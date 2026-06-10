-- ============================================================
-- Add latitude/longitude to top_up_locations
-- The passenger app's Wallet screen plots these on a map; without
-- coordinates the native map marker crashes with
-- "Error while updating property 'coordinate' ... AIRMapMarker / null / latitude".
-- ============================================================

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'top_up_locations' AND COLUMN_NAME = 'latitude'
)
BEGIN
  ALTER TABLE top_up_locations ADD latitude DECIMAL(9,6) NULL;
END;

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'top_up_locations' AND COLUMN_NAME = 'longitude'
)
BEGIN
  ALTER TABLE top_up_locations ADD longitude DECIMAL(9,6) NULL;
END;

-- Backfill coordinates for the seeded locations (no-op if names don't match).
UPDATE top_up_locations SET latitude = 33.895900, longitude = 35.504700 WHERE name = 'Riad El Solh Transit Hub';
UPDATE top_up_locations SET latitude = 33.895900, longitude = 35.478400 WHERE name = 'Hamra Customer Service Centre';
UPDATE top_up_locations SET latitude = 33.871400, longitude = 35.546900 WHERE name = 'Dora Terminal Office';
UPDATE top_up_locations SET latitude = 33.980800, longitude = 35.617800 WHERE name = 'Jounieh Service Point';
UPDATE top_up_locations SET latitude = 33.918100, longitude = 35.596900 WHERE name = 'Antelias Agent Counter';
UPDATE top_up_locations SET latitude = 33.820900, longitude = 35.488400 WHERE name = 'Airport Transit Kiosk';
