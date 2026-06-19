-- Migration 013: Bekaa Valley detailed expansion
-- Adds Saadnayel, Taalabaya, Bar Elias, Kherbet Qanafar, Yohmor,
-- Labweh, Hermel, Deir el Ahmar + 3 Bekaa routes.
-- Safe to re-run.
SET NOCOUNT ON;
PRINT '=== Migration 013: Bekaa Valley Expansion ===';
GO

-- ─────────────────────────────────────────────────────────────
-- 1. NEW STOPS
-- ─────────────────────────────────────────────────────────────
PRINT '1. Bekaa stops...';
MERGE stops AS t
USING (VALUES
  -- Central Bekaa — Chtaura-to-Zahle corridor
  ('Bar Elias Center',        33.742000, 36.016000),   -- SE of Chtaura on Damascus highway
  ('Kherbet Qanafar',         33.800000, 35.915000),   -- between Chtaura and Zahle
  ('Saadnayel Center',        33.838500, 35.983000),   -- NE of Zahle town
  ('Taalabaya Junction',      33.862000, 36.052000),   -- Zahle → Baalbek road
  -- North Bekaa — Baalbek to Hermel
  ('Deir el Ahmar Center',    34.055000, 36.094000),   -- west of Baalbek
  ('Yohmor Junction',         34.090000, 36.148000),   -- north Bekaa highway
  ('Labweh Junction',         34.131000, 36.346000),   -- between Baalbek and Hermel
  ('Hermel Center',           34.394800, 36.385300)    -- far north Bekaa
) AS s(stop_name, latitude, longitude)
ON  t.stop_name = s.stop_name AND t.is_deleted = 0
WHEN NOT MATCHED THEN
  INSERT (stop_name, latitude, longitude, is_deleted)
  VALUES (s.stop_name, s.latitude, s.longitude, 0)
WHEN MATCHED THEN UPDATE SET
  t.latitude  = s.latitude,
  t.longitude = s.longitude;

PRINT '  Done.';
GO

-- ─────────────────────────────────────────────────────────────
-- 2. NEW ROUTES
-- ─────────────────────────────────────────────────────────────
PRINT '2. Bekaa routes...';
MERGE routes AS t
USING (VALUES
  ('Route 11 - Zahle to Hermel',         'Zahle Bus Station',    'Hermel Center'),
  ('Route 12 - Chtaura Valley Circuit',  'Chtaura Junction',     'Zahle Bus Station'),
  ('Route 13 - Baalbek to Hermel Local', 'Baalbek Terminal',     'Hermel Center')
) AS s(route_name, start_location, end_location)
ON  t.route_name = s.route_name AND t.is_deleted = 0
WHEN NOT MATCHED THEN
  INSERT (route_name, start_location, end_location, is_deleted)
  VALUES (s.route_name, s.start_location, s.end_location, 0)
WHEN MATCHED THEN UPDATE SET
  t.start_location = s.start_location,
  t.end_location   = s.end_location;

PRINT '  Done.';
GO

