-- =====================================================================
-- FYP-AYA Bus Transit System — Complete Azure SQL Seed Script
-- Generated: 2026-05-25
--
-- Passwords (bcrypt 10 rounds):
--   super_admin / admin / transport_manager / finance_officer /
--   ops_staff / auditor / it_admin  →  Admin@123
--   staff role users                →  Staff@123
--   driver role users               →  Driver@123
--   passenger role users            →  Pass@1234
--
-- Run order: this file is self-contained.
--   1. Creates all tables (idempotent)
--   2. Creates book_ticket stored procedure
--   3. Seeds reference data → users → vehicles/routes/stops → trips → tickets/ratings/wallets
--
-- Compatible with: Azure SQL Database, SQL Server 2019+
-- =====================================================================
SET NOCOUNT ON;
GO

-- =====================================================================
-- SECTION 1: CORE TABLE CREATION
-- These tables are created by the app at runtime via featureSetup.js
-- but are included here so the script works on a completely fresh DB.
-- =====================================================================

IF OBJECT_ID('users', 'U') IS NULL
  CREATE TABLE users (
    user_id       INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    full_name     NVARCHAR(200)  NOT NULL,
    email         NVARCHAR(200)  NOT NULL UNIQUE,
    password_hash NVARCHAR(200)  NOT NULL,
    phone         NVARCHAR(50)   NULL,
    role          NVARCHAR(50)   NOT NULL DEFAULT 'passenger',
    category      NVARCHAR(50)   NULL,
    status        NVARCHAR(20)   NOT NULL DEFAULT 'active',
    push_token    NVARCHAR(300)  NULL,
    fcm_token     NVARCHAR(300)  NULL,
    deleted_at    DATETIME2      NULL,
    created_at    DATETIME2      NOT NULL DEFAULT GETUTCDATE()
  );
GO

IF OBJECT_ID('vehicles', 'U') IS NULL
  CREATE TABLE vehicles (
    vehicle_id   INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    plate_number NVARCHAR(50)  NOT NULL UNIQUE,
    vehicle_type NVARCHAR(50)  NOT NULL,
    capacity     INT           NOT NULL,
    model        NVARCHAR(100) NOT NULL,
    status       NVARCHAR(50)  NOT NULL DEFAULT 'active',
    created_at   DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );
GO

IF OBJECT_ID('routes', 'U') IS NULL
  CREATE TABLE routes (
    route_id       INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    route_name     NVARCHAR(200) NOT NULL,
    start_location NVARCHAR(200) NOT NULL,
    end_location   NVARCHAR(200) NOT NULL,
    is_deleted     BIT           NOT NULL DEFAULT 0,
    created_at     DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );
GO

IF OBJECT_ID('stops', 'U') IS NULL
  CREATE TABLE stops (
    stop_id    INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    stop_name  NVARCHAR(200) NOT NULL,
    latitude   DECIMAL(9,6)  NOT NULL,
    longitude  DECIMAL(9,6)  NOT NULL,
    is_deleted BIT           NOT NULL DEFAULT 0
  );
GO

IF OBJECT_ID('route_stops', 'U') IS NULL
  CREATE TABLE route_stops (
    id         INT NOT NULL IDENTITY(1,1) PRIMARY KEY,
    route_id   INT NOT NULL REFERENCES routes(route_id),
    stop_id    INT NOT NULL REFERENCES stops(stop_id),
    stop_order INT NOT NULL
  );
GO

IF OBJECT_ID('drivers', 'U') IS NULL
  CREATE TABLE drivers (
    driver_id           INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id             INT           NOT NULL REFERENCES users(user_id),
    license_number      NVARCHAR(100) NOT NULL UNIQUE,
    hire_date           DATE          NOT NULL,
    license_expiry_date DATE          NULL,
    is_deleted          BIT           NOT NULL DEFAULT 0
  );
GO

IF OBJECT_ID('trips', 'U') IS NULL
  CREATE TABLE trips (
    trip_id    INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    vehicle_id INT           NOT NULL REFERENCES vehicles(vehicle_id),
    driver_id  INT           NOT NULL REFERENCES drivers(driver_id),
    route_id   INT           NOT NULL REFERENCES routes(route_id),
    start_time DATETIME2     NOT NULL,
    end_time   DATETIME2     NULL,
    status     NVARCHAR(50)  NOT NULL DEFAULT 'scheduled'
  );
GO

IF OBJECT_ID('tickets', 'U') IS NULL
  CREATE TABLE tickets (
    ticket_id      INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id        INT           NOT NULL REFERENCES users(user_id),
    trip_id        INT           NOT NULL REFERENCES trips(trip_id),
    seat_number    NVARCHAR(20)  NOT NULL,
    status         NVARCHAR(50)  NOT NULL DEFAULT 'booked',
    amount         DECIMAL(10,2) NOT NULL DEFAULT 0,
    booking_time   DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    created_at     DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    qr_code        NVARCHAR(MAX) NULL,
    share_count    INT           NOT NULL DEFAULT 0,
    last_shared_at DATETIME2     NULL
  );
GO

IF OBJECT_ID('ratings', 'U') IS NULL
  CREATE TABLE ratings (
    rating_id  INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id    INT            NOT NULL REFERENCES users(user_id),
    trip_id    INT            NOT NULL REFERENCES trips(trip_id),
    rating     INT            NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment    NVARCHAR(1000) NULL,
    created_at DATETIME2      NOT NULL DEFAULT GETUTCDATE()
  );
GO

IF OBJECT_ID('gps_logs', 'U') IS NULL
  CREATE TABLE gps_logs (
    log_id      INT          NOT NULL IDENTITY(1,1) PRIMARY KEY,
    trip_id     INT          NOT NULL REFERENCES trips(trip_id),
    latitude    DECIMAL(9,6) NOT NULL,
    longitude   DECIMAL(9,6) NOT NULL,
    recorded_at DATETIME2    NOT NULL DEFAULT GETUTCDATE()
  );
GO

IF OBJECT_ID('notifications', 'U') IS NULL
  CREATE TABLE notifications (
    notification_id INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id         INT            NULL REFERENCES users(user_id),
    message         NVARCHAR(2000) NOT NULL,
    title           NVARCHAR(200)  NULL,
    body            NVARCHAR(2000) NULL,
    type            NVARCHAR(20)   NOT NULL DEFAULT 'info',
    target_group    NVARCHAR(50)   NOT NULL DEFAULT 'all_users',
    sent_count      INT            NOT NULL DEFAULT 0,
    read_count      INT            NOT NULL DEFAULT 0,
    is_read         BIT            NOT NULL DEFAULT 0,
    created_at      DATETIME2      NOT NULL DEFAULT GETUTCDATE()
  );
GO

-- =====================================================================
-- SECTION 2: FEATURE TABLES (from featureSetup.js / migrations)
-- =====================================================================

IF OBJECT_ID('roles', 'U') IS NULL
  CREATE TABLE roles (
    role_id      INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    role_key     NVARCHAR(50)   NOT NULL UNIQUE,
    display_name NVARCHAR(100)  NOT NULL,
    description  NVARCHAR(500)  NULL,
    is_system    BIT            NOT NULL DEFAULT 1,
    is_active    BIT            NOT NULL DEFAULT 1,
    created_at   DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    updated_at   DATETIME2      NOT NULL DEFAULT GETUTCDATE()
  );
GO

IF OBJECT_ID('permissions', 'U') IS NULL
  CREATE TABLE permissions (
    permission_id  INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    permission_key NVARCHAR(100)  NOT NULL UNIQUE,
    module_name    NVARCHAR(50)   NOT NULL,
    action_name    NVARCHAR(20)   NOT NULL,
    description    NVARCHAR(255)  NULL,
    created_at     DATETIME2      NOT NULL DEFAULT GETUTCDATE()
  );
GO

IF OBJECT_ID('role_permissions', 'U') IS NULL
  CREATE TABLE role_permissions (
    role_id       INT       NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    permission_id INT       NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    granted_at    DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    granted_by    INT       NULL REFERENCES users(user_id),
    CONSTRAINT PK_role_permissions PRIMARY KEY (role_id, permission_id)
  );
GO

IF OBJECT_ID('wallets', 'U') IS NULL
  CREATE TABLE wallets (
    wallet_id          INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id            INT           NOT NULL UNIQUE,
    balance            DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_frozen          BIT           NOT NULL DEFAULT 0,
    freeze_reason      NVARCHAR(200) NULL,
    freeze_notes       NVARCHAR(500) NULL,
    frozen_at          DATETIME      NULL,
    frozen_by_admin_id INT           NULL,
    updated_at         DATETIME      NULL
  );
GO

IF OBJECT_ID('wallet_transactions', 'U') IS NULL
  CREATE TABLE wallet_transactions (
    transaction_id INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id        INT            NOT NULL,
    recharge_id    INT            NULL,
    type           NVARCHAR(20)   NOT NULL,
    amount         DECIMAL(10,2)  NOT NULL,
    description    NVARCHAR(500)  NULL,
    created_at     DATETIME       NOT NULL DEFAULT GETUTCDATE()
  );
GO

IF OBJECT_ID('wallet_recharges', 'U') IS NULL
  CREATE TABLE wallet_recharges (
    recharge_id   INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id       INT            NOT NULL,
    staff_id      INT            NOT NULL,
    amount        DECIMAL(10,2)  NOT NULL,
    location_name NVARCHAR(255)  NOT NULL,
    tx_ref        NVARCHAR(100)  NOT NULL UNIQUE,
    notes         NVARCHAR(500)  NULL,
    created_at    DATETIME       NOT NULL DEFAULT GETUTCDATE()
  );
GO

IF OBJECT_ID('wallet_adjustments', 'U') IS NULL
  CREATE TABLE wallet_adjustments (
    adjustment_id  INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id        INT           NOT NULL,
    admin_id       INT           NOT NULL,
    type           NVARCHAR(10)  NOT NULL,
    amount         DECIMAL(10,2) NOT NULL,
    reason         NVARCHAR(200) NOT NULL,
    notes          NVARCHAR(500) NULL,
    balance_before DECIMAL(10,2) NOT NULL,
    balance_after  DECIMAL(10,2) NOT NULL,
    created_at     DATETIME      NOT NULL DEFAULT GETUTCDATE()
  );
GO

IF OBJECT_ID('wallet_freeze_log', 'U') IS NULL
  CREATE TABLE wallet_freeze_log (
    log_id     INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id    INT           NOT NULL,
    action     NVARCHAR(20)  NOT NULL,
    reason     NVARCHAR(200) NULL,
    notes      NVARCHAR(500) NULL,
    admin_id   INT           NULL,
    created_at DATETIME      NOT NULL DEFAULT GETUTCDATE()
  );
GO

IF OBJECT_ID('top_up_locations', 'U') IS NULL
  CREATE TABLE top_up_locations (
    location_id INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    name        NVARCHAR(200) NOT NULL,
    address     NVARCHAR(300) NULL,
    city        NVARCHAR(100) NULL,
    phone       NVARCHAR(50)  NULL,
    hours       NVARCHAR(200) NULL,
    is_active   BIT           NOT NULL DEFAULT 1
  );
