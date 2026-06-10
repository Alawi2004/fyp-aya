-- ============================================================
-- Migration 005 — Full idempotent verification
-- Checks every table needed by the application and creates
-- any that are missing.  Safe to re-run at any time.
-- Run: sqlcmd -S <server> -d <db> -U <user> -P <pass> -i 005_verify_all_tables.sql
-- ============================================================

-- ── From 001: Auth token tables ──────────────────────────────────────────────

IF OBJECT_ID('refresh_tokens','U') IS NULL
  CREATE TABLE refresh_tokens (
    id         INT          IDENTITY(1,1) PRIMARY KEY,
    user_id    INT          NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash NVARCHAR(64) NOT NULL,
    expires_at DATETIME2    NOT NULL,
    created_at DATETIME2    NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_refresh_token_hash UNIQUE (token_hash)
  );

IF OBJECT_ID('user_sessions','U') IS NULL
  CREATE TABLE user_sessions (
    session_id          INT           IDENTITY(1,1) PRIMARY KEY,
    user_id             INT           NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash          NVARCHAR(64)  NOT NULL UNIQUE,
    device_fingerprint  NVARCHAR(64)  NULL,
    device_name         NVARCHAR(200) NULL,
    ip_address          NVARCHAR(64)  NULL,
    user_agent          NVARCHAR(500) NULL,
    expires_at          DATETIME2     NOT NULL,
    last_active_at      DATETIME2     NULL,
    created_at          DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );

IF OBJECT_ID('login_lockouts','U') IS NULL
  CREATE TABLE login_lockouts (
    email           NVARCHAR(120) NOT NULL PRIMARY KEY,
    failed_attempts INT           NOT NULL DEFAULT 0,
    locked_until    DATETIME2     NULL,
    lockout_count   INT           NOT NULL DEFAULT 0,
    last_attempt_at DATETIME2     NULL
  );

IF OBJECT_ID('user_totp','U') IS NULL
  CREATE TABLE user_totp (
    totp_id     INT           IDENTITY(1,1) PRIMARY KEY,
    user_id     INT           NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    secret      NVARCHAR(100) NOT NULL,
    enabled     BIT           NOT NULL DEFAULT 0,
    verified_at DATETIME2     NULL
  );

IF OBJECT_ID('password_reset_tokens','U') IS NULL
  CREATE TABLE password_reset_tokens (
    token_id   INT           IDENTITY(1,1) PRIMARY KEY,
    user_id    INT           NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash NVARCHAR(64)  NOT NULL UNIQUE,
    expires_at DATETIME2     NOT NULL,
    used_at    DATETIME2     NULL,
    created_at DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );

-- ── From 002: Staff shifts + complaints ──────────────────────────────────────

IF OBJECT_ID('staff_shift_sessions','U') IS NULL
  CREATE TABLE staff_shift_sessions (
    session_id   INT          IDENTITY(1,1) PRIMARY KEY,
    staff_id     INT          NOT NULL REFERENCES users(user_id),
    started_at   DATETIME2    NOT NULL DEFAULT GETUTCDATE(),
    ended_at     DATETIME2    NULL,
    location     NVARCHAR(200) NULL,
    notes        NVARCHAR(500) NULL
  );

IF OBJECT_ID('complaints','U') IS NULL
  CREATE TABLE complaints (
    complaint_id   INT          IDENTITY(1,1) PRIMARY KEY,
    user_id        INT          NOT NULL REFERENCES users(user_id),
    driver_id      INT          NULL,
    trip_id        INT          NULL,
    category       NVARCHAR(50) NOT NULL DEFAULT 'general',
    priority       NVARCHAR(20) NOT NULL DEFAULT 'medium',
    status         NVARCHAR(20) NOT NULL DEFAULT 'open',
    description    NVARCHAR(2000) NOT NULL,
    submitted_at   DATETIME2    NOT NULL DEFAULT GETUTCDATE(),
    resolved_at    DATETIME2    NULL
  );

IF OBJECT_ID('complaint_updates','U') IS NULL
  CREATE TABLE complaint_updates (
    update_id    INT          IDENTITY(1,1) PRIMARY KEY,
    complaint_id INT          NOT NULL REFERENCES complaints(complaint_id) ON DELETE CASCADE,
    author_id    INT          NOT NULL REFERENCES users(user_id),
    message      NVARCHAR(1000) NOT NULL,
    created_at   DATETIME2    NOT NULL DEFAULT GETUTCDATE()
  );

-- ── From 003: Token blacklist + passenger QR ─────────────────────────────────