-- ─────────────────────────────────────────────────────────────
-- 3. ROUTE-STOP MAPPINGS
-- ─────────────────────────────────────────────────────────────
PRINT '3. Route-stop mappings...';
INSERT INTO route_stops (route_id, stop_id, stop_order)
SELECT r.route_id, s.stop_id, m.stop_order
FROM (VALUES
  -- Route 11: Zahle → Taalabaya → Baalbek → Deir el Ahmar → Yohmor → Labweh → Hermel
  ('Route 11 - Zahle to Hermel',        'Zahle Bus Station',    1),
  ('Route 11 - Zahle to Hermel',        'Saadnayel Center',     2),
  ('Route 11 - Zahle to Hermel',        'Taalabaya Junction',   3),
  ('Route 11 - Zahle to Hermel',        'Baalbek Terminal',     4),
  ('Route 11 - Zahle to Hermel',        'Deir el Ahmar Center', 5),
  ('Route 11 - Zahle to Hermel',        'Yohmor Junction',      6),
  ('Route 11 - Zahle to Hermel',        'Labweh Junction',      7),
  ('Route 11 - Zahle to Hermel',        'Hermel Center',        8),
  -- Route 12: Chtaura circuit — Chtaura → Bar Elias → Kherbet Qanafar → Saadnayel → Zahle
  ('Route 12 - Chtaura Valley Circuit', 'Chtaura Junction',     1),
  ('Route 12 - Chtaura Valley Circuit', 'Bar Elias Center',     2),
  ('Route 12 - Chtaura Valley Circuit', 'Kherbet Qanafar',      3),
  ('Route 12 - Chtaura Valley Circuit', 'Saadnayel Center',     4),
  ('Route 12 - Chtaura Valley Circuit', 'Zahle Bus Station',    5),
  -- Route 13: Baalbek → Deir el Ahmar → Yohmor → Labweh → Hermel
  ('Route 13 - Baalbek to Hermel Local','Baalbek Terminal',     1),
  ('Route 13 - Baalbek to Hermel Local','Deir el Ahmar Center', 2),
  ('Route 13 - Baalbek to Hermel Local','Yohmor Junction',      3),
  ('Route 13 - Baalbek to Hermel Local','Labweh Junction',      4),
  ('Route 13 - Baalbek to Hermel Local','Hermel Center',        5)
) AS m(route_name, stop_name, stop_order)
JOIN routes r ON r.route_name = m.route_name AND r.is_deleted = 0
JOIN stops  s ON s.stop_name  = m.stop_name  AND s.is_deleted = 0
WHERE NOT EXISTS (
  SELECT 1 FROM route_stops rs
  WHERE rs.route_id = r.route_id AND rs.stop_id = s.stop_id
);

PRINT '  Done.';
GO

-- ─────────────────────────────────────────────────────────────
-- 4. WAYPOINTS
-- ─────────────────────────────────────────────────────────────
PRINT '4. Waypoints...';
INSERT INTO route_waypoints (route_id, latitude, longitude, wp_order)
SELECT r.route_id, m.latitude, m.longitude, m.wp_order
FROM (VALUES
  -- Route 11: Zahle → Hermel (~80 km, north on the Bekaa plain)
  ('Route 11 - Zahle to Hermel', 33.847400, 35.901800,  1),  -- Zahle Bus Station
  ('Route 11 - Zahle to Hermel', 33.838500, 35.983000,  2),  -- Saadnayel
  ('Route 11 - Zahle to Hermel', 33.862000, 36.052000,  3),  -- Taalabaya
  ('Route 11 - Zahle to Hermel', 33.900000, 36.100000,  4),  -- Qaraaoun road junction
  ('Route 11 - Zahle to Hermel', 33.950000, 36.150000,  5),  -- Lala
  ('Route 11 - Zahle to Hermel', 34.003800, 36.209500,  6),  -- Baalbek Terminal
  ('Route 11 - Zahle to Hermel', 34.055000, 36.094000,  7),  -- Deir el Ahmar
  ('Route 11 - Zahle to Hermel', 34.090000, 36.148000,  8),  -- Yohmor
  ('Route 11 - Zahle to Hermel', 34.131000, 36.346000,  9),  -- Labweh
  ('Route 11 - Zahle to Hermel', 34.230000, 36.375000, 10),  -- Tufail area
  ('Route 11 - Zahle to Hermel', 34.394800, 36.385300, 11),  -- Hermel Center

  -- Route 12: Chtaura circuit (~30 km, local Bekaa loop)
  ('Route 12 - Chtaura Valley Circuit', 33.766000, 35.878300, 1),  -- Chtaura
  ('Route 12 - Chtaura Valley Circuit', 33.753000, 35.950000, 2),  -- heading SE on Damascus road
  ('Route 12 - Chtaura Valley Circuit', 33.742000, 36.016000, 3),  -- Bar Elias
  ('Route 12 - Chtaura Valley Circuit', 33.760000, 35.970000, 4),  -- looping back north
  ('Route 12 - Chtaura Valley Circuit', 33.800000, 35.915000, 5),  -- Kherbet Qanafar
  ('Route 12 - Chtaura Valley Circuit', 33.819000, 35.950000, 6),  -- heading north
  ('Route 12 - Chtaura Valley Circuit', 33.838500, 35.983000, 7),  -- Saadnayel
  ('Route 12 - Chtaura Valley Circuit', 33.843000, 35.942000, 8),  -- approaching Zahle
  ('Route 12 - Chtaura Valley Circuit', 33.847400, 35.901800, 9),  -- Zahle Bus Station

  -- Route 13: Baalbek → Hermel local (~40 km, north Bekaa)
  ('Route 13 - Baalbek to Hermel Local', 34.003800, 36.209500, 1),  -- Baalbek
  ('Route 13 - Baalbek to Hermel Local', 34.040000, 36.156000, 2),  -- heading NW
  ('Route 13 - Baalbek to Hermel Local', 34.055000, 36.094000, 3),  -- Deir el Ahmar
  ('Route 13 - Baalbek to Hermel Local', 34.073000, 36.121000, 4),  -- rejoining highway
  ('Route 13 - Baalbek to Hermel Local', 34.090000, 36.148000, 5),  -- Yohmor
  ('Route 13 - Baalbek to Hermel Local', 34.110000, 36.247000, 6),
  ('Route 13 - Baalbek to Hermel Local', 34.131000, 36.346000, 7),  -- Labweh
  ('Route 13 - Baalbek to Hermel Local', 34.260000, 36.372000, 8),
  ('Route 13 - Baalbek to Hermel Local', 34.394800, 36.385300, 9)   -- Hermel
) AS m(route_name, latitude, longitude, wp_order)
JOIN routes r ON r.route_name = m.route_name AND r.is_deleted = 0
WHERE NOT EXISTS (
  SELECT 1 FROM route_waypoints w
  WHERE w.route_id = r.route_id AND w.wp_order = m.wp_order
);

