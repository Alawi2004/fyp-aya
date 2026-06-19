-- Migration 012: Lebanon-wide stops, routes, and waypoints expansion
-- Adds 6 new inter-city routes covering North Lebanon, South Lebanon,
-- the Bekaa Valley, and the Chouf/Mountain regions.
-- Safe to re-run: all inserts use MERGE or WHERE NOT EXISTS.
SET NOCOUNT ON;
PRINT '=== Migration 012: Lebanon Stops Expansion ===';
GO

-- ─────────────────────────────────────────────────────────────
-- STOPS — 16 new stops across all Lebanese regions
-- ─────────────────────────────────────────────────────────────
PRINT '1. New stops across Lebanon...';
MERGE stops AS t
USING (VALUES
  -- North Lebanon — coastal highway
  ('Dbayeh Junction',           33.945200, 35.584700),
  ('Jbeil (Byblos) Bus Stop',   34.120400, 35.647900),
  ('Batroun Town Center',        34.251300, 35.659000),
  ('Chekka Junction',            34.328300, 35.708300),
  ('Tripoli Bus Station',        34.436600, 35.849700),
  ('El Mina Terminal',           34.454800, 35.819000),
  -- South Lebanon — coastal highway
  ('Khalde Junction',            33.798000, 35.482000),
  ('Damour Center',              33.740700, 35.456200),
  ('Sidon Terminal',             33.561500, 35.371100),
  ('Nabatieh Bus Station',       33.378100, 35.483700),
  ('Tyre Terminal',              33.270400, 35.203100),
  -- Bekaa Valley
  ('Sofar Junction',             33.784000, 35.714000),
  ('Chtaura Junction',           33.766000, 35.878300),
  ('Zahle Bus Station',          33.847400, 35.901800),
  ('Baalbek Terminal',           34.003800, 36.209500),
  -- Chouf / Mountain
  ('Aley Town Center',           33.812200, 35.599400),
  ('Beiteddine Palace Stop',     33.682000, 35.572300)
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
-- ROUTES — 6 new inter-city routes
-- ─────────────────────────────────────────────────────────────
PRINT '2. New routes...';
MERGE routes AS t
USING (VALUES
  ('Route 5 - Beirut to Tripoli',       'Dora Terminal',           'Tripoli Bus Station'),
  ('Route 6 - Beirut to Tyre',          'Beirut Airport Terminal', 'Tyre Terminal'),
  ('Route 7 - Beirut to Baalbek',       'Downtown Beirut',         'Baalbek Terminal'),
  ('Route 8 - Chouf Mountain Route',    'Mar Elias',               'Beiteddine Palace Stop'),
  ('Route 9 - Tripoli to Batroun',      'Tripoli Bus Station',     'Batroun Town Center'),
  ('Route 10 - Sidon to Tyre',          'Sidon Terminal',          'Tyre Terminal')
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
-- ROUTE_STOPS — ordered stop sequences for each new route
-- ─────────────────────────────────────────────────────────────
PRINT '3. Route-stop mappings...';
INSERT INTO route_stops (route_id, stop_id, stop_order)
SELECT r.route_id, s.stop_id, m.stop_order
FROM (VALUES
  -- Route 5: Beirut → Tripoli (coastal highway north)
  ('Route 5 - Beirut to Tripoli', 'Dora Terminal',             1),
  ('Route 5 - Beirut to Tripoli', 'Dbayeh Junction',           2),
  ('Route 5 - Beirut to Tripoli', 'Jounieh Waterfront',        3),
  ('Route 5 - Beirut to Tripoli', 'Jbeil (Byblos) Bus Stop',  4),
  ('Route 5 - Beirut to Tripoli', 'Batroun Town Center',       5),
  ('Route 5 - Beirut to Tripoli', 'Chekka Junction',           6),
  ('Route 5 - Beirut to Tripoli', 'Tripoli Bus Station',       7),
  -- Route 6: Beirut → Tyre (south coastal highway)
  ('Route 6 - Beirut to Tyre',    'Beirut Airport Terminal',   1),
  ('Route 6 - Beirut to Tyre',    'Khalde Junction',           2),
  ('Route 6 - Beirut to Tyre',    'Damour Center',             3),
  ('Route 6 - Beirut to Tyre',    'Sidon Terminal',            4),
  ('Route 6 - Beirut to Tyre',    'Nabatieh Bus Station',      5),
  ('Route 6 - Beirut to Tyre',    'Tyre Terminal',             6),
  -- Route 7: Beirut → Baalbek (mountain pass → Bekaa)
  ('Route 7 - Beirut to Baalbek', 'Downtown Beirut',           1),
  ('Route 7 - Beirut to Baalbek', 'Ashrafieh Center',          2),
  ('Route 7 - Beirut to Baalbek', 'Sofar Junction',            3),
  ('Route 7 - Beirut to Baalbek', 'Chtaura Junction',          4),
  ('Route 7 - Beirut to Baalbek', 'Zahle Bus Station',         5),
  ('Route 7 - Beirut to Baalbek', 'Baalbek Terminal',          6),
  -- Route 8: Mountain / Chouf route
  ('Route 8 - Chouf Mountain Route', 'Mar Elias',              1),
  ('Route 8 - Chouf Mountain Route', 'Aley Town Center',       2),
  ('Route 8 - Chouf Mountain Route', 'Beiteddine Palace Stop', 3),
  -- Route 9: Tripoli ↔ Batroun local
  ('Route 9 - Tripoli to Batroun', 'Tripoli Bus Station',      1),
  ('Route 9 - Tripoli to Batroun', 'El Mina Terminal',         2),
  ('Route 9 - Tripoli to Batroun', 'Chekka Junction',          3),
  ('Route 9 - Tripoli to Batroun', 'Batroun Town Center',      4),
  -- Route 10: Sidon ↔ Tyre local
  ('Route 10 - Sidon to Tyre',     'Sidon Terminal',           1),
  ('Route 10 - Sidon to Tyre',     'Nabatieh Bus Station',     2),
  ('Route 10 - Sidon to Tyre',     'Tyre Terminal',            3)
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
-- ROUTE WAYPOINTS — GPS path for each new route
-- ─────────────────────────────────────────────────────────────
PRINT '4. Route waypoints...';
INSERT INTO route_waypoints (route_id, latitude, longitude, wp_order)
SELECT r.route_id, m.latitude, m.longitude, m.wp_order
FROM (VALUES
  -- Route 5: Beirut → Tripoli (coastal highway, ~85 km)
  ('Route 5 - Beirut to Tripoli', 33.905180, 35.555900,  1),  -- Dora Terminal
  ('Route 5 - Beirut to Tripoli', 33.918000, 35.565000,  2),  -- Antelias
  ('Route 5 - Beirut to Tripoli', 33.945200, 35.584700,  3),  -- Dbayeh
  ('Route 5 - Beirut to Tripoli', 33.961000, 35.598000,  4),  -- Zouk Mikael
  ('Route 5 - Beirut to Tripoli', 33.981200, 35.616800,  5),  -- Jounieh Waterfront
  ('Route 5 - Beirut to Tripoli', 34.010000, 35.633000,  6),  -- Ghazir
  ('Route 5 - Beirut to Tripoli', 34.070000, 35.641000,  7),  -- Bouar
  ('Route 5 - Beirut to Tripoli', 34.120400, 35.647900,  8),  -- Jbeil
  ('Route 5 - Beirut to Tripoli', 34.170000, 35.659000,  9),  -- Amchit
  ('Route 5 - Beirut to Tripoli', 34.221000, 35.659000, 10),  -- Nahr Ibrahim
  ('Route 5 - Beirut to Tripoli', 34.251300, 35.659000, 11),  -- Batroun
  ('Route 5 - Beirut to Tripoli', 34.291000, 35.680000, 12),  -- Kfarabida
  ('Route 5 - Beirut to Tripoli', 34.328300, 35.708300, 13),  -- Chekka
  ('Route 5 - Beirut to Tripoli', 34.381000, 35.795000, 14),  -- Qalamoun
  ('Route 5 - Beirut to Tripoli', 34.436600, 35.849700, 15),  -- Tripoli Bus Station

  -- Route 6: Beirut → Tyre (south coastal highway, ~90 km)
  ('Route 6 - Beirut to Tyre',    33.820230, 35.490140,  1),  -- Airport
  ('Route 6 - Beirut to Tyre',    33.798000, 35.482000,  2),  -- Khalde
  ('Route 6 - Beirut to Tyre',    33.770000, 35.470000,  3),  -- Naameh
  ('Route 6 - Beirut to Tyre',    33.740700, 35.456200,  4),  -- Damour
  ('Route 6 - Beirut to Tyre',    33.680000, 35.437000,  5),  -- Jieh
  ('Route 6 - Beirut to Tyre',    33.620000, 35.407000,  6),  -- Sarafand
  ('Route 6 - Beirut to Tyre',    33.561500, 35.371100,  7),  -- Sidon Terminal
  ('Route 6 - Beirut to Tyre',    33.470000, 35.410000,  8),  -- Ghaziyeh
  ('Route 6 - Beirut to Tyre',    33.378100, 35.483700,  9),  -- Nabatieh
  ('Route 6 - Beirut to Tyre',    33.330000, 35.370000, 10),  -- Qana
  ('Route 6 - Beirut to Tyre',    33.270400, 35.203100, 11),  -- Tyre Terminal

  -- Route 7: Beirut → Baalbek (mountain pass + Bekaa, ~90 km)
  ('Route 7 - Beirut to Baalbek', 33.883980, 35.507430,  1),  -- Downtown Beirut
  ('Route 7 - Beirut to Baalbek', 33.882130, 35.514600,  2),  -- Ashrafieh
  ('Route 7 - Beirut to Baalbek', 33.857000, 35.543000,  3),  -- Baabda
  ('Route 7 - Beirut to Baalbek', 33.832000, 35.582000,  4),  -- Yarzeh plateau
  ('Route 7 - Beirut to Baalbek', 33.810000, 35.640000,  5),  -- Bhamdoun
  ('Route 7 - Beirut to Baalbek', 33.784000, 35.714000,  6),  -- Sofar Junction
  ('Route 7 - Beirut to Baalbek', 33.780000, 35.796000,  7),  -- Dahr el Baydar (pass)
  ('Route 7 - Beirut to Baalbek', 33.766000, 35.878300,  8),  -- Chtaura Junction
  ('Route 7 - Beirut to Baalbek', 33.847400, 35.901800,  9),  -- Zahle Bus Station
  ('Route 7 - Beirut to Baalbek', 33.900000, 36.000000, 10),  -- Taalabaya
  ('Route 7 - Beirut to Baalbek', 33.950000, 36.100000, 11),  -- Rayak
  ('Route 7 - Beirut to Baalbek', 34.003800, 36.209500, 12),  -- Baalbek Terminal

  -- Route 8: Chouf Mountain (Mar Elias → Aley → Beiteddine, ~40 km)
  ('Route 8 - Chouf Mountain Route', 33.867100, 35.494800, 1),  -- Mar Elias
  ('Route 8 - Chouf Mountain Route', 33.845000, 35.527000, 2),  -- Hazmieh
  ('Route 8 - Chouf Mountain Route', 33.834000, 35.549000, 3),  -- Baabda
  ('Route 8 - Chouf Mountain Route', 33.812200, 35.599400, 4),  -- Aley Town Center
  ('Route 8 - Chouf Mountain Route', 33.790000, 35.590000, 5),  -- Bchamoun
  ('Route 8 - Chouf Mountain Route', 33.750000, 35.583000, 6),  -- Barouk
  ('Route 8 - Chouf Mountain Route', 33.705000, 35.578000, 7),  -- Deir el Qamar area
  ('Route 8 - Chouf Mountain Route', 33.682000, 35.572300, 8),  -- Beiteddine

  -- Route 9: Tripoli → Batroun local (~35 km)
  ('Route 9 - Tripoli to Batroun', 34.436600, 35.849700, 1),  -- Tripoli Bus Station
  ('Route 9 - Tripoli to Batroun', 34.454800, 35.819000, 2),  -- El Mina
  ('Route 9 - Tripoli to Batroun', 34.400000, 35.777000, 3),  -- Qalamoun
  ('Route 9 - Tripoli to Batroun', 34.328300, 35.708300, 4),  -- Chekka
  ('Route 9 - Tripoli to Batroun', 34.290000, 35.680000, 5),  -- Kfarabida
  ('Route 9 - Tripoli to Batroun', 34.251300, 35.659000, 6),  -- Batroun

  -- Route 10: Sidon → Tyre local (~40 km)
  ('Route 10 - Sidon to Tyre',     33.561500, 35.371100, 1),  -- Sidon Terminal
  ('Route 10 - Sidon to Tyre',     33.470000, 35.410000, 2),  -- Ghaziyeh
  ('Route 10 - Sidon to Tyre',     33.420000, 35.450000, 3),  -- Abbasiyeh
  ('Route 10 - Sidon to Tyre',     33.378100, 35.483700, 4),  -- Nabatieh
  ('Route 10 - Sidon to Tyre',     33.320000, 35.370000, 5),  -- Bint Jbeil area
  ('Route 10 - Sidon to Tyre',     33.270400, 35.203100, 6)   -- Tyre Terminal
) AS m(route_name, latitude, longitude, wp_order)
JOIN routes r ON r.route_name = m.route_name AND r.is_deleted = 0
WHERE NOT EXISTS (
  SELECT 1 FROM route_waypoints w
  WHERE w.route_id = r.route_id AND w.wp_order = m.wp_order
);

PRINT '  Done.';
GO

-- ─────────────────────────────────────────────────────────────
-- STOP AMENITIES — for all 17 new stops
-- ─────────────────────────────────────────────────────────────
PRINT '5. Stop amenities...';
INSERT INTO stop_amenities
  (stop_id, has_shelter, has_seating, has_lighting, has_wheelchair, has_ticket_machine, has_wifi, nearby_landmark)
SELECT s.stop_id,
       m.has_shelter, m.has_seating, m.has_lighting,
       m.has_wheelchair, m.has_ticket_machine, m.has_wifi, m.nearby_landmark
FROM (VALUES
  --                              shelt seat light wheelchair ticket wifi  landmark
  ('Dbayeh Junction',             1,    1,    1,    0,         0,     0,   'Dbayeh Highway Interchange'),
  ('Jbeil (Byblos) Bus Stop',     1,    1,    1,    1,         0,     0,   'Byblos Old Harbour'),
  ('Batroun Town Center',         1,    1,    1,    1,         0,     0,   'Batroun Old Wall'),
  ('Chekka Junction',             0,    0,    1,    0,         0,     0,   'Chekka Industrial Zone'),
  ('Tripoli Bus Station',         1,    1,    1,    1,         1,     1,   'Abd al-Hamid Karame Square'),
  ('El Mina Terminal',            1,    1,    1,    0,         0,     0,   'El Mina Fishing Port'),
  ('Khalde Junction',             1,    0,    1,    0,         0,     0,   'Khalde Interchange'),
  ('Damour Center',               1,    1,    1,    0,         0,     0,   'Damour River Bridge'),
  ('Sidon Terminal',              1,    1,    1,    1,         1,     0,   'Sidon Old Souq'),
  ('Nabatieh Bus Station',        1,    1,    1,    1,         0,     0,   'Nabatieh Municipality'),
  ('Tyre Terminal',               1,    1,    1,    1,         1,     0,   'Tyre Roman Hippodrome'),
  ('Sofar Junction',              0,    0,    1,    0,         0,     0,   'Sofar Hotel ruins'),
  ('Chtaura Junction',            1,    1,    1,    0,         0,     0,   'Chtaura Crossroads'),
  ('Zahle Bus Station',           1,    1,    1,    1,         1,     1,   'Zahle Casino du Liban'),
  ('Baalbek Terminal',            1,    1,    1,    1,         1,     0,   'Baalbek Roman Temples'),
  ('Aley Town Center',            1,    1,    1,    0,         0,     0,   'Aley Main Square'),
  ('Beiteddine Palace Stop',      1,    1,    1,    0,         0,     0,   'Beiteddine Palace')
) AS m(stop_name,
       has_shelter, has_seating, has_lighting,
       has_wheelchair, has_ticket_machine, has_wifi, nearby_landmark)
JOIN stops s ON s.stop_name = m.stop_name AND s.is_deleted = 0
WHERE NOT EXISTS (
  SELECT 1 FROM stop_amenities sa WHERE sa.stop_id = s.stop_id
);

PRINT '  Done.';
GO

PRINT '=== Migration 012 complete: 17 stops, 6 routes, waypoints and amenities added ===';
GO
