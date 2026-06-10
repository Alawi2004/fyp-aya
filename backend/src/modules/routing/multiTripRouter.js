const MAX_TRANSFERS = 3;
const MAX_TRANSPORT_LEGS = MAX_TRANSFERS + 1;
const DEFAULT_WALKING_RADIUS_M = 650;
const MIN_TRANSFER_MIN = 3;
const WALKING_SPEED_M_PER_MIN = 75;
const MAX_SEARCH_STATES = 8000;
const DEFAULT_FARES = {
  bus: 125000,
  van: 150000,
  walk: 0,
};
const DEFAULT_MIN_PER_STOP = {
  bus: 3,
  van: 2.5,
  shuttle: 3,
  car: 2.5,
};

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clean = (value) => (value === null || value === undefined ? "" : String(value).trim());

const normalizeVehicleType = (value, routeName = "") => {
  const text = `${value || ""} ${routeName || ""}`.toLowerCase();
  if (text.includes("van")) return "van";
  return "bus";
};

const lineCodeForRoute = (route) => {
  const explicit = clean(route.route_code || route.line_code || route.code);
  if (explicit) return explicit;

  const name = clean(route.route_name);
  const firstToken = name.split(/\s+/)[0];
  return firstToken || `R${route.route_id}`;
};

const haversineMeters = (a, b) => {
  if (!a || !b || a.latitude === null || a.longitude === null || b.latitude === null || b.longitude === null) {
    return null;
  }

  const earthRadius = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(h));
};

const estimateRideMinutes = (routeType, stops) => {
  const perStop = DEFAULT_MIN_PER_STOP[routeType] || DEFAULT_MIN_PER_STOP.bus;
  return Math.max(2, Math.ceil(stops * perStop));
};

const routeFare = (route, type) => {
  const fare = toNumber(route.fare || route.base_fare || route.price);
  return fare !== null ? fare : DEFAULT_FARES[type] || DEFAULT_FARES.bus;
};

const summarizeSegments = (segments) =>
  segments
    .map((segment) => (segment.type === "walk" ? "Walk" : segment.line))
    .filter(Boolean)
    .join(" -> ");

const loadRouteGraph = (rows) => {
  const routes = new Map();
  const stops = new Map();
  const routeStopIndex = new Map();

  for (const row of rows) {
    const routeId = Number(row.route_id);
    const stopId = Number(row.stop_id);
    if (!routeId || !stopId) continue;

    if (!routes.has(routeId)) {
      const type = normalizeVehicleType(row.vehicle_type || row.route_type, row.route_name);
      routes.set(routeId, {
        route_id: routeId,
        route_name: clean(row.route_name),
        start_location: clean(row.start_location),
        end_location: clean(row.end_location),
        route_code: row.route_code,
        line_code: row.line_code,
        route_type: type,
        fare: row.fare,
        base_fare: row.base_fare,
        price: row.price,
        trip_id: row.trip_id ?? null,
        stops: [],
      });
    }

    const stop = {
      stop_id: stopId,
      stop_name: clean(row.stop_name),
      latitude: toNumber(row.latitude),
      longitude: toNumber(row.longitude),
    };
    stops.set(stopId, stop);

    const route = routes.get(routeId);
    route.stops.push({
      ...stop,
      stop_order: Number(row.stop_order || route.stops.length + 1),
    });
  }

  for (const route of routes.values()) {
    route.stops.sort((a, b) => a.stop_order - b.stop_order);
    route.stops.forEach((stop, index) => {
      routeStopIndex.set(`${route.route_id}:${stop.stop_id}`, index);
    });
  }

  return { routes: [...routes.values()], stops, routeStopIndex };
};

const makeRideSegment = (route, fromStop, toStop, fromIndex, toIndex, transferMinutes = 0) => {
  const type = route.route_type || "bus";
  const stopCount = Math.max(1, toIndex - fromIndex);
  const segment = {
    type,
    line: lineCodeForRoute(route),
    route_id: route.route_id,
    trip_id: route.trip_id ?? null,
    route_name: route.route_name,
    from: fromStop.stop_name,
    to: toStop.stop_name,
    from_stop_id: fromStop.stop_id,
    to_stop_id: toStop.stop_id,
    stops: stopCount,
    estimated_time_min: estimateRideMinutes(type, stopCount),
    price: routeFare(route, type),
    boarding_instruction: `Board ${lineCodeForRoute(route)} at ${fromStop.stop_name}.`,
    dropoff_instruction: `Get off at ${toStop.stop_name}.`,
  };

  if (transferMinutes > 0) {
    segment.transfer_from_previous_min = transferMinutes;
  }

  return segment;
};

const makeWalkSegment = (fromStop, toStop, distanceM, reason = "transfer") => {
  const roundedDistance = Math.max(1, Math.round(distanceM || 0));
  return {
    type: "walk",
    from: fromStop.stop_name,
    to: toStop.stop_name,
    from_stop_id: fromStop.stop_id,
    to_stop_id: toStop.stop_id,
    estimated_time_min: Math.max(1, Math.ceil(roundedDistance / WALKING_SPEED_M_PER_MIN)),
    distance_m: roundedDistance,
    price: 0,
    transfer_reason: reason,
    directions_available: true,
  };
};