IF OBJECT_ID('refresh_token_blacklist','U') IS NULL
  CREATE TABLE refresh_token_blacklist (
    id         INT          IDENTITY(1,1) PRIMARY KEY,
    user_id    INT          NULL,
    token_hash NVARCHAR(64) NOT NULL UNIQUE,
    reason     NVARCHAR(30) NULL,
    expires_at DATETIME2    NULL,
    created_at DATETIME2    NOT NULL DEFAULT GETUTCDATE()
  );

IF OBJECT_ID('passenger_qr_tokens','U') IS NULL
  CREATE TABLE passenger_qr_tokens (
    qr_id      INT           IDENTITY(1,1) PRIMARY KEY,
    user_id    INT           NOT NULL REFERENCES users(user_id),
    token      NVARCHAR(64)  NOT NULL UNIQUE,
    expires_at DATETIME2     NOT NULL,
    used_at    DATETIME2     NULL,
    created_at DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );

-- ── From 004: RBAC + trip arrivals + audit log ────────────────────────────────

IF OBJECT_ID('roles','U') IS NULL
BEGIN
  CREATE TABLE roles (
    role_id      INT          IDENTITY(1,1) PRIMARY KEY,
    role_key     NVARCHAR(50) NOT NULL UNIQUE,
    display_name NVARCHAR(100) NOT NULL,
    description  NVARCHAR(500) NULL,
    is_system    BIT          NOT NULL DEFAULT 1,
    is_active    BIT          NOT NULL DEFAULT 1,
    created_at   DATETIME2    NOT NULL DEFAULT GETUTCDATE(),
    updated_at   DATETIME2    NOT NULL DEFAULT GETUTCDATE()
  );
END

IF OBJECT_ID('permissions','U') IS NULL
BEGIN
  CREATE TABLE permissions (
    permission_id  INT           IDENTITY(1,1) PRIMARY KEY,
    permission_key NVARCHAR(100) NOT NULL UNIQUE,
    module_name    NVARCHAR(50)  NOT NULL,
    action_name    NVARCHAR(20)  NOT NULL,
    description    NVARCHAR(200) NULL,
    created_at     DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );
END

IF OBJECT_ID('role_permissions','U') IS NULL
BEGIN
  CREATE TABLE role_permissions (
    role_id        INT       NOT NULL REFERENCES roles(role_id),
    permission_id  INT       NOT NULL REFERENCES permissions(permission_id),
    granted_at     DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    granted_by     INT       NULL,
    PRIMARY KEY (role_id, permission_id)
  );
END

IF OBJECT_ID('trip_stop_arrivals','U') IS NULL
  CREATE TABLE trip_stop_arrivals (
    arrival_id    INT       IDENTITY(1,1) PRIMARY KEY,
    trip_id       INT       NOT NULL,
    stop_id       INT       NOT NULL,
    scheduled_at  DATETIME2 NULL,
    arrived_at    DATETIME2 NULL,
    departed_at   DATETIME2 NULL
  );

IF OBJECT_ID('audit_logs','U') IS NULL
  CREATE TABLE audit_logs (
    audit_log_id    INT           IDENTITY(1,1) PRIMARY KEY,
    actor_user_id   INT           NULL,
    action_name     NVARCHAR(100) NOT NULL,
    entity_type     NVARCHAR(50)  NULL,
    entity_id       INT           NULL,
    old_values_json NVARCHAR(MAX) NULL,
    new_values_json NVARCHAR(MAX) NULL,
    ip_address      NVARCHAR(64)  NULL,
    created_at      DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );

-- ── Wallet tables ─────────────────────────────────────────────────────────────

IF OBJECT_ID('wallets','U') IS NULL
  CREATE TABLE wallets (
    wallet_id          INT          IDENTITY(1,1) PRIMARY KEY,
    user_id            INT          NOT NULL UNIQUE,
    balance            DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_frozen          BIT          NOT NULL DEFAULT 0,
    freeze_reason      NVARCHAR(200) NULL,
    freeze_notes       NVARCHAR(500) NULL,
    frozen_at          DATETIME      NULL,
    frozen_by_admin_id INT          NULL,
    updated_at         DATETIME      NULL
  );
ELSE
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
END

IF OBJECT_ID('wallet_transactions','U') IS NULL
  CREATE TABLE wallet_transactions (
    transaction_id INT          IDENTITY(1,1) PRIMARY KEY,
    user_id        INT          NOT NULL,
    recharge_id    INT          NULL,
    type           NVARCHAR(20) NOT NULL,
    amount         DECIMAL(10,2) NOT NULL,
    description    NVARCHAR(500) NULL,
    created_at     DATETIME      NOT NULL DEFAULT GETUTCDATE()
  );