PRINT '  Done.';
GO

-- ─────────────────────────────────────────────────────────────
-- 5. STOP AMENITIES
-- ─────────────────────────────────────────────────────────────
PRINT '5. Stop amenities...';
INSERT INTO stop_amenities
  (stop_id, has_shelter, has_seating, has_lighting, has_wheelchair, has_ticket_machine, has_wifi, nearby_landmark)
SELECT s.stop_id,
       m.has_shelter, m.has_seating, m.has_lighting,
       m.has_wheelchair, m.has_ticket_machine, m.has_wifi, m.nearby_landmark
FROM (VALUES
  ('Bar Elias Center',        1, 1, 1, 0, 0, 0, 'Bar Elias Municipality'),
  ('Kherbet Qanafar',         0, 0, 1, 0, 0, 0, 'Kherbet Qanafar Roundabout'),
  ('Saadnayel Center',        1, 1, 1, 0, 0, 0, 'Saadnayel Municipality'),
  ('Taalabaya Junction',      1, 0, 1, 0, 0, 0, 'Taalabaya Highway Junction'),
  ('Deir el Ahmar Center',    1, 1, 1, 0, 0, 0, 'Deir el Ahmar Town Square'),
  ('Yohmor Junction',         0, 0, 1, 0, 0, 0, 'Yohmor Road Junction'),
  ('Labweh Junction',         1, 0, 1, 0, 0, 0, 'Labweh Crossroads'),
  ('Hermel Center',           1, 1, 1, 1, 0, 0, 'Hermel Pyramid Monument')
) AS m(stop_name,
       has_shelter, has_seating, has_lighting,
       has_wheelchair, has_ticket_machine, has_wifi, nearby_landmark)
JOIN stops s ON s.stop_name = m.stop_name AND s.is_deleted = 0
WHERE NOT EXISTS (
  SELECT 1 FROM stop_amenities sa WHERE sa.stop_id = s.stop_id
);

PRINT '  Done.';
GO

PRINT '=== Migration 013 complete: 8 Bekaa stops, 3 routes, waypoints and amenities added ===';
GO