GO

IF OBJECT_ID('staff_top_ups', 'U') IS NULL
  CREATE TABLE staff_top_ups (
    top_up_id             INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id               INT           NOT NULL,
    wallet_id             INT           NULL,
    amount                DECIMAL(10,2) NOT NULL,
    transaction_type      NVARCHAR(50)  NOT NULL DEFAULT 'top_up',
    balance_before        DECIMAL(10,2) NOT NULL,
    balance_after         DECIMAL(10,2) NOT NULL,
    processed_by_staff_id INT           NOT NULL,
    recharge_location     NVARCHAR(255) NOT NULL,
    payment_method        NVARCHAR(100) NOT NULL,
    transaction_reference NVARCHAR(100) NOT NULL UNIQUE,
    notes                 NVARCHAR(500) NULL,
    status                NVARCHAR(50)  NOT NULL DEFAULT 'completed',
    created_at            DATETIME      NOT NULL DEFAULT GETUTCDATE()
  );
GO

IF OBJECT_ID('refresh_tokens', 'U') IS NULL
  CREATE TABLE refresh_tokens (
    token_id   INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id    INT           NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash NVARCHAR(64)  NOT NULL UNIQUE,
    expires_at DATETIME2     NOT NULL,
    created_at DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );
GO

IF OBJECT_ID('refresh_token_blacklist', 'U') IS NULL
  CREATE TABLE refresh_token_blacklist (
    blacklist_id   INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id        INT           NULL REFERENCES users(user_id),
    token_hash     NVARCHAR(64)  NOT NULL UNIQUE,
    reason         NVARCHAR(30)  NOT NULL,
    blacklisted_at DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    expires_at     DATETIME2     NULL
  );
GO

IF OBJECT_ID('user_sessions', 'U') IS NULL
  CREATE TABLE user_sessions (
    session_id         INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id            INT           NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash         NVARCHAR(64)  NOT NULL UNIQUE,
    device_fingerprint NVARCHAR(64)  NOT NULL,
    device_name        NVARCHAR(200) NULL,
    ip_address         NVARCHAR(64)  NOT NULL,
    user_agent         NVARCHAR(500) NULL,
    last_active_at     DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    created_at         DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    expires_at         DATETIME2     NOT NULL
  );
GO

IF OBJECT_ID('login_lockouts', 'U') IS NULL
  CREATE TABLE login_lockouts (
    email           NVARCHAR(120) NOT NULL PRIMARY KEY,
    failed_attempts INT           NOT NULL DEFAULT 0,
    locked_until    DATETIME2     NULL,
    lockout_count   INT           NOT NULL DEFAULT 0,
    last_attempt_at DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );
GO

IF OBJECT_ID('login_audit_logs', 'U') IS NULL
BEGIN
  CREATE TABLE login_audit_logs (
    log_id             BIGINT        NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id            INT           NULL REFERENCES users(user_id),
    email_attempted    NVARCHAR(120) NOT NULL,
    ip_address         NVARCHAR(64)  NOT NULL,
    user_agent         NVARCHAR(500) NULL,
    device_fingerprint NVARCHAR(64)  NULL,
    success            BIT           NOT NULL,
    failure_reason     NVARCHAR(100) NULL,
    logged_at          DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );
  CREATE INDEX IX_login_audit_user ON login_audit_logs(user_id, logged_at DESC);
  CREATE INDEX IX_login_audit_date ON login_audit_logs(logged_at DESC);
END;
GO

IF OBJECT_ID('password_reset_tokens', 'U') IS NULL
  CREATE TABLE password_reset_tokens (
    token_id   INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id    INT           NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash NVARCHAR(64)  NOT NULL UNIQUE,
    expires_at DATETIME2     NOT NULL,
    used_at    DATETIME2     NULL,
    created_at DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );
GO

IF OBJECT_ID('user_totp', 'U') IS NULL
  CREATE TABLE user_totp (
    totp_id     INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id     INT           NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    secret      NVARCHAR(100) NOT NULL,
    enabled     BIT           NOT NULL DEFAULT 0,
    verified_at DATETIME2     NULL,
    created_at  DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );
GO

IF OBJECT_ID('system_settings', 'U') IS NULL
  CREATE TABLE system_settings (
    setting_key   NVARCHAR(100) NOT NULL PRIMARY KEY,
    setting_value NVARCHAR(MAX) NOT NULL,
    category      NVARCHAR(50)  NOT NULL,
    label         NVARCHAR(200) NULL,
    description   NVARCHAR(500) NULL,
    value_type    NVARCHAR(20)  NOT NULL DEFAULT 'string',
    updated_at    DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    updated_by    INT           NULL REFERENCES users(user_id)
  );
GO

IF OBJECT_ID('scheduled_reports', 'U') IS NULL
  CREATE TABLE scheduled_reports (
    schedule_id  INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    report_name  NVARCHAR(100)  NOT NULL,
    report_type  NVARCHAR(50)   NOT NULL,
    frequency    NVARCHAR(20)   NOT NULL,
    day_of_week  INT            NULL,
    hour_of_day  INT            NOT NULL DEFAULT 8,
    recipients   NVARCHAR(MAX)  NOT NULL,
    enabled      BIT            NOT NULL DEFAULT 1,
    last_sent_at DATETIME2      NULL,
    next_send_at DATETIME2      NULL,
    created_by   INT            NULL REFERENCES users(user_id),
    created_at   DATETIME2      NOT NULL DEFAULT GETUTCDATE()
  );
GO

IF OBJECT_ID('staff_shift_sessions', 'U') IS NULL
BEGIN
  CREATE TABLE staff_shift_sessions (
    shift_id       INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    staff_user_id  INT            NOT NULL REFERENCES users(user_id),
    opening_cash   DECIMAL(10,2)  NOT NULL DEFAULT 0,
    expected_cash  DECIMAL(10,2)  NULL,
    closing_cash   DECIMAL(10,2)  NULL,
    reported_cash  DECIMAL(10,2)  NULL,
    cash_difference DECIMAL(10,2) NULL,
    opened_at      DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    closed_at      DATETIME2      NULL,
    opening_notes  NVARCHAR(500)  NULL,
    closing_notes  NVARCHAR(500)  NULL,
    summary_json   NVARCHAR(MAX)  NULL
  );
  CREATE INDEX IX_staff_shift_sessions_staff_opened ON staff_shift_sessions(staff_user_id, opened_at DESC);
END;
GO

IF OBJECT_ID('complaints', 'U') IS NULL
BEGIN
  CREATE TABLE complaints (
    complaint_id         INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    tracking_code        NVARCHAR(30)   NOT NULL UNIQUE,
    submitted_by_user_id INT            NOT NULL REFERENCES users(user_id),
    assigned_to_user_id  INT            NULL REFERENCES users(user_id),
    trip_id              INT            NULL REFERENCES trips(trip_id),
    driver_id            INT            NULL REFERENCES drivers(driver_id),
    route_id             INT            NULL REFERENCES routes(route_id),
    title                NVARCHAR(200)  NOT NULL,
    description          NVARCHAR(MAX)  NOT NULL,
    category             NVARCHAR(50)   NOT NULL,
    priority             NVARCHAR(20)   NOT NULL DEFAULT 'medium',
    status               NVARCHAR(20)   NOT NULL DEFAULT 'submitted',
    submitted_at         DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    assigned_at          DATETIME2      NULL,
    resolved_at          DATETIME2      NULL,
    resolution_notes     NVARCHAR(1000) NULL,
    last_updated_at      DATETIME2      NOT NULL DEFAULT GETUTCDATE()
  );
END;
GO

IF OBJECT_ID('complaint_updates', 'U') IS NULL
  CREATE TABLE complaint_updates (
    update_id    INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    complaint_id INT            NOT NULL REFERENCES complaints(complaint_id) ON DELETE CASCADE,
    actor_user_id INT           NULL REFERENCES users(user_id),
    action_type  NVARCHAR(30)   NOT NULL,
    old_status   NVARCHAR(20)   NULL,
    new_status   NVARCHAR(20)   NULL,
    comment      NVARCHAR(1000) NULL,
    created_at   DATETIME2      NOT NULL DEFAULT GETUTCDATE()
  );
GO

IF OBJECT_ID('passenger_qr_tokens', 'U') IS NULL
BEGIN
  CREATE TABLE passenger_qr_tokens (
    qr_token_id INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id     INT           NOT NULL REFERENCES users(user_id),
    jti         NVARCHAR(64)  NOT NULL UNIQUE,
    token_hash  NVARCHAR(64)  NOT NULL UNIQUE,
    expires_at  DATETIME2     NOT NULL,
    created_at  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    used_at     DATETIME2     NULL,
    revoked_at  DATETIME2     NULL
  );
  CREATE INDEX IX_passenger_qr_tokens_user ON passenger_qr_tokens(user_id, created_at DESC);
END;
GO

IF OBJECT_ID('trip_stop_arrivals', 'U') IS NULL
BEGIN
  CREATE TABLE trip_stop_arrivals (
    trip_stop_arrival_id INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    trip_id              INT           NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
    stop_id              INT           NOT NULL REFERENCES stops(stop_id),
    route_id             INT           NULL REFERENCES routes(route_id),
    stop_order           INT           NULL,
    scheduled_arrival_at DATETIME2     NULL,
    actual_arrival_at    DATETIME2     NULL,
    delay_seconds        INT           NULL,
    arrival_status       NVARCHAR(20)  NOT NULL DEFAULT 'pending',
    notes                NVARCHAR(500) NULL,
    created_at           DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    updated_at           DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_trip_stop_arrivals_trip_stop UNIQUE (trip_id, stop_id, stop_order)
  );
END;
GO

IF OBJECT_ID('audit_logs', 'U') IS NULL
BEGIN
  CREATE TABLE audit_logs (
    audit_log_id    BIGINT         NOT NULL IDENTITY(1,1) PRIMARY KEY,
    actor_user_id   INT            NULL REFERENCES users(user_id),
    actor_role      NVARCHAR(50)   NULL,
    action_name     NVARCHAR(100)  NOT NULL,
    entity_type     NVARCHAR(100)  NOT NULL,
    entity_id       NVARCHAR(100)  NULL,
    old_values_json NVARCHAR(MAX)  NULL,
    new_values_json NVARCHAR(MAX)  NULL,
    ip_address      NVARCHAR(64)   NULL,
    user_agent      NVARCHAR(500)  NULL,
    request_id      NVARCHAR(100)  NULL,
    created_at      DATETIME2      NOT NULL DEFAULT GETUTCDATE()
  );
  CREATE INDEX IX_audit_logs_actor_date ON audit_logs(actor_user_id, created_at DESC);
  CREATE INDEX IX_audit_logs_entity     ON audit_logs(entity_type, entity_id, created_at DESC);
END;
GO

IF OBJECT_ID('geofence_events', 'U') IS NULL
BEGIN
  CREATE TABLE geofence_events (
    event_id    INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    trip_id     INT           NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
    route_id    INT           NULL REFERENCES routes(route_id),
    latitude    DECIMAL(9,6)  NOT NULL,
    longitude   DECIMAL(9,6)  NOT NULL,
    distance_m  INT           NOT NULL,
    status      NVARCHAR(20)  NOT NULL DEFAULT 'active',
    detected_at DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    resolved_at DATETIME2     NULL
  );
