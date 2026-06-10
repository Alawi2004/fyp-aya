-- =============================================================================
--  CAMERA AI MONITORING  —  Azure SQL Schema
--  Run once against your Azure SQL database.
-- =============================================================================

-- ---------------------------------------------------------------------------
--  Passenger Events
--  One row per ENTER / EXIT event detected by the door camera.
-- ---------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = 'camera_passenger_events'
)
BEGIN
    CREATE TABLE camera_passenger_events (
        id               INT           IDENTITY(1,1) PRIMARY KEY,
        bus_id           VARCHAR(20)   NOT NULL,
        event_type       VARCHAR(10)   NOT NULL,   -- 'ENTER' | 'EXIT'
        track_id         INT,                       -- ByteTrack person ID
        passenger_count  INT           NOT NULL,   -- on_bus at time of event
        available_seats  INT,
        recorded_at      DATETIME2     NOT NULL DEFAULT GETUTCDATE(),

        INDEX IX_cpe_bus_id   (bus_id),
        INDEX IX_cpe_recorded (recorded_at DESC)
    );
END;

-- ---------------------------------------------------------------------------
--  Driver Alerts
--  One row per alert-state transition (focused → drowsy, etc.)
-- ---------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = 'camera_driver_alerts'
)
BEGIN
    CREATE TABLE camera_driver_alerts (
        id             INT          IDENTITY(1,1) PRIMARY KEY,
        bus_id         VARCHAR(20)  NOT NULL,
        alert_type     VARCHAR(30)  NOT NULL,  -- focused | drowsy | distracted | phone_detected
        confidence     INT          NOT NULL DEFAULT 0,  -- 0-100 %
        recorded_at    DATETIME2    NOT NULL DEFAULT GETUTCDATE(),

        INDEX IX_cda_bus_id   (bus_id),
        INDEX IX_cda_alert    (alert_type),
        INDEX IX_cda_recorded (recorded_at DESC)
    );
END;

-- ---------------------------------------------------------------------------
--  Camera Health Log  (optional — tracks when cameras go offline / online)
-- ---------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = 'camera_health_log'
)
BEGIN
    CREATE TABLE camera_health_log (
        id          INT          IDENTITY(1,1) PRIMARY KEY,
        bus_id      VARCHAR(20)  NOT NULL,
        cam_type    VARCHAR(20)  NOT NULL,  -- 'passenger' | 'driver'
        status      VARCHAR(10)  NOT NULL,  -- 'online' | 'offline'
        recorded_at DATETIME2    NOT NULL DEFAULT GETUTCDATE(),

        INDEX IX_chl_bus (bus_id, cam_type)
    );
END;