const directRoutes = (graph, startId, endId) => {
  const matches = [];

  for (const route of graph.routes) {
    const fromIndex = graph.routeStopIndex.get(`${route.route_id}:${startId}`);
    const toIndex = graph.routeStopIndex.get(`${route.route_id}:${endId}`);
    if (fromIndex === undefined || toIndex === undefined || fromIndex >= toIndex) continue;

    matches.push({
      route_type: "direct",
      mode: "fastest",
      segments: [
        makeRideSegment(route, route.stops[fromIndex], route.stops[toIndex], fromIndex, toIndex),
      ],
    });
  }

  return matches;
};

const buildWalkingConnections = (stops, radiusM = DEFAULT_WALKING_RADIUS_M) => {
  const stopList = [...stops.values()];
  const connections = new Map();

  for (let i = 0; i < stopList.length; i += 1) {
    for (let j = i + 1; j < stopList.length; j += 1) {
      const distance = haversineMeters(stopList[i], stopList[j]);
      if (distance === null || distance > radiusM) continue;

      if (!connections.has(stopList[i].stop_id)) connections.set(stopList[i].stop_id, []);
      if (!connections.has(stopList[j].stop_id)) connections.set(stopList[j].stop_id, []);
      connections.get(stopList[i].stop_id).push({ stop: stopList[j], distance });
      connections.get(stopList[j].stop_id).push({ stop: stopList[i], distance });
    }
  }

  return connections;
};

const hasRepeatedTransportRoute = (segments, routeId) =>
  segments.some((segment) => segment.type !== "walk" && segment.route_id === routeId);

const rideOptionsFromStop = (graph, stopId, currentSegments) => {
  const options = [];

  for (const route of graph.routes) {
    if (hasRepeatedTransportRoute(currentSegments, route.route_id)) continue;

    const fromIndex = graph.routeStopIndex.get(`${route.route_id}:${stopId}`);
    if (fromIndex === undefined) continue;

    for (let toIndex = fromIndex + 1; toIndex < route.stops.length; toIndex += 1) {
      options.push({
        route,
        fromIndex,
        toIndex,
        toStop: route.stops[toIndex],
      });
    }
  }

  return options;
};

const totalsForSegments = (segments) => {
  const totalDuration = segments.reduce((sum, segment) => {
    const transfer = segment.transfer_from_previous_min || 0;
    return sum + (segment.estimated_time_min || 0) + transfer;
  }, 0);

  const transportSegments = segments.filter((segment) => segment.type !== "walk");
  const walkingSegments = segments.filter((segment) => segment.type === "walk");

  return {
    total_price: segments.reduce((sum, segment) => sum + (segment.price || 0), 0),
    total_duration_min: totalDuration,
    total_transfers: Math.max(0, transportSegments.length - 1),
    walking_time_min: walkingSegments.reduce((sum, segment) => sum + (segment.estimated_time_min || 0), 0),
  };
};

const validateJourney = (segments, startId, endId) => {
  if (!segments.length) return false;
  if (segments[0].from_stop_id !== startId) return false;
  if (segments[segments.length - 1].to_stop_id !== endId) return false;

  const transportLegs = segments.filter((segment) => segment.type !== "walk");
  if (Math.max(0, transportLegs.length - 1) > MAX_TRANSFERS) return false;

  for (let i = 1; i < segments.length; i += 1) {
    if (segments[i - 1].to_stop_id !== segments[i].from_stop_id) return false;
  }

  const visitedStops = new Set();
  for (const segment of segments) {
    if (visitedStops.has(segment.to_stop_id) && segment.to_stop_id !== endId) return false;
    visitedStops.add(segment.from_stop_id);
  }

  return true;
};

const scoreJourney = (journey, mode) => {
  const { total_duration_min, total_price, total_transfers, walking_time_min } = journey;

  if (mode === "easiest") {
    return total_transfers * 1000 + walking_time_min * 8 + total_duration_min * 3 + total_price / 10000;
  }

  if (mode === "cheapest") {
    return total_price / 1000 + total_transfers * 80 + walking_time_min * 4 + total_duration_min;
  }

  return total_duration_min * 10 + total_transfers * 90 + walking_time_min * 6 + total_price / 20000;
};

const buildJourney = (segments, mode, routeType = "multi_step") => {
  const totals = totalsForSegments(segments);
  return {
    route_type: routeType,
    mode,
    ...totals,
    summary: summarizeSegments(segments),
    segments,
    realtime_ready: true,
  };
};