IF OBJECT_ID('wallet_recharges','U') IS NULL
  CREATE TABLE wallet_recharges (
    recharge_id   INT           IDENTITY(1,1) PRIMARY KEY,
    user_id       INT           NOT NULL,
    staff_id      INT           NOT NULL,
    amount        DECIMAL(10,2) NOT NULL,
    location_name NVARCHAR(255) NOT NULL,
    tx_ref        NVARCHAR(100) NOT NULL UNIQUE,
    notes         NVARCHAR(500) NULL,
    created_at    DATETIME      NOT NULL DEFAULT GETUTCDATE()
  );

IF OBJECT_ID('wallet_adjustments','U') IS NULL
  CREATE TABLE wallet_adjustments (
    adjustment_id   INT           IDENTITY(1,1) PRIMARY KEY,
    user_id         INT           NOT NULL,
    admin_id        INT           NOT NULL,
    type            NVARCHAR(10)  NOT NULL,
    amount          DECIMAL(10,2) NOT NULL,
    reason          NVARCHAR(200) NOT NULL,
    notes           NVARCHAR(500) NULL,
    balance_before  DECIMAL(10,2) NOT NULL,
    balance_after   DECIMAL(10,2) NOT NULL,
    created_at      DATETIME      NOT NULL DEFAULT GETUTCDATE()
  );

IF OBJECT_ID('wallet_freeze_log','U') IS NULL
  CREATE TABLE wallet_freeze_log (
    log_id     INT          IDENTITY(1,1) PRIMARY KEY,
    user_id    INT          NOT NULL,
    action     NVARCHAR(20) NOT NULL,
    reason     NVARCHAR(200) NULL,
    notes      NVARCHAR(500) NULL,
    admin_id   INT          NULL,
    created_at DATETIME     NOT NULL DEFAULT GETUTCDATE()
  );

IF OBJECT_ID('top_up_locations','U') IS NULL
  CREATE TABLE top_up_locations (
    location_id INT           IDENTITY(1,1) PRIMARY KEY,
    name        NVARCHAR(200) NOT NULL,
    address     NVARCHAR(300) NULL,
    city        NVARCHAR(100) NULL,
    phone       NVARCHAR(50)  NULL,
    hours       NVARCHAR(200) NULL,
    is_active   BIT           NOT NULL DEFAULT 1
  );

IF OBJECT_ID('staff_top_ups','U') IS NULL
  CREATE TABLE staff_top_ups (
    top_up_id             INT           IDENTITY(1,1) PRIMARY KEY,
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

-- ── Vehicle document + maintenance + fuel tables ──────────────────────────────

IF OBJECT_ID('vehicle_docs','U') IS NULL
  CREATE TABLE vehicle_docs (
    plate                 NVARCHAR(50) NOT NULL PRIMARY KEY,
    registration_expiry   DATE         NULL,
    insurance_expiry      DATE         NULL,
    roadworthiness_expiry DATE         NULL,
    updated_at            DATETIME     NULL,
    updated_by_admin_id   INT          NULL
  );

IF OBJECT_ID('vehicle_maintenance_records','U') IS NULL
  CREATE TABLE vehicle_maintenance_records (
    record_id         INT           IDENTITY(1,1) PRIMARY KEY,
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

IF OBJECT_ID('vehicle_fuel_records','U') IS NULL
  CREATE TABLE vehicle_fuel_records (
    fuel_id     INT           IDENTITY(1,1) PRIMARY KEY,
    vehicle_id  INT           NOT NULL,
    fuel_date   DATE          NOT NULL,
    liters      DECIMAL(8,2)  NOT NULL,
    cost        DECIMAL(10,2) NULL,
    odometer_km INT           NOT NULL,
    station     NVARCHAR(200) NULL,
    notes       NVARCHAR(500) NULL,
    recorded_by INT           NULL,
    created_at  DATETIME      NOT NULL DEFAULT GETUTCDATE()
  );
ELSE
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='vehicle_fuel_records' AND COLUMN_NAME='cost_per_liter')
    ALTER TABLE vehicle_fuel_records ADD cost_per_liter DECIMAL(6,3) NULL;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='vehicle_fuel_records' AND COLUMN_NAME='recorded_by')
    ALTER TABLE vehicle_fuel_records ADD recorded_by INT NULL;
END

-- ── Staff reconciliation + recurring schedules ────────────────────────────────

