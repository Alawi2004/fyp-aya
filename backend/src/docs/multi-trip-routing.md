# Multi-Step Trip Routing

## Architecture

The routing system is split into three layers:

1. `GET /api/routes/multi-trip` validates the request and loads route data from SQL Server.
2. `modules/routing/multiTripRouter.js` builds an in-memory graph from `routes`, `route_stops`, `stops`, `trips`, and `vehicles`.
3. The passenger app can render the response with `MultiTripBottomSheet`.

The engine is deterministic: the same stop pair, data, and ranking mode return the same primary route and alternatives.

## Endpoint

```http
GET /api/routes/multi-trip?start_id=11&end_id=88&mode=fastest&alternatives=true
```

Supported modes:

- `fastest`
- `easiest`
- `cheapest`

## Algorithm

1. Load all ordered route stops.
2. Build route objects and stop objects.
3. Check direct route first by finding any route where `start_id` and `end_id` both appear and `start_order < end_order`.
4. If a direct route exists, return it as the primary route.
5. If no direct route exists, search connected journeys with up to four transport legs, which equals three transfers.
6. Add walking transfer edges between stops within 650 meters when coordinates are available.
7. Reject broken journeys where adjacent segments do not connect, a stop loops unnecessarily, or transfer count exceeds three.
8. Rank candidates according to the requested mode.

## Ranking

`fastest` prioritizes total duration, then transfers, walking time, and fare.

`easiest` heavily penalizes transfers, then walking time, duration, and fare.

`cheapest` prioritizes total fare, then transfers, walking time, and duration.

## Segment Contract

Transport segments include:

- `type`: `bus` or `van`
- `line`
- `route_id`
- `route_name`
- `from`, `to`
- `from_stop_id`, `to_stop_id`
- `stops`
- `estimated_time_min`
- `price`
- `boarding_instruction`
- `dropoff_instruction`
- optional `transfer_from_previous_min`

Walking segments include:

- `type: "walk"`
- `from`, `to`
- `from_stop_id`, `to_stop_id`
- `estimated_time_min`
- `distance_m`
- `directions_available`

## Response Example

```json
{
  "route_type": "multi_step",
  "mode": "fastest",
  "total_price": 400000,
  "total_duration_min": 52,
  "total_transfers": 2,
  "walking_time_min": 8,
  "summary": "ML1 -> B1 -> B2 -> Walk",
  "segments": [
    {
      "type": "bus",
      "line": "ML1",
      "route_name": "Chtaura -> Adliyeh Roundabout",
      "from": "Chtaura",
      "to": "Adliyeh Roundabout",
      "from_stop_id": 11,
      "to_stop_id": 48,
      "stops": 13,
      "estimated_time_min": 20,
      "price": 150000,
      "boarding_instruction": "Board ML1 at Chtaura.",
      "dropoff_instruction": "Get off at Adliyeh Roundabout."
    }
  ],
  "alternatives": []
}
```

## Optional Helper Tables

The current engine works without new tables. For a stronger real-world model, add these later:

```sql
CREATE TABLE fare_rules (
  fare_rule_id INT IDENTITY(1,1) PRIMARY KEY,
  route_id INT NOT NULL FOREIGN KEY REFERENCES routes(route_id),
  fare_amount INT NOT NULL,
  currency VARCHAR(10) DEFAULT 'LBP',
  active BIT DEFAULT 1
);

CREATE TABLE nearby_stops (
  from_stop_id INT NOT NULL FOREIGN KEY REFERENCES stops(stop_id),
  to_stop_id INT NOT NULL FOREIGN KEY REFERENCES stops(stop_id),
  distance_m INT NOT NULL,
  walking_time_min INT NOT NULL,
  active BIT DEFAULT 1,
  PRIMARY KEY (from_stop_id, to_stop_id)
);

CREATE TABLE service_alerts (
  alert_id INT IDENTITY(1,1) PRIMARY KEY,
  route_id INT NULL FOREIGN KEY REFERENCES routes(route_id),
  stop_id INT NULL FOREIGN KEY REFERENCES stops(stop_id),
  severity VARCHAR(20) NOT NULL,
  message VARCHAR(255) NOT NULL,
  active BIT DEFAULT 1,
  created_at DATETIME DEFAULT GETDATE()
);
```

## UI Structure

Use `frontend/src/components/passenger/MultiTripBottomSheet.js` for the passenger details view.

The sheet contains:

- Summary: route chain, mode badge, total price, duration, transfers, walking time.
- Ranking tabs: fastest, easiest, cheapest.
- Vertical timeline: icon per segment with active segment highlight.
- Expandable cards: boarding, drop-off, stops, fare, transfer time, walking distance, and directions button.

## Validation Rules

- Maximum three transfers.
- Segment `to_stop_id` must match the next segment `from_stop_id`.
- Direct trips remain preferred when available.
- Stops must belong to the route in the correct order.
- Repeated route switching is blocked.
- Repeated stops are rejected unless the repeated stop is the final destination.
- Walking transfers require nearby stops with valid coordinates.
- Cancelled trips are ignored when selecting vehicle type.

## Real-Time Extension

The response includes stable `route_id`, `from_stop_id`, and `to_stop_id` values, so ETA can be added later by joining:

- `trips`
- `gps_logs`
- `eta_predictions`
- `passenger_counts`
- `service_alerts`

Recommended future fields per segment:

- `eta_min`
- `vehicle_id`
- `trip_id`
- `crowd_level`
- `service_alert`
- `is_current_segment`