export const findMultiTripRoutes = (rows, startIdRaw, endIdRaw, mode = "fastest", options = {}) => {
  const startId = Number(startIdRaw);
  const endId = Number(endIdRaw);
  if (!startId || !endId || startId === endId) {
    return { primary: null, alternatives: [], reason: "Invalid start or end stop." };
  }

  const graph = loadRouteGraph(rows);
  if (!graph.stops.has(startId) || !graph.stops.has(endId)) {
    return { primary: null, alternatives: [], reason: "Start or end stop was not found in route data." };
  }

  const direct = directRoutes(graph, startId, endId)
    .map((journey) => buildJourney(journey.segments, mode, "direct"))
    .sort((a, b) => scoreJourney(a, mode) - scoreJourney(b, mode));

  if (direct.length && !options.includeAlternatives) {
    return { primary: direct[0], alternatives: direct.slice(1, 4), direct_available: true };
  }

  const walkingConnections = buildWalkingConnections(graph.stops, options.walkingRadiusM);
  const found = [];
  const queue = [
    {
      stopId: startId,
      segments: [],
      transportLegs: 0,
      visitedStops: new Set([startId]),
    },
  ];
  let exploredStates = 0;

  while (queue.length) {
    const state = queue.shift();
    exploredStates += 1;
    if (exploredStates > MAX_SEARCH_STATES) break;
    if (state.transportLegs > MAX_TRANSPORT_LEGS) continue;

    if (state.stopId === endId && state.segments.length) {
      if (validateJourney(state.segments, startId, endId)) {
        found.push(buildJourney(state.segments, mode, "multi_step"));
      }
      continue;
    }

    const walkingOptions = walkingConnections.get(state.stopId) || [];
    for (const connection of walkingOptions) {
      const isDestinationWalk = connection.stop.stop_id === endId;
      const hasTransportBefore = state.segments.some((segment) => segment.type !== "walk");
      if (!isDestinationWalk && !hasTransportBefore) continue;
      if (!isDestinationWalk && state.visitedStops.has(connection.stop.stop_id)) continue;

      const fromStop = graph.stops.get(state.stopId);
      const walkSegment = makeWalkSegment(fromStop, connection.stop, connection.distance, isDestinationWalk ? "final" : "transfer");
      const nextVisited = new Set(state.visitedStops);
      nextVisited.add(connection.stop.stop_id);
      queue.push({
        stopId: connection.stop.stop_id,
        segments: [...state.segments, walkSegment],
        transportLegs: state.transportLegs,
        visitedStops: nextVisited,
      });
    }

    if (state.transportLegs >= MAX_TRANSPORT_LEGS) continue;

    const optionsFromStop = rideOptionsFromStop(graph, state.stopId, state.segments);
    for (const option of optionsFromStop) {
      if (state.visitedStops.has(option.toStop.stop_id) && option.toStop.stop_id !== endId) continue;

      const previous = state.segments[state.segments.length - 1];
      const transferMinutes = previous && previous.type !== "walk" ? MIN_TRANSFER_MIN : 0;
      const fromStop = option.route.stops[option.fromIndex];
      const segment = makeRideSegment(
        option.route,
        fromStop,
        option.toStop,
        option.fromIndex,
        option.toIndex,
        transferMinutes
      );

      const nextVisited = new Set(state.visitedStops);
      nextVisited.add(option.toStop.stop_id);
      queue.push({
        stopId: option.toStop.stop_id,
        segments: [...state.segments, segment],
        transportLegs: state.transportLegs + 1,
        visitedStops: nextVisited,
      });
    }
  }

  const unique = new Map();
  for (const journey of [...direct, ...found]) {
    const key = journey.segments
      .map((segment) => `${segment.type}:${segment.route_id || "walk"}:${segment.from_stop_id}-${segment.to_stop_id}`)
      .join("|");
    if (!unique.has(key)) unique.set(key, journey);
  }

  const ranked = [...unique.values()]
    .filter((journey) => validateJourney(journey.segments, startId, endId))
    .sort((a, b) => {
      const diff = scoreJourney(a, mode) - scoreJourney(b, mode);
      if (diff !== 0) return diff;
      if (a.total_transfers !== b.total_transfers) return a.total_transfers - b.total_transfers;
      return a.total_price - b.total_price;
    });

  if (direct.length) {
    const directKey = direct[0].segments
      .map((segment) => `${segment.type}:${segment.route_id || "walk"}:${segment.from_stop_id}-${segment.to_stop_id}`)
      .join("|");
    const alternativePool = ranked.filter((journey) => {
      const key = journey.segments
        .map((segment) => `${segment.type}:${segment.route_id || "walk"}:${segment.from_stop_id}-${segment.to_stop_id}`)
        .join("|");
      return key !== directKey;
    });

    return {
      primary: direct[0],
      alternatives: alternativePool.slice(0, 3),
      direct_available: true,
      reason: null,
    };
  }

  return {
    primary: ranked[0] || null,
    alternatives: ranked.slice(1, 4),
    direct_available: direct.length > 0,
    reason: ranked.length ? null : "No connected trip was found within 3 transfers.",
  };
};