END;
GO

IF OBJECT_ID('nfc_cards', 'U') IS NULL
BEGIN
  CREATE TABLE nfc_cards (
    nfc_id      INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id     INT           NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    card_uid    NVARCHAR(64)  NOT NULL,
    status      NVARCHAR(20)  NOT NULL DEFAULT 'active',
    linked_at   DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    unlinked_at DATETIME2     NULL
  );
END;
GO

IF OBJECT_ID('user_favorite_routes', 'U') IS NULL
BEGIN
  CREATE TABLE user_favorite_routes (
    favorite_id INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id     INT           NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    route_id    INT           NOT NULL REFERENCES routes(route_id) ON DELETE CASCADE,
    nickname    NVARCHAR(100) NULL,
    created_at  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_user_favorite_route UNIQUE (user_id, route_id)
  );
END;
GO

IF OBJECT_ID('user_suspension_logs', 'U') IS NULL
BEGIN
  CREATE TABLE user_suspension_logs (
    log_id          INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id         INT           NOT NULL REFERENCES users(user_id),
    action          NVARCHAR(20)  NOT NULL,
    reason          NVARCHAR(100) NOT NULL,
    notes           NVARCHAR(500) NULL,
    duration_days   INT           NULL,
    suspended_until DATETIME2     NULL,
    acted_by        INT           NOT NULL REFERENCES users(user_id),
    acted_at        DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );
END;
GO

IF OBJECT_ID('route_waypoints', 'U') IS NULL
BEGIN
  CREATE TABLE route_waypoints (
    waypoint_id INT          NOT NULL IDENTITY(1,1) PRIMARY KEY,
    route_id    INT          NOT NULL REFERENCES routes(route_id) ON DELETE CASCADE,
    latitude    DECIMAL(9,6) NOT NULL,
    longitude   DECIMAL(9,6) NOT NULL,
    wp_order    INT          NOT NULL,
    created_at  DATETIME2    NOT NULL DEFAULT GETUTCDATE()
  );
  CREATE INDEX IX_route_waypoints_route ON route_waypoints(route_id, wp_order);
END;
GO

IF OBJECT_ID('fare_zones', 'U') IS NULL
BEGIN
  CREATE TABLE fare_zones (
    zone_id    INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    route_id   INT           NOT NULL REFERENCES routes(route_id) ON DELETE CASCADE,
    zone_name  NVARCHAR(60)  NOT NULL,
    zone_color NVARCHAR(7)   NOT NULL DEFAULT '#2563EB',
    base_fare  DECIMAL(6,2)  NOT NULL,
    created_at DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    updated_at DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );
END;
GO

IF OBJECT_ID('stop_amenities', 'U') IS NULL
  CREATE TABLE stop_amenities (
    stop_id            INT           NOT NULL PRIMARY KEY REFERENCES stops(stop_id) ON DELETE CASCADE,
    has_shelter        BIT           NOT NULL DEFAULT 0,
    has_seating        BIT           NOT NULL DEFAULT 0,
    has_lighting       BIT           NOT NULL DEFAULT 0,
    has_wheelchair     BIT           NOT NULL DEFAULT 0,
    has_ticket_machine BIT           NOT NULL DEFAULT 0,
    has_wifi           BIT           NOT NULL DEFAULT 0,
    nearby_landmark    NVARCHAR(200) NULL,
    nfc_tag_id         NVARCHAR(100) NULL,
    updated_at         DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );
GO

IF OBJECT_ID('fare_zone_stops', 'U') IS NULL
  CREATE TABLE fare_zone_stops (
    id      INT NOT NULL IDENTITY(1,1) PRIMARY KEY,
    zone_id INT NOT NULL REFERENCES fare_zones(zone_id) ON DELETE CASCADE,
    stop_id INT NOT NULL,
    CONSTRAINT UQ_fare_zone_stops UNIQUE (zone_id, stop_id)
  );
GO

IF OBJECT_ID('trip_checklists', 'U') IS NULL
  CREATE TABLE trip_checklists (
    checklist_id INT       NOT NULL IDENTITY(1,1) PRIMARY KEY,
    trip_id      INT       NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
    fuel_ok      BIT       NOT NULL DEFAULT 0,
    lights_ok    BIT       NOT NULL DEFAULT 0,
    tires_ok     BIT       NOT NULL DEFAULT 0,
    submitted_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
  );
GO

IF OBJECT_ID('trip_delays', 'U') IS NULL
  CREATE TABLE trip_delays (
    delay_id      INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    trip_id       INT            NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
    reason        NVARCHAR(200)  NOT NULL,
    delay_minutes INT            NOT NULL,
    notes         NVARCHAR(500)  NULL,
    reported_at   DATETIME2      NOT NULL DEFAULT GETUTCDATE()
  );
GO

IF OBJECT_ID('vehicle_docs', 'U') IS NULL
  CREATE TABLE vehicle_docs (
    plate                 NVARCHAR(50) NOT NULL PRIMARY KEY,
    registration_expiry   DATE         NULL,
    insurance_expiry      DATE         NULL,
    roadworthiness_expiry DATE         NULL,
    updated_at            DATETIME     NULL,
    updated_by_admin_id   INT          NULL
  );
GO

IF OBJECT_ID('vehicle_maintenance_records', 'U') IS NULL
  CREATE TABLE vehicle_maintenance_records (
    record_id         INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    vehicle_id        INT           NOT NULL,
    service_date      DATE          NOT NULL,
    service_type      NVARCHAR(100) NOT NULL,
    mechanic          NVARCHAR(200) NOT NULL,
    workshop          NVARCHAR(200) NULL,
    cost              DECIMAL(10,2) NULL,
    odometer_km       INT           NULL,
    notes             NVARCHAR(500) NULL,
    next_service_date DATE          NULL,
    created_by        INT           NULL,
    created_at        DATETIME      NOT NULL DEFAULT GETUTCDATE()
  );
GO

IF OBJECT_ID('vehicle_fuel_records', 'U') IS NULL
  CREATE TABLE vehicle_fuel_records (
    fuel_id    INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    vehicle_id INT           NOT NULL,
    fuel_date  DATE          NOT NULL,
    liters     DECIMAL(8,2)  NOT NULL,
    cost       DECIMAL(10,2) NULL,
    odometer_km INT          NULL,
    created_by  INT          NULL,
    created_at  DATETIME     NOT NULL DEFAULT GETUTCDATE()
  );
GO

-- =====================================================================
-- SECTION 2b: PATCH EXISTING TABLES
-- Adds columns that were introduced in later migrations/versions.
-- These ALTER TABLE statements are safe to run on any DB state.
-- =====================================================================

-- Drop the chk_role CHECK constraint on users.role if it exists.
-- The original schema only allowed a narrow set of roles; we now support
-- super_admin, transport_manager, finance_officer, ops_staff, auditor, it_admin.
IF EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'chk_role'
)
  ALTER TABLE users DROP CONSTRAINT chk_role;
GO

-- Drop any other CHECK constraints on users.role (some schemas use auto-generated names)
DECLARE @constraintName NVARCHAR(200);
SELECT @constraintName = cc.CONSTRAINT_NAME
FROM INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS cc
  ON cc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
  AND cc.CONSTRAINT_TYPE = 'CHECK'
WHERE ccu.TABLE_NAME = 'users' AND ccu.COLUMN_NAME = 'role'
  AND cc.CONSTRAINT_NAME != 'chk_role';
IF @constraintName IS NOT NULL
  EXEC('ALTER TABLE users DROP CONSTRAINT [' + @constraintName + ']');
GO

-- tickets: amount (fare), share_count, last_shared_at, qr_code
IF OBJECT_ID('tickets','U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tickets' AND COLUMN_NAME='amount')
    ALTER TABLE tickets ADD amount DECIMAL(10,2) NOT NULL DEFAULT 0;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tickets' AND COLUMN_NAME='share_count')
    ALTER TABLE tickets ADD share_count INT NOT NULL DEFAULT 0;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tickets' AND COLUMN_NAME='last_shared_at')
    ALTER TABLE tickets ADD last_shared_at DATETIME2 NULL;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tickets' AND COLUMN_NAME='qr_code')
    ALTER TABLE tickets ADD qr_code NVARCHAR(MAX) NULL;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tickets' AND COLUMN_NAME='created_at')
    ALTER TABLE tickets ADD created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE();
END;
GO

-- users: status, push_token, fcm_token, deleted_at, category
IF OBJECT_ID('users','U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users' AND COLUMN_NAME='status')
    ALTER TABLE users ADD status NVARCHAR(20) NOT NULL DEFAULT 'active';
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users' AND COLUMN_NAME='push_token')
    ALTER TABLE users ADD push_token NVARCHAR(300) NULL;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users' AND COLUMN_NAME='fcm_token')
    ALTER TABLE users ADD fcm_token NVARCHAR(300) NULL;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users' AND COLUMN_NAME='deleted_at')
    ALTER TABLE users ADD deleted_at DATETIME2 NULL;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users' AND COLUMN_NAME='category')
    ALTER TABLE users ADD category NVARCHAR(50) NULL;
END;
GO

-- notifications: title, body, type, target_group, sent_count, read_count, is_read
IF OBJECT_ID('notifications','U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='notifications' AND COLUMN_NAME='title')
    ALTER TABLE notifications ADD title NVARCHAR(200) NULL;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='notifications' AND COLUMN_NAME='body')
    ALTER TABLE notifications ADD body NVARCHAR(2000) NULL;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='notifications' AND COLUMN_NAME='type')
    ALTER TABLE notifications ADD type NVARCHAR(20) NOT NULL DEFAULT 'info';
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='notifications' AND COLUMN_NAME='target_group')
    ALTER TABLE notifications ADD target_group NVARCHAR(50) NOT NULL DEFAULT 'all_users';
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='notifications' AND COLUMN_NAME='sent_count')
    ALTER TABLE notifications ADD sent_count INT NOT NULL DEFAULT 0;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='notifications' AND COLUMN_NAME='read_count')
    ALTER TABLE notifications ADD read_count INT NOT NULL DEFAULT 0;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='notifications' AND COLUMN_NAME='is_read')
    ALTER TABLE notifications ADD is_read BIT NOT NULL DEFAULT 0;
END;
GO

-- drivers: license_expiry_date, is_deleted
IF OBJECT_ID('drivers','U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='drivers' AND COLUMN_NAME='license_expiry_date')
    ALTER TABLE drivers ADD license_expiry_date DATE NULL;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='drivers' AND COLUMN_NAME='is_deleted')
    ALTER TABLE drivers ADD is_deleted BIT NOT NULL DEFAULT 0;
END;
GO

-- routes: is_deleted
IF OBJECT_ID('routes','U') IS NOT NULL
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='routes' AND COLUMN_NAME='is_deleted')
    ALTER TABLE routes ADD is_deleted BIT NOT NULL DEFAULT 0;
GO

