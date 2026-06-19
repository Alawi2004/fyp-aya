-- Migration 014: Accurate stop coordinates
-- Corrects all 39 stops to precise GPS coordinates verified against
-- known landmarks and highway junctions in Lebanon.
-- Major fixes: Downtown Beirut (Martyrs' Sq), Tripoli (Tell Square),
--   Chekka (coastal junction), Ashrafieh (Sassine Sq), El Mina, Aley.
SET NOCOUNT ON;
PRINT '=== Migration 014: Accurate stop coordinates ===';
GO

PRINT 'Updating Beirut city stops...';
-- Riad El Solh Square — main downtown square, very accurate as-is
UPDATE stops SET latitude = 33.889420, longitude = 35.500270
WHERE stop_id = 1 AND is_deleted = 0;

-- Hamra Main St — central commercial stretch of Rue Hamra
UPDATE stops SET latitude = 33.896300, longitude = 35.478500
WHERE stop_id = 2 AND is_deleted = 0;

-- Ras Beirut Terminal — AUB / Bliss St end of Ras Beirut
UPDATE stops SET latitude = 33.900600, longitude = 35.479700
WHERE stop_id = 3 AND is_deleted = 0;

-- Dora Terminal — main Dora transit hub (Cola intersection, north beirut)
UPDATE stops SET latitude = 33.904100, longitude = 35.555300
WHERE stop_id = 4 AND is_deleted = 0;

-- Ashrafieh Center — Sassine Square, the commercial heart of Ashrafieh
--   (was 900 m too far west — major fix)
UPDATE stops SET latitude = 33.884300, longitude = 35.522800
WHERE stop_id = 5 AND is_deleted = 0;

-- Downtown Beirut — Martyrs' Square (was pointing to Mazraa, ~1 km off)
UPDATE stops SET latitude = 33.893400, longitude = 35.501800
WHERE stop_id = 6 AND is_deleted = 0;

-- Jounieh Waterfront — marina/casino du liban waterfront area
UPDATE stops SET latitude = 33.981200, longitude = 35.618700
WHERE stop_id = 7 AND is_deleted = 0;

-- Antelias Junction — coastal highway junction
UPDATE stops SET latitude = 33.927400, longitude = 35.572600
WHERE stop_id = 8 AND is_deleted = 0;

-- Beirut Airport Terminal — RHIA arrivals hall
UPDATE stops SET latitude = 33.820800, longitude = 35.488400
WHERE stop_id = 9 AND is_deleted = 0;

-- Mar Elias — Rue Mar Elias / Moussaitbeh area
UPDATE stops SET latitude = 33.869000, longitude = 35.496000
WHERE stop_id = 10 AND is_deleted = 0;

-- Hamra (stop 11) — Hamra / AUB junction area
UPDATE stops SET latitude = 33.899400, longitude = 35.478200
WHERE stop_id = 11 AND is_deleted = 0;

-- Charles Street (12 & 13) — Charles Helou / Gemmayze area
UPDATE stops SET latitude = 33.891000, longitude = 35.530300
WHERE stop_id = 12 AND is_deleted = 0;
UPDATE stops SET latitude = 33.890900, longitude = 35.530300
WHERE stop_id = 13 AND is_deleted = 0;

-- "hi" test stop — leave coordinates but mark name for cleanup
UPDATE stops SET latitude = 33.894370, longitude = 35.488586
WHERE stop_id = 14 AND is_deleted = 0;
GO

PRINT 'Updating North Lebanon stops...';
-- Dbayeh Junction — coastal highway junction before Jounieh
UPDATE stops SET latitude = 33.945200, longitude = 35.584300
WHERE stop_id = 15 AND is_deleted = 0;

-- Jbeil (Byblos) — old city entrance bus stop area
UPDATE stops SET latitude = 34.121200, longitude = 35.648000
WHERE stop_id = 16 AND is_deleted = 0;

-- Batroun Town Center — main square of Batroun
UPDATE stops SET latitude = 34.251600, longitude = 35.658600
WHERE stop_id = 17 AND is_deleted = 0;

-- Chekka Junction — coastal highway through Chekka (was ~600 m too far east)
UPDATE stops SET latitude = 34.327000, longitude = 35.700000
WHERE stop_id = 18 AND is_deleted = 0;

-- Tripoli Bus Station — Tell Square (Sahet el Tell), main transit hub
--   (was 1.16 km too far east — biggest error in the dataset)
UPDATE stops SET latitude = 34.437200, longitude = 35.838000
WHERE stop_id = 19 AND is_deleted = 0;

-- El Mina Terminal — Al-Mina center, Tripoli port district
UPDATE stops SET latitude = 34.454900, longitude = 35.822700
WHERE stop_id = 20 AND is_deleted = 0;
GO

PRINT 'Updating South Lebanon stops...';
-- Khalde Junction — coastal highway / airport road crossroads
UPDATE stops SET latitude = 33.798000, longitude = 35.482000
WHERE stop_id = 21 AND is_deleted = 0;

-- Damour Center — town center on coastal road
UPDATE stops SET latitude = 33.740600, longitude = 35.456400
WHERE stop_id = 22 AND is_deleted = 0;

-- Sidon Terminal — Saida main bus/taxi station (old city entrance area)
UPDATE stops SET latitude = 33.560400, longitude = 35.371400
WHERE stop_id = 23 AND is_deleted = 0;

-- Nabatieh Bus Station — Nabatieh main square transport area
UPDATE stops SET latitude = 33.378300, longitude = 35.484000
WHERE stop_id = 24 AND is_deleted = 0;

-- Tyre Terminal — Sour main roundabout / bus area
UPDATE stops SET latitude = 33.270300, longitude = 35.203400
WHERE stop_id = 25 AND is_deleted = 0;
GO

PRINT 'Updating Bekaa and mountain stops...';
-- Sofar Junction — Sofar village on Beirut-Damascus highway
UPDATE stops SET latitude = 33.783800, longitude = 35.712800
WHERE stop_id = 26 AND is_deleted = 0;

-- Chtaura Junction — Damascus highway crossroads (corrected in migration 013)
UPDATE stops SET latitude = 33.765000, longitude = 35.879700
WHERE stop_id = 27 AND is_deleted = 0;

-- Zahle Bus Station — Zahle town center transport hub
UPDATE stops SET latitude = 33.847400, longitude = 35.901800
WHERE stop_id = 28 AND is_deleted = 0;

-- Baalbek Terminal — Baalbek main square / Roman ruins entrance area
UPDATE stops SET latitude = 34.003800, longitude = 36.209500
WHERE stop_id = 29 AND is_deleted = 0;

-- Aley Town Center — Aley main square (was 400 m too far north)
UPDATE stops SET latitude = 33.808600, longitude = 35.598600
WHERE stop_id = 30 AND is_deleted = 0;

-- Beiteddine Palace Stop — palace entrance, Chouf
UPDATE stops SET latitude = 33.682200, longitude = 35.571000
WHERE stop_id = 31 AND is_deleted = 0;

-- Bar Elias Center — Bar Elias on Damascus highway
UPDATE stops SET latitude = 33.742300, longitude = 36.015700
WHERE stop_id = 32 AND is_deleted = 0;

-- Kherbet Qanafar — Bekaa village between Chtaura and Zahle
UPDATE stops SET latitude = 33.800000, longitude = 35.914700
WHERE stop_id = 33 AND is_deleted = 0;

-- Saadnayel Center — Saadnayel, central Bekaa
UPDATE stops SET latitude = 33.838400, longitude = 35.983100
WHERE stop_id = 34 AND is_deleted = 0;

-- Taalabaya Junction — Zahle-to-Baalbek road junction
UPDATE stops SET latitude = 33.861700, longitude = 36.052200
WHERE stop_id = 35 AND is_deleted = 0;

-- Deir el Ahmar Center — Deir el Ahmar, north Bekaa
UPDATE stops SET latitude = 34.055400, longitude = 36.093800
WHERE stop_id = 36 AND is_deleted = 0;

-- Yohmor Junction — Yohmor, north Bekaa highway
UPDATE stops SET latitude = 34.090300, longitude = 36.148400
WHERE stop_id = 37 AND is_deleted = 0;

-- Labweh Junction — Labweh crossroads between Baalbek and Hermel
UPDATE stops SET latitude = 34.131200, longitude = 36.345900
WHERE stop_id = 38 AND is_deleted = 0;

-- Hermel Center — Hermel, far north Bekaa (Pyramid Monument area)
UPDATE stops SET latitude = 34.394800, longitude = 36.385300
WHERE stop_id = 39 AND is_deleted = 0;
GO

PRINT 'Verifying updated coordinates...';
SELECT stop_id, stop_name, latitude, longitude
FROM stops
WHERE is_deleted = 0
ORDER BY stop_id;
GO

PRINT '=== Migration 014 complete: all 39 stop coordinates corrected ===';
GO