IF OBJECT_ID('staff_reconciliation','U') IS NULL
  CREATE TABLE staff_reconciliation (
    reconciliation_id    INT           IDENTITY(1,1) PRIMARY KEY,
    staff_id             INT           NOT NULL,
    reconciliation_date  DATE          NOT NULL,
    expected_amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
    actual_amount        DECIMAL(10,2) NULL,
    discrepancy          AS (actual_amount - expected_amount),
    status               NVARCHAR(50)  NOT NULL DEFAULT 'pending',
    notes                NVARCHAR(500) NULL,
    reviewed_by          INT           NULL,
    reviewed_at          DATETIME      NULL,
    created_at           DATETIME      NOT NULL DEFAULT GETUTCDATE(),
    UNIQUE (staff_id, reconciliation_date)
  );

IF OBJECT_ID('recurring_trip_schedules','U') IS NULL
  CREATE TABLE recurring_trip_schedules (
    schedule_id    INT           IDENTITY(1,1) PRIMARY KEY,
    route_name     NVARCHAR(100) NOT NULL,
    driver_name    NVARCHAR(100) NULL,
    vehicle_plate  NVARCHAR(50)  NULL,
    departure_time TIME          NOT NULL,
    recurrence     NVARCHAR(20)  NOT NULL DEFAULT 'daily',
    custom_days    NVARCHAR(200) NULL,
    status         NVARCHAR(20)  NOT NULL DEFAULT 'Active',
    active_from    DATE          NOT NULL,
    next_run       DATE          NULL,
    created_at     DATETIME      NOT NULL DEFAULT GETUTCDATE()
  );

-- ── Delivery tracking columns on notifications ────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='notifications' AND COLUMN_NAME='title')
  ALTER TABLE notifications ADD title NVARCHAR(200) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='notifications' AND COLUMN_NAME='body')
  ALTER TABLE notifications ADD body NVARCHAR(2000) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='notifications' AND COLUMN_NAME='type')
  ALTER TABLE notifications ADD type NVARCHAR(20) NULL DEFAULT 'info';
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='notifications' AND COLUMN_NAME='target_group')
  ALTER TABLE notifications ADD target_group NVARCHAR(50) NULL DEFAULT 'all_users';
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='notifications' AND COLUMN_NAME='sent_count')
  ALTER TABLE notifications ADD sent_count INT NOT NULL DEFAULT 0;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='notifications' AND COLUMN_NAME='read_count')
  ALTER TABLE notifications ADD read_count INT NOT NULL DEFAULT 0;

-- ── Users table additions ─────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users' AND COLUMN_NAME='category')
  ALTER TABLE users ADD category VARCHAR(20) NOT NULL DEFAULT 'regular'
    CONSTRAINT CK_users_category CHECK (category IN ('regular','student','senior','employee','school_child'));

-- ── Drivers table additions ───────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='drivers' AND COLUMN_NAME='license_expiry_date')
  ALTER TABLE drivers ADD license_expiry_date DATE NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='drivers' AND COLUMN_NAME='is_deleted')
  ALTER TABLE drivers ADD is_deleted BIT NOT NULL DEFAULT 0;

-- ── Routes + stops soft-delete ────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='routes' AND COLUMN_NAME='is_deleted')
  ALTER TABLE routes ADD is_deleted BIT NOT NULL DEFAULT 0;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='stops' AND COLUMN_NAME='is_deleted')
  ALTER TABLE stops ADD is_deleted BIT NOT NULL DEFAULT 0;

-- ── Scheduled reports tracking columns ───────────────────────────────────────

IF OBJECT_ID('scheduled_reports','U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='scheduled_reports' AND COLUMN_NAME='last_sent_at')
    ALTER TABLE scheduled_reports ADD last_sent_at DATETIME2 NULL;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='scheduled_reports' AND COLUMN_NAME='next_send_at')
    ALTER TABLE scheduled_reports ADD next_send_at DATETIME2 NULL;
END

-- ── Performance indexes ───────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('gps_logs') AND name='IX_gps_logs_trip_id')
  CREATE INDEX IX_gps_logs_trip_id ON gps_logs(trip_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('wallet_transactions') AND name='IX_wallet_transactions_user_id')
  CREATE INDEX IX_wallet_transactions_user_id ON wallet_transactions(user_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('tickets') AND name='IX_tickets_user_id')
  CREATE INDEX IX_tickets_user_id ON tickets(user_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('notifications') AND name='IX_notifications_user_id')
  CREATE INDEX IX_notifications_user_id ON notifications(user_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('login_audit_logs') AND name='IX_login_audit_logged_at')
  CREATE INDEX IX_login_audit_logged_at ON login_audit_logs(logged_at DESC);

PRINT 'Migration 005 complete — all tables and columns verified.';