-- stops: is_deleted
IF OBJECT_ID('stops','U') IS NOT NULL
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='stops' AND COLUMN_NAME='is_deleted')
    ALTER TABLE stops ADD is_deleted BIT NOT NULL DEFAULT 0;
GO

-- wallets: freeze columns
IF OBJECT_ID('wallets','U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wallets' AND COLUMN_NAME='is_frozen')
    ALTER TABLE wallets ADD is_frozen BIT NOT NULL DEFAULT 0;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wallets' AND COLUMN_NAME='freeze_reason')
    ALTER TABLE wallets ADD freeze_reason NVARCHAR(200) NULL;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wallets' AND COLUMN_NAME='freeze_notes')
    ALTER TABLE wallets ADD freeze_notes NVARCHAR(500) NULL;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wallets' AND COLUMN_NAME='frozen_at')
    ALTER TABLE wallets ADD frozen_at DATETIME NULL;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wallets' AND COLUMN_NAME='frozen_by_admin_id')
    ALTER TABLE wallets ADD frozen_by_admin_id INT NULL;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wallets' AND COLUMN_NAME='updated_at')
    ALTER TABLE wallets ADD updated_at DATETIME NULL;
END;
GO

-- staff_shift_sessions: reported_cash
IF OBJECT_ID('staff_shift_sessions','U') IS NOT NULL
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='staff_shift_sessions' AND COLUMN_NAME='reported_cash')
    ALTER TABLE staff_shift_sessions ADD reported_cash DECIMAL(10,2) NULL;
GO

-- Drop CHECK constraint on vehicles.vehicle_type (named chk_vehicle_type or auto-named)
IF EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_NAME = 'vehicles' AND CONSTRAINT_NAME = 'chk_vehicle_type'
)
  ALTER TABLE vehicles DROP CONSTRAINT chk_vehicle_type;
GO

DECLARE @vcConstraint NVARCHAR(200);
SELECT @vcConstraint = cc.CONSTRAINT_NAME
FROM INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS cc
  ON cc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
  AND cc.CONSTRAINT_TYPE = 'CHECK'
WHERE ccu.TABLE_NAME = 'vehicles' AND ccu.COLUMN_NAME = 'vehicle_type'
  AND cc.CONSTRAINT_NAME != 'chk_vehicle_type';
IF @vcConstraint IS NOT NULL
  EXEC('ALTER TABLE vehicles DROP CONSTRAINT [' + @vcConstraint + ']');
GO

-- =====================================================================
-- SECTION 3: book_ticket STORED PROCEDURE
-- =====================================================================

IF OBJECT_ID('book_ticket', 'P') IS NOT NULL
  DROP PROCEDURE book_ticket;
GO

CREATE PROCEDURE book_ticket
  @p_user_id INT,
  @p_trip_id INT,
  @p_seat    VARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRANSACTION;
  BEGIN TRY
    IF EXISTS (
      SELECT 1 FROM tickets
      WHERE trip_id = @p_trip_id AND seat_number = @p_seat AND status != 'cancelled'
    )
    BEGIN
      ROLLBACK;
      RAISERROR('Seat %s on trip %d is already booked', 16, 1, @p_seat, @p_trip_id);
      RETURN;
    END

    DECLARE @amount DECIMAL(10,2) = 1.50;

    INSERT INTO tickets (user_id, trip_id, seat_number, status, amount, booking_time, created_at)
    VALUES (@p_user_id, @p_trip_id, @p_seat, 'booked', @amount, GETUTCDATE(), GETUTCDATE());

    UPDATE wallets
    SET balance = balance - @amount, updated_at = GETUTCDATE()
    WHERE user_id = @p_user_id;

    IF @@ROWCOUNT > 0
      INSERT INTO wallet_transactions (user_id, type, amount, description, created_at)
      VALUES (@p_user_id, 'debit', @amount, 'Bus ticket booking', GETUTCDATE());

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
  END CATCH
END;
GO

-- =====================================================================
-- SECTION 4: SEED SYSTEM SETTINGS
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'fare.base_fare')
BEGIN
  INSERT INTO system_settings (setting_key, setting_value, category, label, value_type, description) VALUES
    ('fare.base_fare',              '1.00',   'fare',        'Base Fare ($)',                    'number',  'Flat fare charged for any journey'),
    ('fare.per_km_rate',            '0.15',   'fare',        'Per-km Rate ($)',                  'number',  'Additional fare per kilometre travelled'),
    ('fare.student_discount',       '25',     'fare',        'Student Discount (%)',             'number',  'Percentage discount for student pass holders'),
    ('fare.senior_discount',        '30',     'fare',        'Senior Discount (%)',              'number',  'Percentage discount for senior citizens'),
    ('fare.staff_discount',         '100',    'fare',        'Staff Discount (%)',               'number',  'Percentage discount for company staff'),
    ('fare.peak_surcharge',         '15',     'fare',        'Peak Hour Surcharge (%)',          'number',  'Extra charge during peak hours (7-9 am, 5-7 pm)'),
    ('fare.night_surcharge',        '10',     'fare',        'Night Surcharge (%)',              'number',  'Extra charge for journeys between 10 pm and 5 am'),
    ('wallet.max_balance',          '500',    'wallet',      'Max Wallet Balance ($)',           'number',  'Maximum balance a passenger wallet may hold'),
    ('wallet.min_topup',            '5',      'wallet',      'Min Top-Up Amount ($)',            'number',  'Minimum single top-up transaction'),
    ('wallet.max_topup_daily',      '200',    'wallet',      'Max Top-Up Per Day ($)',           'number',  'Daily cap on top-ups per passenger'),
    ('wallet.low_balance_alert',    '25',     'wallet',      'Low-Balance Alert Threshold ($)',  'number',  'Send alert when balance drops below this amount'),
    ('wallet.freeze_on_fraud',      'true',   'wallet',      'Auto-freeze on Fraud Flag',       'boolean', 'Automatically freeze wallet when fraud is flagged'),
    ('gps.broadcast_interval_sec',  '5',      'gps',         'Broadcast Interval (s)',          'number',  'How often drivers send GPS updates'),
    ('gps.accuracy_threshold_m',    '20',     'gps',         'Accuracy Threshold (m)',          'number',  'Ignore GPS readings with accuracy worse than this'),
    ('gps.history_retention_days',  '90',     'gps',         'History Retention (days)',        'number',  'How long GPS logs are kept before purging'),
    ('gps.geofence_radius_m',       '200',    'gps',         'Geofence Alert Radius (m)',       'number',  'Radius used to detect route deviation'),
    ('gps.offline_buffer_minutes',  '10',     'gps',         'Offline Buffer (min)',            'number',  'Buffer GPS points offline for this long before alerting'),
    ('security.max_login_attempts', '5',      'security',    'Max Login Attempts',              'number',  'Failed attempts before account lockout triggers'),
    ('security.lockout_base_min',   '1',      'security',    'Lockout Base Duration (min)',     'number',  'Starting lockout duration — doubles exponentially per lockout'),
    ('security.jwt_expiry_min',     '15',     'security',    'JWT Access Token Expiry (min)',   'number',  'Short-lived access token TTL'),
    ('security.max_sessions',       '3',      'security',    'Max Concurrent Sessions',        'number',  'Maximum simultaneous sessions per user'),
    ('security.force_2fa_admin',    'false',  'security',    'Force 2FA for All Admins',       'boolean', 'Require TOTP 2FA at login for every admin account'),
    ('security.strong_password',    'true',   'security',    'Require Strong Password',        'boolean', 'Enforce uppercase, lowercase, digit, and special char'),
    ('maintenance.enabled',         'false',  'maintenance', 'Maintenance Mode',               'boolean', 'Block all non-admin traffic while maintenance is active'),
    ('maintenance.message',         'System is undergoing scheduled maintenance. Please check back shortly.',
                                              'maintenance', 'Maintenance Message',            'string',  'Message shown to users during maintenance'),
    ('maintenance.allowed_ips',     '127.0.0.1',
                                              'maintenance', 'Allowed IPs (comma-separated)', 'string',  'These IPs bypass maintenance mode'),
    ('maintenance.scheduled_start', '',       'maintenance', 'Scheduled Start',               'string',  'ISO datetime for planned maintenance window start'),
    ('maintenance.scheduled_end',   '',       'maintenance', 'Scheduled End',                 'string',  'ISO datetime for planned maintenance window end');
END;
GO

-- =====================================================================
-- SECTION 5: SEED ROLES
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM roles WHERE role_key = 'super_admin')
BEGIN
  INSERT INTO roles (role_key, display_name, description, is_system, is_active) VALUES
    ('super_admin',       'Super Administrator', 'Full system access with no restrictions',         1, 1),
    ('admin',             'Administrator',       'Full admin access to all modules',                1, 1),
    ('transport_manager', 'Transport Manager',   'Manages drivers, vehicles, routes and trips',     1, 1),
    ('finance_officer',   'Finance Officer',     'Manages wallet, tickets and analytics',           1, 1),
    ('ops_staff',         'Operations Staff',    'Day-to-day operations monitoring',                1, 1),
    ('auditor',           'Auditor',             'Read-only access across all modules',             1, 1),
    ('it_admin',          'IT Administrator',    'User and system management',                      1, 1),
    ('staff',             'Staff',               'Field staff — wallet top-ups and notifications',  1, 1),
    ('driver',            'Driver',              'Driver mobile app access',                        1, 1),
    ('passenger',         'Passenger',           'Passenger mobile app access',                     1, 1);
END;
GO

-- =====================================================================
-- SECTION 6: SEED PERMISSIONS
-- One row per module.action combination used in the HARDCODED_MATRIX
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM permissions WHERE permission_key = 'dashboard.view')
BEGIN
  INSERT INTO permissions (permission_key, module_name, action_name, description) VALUES
    ('dashboard.view',       'dashboard',     'view',   'View dashboard overview'),
    ('live.view',            'live',          'view',   'View live map and GPS feeds'),
    ('live.edit',            'live',          'edit',   'Update live trip data'),
    ('camera.view',          'camera',        'view',   'View onboard camera feeds'),
    ('drivers.view',         'drivers',       'view',   'View driver profiles'),
    ('drivers.create',       'drivers',       'create', 'Add new drivers'),
    ('drivers.edit',         'drivers',       'edit',   'Edit driver details'),
    ('drivers.delete',       'drivers',       'delete', 'Remove drivers'),
    ('vehicles.view',        'vehicles',      'view',   'View vehicle fleet'),
    ('vehicles.create',      'vehicles',      'create', 'Add new vehicles'),
    ('vehicles.edit',        'vehicles',      'edit',   'Edit vehicle details'),
    ('vehicles.delete',      'vehicles',      'delete', 'Remove vehicles'),
    ('routes.view',          'routes',        'view',   'View routes and stops'),
    ('routes.create',        'routes',        'create', 'Create new routes'),
    ('routes.edit',          'routes',        'edit',   'Edit route details'),
    ('routes.delete',        'routes',        'delete', 'Delete routes'),
    ('trips.view',           'trips',         'view',   'View trips'),
    ('trips.create',         'trips',         'create', 'Schedule new trips'),
    ('trips.edit',           'trips',         'edit',   'Update trip status'),
    ('trips.delete',         'trips',         'delete', 'Cancel / delete trips'),
    ('analytics.view',       'analytics',     'view',   'View reports and analytics'),
    ('tickets.view',         'tickets',       'view',   'View tickets'),
    ('tickets.create',       'tickets',       'create', 'Book tickets'),
    ('tickets.edit',         'tickets',       'edit',   'Modify ticket status'),
    ('tickets.delete',       'tickets',       'delete', 'Void tickets'),
    ('notifications.view',   'notifications', 'view',   'View notifications'),
    ('notifications.create', 'notifications', 'create', 'Send broadcast notifications'),
    ('ratings.view',         'ratings',       'view',   'View passenger ratings'),
    ('ratings.create',       'ratings',       'create', 'Submit a rating'),
    ('wallet.view',          'wallet',        'view',   'View wallet balance and history'),
    ('wallet.create',        'wallet',        'create', 'Top up a wallet'),
    ('wallet.edit',          'wallet',        'edit',   'Adjust or freeze wallets'),
    ('users.view',           'users',         'view',   'View user accounts'),
    ('users.create',         'users',         'create', 'Create user accounts'),
    ('users.edit',           'users',         'edit',   'Edit user accounts'),
    ('users.delete',         'users',         'delete', 'Delete user accounts');
END;
GO

-- =====================================================================
-- SECTION 7: SEED ROLE_PERMISSIONS  (mirrors HARDCODED_MATRIX exactly)
-- =====================================================================

-- super_admin: all permissions
IF NOT EXISTS (
  SELECT 1 FROM role_permissions rp
  JOIN roles r ON r.role_id = rp.role_id
  WHERE r.role_key = 'super_admin'
)
BEGIN
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.role_id, p.permission_id FROM roles r
  CROSS JOIN permissions p
  WHERE r.role_key = 'super_admin';
END;
GO

-- admin: all permissions
IF NOT EXISTS (
  SELECT 1 FROM role_permissions rp
  JOIN roles r ON r.role_id = rp.role_id
  WHERE r.role_key = 'admin'
)
BEGIN
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.role_id, p.permission_id FROM roles r
  CROSS JOIN permissions p
  WHERE r.role_key = 'admin';
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM role_permissions rp
  JOIN roles r ON r.role_id = rp.role_id
  WHERE r.role_key = 'transport_manager'
)
BEGIN
  -- transport_manager
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.role_id, p.permission_id FROM roles r
  CROSS JOIN permissions p
  WHERE r.role_key = 'transport_manager'
    AND p.permission_key IN (
      'dashboard.view','live.view','live.edit','camera.view',
      'drivers.view','drivers.create','drivers.edit',
      'vehicles.view','vehicles.create','vehicles.edit',
      'routes.view','routes.create','routes.edit',
      'trips.view','trips.create','trips.edit','trips.delete',
      'analytics.view','tickets.view','notifications.view',
      'ratings.view','users.view'
    );

  -- finance_officer
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.role_id, p.permission_id FROM roles r
  CROSS JOIN permissions p
  WHERE r.role_key = 'finance_officer'
    AND p.permission_key IN (
      'dashboard.view','analytics.view',
      'tickets.view','tickets.create','tickets.edit',
      'wallet.view','wallet.create','wallet.edit',
      'ratings.view','users.view'
    );

  -- ops_staff
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.role_id, p.permission_id FROM roles r
  CROSS JOIN permissions p
  WHERE r.role_key = 'ops_staff'
    AND p.permission_key IN (
      'dashboard.view','live.view','trips.view',
      'notifications.view','notifications.create',
      'camera.view','users.view'
    );

  -- auditor
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.role_id, p.permission_id FROM roles r
  CROSS JOIN permissions p
  WHERE r.role_key = 'auditor'
    AND p.permission_key IN (
      'dashboard.view','live.view','camera.view',
      'drivers.view','vehicles.view','routes.view','trips.view',
      'analytics.view','tickets.view','notifications.view',
      'ratings.view','wallet.view','users.view'
    );

  -- it_admin
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.role_id, p.permission_id FROM roles r
  CROSS JOIN permissions p
  WHERE r.role_key = 'it_admin'
    AND p.permission_key IN (
      'dashboard.view',
      'users.view','users.create','users.edit','users.delete',
      'vehicles.view','vehicles.edit',
      'live.view','camera.view','notifications.view','drivers.view'
    );

  -- staff
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.role_id, p.permission_id FROM roles r
  CROSS JOIN permissions p
  WHERE r.role_key = 'staff'
    AND p.permission_key IN (
      'dashboard.view','live.view','trips.view',
      'notifications.view','notifications.create',
      'camera.view',
      'wallet.view','wallet.create','wallet.edit',
      'users.view'
    );

  -- driver
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.role_id, p.permission_id FROM roles r
  CROSS JOIN permissions p
  WHERE r.role_key = 'driver'
    AND p.permission_key IN (
      'trips.view','trips.edit',
      'notifications.view','ratings.view','live.view'
    );

  -- passenger
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.role_id, p.permission_id FROM roles r
  CROSS JOIN permissions p
  WHERE r.role_key = 'passenger'
    AND p.permission_key IN (
      'tickets.view','tickets.create',
      'wallet.view','notifications.view',
      'ratings.create','trips.view'
    );
END;
GO

-- =====================================================================
-- SECTION 8: SEED USERS
-- =====================================================================

-- ── Admin / management accounts  (password: Admin@123) ──
MERGE users AS t
USING (SELECT N'superadmin@transit.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status)
  VALUES (N'Super Admin', N'superadmin@transit.com', N'$2b$10$eG/v0ScZnqUGry5mcjsvqO7lP2OyZNaA.jL6yPW6M2ltE7a.N/pbe', N'+961 1 000001', N'super_admin', N'active');

MERGE users AS t
USING (SELECT N'admin@transit.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status)
  VALUES (N'Ahmad Al-Hassan', N'admin@transit.com', N'$2b$10$eG/v0ScZnqUGry5mcjsvqO7lP2OyZNaA.jL6yPW6M2ltE7a.N/pbe', N'+961 1 000002', N'admin', N'active');

MERGE users AS t
USING (SELECT N'transport@transit.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status)
  VALUES (N'Leila Mansour', N'transport@transit.com', N'$2b$10$eG/v0ScZnqUGry5mcjsvqO7lP2OyZNaA.jL6yPW6M2ltE7a.N/pbe', N'+961 1 000003', N'transport_manager', N'active');

MERGE users AS t
USING (SELECT N'transport2@transit.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status)
  VALUES (N'Karim Bitar', N'transport2@transit.com', N'$2b$10$eG/v0ScZnqUGry5mcjsvqO7lP2OyZNaA.jL6yPW6M2ltE7a.N/pbe', N'+961 1 000004', N'transport_manager', N'active');

MERGE users AS t
USING (SELECT N'finance@transit.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status)
  VALUES (N'Nadia Khoury', N'finance@transit.com', N'$2b$10$eG/v0ScZnqUGry5mcjsvqO7lP2OyZNaA.jL6yPW6M2ltE7a.N/pbe', N'+961 1 000005', N'finance_officer', N'active');

MERGE users AS t
USING (SELECT N'ops@transit.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status)
  VALUES (N'George Habib', N'ops@transit.com', N'$2b$10$eG/v0ScZnqUGry5mcjsvqO7lP2OyZNaA.jL6yPW6M2ltE7a.N/pbe', N'+961 1 000006', N'ops_staff', N'active');

MERGE users AS t
USING (SELECT N'auditor@transit.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status)
  VALUES (N'Rania Saad', N'auditor@transit.com', N'$2b$10$eG/v0ScZnqUGry5mcjsvqO7lP2OyZNaA.jL6yPW6M2ltE7a.N/pbe', N'+961 1 000007', N'auditor', N'active');

MERGE users AS t
USING (SELECT N'itadmin@transit.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status)
  VALUES (N'Fadi Rizk', N'itadmin@transit.com', N'$2b$10$eG/v0ScZnqUGry5mcjsvqO7lP2OyZNaA.jL6yPW6M2ltE7a.N/pbe', N'+961 1 000008', N'it_admin', N'active');
GO

-- ── Staff accounts  (password: Staff@123) ──
MERGE users AS t
USING (SELECT N'staff1@transit.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status)
  VALUES (N'Sara Abi Nader', N'staff1@transit.com', N'$2b$10$6kSHNZeRNaNTNQUXAIEbpOGzIpoWMrNtSljKvfvEt/4QCVO0qC5Ye', N'+961 1 100001', N'staff', N'active');

MERGE users AS t
USING (SELECT N'staff2@transit.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status)
  VALUES (N'Marwan Khalil', N'staff2@transit.com', N'$2b$10$6kSHNZeRNaNTNQUXAIEbpOGzIpoWMrNtSljKvfvEt/4QCVO0qC5Ye', N'+961 1 100002', N'staff', N'active');
GO

-- ── Driver accounts  (password: Driver@123) ──
MERGE users AS t
USING (SELECT N'driver1@transit.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status)
  VALUES (N'Hassan Mawla', N'driver1@transit.com', N'$2b$10$Ioud0mU6hYQNDANn94R1DeO21jqBX7IiuAWJNezUU2rFyv0i1FUR2', N'+961 3 200001', N'driver', N'active');

MERGE users AS t
USING (SELECT N'driver2@transit.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status)
  VALUES (N'Omar Farouk', N'driver2@transit.com', N'$2b$10$Ioud0mU6hYQNDANn94R1DeO21jqBX7IiuAWJNezUU2rFyv0i1FUR2', N'+961 3 200002', N'driver', N'active');

MERGE users AS t
USING (SELECT N'driver3@transit.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status)
  VALUES (N'Youssef Daher', N'driver3@transit.com', N'$2b$10$Ioud0mU6hYQNDANn94R1DeO21jqBX7IiuAWJNezUU2rFyv0i1FUR2', N'+961 3 200003', N'driver', N'active');

MERGE users AS t
USING (SELECT N'driver4@transit.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status)
  VALUES (N'Ali Shaaban', N'driver4@transit.com', N'$2b$10$Ioud0mU6hYQNDANn94R1DeO21jqBX7IiuAWJNezUU2rFyv0i1FUR2', N'+961 3 200004', N'driver', N'active');

MERGE users AS t
USING (SELECT N'driver5@transit.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status)
  VALUES (N'Khaled Nassar', N'driver5@transit.com', N'$2b$10$Ioud0mU6hYQNDANn94R1DeO21jqBX7IiuAWJNezUU2rFyv0i1FUR2', N'+961 3 200005', N'driver', N'active');
GO

-- ── Passenger accounts  (password: Pass@1234) ──
MERGE users AS t
USING (SELECT N'passenger1@example.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status, category)
  VALUES (N'Amal Haddad', N'passenger1@example.com', N'$2b$10$1dRCfXAgao7ec271oOV8w.vbx3ig78/XMFBxv.adN9N30x81qdkRS', N'+961 70 300001', N'passenger', N'active', N'regular');

MERGE users AS t
USING (SELECT N'passenger2@example.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status, category)
  VALUES (N'Joelle Aziz', N'passenger2@example.com', N'$2b$10$1dRCfXAgao7ec271oOV8w.vbx3ig78/XMFBxv.adN9N30x81qdkRS', N'+961 70 300002', N'passenger', N'active', N'student');

MERGE users AS t
USING (SELECT N'passenger3@example.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status, category)
  VALUES (N'Ramzi Tannous', N'passenger3@example.com', N'$2b$10$1dRCfXAgao7ec271oOV8w.vbx3ig78/XMFBxv.adN9N30x81qdkRS', N'+961 70 300003', N'passenger', N'active', N'regular');

MERGE users AS t
USING (SELECT N'passenger4@example.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status, category)
  VALUES (N'Hana Frem', N'passenger4@example.com', N'$2b$10$1dRCfXAgao7ec271oOV8w.vbx3ig78/XMFBxv.adN9N30x81qdkRS', N'+961 70 300004', N'passenger', N'active', N'senior');

MERGE users AS t
USING (SELECT N'passenger5@example.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status, category)
  VALUES (N'Tarek Zein', N'passenger5@example.com', N'$2b$10$1dRCfXAgao7ec271oOV8w.vbx3ig78/XMFBxv.adN9N30x81qdkRS', N'+961 70 300005', N'passenger', N'active', N'regular');

MERGE users AS t
USING (SELECT N'passenger6@example.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status, category)
  VALUES (N'Lina Ghanem', N'passenger6@example.com', N'$2b$10$1dRCfXAgao7ec271oOV8w.vbx3ig78/XMFBxv.adN9N30x81qdkRS', N'+961 70 300006', N'passenger', N'active', N'student');

MERGE users AS t
USING (SELECT N'passenger7@example.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status, category)
  VALUES (N'Charbel Azar', N'passenger7@example.com', N'$2b$10$1dRCfXAgao7ec271oOV8w.vbx3ig78/XMFBxv.adN9N30x81qdkRS', N'+961 70 300007', N'passenger', N'active', N'regular');

MERGE users AS t
USING (SELECT N'passenger8@example.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status, category)
  VALUES (N'Maya Sarkis', N'passenger8@example.com', N'$2b$10$1dRCfXAgao7ec271oOV8w.vbx3ig78/XMFBxv.adN9N30x81qdkRS', N'+961 70 300008', N'passenger', N'active', N'regular');

MERGE users AS t
USING (SELECT N'passenger9@example.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status, category)
  VALUES (N'Sami Nasr', N'passenger9@example.com', N'$2b$10$1dRCfXAgao7ec271oOV8w.vbx3ig78/XMFBxv.adN9N30x81qdkRS', N'+961 70 300009', N'passenger', N'active', N'regular');

MERGE users AS t
USING (SELECT N'passenger10@example.com' AS email) AS s ON t.email = s.email
WHEN NOT MATCHED THEN INSERT (full_name, email, password_hash, phone, role, status, category)
  VALUES (N'Rana Jaber', N'passenger10@example.com', N'$2b$10$1dRCfXAgao7ec271oOV8w.vbx3ig78/XMFBxv.adN9N30x81qdkRS', N'+961 70 300010', N'passenger', N'active', N'student');
GO

-- =====================================================================
-- SECTION 9: SEED VEHICLES
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM vehicles WHERE plate_number = 'LEB-1001')
BEGIN
  INSERT INTO vehicles (plate_number, vehicle_type, capacity, model, status) VALUES
    ('LEB-1001', 'standard',   45, 'Mercedes Sprinter 2022', 'active'),
    ('LEB-1002', 'standard',   45, 'Mercedes Sprinter 2021', 'active'),
    ('LEB-1003', 'articulated',80, 'Volvo 7900 2023',        'active'),
    ('LEB-1004', 'minibus',    20, 'Toyota Coaster 2022',    'active'),
    ('LEB-1005', 'standard',   45, 'Yutong ZK6119H 2023',   'maintenance');
END;
GO

-- =====================================================================
-- SECTION 10: SEED ROUTES
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM routes WHERE route_name LIKE 'Route 1%')
BEGIN
  INSERT INTO routes (route_name, start_location, end_location) VALUES
    ('Route 1 - Beirut Central to Jounieh', 'Riad El Solh, Beirut',    'Jounieh Waterfront'),
    ('Route 2 - Hamra to Dora',             'Hamra, Beirut',            'Dora Bus Terminal'),
    ('Route 3 - Verdun to Antelias',        'Verdun, Beirut',           'Antelias Center'),
    ('Route 4 - Airport to Downtown',       'Beirut Int Airport',       'Martyrs Square, Beirut');
END;
GO

-- =====================================================================
-- SECTION 11: SEED STOPS
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM stops WHERE stop_name = 'Riad El Solh Square')
BEGIN
  INSERT INTO stops (stop_name, latitude, longitude) VALUES
    -- Route 1 (Beirut Central → Jounieh)
    ('Riad El Solh Square',        33.889520, 35.501330),
    ('Bechara El Khoury',          33.887180, 35.511240),
    ('Charles Helou Terminal',     33.895400, 35.517600),
    ('Dbayeh Highway Junction',    33.921700, 35.579300),
    ('Kaslik Center',              33.959400, 35.628800),
    ('Jounieh Waterfront',         33.982100, 35.617500),
    -- Route 2 (Hamra → Dora)
    ('Hamra Main Street',          33.895100, 35.477900),
    ('Tallet El Khayat',           33.882700, 35.489500),
    ('Cola Intersection',          33.869800, 35.490700),
    ('Museum Crossing',            33.881800, 35.507900),
    ('Tabaris Square',             33.889000, 35.514400),
    ('Dora Bus Terminal',          33.902600, 35.547700),
    -- Route 3 (Verdun → Antelias)
    ('Verdun Street',              33.887400, 35.485200),
    ('Sanayeh Garden',             33.886500, 35.494100),
    ('Ashrafieh Sassine',          33.887700, 35.519600),
    ('Bourj Hammoud Bridge',       33.882100, 35.540000),
    ('Antelias Center',            33.897200, 35.573800),
    -- Route 4 (Airport → Downtown)
    ('Beirut Airport Terminal 1',  33.820900, 35.488700),
    ('Ouzai Junction',             33.840000, 35.494600),
    ('Corniche Al Mazraa',         33.866900, 35.490200),
    ('Martyrs Square',             33.888900, 35.503500);
END;
GO

-- =====================================================================
-- SECTION 12: SEED ROUTE_STOPS
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM route_stops)
BEGIN
  -- Route 1
  INSERT INTO route_stops (route_id, stop_id, stop_order)
  SELECT r.route_id, s.stop_id, v.stop_order
  FROM routes r
  CROSS JOIN (VALUES
    (N'Riad El Solh Square',     1),
    (N'Bechara El Khoury',       2),
    (N'Charles Helou Terminal',  3),
    (N'Dbayeh Highway Junction', 4),
    (N'Kaslik Center',           5),
    (N'Jounieh Waterfront',      6)
  ) v(stop_name, stop_order)
  JOIN stops s ON s.stop_name = v.stop_name
  WHERE r.route_name LIKE 'Route 1%';

  -- Route 2
  INSERT INTO route_stops (route_id, stop_id, stop_order)
  SELECT r.route_id, s.stop_id, v.stop_order
  FROM routes r
  CROSS JOIN (VALUES
    (N'Hamra Main Street',  1),
    (N'Tallet El Khayat',   2),
    (N'Cola Intersection',  3),
    (N'Museum Crossing',    4),
    (N'Tabaris Square',     5),
    (N'Dora Bus Terminal',  6)
  ) v(stop_name, stop_order)
  JOIN stops s ON s.stop_name = v.stop_name
  WHERE r.route_name LIKE 'Route 2%';

  -- Route 3
  INSERT INTO route_stops (route_id, stop_id, stop_order)
  SELECT r.route_id, s.stop_id, v.stop_order
  FROM routes r
  CROSS JOIN (VALUES
    (N'Verdun Street',       1),
    (N'Sanayeh Garden',      2),
    (N'Ashrafieh Sassine',   3),
    (N'Bourj Hammoud Bridge',4),
    (N'Antelias Center',     5)
  ) v(stop_name, stop_order)
  JOIN stops s ON s.stop_name = v.stop_name
  WHERE r.route_name LIKE 'Route 3%';

  -- Route 4
  INSERT INTO route_stops (route_id, stop_id, stop_order)
  SELECT r.route_id, s.stop_id, v.stop_order
  FROM routes r
  CROSS JOIN (VALUES
    (N'Beirut Airport Terminal 1', 1),
    (N'Ouzai Junction',            2),
    (N'Corniche Al Mazraa',        3),
    (N'Martyrs Square',            4)
  ) v(stop_name, stop_order)
  JOIN stops s ON s.stop_name = v.stop_name
  WHERE r.route_name LIKE 'Route 4%';
END;
GO

-- =====================================================================
-- SECTION 13: SEED STOP AMENITIES
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM stop_amenities)
BEGIN
  INSERT INTO stop_amenities (stop_id, has_shelter, has_seating, has_lighting, has_wheelchair, has_ticket_machine, has_wifi, nearby_landmark)
  SELECT s.stop_id, a.shelter, a.seating, a.lighting, a.wheelchair, a.machine, a.wifi, a.landmark
  FROM stops s
  JOIN (VALUES
    (N'Riad El Solh Square',     1,1,1,1,1,1,N'Riad El Solh Palace'),
    (N'Charles Helou Terminal',  1,1,1,1,1,0,N'Charles Helou Bus Station'),
    (N'Hamra Main Street',       1,1,1,0,0,0,N'Hamra Commercial District'),
    (N'Dora Bus Terminal',       1,1,1,1,1,0,N'Dora Interchange'),
    (N'Beirut Airport Terminal 1',1,1,1,1,1,1,N'Rafic Hariri International Airport'),
    (N'Martyrs Square',          1,1,1,1,0,1,N'Martyrs Monument')
  ) a(stop_name, shelter, seating, lighting, wheelchair, machine, wifi, landmark)
  ON s.stop_name = a.stop_name;
END;
GO

-- =====================================================================
-- SECTION 14: SEED DRIVERS TABLE
-- =====================================================================

MERGE drivers AS t
USING (SELECT u.user_id, N'LB-D-2001' AS lic, CAST(N'2020-01-15' AS DATE) AS hd, CAST(N'2027-01-15' AS DATE) AS exp
       FROM users u WHERE u.email = N'driver1@transit.com') AS s
ON t.user_id = s.user_id
WHEN NOT MATCHED THEN INSERT (user_id, license_number, hire_date, license_expiry_date)
  VALUES (s.user_id, s.lic, s.hd, s.exp);

MERGE drivers AS t
USING (SELECT u.user_id, N'LB-D-2002' AS lic, CAST(N'2021-03-20' AS DATE) AS hd, CAST(N'2028-03-20' AS DATE) AS exp
       FROM users u WHERE u.email = N'driver2@transit.com') AS s
ON t.user_id = s.user_id
WHEN NOT MATCHED THEN INSERT (user_id, license_number, hire_date, license_expiry_date)
  VALUES (s.user_id, s.lic, s.hd, s.exp);

MERGE drivers AS t
USING (SELECT u.user_id, N'LB-D-2003' AS lic, CAST(N'2019-06-10' AS DATE) AS hd, CAST(N'2026-06-10' AS DATE) AS exp
       FROM users u WHERE u.email = N'driver3@transit.com') AS s
ON t.user_id = s.user_id
WHEN NOT MATCHED THEN INSERT (user_id, license_number, hire_date, license_expiry_date)
  VALUES (s.user_id, s.lic, s.hd, s.exp);

MERGE drivers AS t
USING (SELECT u.user_id, N'LB-D-2004' AS lic, CAST(N'2022-09-01' AS DATE) AS hd, CAST(N'2029-09-01' AS DATE) AS exp
       FROM users u WHERE u.email = N'driver4@transit.com') AS s
ON t.user_id = s.user_id
WHEN NOT MATCHED THEN INSERT (user_id, license_number, hire_date, license_expiry_date)
  VALUES (s.user_id, s.lic, s.hd, s.exp);

MERGE drivers AS t
USING (SELECT u.user_id, N'LB-D-2005' AS lic, CAST(N'2023-02-14' AS DATE) AS hd, CAST(N'2030-02-14' AS DATE) AS exp
       FROM users u WHERE u.email = N'driver5@transit.com') AS s
ON t.user_id = s.user_id
WHEN NOT MATCHED THEN INSERT (user_id, license_number, hire_date, license_expiry_date)
  VALUES (s.user_id, s.lic, s.hd, s.exp);
GO

-- =====================================================================
-- SECTION 15: SEED TRIPS
-- Uses subqueries on natural keys — safe on any IDENTITY start value
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM trips)
BEGIN
  -- Completed trips
  INSERT INTO trips (vehicle_id, driver_id, route_id, start_time, end_time, status)
  SELECT v.vehicle_id, d.driver_id, r.route_id, t.start_time, t.end_time, t.status
  FROM (VALUES
    (N'LEB-1001', N'driver1@transit.com', N'Route 1%', CAST('2026-05-20 07:00' AS DATETIME2), CAST('2026-05-20 08:30' AS DATETIME2), N'completed'),
    (N'LEB-1002', N'driver2@transit.com', N'Route 2%', CAST('2026-05-20 08:00' AS DATETIME2), CAST('2026-05-20 09:00' AS DATETIME2), N'completed'),
    (N'LEB-1003', N'driver3@transit.com', N'Route 3%', CAST('2026-05-21 09:00' AS DATETIME2), CAST('2026-05-21 10:30' AS DATETIME2), N'completed'),
    (N'LEB-1004', N'driver4@transit.com', N'Route 4%', CAST('2026-05-21 10:00' AS DATETIME2), CAST('2026-05-21 11:00' AS DATETIME2), N'completed'),
    (N'LEB-1001', N'driver5@transit.com', N'Route 1%', CAST('2026-05-22 07:00' AS DATETIME2), CAST('2026-05-22 08:30' AS DATETIME2), N'completed'),
    (N'LEB-1002', N'driver1@transit.com', N'Route 2%', CAST('2026-05-22 14:00' AS DATETIME2), CAST('2026-05-22 15:00' AS DATETIME2), N'completed'),
    (N'LEB-1003', N'driver2@transit.com', N'Route 3%', CAST('2026-05-23 08:00' AS DATETIME2), CAST('2026-05-23 09:30' AS DATETIME2), N'completed'),
    (N'LEB-1004', N'driver3@transit.com', N'Route 4%', CAST('2026-05-23 11:00' AS DATETIME2), CAST('2026-05-23 12:00' AS DATETIME2), N'completed'),
    -- Today (active + scheduled)
    (N'LEB-1001', N'driver1@transit.com', N'Route 1%', CAST('2026-05-25 07:00' AS DATETIME2), NULL,                                  N'active'),
    (N'LEB-1002', N'driver2@transit.com', N'Route 2%', CAST('2026-05-25 14:00' AS DATETIME2), NULL,                                  N'scheduled'),
    (N'LEB-1003', N'driver3@transit.com', N'Route 3%', CAST('2026-05-25 16:00' AS DATETIME2), NULL,                                  N'scheduled'),
    (N'LEB-1004', N'driver4@transit.com', N'Route 4%', CAST('2026-05-26 08:00' AS DATETIME2), NULL,                                  N'scheduled')
  ) t(plate, driver_email, route_pat, start_time, end_time, status)
  JOIN vehicles v ON v.plate_number = t.plate
  JOIN users    u ON u.email        = t.driver_email
  JOIN drivers  d ON d.user_id      = u.user_id
  JOIN routes   r ON r.route_name  LIKE t.route_pat;
END;
GO

-- =====================================================================
-- SECTION 16: SEED TICKETS
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM tickets)
BEGIN
  INSERT INTO tickets (user_id, trip_id, seat_number, status, amount, booking_time)
  SELECT u.user_id, tr.trip_id, t.seat, t.status, t.amount, CAST(t.booked_at AS DATETIME2)
  FROM (VALUES
    -- Trip 1 (Route 1, 2026-05-20 07:00, completed)
    (N'passenger1@example.com', N'Route 1%', N'2026-05-20 07:00', N'A1', N'used',   1.50, N'2026-05-20 06:30'),
    (N'passenger2@example.com', N'Route 1%', N'2026-05-20 07:00', N'A2', N'used',   1.12, N'2026-05-20 06:35'),
    (N'passenger3@example.com', N'Route 1%', N'2026-05-20 07:00', N'A3', N'used',   1.50, N'2026-05-20 06:40'),
    -- Trip 2 (Route 2, 2026-05-20 08:00, completed)
    (N'passenger4@example.com', N'Route 2%', N'2026-05-20 08:00', N'B1', N'used',   1.05, N'2026-05-20 07:45'),
    (N'passenger5@example.com', N'Route 2%', N'2026-05-20 08:00', N'B2', N'used',   1.50, N'2026-05-20 07:50'),
    -- Trip 3 (Route 3, 2026-05-21 09:00, completed)
    (N'passenger6@example.com', N'Route 3%', N'2026-05-21 09:00', N'A1', N'used',   1.50, N'2026-05-21 08:45'),
    (N'passenger7@example.com', N'Route 3%', N'2026-05-21 09:00', N'A2', N'used',   1.50, N'2026-05-21 08:50'),
    -- Trip 5 (Route 1, 2026-05-22 07:00, completed)
    (N'passenger1@example.com', N'Route 1%', N'2026-05-22 07:00', N'A1', N'used',   1.50, N'2026-05-22 06:30'),
    (N'passenger8@example.com', N'Route 1%', N'2026-05-22 07:00', N'B1', N'used',   1.50, N'2026-05-22 06:35'),
    -- Trip 9 (Route 1, 2026-05-25 07:00, active — today)
    (N'passenger1@example.com', N'Route 1%', N'2026-05-25 07:00', N'A1', N'booked', 1.50, N'2026-05-25 06:00'),
    (N'passenger9@example.com', N'Route 1%', N'2026-05-25 07:00', N'A2', N'booked', 1.50, N'2026-05-25 06:05'),
    (N'passenger10@example.com',N'Route 1%', N'2026-05-25 07:00', N'A3', N'booked', 1.50, N'2026-05-25 06:10'),
    -- Trip 10 (Route 2, 2026-05-25 14:00, scheduled — today)
    (N'passenger2@example.com', N'Route 2%', N'2026-05-25 14:00', N'A1', N'booked', 1.12, N'2026-05-24 20:00'),
    (N'passenger3@example.com', N'Route 2%', N'2026-05-25 14:00', N'A2', N'booked', 1.50, N'2026-05-24 20:05')
  ) t(pax_email, route_pat, trip_start, seat, status, amount, booked_at)
  JOIN users   u  ON u.email        = t.pax_email
  JOIN routes  r  ON r.route_name  LIKE t.route_pat
  JOIN trips   tr ON tr.route_id    = r.route_id
                  AND tr.start_time = CAST(t.trip_start AS DATETIME2);
END;
GO

-- =====================================================================
-- SECTION 17: SEED WALLETS
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM wallets)
BEGIN
  INSERT INTO wallets (user_id, balance, updated_at)
  SELECT u.user_id, w.balance, GETUTCDATE()
  FROM (VALUES
    (N'passenger1@example.com',   45.50),
    (N'passenger2@example.com',   18.75),
    (N'passenger3@example.com',   62.00),
    (N'passenger4@example.com',    8.25),
    (N'passenger5@example.com',   33.00),
    (N'passenger6@example.com',   27.50),
    (N'passenger7@example.com',    5.00),
    (N'passenger8@example.com',   91.25),
    (N'passenger9@example.com',   15.00),
    (N'passenger10@example.com',  50.00),
    (N'staff1@transit.com',        0.00),
    (N'staff2@transit.com',        0.00)
  ) w(email, balance)
  JOIN users u ON u.email = w.email;
END;
GO

-- =====================================================================
-- SECTION 18: SEED WALLET TRANSACTIONS
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM wallet_transactions)
BEGIN
  -- Initial top-up credit for every passenger
  INSERT INTO wallet_transactions (user_id, type, amount, description, created_at)
  SELECT u.user_id, 'credit', 50.00, 'Initial wallet top-up', CAST('2026-05-19 12:00' AS DATETIME)
  FROM users u WHERE u.role = 'passenger';

  -- Debits matching the seeded tickets
  INSERT INTO wallet_transactions (user_id, type, amount, description, created_at)
  SELECT u.user_id, 'debit', t.amount, t.descr, CAST(t.created_at AS DATETIME)
  FROM (VALUES
    (N'passenger1@example.com', 1.50, N'Ticket: Route 1, 2026-05-20', N'2026-05-20 06:30'),
    (N'passenger2@example.com', 1.12, N'Ticket: Route 1, 2026-05-20', N'2026-05-20 06:35'),
    (N'passenger3@example.com', 1.50, N'Ticket: Route 1, 2026-05-20', N'2026-05-20 06:40'),
    (N'passenger4@example.com', 1.05, N'Ticket: Route 2, 2026-05-20', N'2026-05-20 07:45'),
    (N'passenger5@example.com', 1.50, N'Ticket: Route 2, 2026-05-20', N'2026-05-20 07:50'),
    (N'passenger6@example.com', 1.50, N'Ticket: Route 3, 2026-05-21', N'2026-05-21 08:45'),
    (N'passenger7@example.com', 1.50, N'Ticket: Route 3, 2026-05-21', N'2026-05-21 08:50'),
    (N'passenger1@example.com', 1.50, N'Ticket: Route 1, 2026-05-22', N'2026-05-22 06:30'),
    (N'passenger8@example.com', 1.50, N'Ticket: Route 1, 2026-05-22', N'2026-05-22 06:35'),
    (N'passenger1@example.com', 1.50, N'Ticket: Route 1, 2026-05-25', N'2026-05-25 06:00'),
    (N'passenger9@example.com', 1.50, N'Ticket: Route 1, 2026-05-25', N'2026-05-25 06:05'),
    (N'passenger10@example.com',1.50, N'Ticket: Route 1, 2026-05-25', N'2026-05-25 06:10'),
    (N'passenger2@example.com', 1.12, N'Ticket: Route 2, 2026-05-25', N'2026-05-24 20:00'),
    (N'passenger3@example.com', 1.50, N'Ticket: Route 2, 2026-05-25', N'2026-05-24 20:05')
  ) t(email, amount, descr, created_at)
  JOIN users u ON u.email = t.email;
END;
GO

-- =====================================================================
-- SECTION 19: SEED RATINGS
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM ratings)
BEGIN
  INSERT INTO ratings (user_id, trip_id, rating, comment)
  SELECT u.user_id, tr.trip_id, t.rating, t.comment
  FROM (VALUES
    (N'passenger1@example.com', N'Route 1%', N'2026-05-20 07:00', 5, N'Excellent service, very punctual!'),
    (N'passenger2@example.com', N'Route 1%', N'2026-05-20 07:00', 4, N'Comfortable ride, slight delay at Bechara.'),
    (N'passenger3@example.com', N'Route 1%', N'2026-05-20 07:00', 5, N'Driver was very professional.'),
    (N'passenger4@example.com', N'Route 2%', N'2026-05-20 08:00', 3, N'Bus was crowded during peak hour.'),
    (N'passenger5@example.com', N'Route 2%', N'2026-05-20 08:00', 4, N'Good experience overall.'),
    (N'passenger6@example.com', N'Route 3%', N'2026-05-21 09:00', 5, N'On time and clean bus!'),
    (N'passenger7@example.com', N'Route 3%', N'2026-05-21 09:00', 4, N'Nice route, friendly driver.'),
    (N'passenger1@example.com', N'Route 1%', N'2026-05-22 07:00', 5, N'Smooth ride to Jounieh.'),
    (N'passenger8@example.com', N'Route 1%', N'2026-05-22 07:00', 3, N'AC was not working properly.')
  ) t(pax_email, route_pat, trip_start, rating, comment)
  JOIN users  u  ON u.email       = t.pax_email
  JOIN routes r  ON r.route_name LIKE t.route_pat
  JOIN trips  tr ON tr.route_id   = r.route_id
                 AND tr.start_time = CAST(t.trip_start AS DATETIME2);
END;
GO

-- =====================================================================
-- SECTION 20: SEED GPS LOGS
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM gps_logs)
BEGIN
  INSERT INTO gps_logs (trip_id, latitude, longitude, recorded_at)
  SELECT tr.trip_id, g.lat, g.lng, CAST(g.ts AS DATETIME2)
  FROM (VALUES
    -- Trip 1: Route 1, 2026-05-20 07:00 (completed)
    (N'Route 1%', N'2026-05-20 07:00', 33.889520, 35.501330, N'2026-05-20 07:00'),
    (N'Route 1%', N'2026-05-20 07:00', 33.891200, 35.505600, N'2026-05-20 07:05'),
    (N'Route 1%', N'2026-05-20 07:00', 33.895400, 35.517600, N'2026-05-20 07:15'),
    (N'Route 1%', N'2026-05-20 07:00', 33.905100, 35.540200, N'2026-05-20 07:30'),
    (N'Route 1%', N'2026-05-20 07:00', 33.921700, 35.579300, N'2026-05-20 07:50'),
    (N'Route 1%', N'2026-05-20 07:00', 33.959400, 35.628800, N'2026-05-20 08:10'),
    (N'Route 1%', N'2026-05-20 07:00', 33.982100, 35.617500, N'2026-05-20 08:30'),
    -- Trip 9: Route 1, 2026-05-25 07:00 (active today)
    (N'Route 1%', N'2026-05-25 07:00', 33.889520, 35.501330, N'2026-05-25 07:00'),
    (N'Route 1%', N'2026-05-25 07:00', 33.891200, 35.505600, N'2026-05-25 07:05'),
    (N'Route 1%', N'2026-05-25 07:00', 33.895400, 35.517600, N'2026-05-25 07:15')
  ) g(route_pat, trip_start, lat, lng, ts)
  JOIN routes r  ON r.route_name LIKE g.route_pat
  JOIN trips  tr ON tr.route_id   = r.route_id
                 AND tr.start_time = CAST(g.trip_start AS DATETIME2);
END;
GO

-- =====================================================================
-- SECTION 21: SEED NOTIFICATIONS
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM notifications)
BEGIN
  INSERT INTO notifications (user_id, message, title, body, type, target_group, sent_count, read_count)
  VALUES
    (NULL,
     'Welcome to the FYP Transit System! Plan your journeys easily with real-time bus tracking.',
     'Welcome to Transit System',
     'Welcome to the FYP Transit System! Plan your journeys easily with real-time bus tracking.',
     'info', 'all_users', 25, 12),

    (NULL,
     'Route 1 will have a 15-minute delay on Friday morning due to road works near Dbayeh.',
     'Service Delay Alert',
     'Route 1 will have a 15-minute delay on Friday morning (07:00-09:00) due to road works near Dbayeh.',
     'warning', 'passengers', 18, 8),

    (NULL,
     'New wallet top-up locations are now available in Jounieh and Antelias.',
     'New Top-Up Locations',
     'You can now top up your wallet at 6 locations across the network. Visit the app for details.',
     'info', 'passengers', 15, 5),

    ((SELECT user_id FROM users WHERE email = 'driver1@transit.com'),
     'Your shift starts at 07:00 today. Vehicle LEB-1001 is ready at Riad El Solh depot.',
     'Shift Reminder',
     'Your shift starts at 07:00 today. Please report to Riad El Solh depot. Vehicle: LEB-1001.',
     'info', 'specific_user', 1, 1);
END;
GO

-- =====================================================================
-- SECTION 22: SEED TOP-UP LOCATIONS
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM top_up_locations)
BEGIN
  INSERT INTO top_up_locations (name, address, city, phone, hours, is_active) VALUES
    ('Riad El Solh Transit Hub',      '5 Riad El Solh Square',         'Beirut',         '+961 1 201010', 'Mon-Fri 06:00-20:00, Sat-Sun 08:00-18:00', 1),
    ('Hamra Customer Service Centre', '12 Hamra Main Street',           'Beirut',         '+961 1 202020', 'Daily 07:00-21:00',                         1),
    ('Dora Terminal Office',          'Dora Bus Terminal, Ground Floor', 'Dora',           '+961 1 203030', 'Daily 06:00-22:00',                         1),
    ('Jounieh Service Point',         '3 Jounieh Waterfront Road',      'Jounieh',        '+961 9 204040', 'Mon-Fri 08:00-18:00',                       1),
    ('Antelias Agent Counter',        'Antelias Center, Shop 5',        'Antelias',       '+961 4 205050', 'Mon-Sat 09:00-19:00',                       1),
    ('Airport Transit Kiosk',         'Terminal 1, Arrivals Hall',      'Beirut Airport', '+961 1 206060', 'Daily 05:00-23:00',                         1);
END;
GO

-- =====================================================================
-- SECTION 23: SEED ROUTE WAYPOINTS  (GPS polyline for each route)
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM route_waypoints)
BEGIN
  -- Route 1: Beirut → Jounieh (coastal highway)
  INSERT INTO route_waypoints (route_id, latitude, longitude, wp_order)
  SELECT r.route_id, v.lat, v.lng, v.ord
  FROM routes r
  CROSS JOIN (VALUES
    (33.889520,35.501330,0),(33.890800,35.505000,1),(33.895400,35.517600,2),
    (33.900200,35.528400,3),(33.908600,35.548000,4),(33.921700,35.579300,5),
    (33.935000,35.600000,6),(33.950000,35.618000,7),(33.959400,35.628800,8),
    (33.970000,35.620000,9),(33.982100,35.617500,10)
  ) v(lat,lng,ord)
  WHERE r.route_name LIKE 'Route 1%';

  -- Route 2: Hamra → Dora
  INSERT INTO route_waypoints (route_id, latitude, longitude, wp_order)
  SELECT r.route_id, v.lat, v.lng, v.ord
  FROM routes r
  CROSS JOIN (VALUES
    (33.895100,35.477900,0),(33.887000,35.482000,1),(33.882700,35.489500,2),
    (33.876000,35.490000,3),(33.869800,35.490700,4),(33.875000,35.498000,5),
    (33.881800,35.507900,6),(33.889000,35.514400,7),(33.895000,35.530000,8),
    (33.902600,35.547700,9)
  ) v(lat,lng,ord)
  WHERE r.route_name LIKE 'Route 2%';

  -- Route 3: Verdun → Antelias
  INSERT INTO route_waypoints (route_id, latitude, longitude, wp_order)
  SELECT r.route_id, v.lat, v.lng, v.ord
  FROM routes r
  CROSS JOIN (VALUES
    (33.887400,35.485200,0),(33.887000,35.490000,1),(33.886500,35.494100,2),
    (33.887000,35.505000,3),(33.887700,35.519600,4),(33.885000,35.530000,5),
    (33.882100,35.540000,6),(33.886000,35.555000,7),(33.897200,35.573800,8)
  ) v(lat,lng,ord)
  WHERE r.route_name LIKE 'Route 3%';

  -- Route 4: Airport → Downtown
  INSERT INTO route_waypoints (route_id, latitude, longitude, wp_order)
  SELECT r.route_id, v.lat, v.lng, v.ord
  FROM routes r
  CROSS JOIN (VALUES
    (33.820900,35.488700,0),(33.830000,35.490000,1),(33.840000,35.494600,2),
    (33.850000,35.492000,3),(33.858000,35.491000,4),(33.866900,35.490200,5),
    (33.875000,35.495000,6),(33.882000,35.499000,7),(33.888900,35.503500,8)
  ) v(lat,lng,ord)
  WHERE r.route_name LIKE 'Route 4%';
END;
GO

-- =====================================================================
-- SECTION 24: SEED VEHICLE DOCS (compliance records)
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM vehicle_docs)
BEGIN
  INSERT INTO vehicle_docs (plate, registration_expiry, insurance_expiry, roadworthiness_expiry) VALUES
    ('LEB-1001', '2027-01-31', '2026-12-31', '2027-03-31'),
    ('LEB-1002', '2027-01-31', '2026-12-31', '2027-03-31'),
    ('LEB-1003', '2027-06-30', '2027-05-31', '2027-06-30'),
    ('LEB-1004', '2027-01-31', '2026-11-30', '2027-02-28'),
    ('LEB-1005', '2026-09-30', '2026-08-31', '2026-09-30');
END;
GO

PRINT '====================================================';
PRINT 'Seed completed successfully.';
PRINT '';
PRINT 'Login credentials:';
PRINT '  superadmin@transit.com   /  Admin@123';
PRINT '  admin@transit.com        /  Admin@123';
PRINT '  transport@transit.com    /  Admin@123';
PRINT '  finance@transit.com      /  Admin@123';
PRINT '  ops@transit.com          /  Admin@123';
PRINT '  auditor@transit.com      /  Admin@123';
PRINT '  itadmin@transit.com      /  Admin@123';
PRINT '  staff1@transit.com       /  Staff@123';
PRINT '  driver1@transit.com      /  Driver@123';
PRINT '  passenger1@example.com   /  Pass@1234';
PRINT '====================================================';
GO
