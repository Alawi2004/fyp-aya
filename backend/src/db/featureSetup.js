let setupPromise = null;

const setupSql = `
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'roles'
)
BEGIN
  CREATE TABLE roles (
    role_id       INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    role_key      NVARCHAR(50)   NOT NULL UNIQUE,
    display_name  NVARCHAR(100)  NOT NULL,
    description   NVARCHAR(500)  NULL,
    is_system     BIT            NOT NULL DEFAULT 1,
    is_active     BIT            NOT NULL DEFAULT 1,
    created_at    DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    updated_at    DATETIME2      NOT NULL DEFAULT GETUTCDATE()
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'permissions'
)
BEGIN
  CREATE TABLE permissions (
    permission_id    INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    permission_key   NVARCHAR(100)  NOT NULL UNIQUE,
    module_name      NVARCHAR(50)   NOT NULL,
    action_name      NVARCHAR(20)   NOT NULL,
    description      NVARCHAR(255)  NULL,
    created_at       DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_permissions_module_action UNIQUE (module_name, action_name)
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'role_permissions'
)
BEGIN
  CREATE TABLE role_permissions (
    role_id         INT           NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    permission_id   INT           NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    granted_at      DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    granted_by      INT           NULL REFERENCES users(user_id),
    CONSTRAINT PK_role_permissions PRIMARY KEY (role_id, permission_id)
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'staff_shift_sessions'
)
BEGIN
  CREATE TABLE staff_shift_sessions (
    shift_id          INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    staff_user_id     INT            NOT NULL REFERENCES users(user_id),
    opening_cash      DECIMAL(10,2)  NOT NULL DEFAULT 0,
    expected_cash     DECIMAL(10,2)  NULL,
    closing_cash      DECIMAL(10,2)  NULL,
    cash_difference   DECIMAL(10,2)  NULL,
    opened_at         DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    closed_at         DATETIME2      NULL,
    opening_notes     NVARCHAR(500)  NULL,
    closing_notes     NVARCHAR(500)  NULL,
    summary_json      NVARCHAR(MAX)  NULL
  );

  CREATE INDEX IX_staff_shift_sessions_staff_opened
    ON staff_shift_sessions (staff_user_id, opened_at DESC);
END;

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'staff_shift_sessions'
    AND COLUMN_NAME = 'reported_cash'
)
BEGIN
  ALTER TABLE staff_shift_sessions
  ADD reported_cash DECIMAL(10,2) NULL;
END;

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'complaints'
)
BEGIN
  CREATE TABLE complaints (
    complaint_id          INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    tracking_code         NVARCHAR(30)   NOT NULL UNIQUE,
    submitted_by_user_id  INT            NOT NULL REFERENCES users(user_id),
    assigned_to_user_id   INT            NULL REFERENCES users(user_id),
    trip_id               INT            NULL REFERENCES trips(trip_id),
    driver_id             INT            NULL REFERENCES drivers(driver_id),
    route_id              INT            NULL REFERENCES routes(route_id),
    title                 NVARCHAR(200)  NOT NULL,
    description           NVARCHAR(MAX)  NOT NULL,
    category              NVARCHAR(50)   NOT NULL,
    priority              NVARCHAR(20)   NOT NULL DEFAULT 'medium',
    status                NVARCHAR(20)   NOT NULL DEFAULT 'submitted',
    submitted_at          DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    assigned_at           DATETIME2      NULL,
    resolved_at           DATETIME2      NULL,
    resolution_notes      NVARCHAR(1000) NULL,
    last_updated_at       DATETIME2      NOT NULL DEFAULT GETUTCDATE()
  );

  CREATE INDEX IX_complaints_status_date
    ON complaints (status, submitted_at DESC);
  CREATE INDEX IX_complaints_submitter
    ON complaints (submitted_by_user_id, submitted_at DESC);
  CREATE INDEX IX_complaints_assignee
    ON complaints (assigned_to_user_id, submitted_at DESC);
END;

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'complaint_updates'
)
BEGIN
  CREATE TABLE complaint_updates (
    update_id        INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    complaint_id     INT            NOT NULL REFERENCES complaints(complaint_id) ON DELETE CASCADE,
    actor_user_id    INT            NULL REFERENCES users(user_id),
    action_type      NVARCHAR(30)   NOT NULL,
    old_status       NVARCHAR(20)   NULL,
    new_status       NVARCHAR(20)   NULL,
    comment          NVARCHAR(1000) NULL,
    created_at       DATETIME2      NOT NULL DEFAULT GETUTCDATE()
  );

  CREATE INDEX IX_complaint_updates_complaint
    ON complaint_updates (complaint_id, created_at DESC);
END;

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'refresh_token_blacklist'
)
BEGIN
  CREATE TABLE refresh_token_blacklist (
    blacklist_id   INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id        INT            NULL REFERENCES users(user_id),
    token_hash     NVARCHAR(64)   NOT NULL UNIQUE,
    reason         NVARCHAR(30)   NOT NULL,
    blacklisted_at DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    expires_at     DATETIME2      NULL
  );

  CREATE INDEX IX_refresh_token_blacklist_hash
    ON refresh_token_blacklist (token_hash);
END;

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'passenger_qr_tokens'
)
BEGIN
  CREATE TABLE passenger_qr_tokens (
    qr_token_id   INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id       INT            NOT NULL REFERENCES users(user_id),
    jti           NVARCHAR(64)   NOT NULL UNIQUE,
    token_hash    NVARCHAR(64)   NOT NULL UNIQUE,
    expires_at    DATETIME2      NOT NULL,
    created_at    DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    used_at       DATETIME2      NULL,
    revoked_at    DATETIME2      NULL
  );

  CREATE INDEX IX_passenger_qr_tokens_user
    ON passenger_qr_tokens (user_id, created_at DESC);
  CREATE INDEX IX_passenger_qr_tokens_jti
    ON passenger_qr_tokens (jti);
END;

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'trip_stop_arrivals'
)
BEGIN
  CREATE TABLE trip_stop_arrivals (
    trip_stop_arrival_id     INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    trip_id                  INT            NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
    stop_id                  INT            NOT NULL REFERENCES stops(stop_id),
    route_id                 INT            NULL REFERENCES routes(route_id),
    stop_order               INT            NULL,
    scheduled_arrival_at     DATETIME2      NULL,
    actual_arrival_at        DATETIME2      NULL,
    delay_seconds            INT            NULL,
    arrival_status           NVARCHAR(20)   NOT NULL DEFAULT 'pending',
    notes                    NVARCHAR(500)  NULL,
    created_at               DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    updated_at               DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_trip_stop_arrivals_trip_stop UNIQUE (trip_id, stop_id, stop_order)
  );

  CREATE INDEX IX_trip_stop_arrivals_trip
    ON trip_stop_arrivals (trip_id, stop_order);
  CREATE INDEX IX_trip_stop_arrivals_status
    ON trip_stop_arrivals (arrival_status, scheduled_arrival_at);
END;

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'audit_logs'
)
BEGIN
  CREATE TABLE audit_logs (
    audit_log_id      BIGINT          NOT NULL IDENTITY(1,1) PRIMARY KEY,
    actor_user_id     INT             NULL REFERENCES users(user_id),
    actor_role        NVARCHAR(50)    NULL,
    action_name       NVARCHAR(100)   NOT NULL,
    entity_type       NVARCHAR(100)   NOT NULL,
    entity_id         NVARCHAR(100)   NULL,
    old_values_json   NVARCHAR(MAX)   NULL,
    new_values_json   NVARCHAR(MAX)   NULL,
    ip_address        NVARCHAR(64)    NULL,
    user_agent        NVARCHAR(500)   NULL,
    request_id        NVARCHAR(100)   NULL,
    created_at        DATETIME2       NOT NULL DEFAULT GETUTCDATE()
  );

  CREATE INDEX IX_audit_logs_actor_date
    ON audit_logs (actor_user_id, created_at DESC);
  CREATE INDEX IX_audit_logs_entity
    ON audit_logs (entity_type, entity_id, created_at DESC);
END;

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'user_totp'
)
BEGIN
  CREATE TABLE user_totp (
    totp_id      INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id      INT           NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    secret       NVARCHAR(100) NOT NULL,
    enabled      BIT           NOT NULL DEFAULT 0,
    verified_at  DATETIME2     NULL,
    created_at   DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'login_audit_logs'
)
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

  CREATE INDEX IX_login_audit_logs_user_date
    ON login_audit_logs (user_id, logged_at DESC);
  CREATE INDEX IX_login_audit_logs_date
    ON login_audit_logs (logged_at DESC);
END;

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'password_reset_tokens'
)
BEGIN
  CREATE TABLE password_reset_tokens (
    token_id    INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id     INT           NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash  NVARCHAR(64)  NOT NULL UNIQUE,
    expires_at  DATETIME2     NOT NULL,
    used_at     DATETIME2     NULL,
    created_at  DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );

  CREATE INDEX IX_password_reset_tokens_user
    ON password_reset_tokens (user_id, created_at DESC);
END;

-- Allow ratings without a linked trip (app-level ratings, test data, etc.)
IF EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ratings' AND COLUMN_NAME = 'trip_id' AND IS_NULLABLE = 'NO'
)
BEGIN
  ALTER TABLE ratings ALTER COLUMN trip_id INT NULL;
END;

-- Track when each rating was posted (needed for "My Ratings" + the 24h edit window)
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ratings' AND COLUMN_NAME = 'created_at'
)
BEGIN
  ALTER TABLE ratings ADD created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE();
END;

-- Allow passengers to attach a photo to a complaint
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'complaints' AND COLUMN_NAME = 'photo_url'
)
BEGIN
  ALTER TABLE complaints ADD photo_url NVARCHAR(500) NULL;
END;

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'app_feedback'
)
BEGIN
  CREATE TABLE app_feedback (
    feedback_id   INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id       INT            NOT NULL REFERENCES users(user_id),
    rating        INT            NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment       NVARCHAR(1000) NULL,
    created_at    DATETIME2      NOT NULL DEFAULT GETUTCDATE()
  );
END;

-- Add color column to vehicles for taxi display (plate + color shown to passenger)
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'vehicles' AND COLUMN_NAME = 'color'
)
BEGIN
  ALTER TABLE vehicles ADD color NVARCHAR(30) NULL;
END;

-- Ensure drivers.is_deleted has a default so NULLs don't hide drivers from queries
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'drivers' AND COLUMN_NAME = 'is_deleted'
)
BEGIN
  ALTER TABLE drivers ADD is_deleted BIT NOT NULL DEFAULT 0;
END;

-- Taxi / tuktuk reservations (passenger-facing; separate from bus ticket bookings)
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'taxi_reservations')
BEGIN
  CREATE TABLE taxi_reservations (
    reservation_id   INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id          INT            NOT NULL REFERENCES users(user_id),
    vehicle_type     NVARCHAR(20)   NOT NULL,
    pickup_address   NVARCHAR(300)  NOT NULL,
    pickup_lat       FLOAT          NULL,
    pickup_lng       FLOAT          NULL,
    dest_address     NVARCHAR(300)  NOT NULL,
    dest_lat         FLOAT          NULL,
    dest_lng         FLOAT          NULL,
    distance_km      FLOAT          NULL,
    estimated_fare   DECIMAL(10,2)  NOT NULL DEFAULT 0,
    driver_id        INT            NULL REFERENCES drivers(driver_id),
    driver_name      NVARCHAR(100)  NULL,
    scheduled_for    NVARCHAR(100)  NULL DEFAULT 'Now',
    recurrence       NVARCHAR(20)   NOT NULL DEFAULT 'once',
    notes            NVARCHAR(500)  NULL,
    status           NVARCHAR(20)   NOT NULL DEFAULT 'pending',
    created_at       DATETIME2      NOT NULL DEFAULT GETUTCDATE()
  );
  CREATE INDEX IX_taxi_reservations_user ON taxi_reservations(user_id, created_at DESC);
END;

-- Passenger-submitted requests to add a new bus stop at a location
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'stop_requests')
BEGIN
  CREATE TABLE stop_requests (
    request_id   INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id      INT            NOT NULL REFERENCES users(user_id),
    address      NVARCHAR(300)  NOT NULL,
    lat          FLOAT          NULL,
    lng          FLOAT          NULL,
    description  NVARCHAR(500)  NULL,
    status       NVARCHAR(20)   NOT NULL DEFAULT 'pending',
    created_at   DATETIME2      NOT NULL DEFAULT GETUTCDATE()
  );
  CREATE INDEX IX_stop_requests_user ON stop_requests(user_id, created_at DESC);
END;
`;

export const ensureOperationalTables = async (pool) => {
  if (!setupPromise) {
    const req = pool.request();
    req.timeout = 60000;
    setupPromise = req.batch(setupSql).catch((err) => {
      setupPromise = null;
      throw err;
    });
  }

  await setupPromise;
};

// ── Auth-specific tables — isolated so they always succeed regardless of
//    whether other operational tables (complaints, trips, etc.) exist yet.
const authTablesSql = `
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='refresh_tokens')
BEGIN
  CREATE TABLE refresh_tokens (
    token_id    INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id     INT           NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash  NVARCHAR(64)  NOT NULL UNIQUE,
    expires_at  DATETIME2     NOT NULL,
    created_at  DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );
  CREATE INDEX IX_refresh_tokens_user ON refresh_tokens(user_id);
END;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='refresh_token_blacklist')
BEGIN
  CREATE TABLE refresh_token_blacklist (
    blacklist_id   INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id        INT           NULL REFERENCES users(user_id),
    token_hash     NVARCHAR(64)  NOT NULL UNIQUE,
    reason         NVARCHAR(30)  NOT NULL,
    blacklisted_at DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    expires_at     DATETIME2     NULL
  );
  CREATE INDEX IX_refresh_token_blacklist_hash ON refresh_token_blacklist(token_hash);
END;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='system_settings')
BEGIN
  CREATE TABLE system_settings (
    setting_key   NVARCHAR(100)  NOT NULL PRIMARY KEY,
    setting_value NVARCHAR(MAX)  NOT NULL,
    category      NVARCHAR(50)   NOT NULL,
    label         NVARCHAR(200)  NULL,
    description   NVARCHAR(500)  NULL,
    value_type    NVARCHAR(20)   NOT NULL DEFAULT 'string',
    updated_at    DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    updated_by    INT            NULL REFERENCES users(user_id)
  );

  -- Seed default settings
  INSERT INTO system_settings(setting_key, setting_value, category, label, value_type, description)
  VALUES
    ('fare.base_fare',              '1.00',   'fare',        'Base Fare ($)',              'number',  'Flat fare charged for any journey'),
    ('fare.per_km_rate',            '0.15',   'fare',        'Per-km Rate ($)',            'number',  'Additional fare per kilometre travelled'),
    ('fare.student_discount',       '25',     'fare',        'Student Discount (%)',       'number',  'Percentage discount for student pass holders'),
    ('fare.senior_discount',        '30',     'fare',        'Senior Discount (%)',        'number',  'Percentage discount for senior citizens'),
    ('fare.staff_discount',         '100',    'fare',        'Staff Discount (%)',         'number',  'Percentage discount for company staff'),
    ('fare.peak_surcharge',         '15',     'fare',        'Peak Hour Surcharge (%)',    'number',  'Extra charge during peak hours (7–9 am, 5–7 pm)'),
    ('fare.night_surcharge',        '10',     'fare',        'Night Surcharge (%)',        'number',  'Extra charge for journeys between 10 pm and 5 am'),
    ('wallet.max_balance',          '500',    'wallet',      'Max Wallet Balance ($)',     'number',  'Maximum balance a passenger wallet may hold'),
    ('wallet.min_topup',            '5',      'wallet',      'Min Top-Up Amount ($)',      'number',  'Minimum single top-up transaction'),
    ('wallet.max_topup_daily',      '200',    'wallet',      'Max Top-Up Per Day ($)',     'number',  'Daily cap on top-ups per passenger'),
    ('wallet.low_balance_alert',    '25',     'wallet',      'Low-Balance Alert Threshold ($)', 'number', 'Send alert when balance drops below this amount'),
    ('wallet.freeze_on_fraud',      'true',   'wallet',      'Auto-freeze on Fraud Flag', 'boolean', 'Automatically freeze wallet when fraud is flagged'),
    ('gps.broadcast_interval_sec',  '5',      'gps',         'Broadcast Interval (s)',    'number',  'How often drivers send GPS updates'),
    ('gps.accuracy_threshold_m',    '20',     'gps',         'Accuracy Threshold (m)',    'number',  'Ignore GPS readings with accuracy worse than this'),
    ('gps.history_retention_days',  '90',     'gps',         'History Retention (days)',  'number',  'How long GPS logs are kept before purging'),
    ('gps.geofence_radius_m',       '200',    'gps',         'Geofence Alert Radius (m)', 'number',  'Radius used to detect route deviation'),
    ('gps.offline_buffer_minutes',  '10',     'gps',         'Offline Buffer (min)',      'number',  'Buffer GPS points offline for this long before alerting'),
    ('security.max_login_attempts', '5',      'security',    'Max Login Attempts',        'number',  'Failed attempts before account lockout triggers'),
    ('security.lockout_base_min',   '1',      'security',    'Lockout Base Duration (min)','number', 'Starting lockout duration — doubles exponentially per lockout'),
    ('security.jwt_expiry_min',     '15',     'security',    'JWT Access Token Expiry (min)','number','Short-lived access token TTL'),
    ('security.max_sessions',       '3',      'security',    'Max Concurrent Sessions',   'number',  'Maximum simultaneous sessions per user'),
    ('security.force_2fa_admin',    'false',  'security',    'Force 2FA for All Admins',  'boolean', 'Require TOTP 2FA at login for every admin account'),
    ('security.strong_password',    'true',   'security',    'Require Strong Password',   'boolean', 'Enforce uppercase, lowercase, digit, and special char'),
    ('maintenance.enabled',         'false',  'maintenance', 'Maintenance Mode',          'boolean', 'Block all non-admin traffic while maintenance is active'),
    ('maintenance.message',         'System is undergoing scheduled maintenance. Please check back shortly.', 'maintenance', 'Maintenance Message', 'string', 'Message shown to users during maintenance'),
    ('maintenance.allowed_ips',     '127.0.0.1', 'maintenance', 'Allowed IPs (comma-separated)', 'string', 'These IPs bypass maintenance mode'),
    ('maintenance.scheduled_start', '',       'maintenance', 'Scheduled Start',           'string',  'ISO datetime for planned maintenance window start'),
    ('maintenance.scheduled_end',   '',       'maintenance', 'Scheduled End',             'string',  'ISO datetime for planned maintenance window end');
END;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='scheduled_reports')
BEGIN
  CREATE TABLE scheduled_reports (
    schedule_id   INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    report_name   NVARCHAR(100)  NOT NULL,
    report_type   NVARCHAR(50)   NOT NULL,
    frequency     NVARCHAR(20)   NOT NULL,
    day_of_week   INT            NULL,
    hour_of_day   INT            NOT NULL DEFAULT 8,
    recipients    NVARCHAR(MAX)  NOT NULL,
    enabled       BIT            NOT NULL DEFAULT 1,
    last_sent_at  DATETIME2      NULL,
    next_send_at  DATETIME2      NULL,
    created_by    INT            NULL REFERENCES users(user_id),
    created_at    DATETIME2      NOT NULL DEFAULT GETUTCDATE()
  );
END;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='user_totp')
BEGIN
  CREATE TABLE user_totp (
    totp_id     INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id     INT           NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    secret      NVARCHAR(100) NOT NULL,
    enabled     BIT           NOT NULL DEFAULT 0,
    verified_at DATETIME2     NULL,
    created_at  DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );
END;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='login_audit_logs')
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
  CREATE INDEX IX_login_audit_date  ON login_audit_logs(logged_at DESC);
END;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='password_reset_tokens')
BEGIN
  CREATE TABLE password_reset_tokens (
    token_id   INT          NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id    INT          NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash NVARCHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME2    NOT NULL,
    used_at    DATETIME2    NULL,
    created_at DATETIME2    NOT NULL DEFAULT GETUTCDATE()
  );
  CREATE INDEX IX_password_reset_user ON password_reset_tokens(user_id, created_at DESC);
END;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='otp_codes')
BEGIN
  CREATE TABLE otp_codes (
    otp_id     INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    email      NVARCHAR(120) NOT NULL,
    code       NVARCHAR(6)   NOT NULL,
    purpose    NVARCHAR(30)  NULL,
    expires_at DATETIME2     NOT NULL,
    created_at DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );
  CREATE INDEX IX_otp_codes_email ON otp_codes(email, expires_at DESC);
END;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='login_lockouts')
BEGIN
  CREATE TABLE login_lockouts (
    email           NVARCHAR(120) NOT NULL PRIMARY KEY,
    failed_attempts INT           NOT NULL DEFAULT 0,
    locked_until    DATETIME2     NULL,
    lockout_count   INT           NOT NULL DEFAULT 0,
    last_attempt_at DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );
END;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='user_sessions')
BEGIN
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
  CREATE INDEX IX_user_sessions_user ON user_sessions(user_id, created_at DESC);
  CREATE INDEX IX_user_sessions_hash ON user_sessions(token_hash);
END;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users' AND COLUMN_NAME='status')
BEGIN
  ALTER TABLE users ADD status NVARCHAR(20) NOT NULL DEFAULT 'active';
END;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users' AND COLUMN_NAME='push_token')
BEGIN
  ALTER TABLE users ADD push_token NVARCHAR(200) NULL;
END;

-- Soft-delete support for account deletion
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users' AND COLUMN_NAME='deleted_at')
BEGIN
  ALTER TABLE users ADD deleted_at DATETIME2 NULL;
END;

-- Raw FCM / APNs device token (non-Expo) for direct Firebase delivery
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users' AND COLUMN_NAME='fcm_token')
BEGIN
  ALTER TABLE users ADD fcm_token NVARCHAR(300) NULL;
END;

-- Passenger date of birth (replaces category-based discount model)
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users' AND COLUMN_NAME='birth_date')
BEGIN
  ALTER TABLE users ADD birth_date DATE NULL;
END;

-- Server-side geofence breach events
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='geofence_events')
BEGIN
  CREATE TABLE geofence_events (
    event_id     INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    trip_id      INT            NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
    route_id     INT            NULL     REFERENCES routes(route_id),
    latitude     DECIMAL(9,6)   NOT NULL,
    longitude    DECIMAL(9,6)   NOT NULL,
    distance_m   INT            NOT NULL,
    status       NVARCHAR(20)   NOT NULL DEFAULT 'active',
    detected_at  DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    resolved_at  DATETIME2      NULL
  );
  CREATE INDEX IX_geofence_events_trip ON geofence_events(trip_id, status);
END;

-- Favourite routes saved by passengers
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='user_favorite_routes')
BEGIN
  CREATE TABLE user_favorite_routes (
    favorite_id  INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id      INT            NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    route_id     INT            NOT NULL REFERENCES routes(route_id) ON DELETE CASCADE,
    nickname     NVARCHAR(100)  NULL,
    created_at   DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_user_favorite_route UNIQUE (user_id, route_id)
  );
  CREATE INDEX IX_favorites_user ON user_favorite_routes(user_id, created_at DESC);
END;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='user_suspension_logs')
BEGIN
  CREATE TABLE user_suspension_logs (
    log_id         INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id        INT           NOT NULL REFERENCES users(user_id),
    action         NVARCHAR(20)  NOT NULL,
    reason         NVARCHAR(100) NOT NULL,
    notes          NVARCHAR(500) NULL,
    duration_days  INT           NULL,
    suspended_until DATETIME2    NULL,
    acted_by       INT           NOT NULL REFERENCES users(user_id),
    acted_at       DATETIME2     NOT NULL DEFAULT GETUTCDATE()
  );
  CREATE INDEX IX_suspension_logs_user ON user_suspension_logs(user_id, acted_at DESC);
END;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='wallet_adjustments')
BEGIN
  CREATE TABLE wallet_adjustments (
    adjustment_id  INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id        INT            NOT NULL REFERENCES users(user_id),
    admin_id       INT            NOT NULL REFERENCES users(user_id),
    type           NVARCHAR(10)   NOT NULL,
    amount         DECIMAL(10,2)  NOT NULL,
    reason         NVARCHAR(200)  NOT NULL,
    notes          NVARCHAR(500)  NULL,
    balance_before DECIMAL(10,2)  NOT NULL,
    balance_after  DECIMAL(10,2)  NOT NULL,
    created_at     DATETIME2      NOT NULL DEFAULT GETUTCDATE()
  );
  CREATE INDEX IX_wallet_adjustments_user  ON wallet_adjustments(user_id,  created_at DESC);
  CREATE INDEX IX_wallet_adjustments_admin ON wallet_adjustments(admin_id, created_at DESC);
END;

-- Driver-reported issues / emergency alerts
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='issues')
BEGIN
  CREATE TABLE issues (
    issue_id    INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    driver_id   INT            NOT NULL REFERENCES drivers(driver_id),
    trip_id     INT            NULL     REFERENCES trips(trip_id),
    description NVARCHAR(1000) NOT NULL,
    created_at  DATETIME2      NOT NULL DEFAULT GETUTCDATE()
  );
  CREATE INDEX IX_issues_driver ON issues(driver_id, created_at DESC);
  CREATE INDEX IX_issues_trip   ON issues(trip_id);
END;
`;

// ── Route-specific tables ─────────────────────────────────────────────────────
// Isolated batch — depends only on routes and stops tables existing.
const routeTablesSql = `
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='routes')
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='route_waypoints')
  BEGIN
    CREATE TABLE route_waypoints (
      waypoint_id INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
      route_id    INT           NOT NULL REFERENCES routes(route_id) ON DELETE CASCADE,
      latitude    DECIMAL(9,6)  NOT NULL,
      longitude   DECIMAL(9,6)  NOT NULL,
      wp_order    INT           NOT NULL,
      created_at  DATETIME2     NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_route_waypoints_route ON route_waypoints(route_id, wp_order);
  END
END;

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='routes')
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='fare_zones')
  BEGIN
    CREATE TABLE fare_zones (
      zone_id     INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
      route_id    INT           NOT NULL REFERENCES routes(route_id) ON DELETE CASCADE,
      zone_name   NVARCHAR(60)  NOT NULL,
      zone_color  NVARCHAR(7)   NOT NULL DEFAULT '#2563EB',
      base_fare   DECIMAL(6,2)  NOT NULL,
      created_at  DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
      updated_at  DATETIME2     NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_fare_zones_route ON fare_zones(route_id);
  END
END;

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='stops')
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='stop_amenities')
  BEGIN
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
  END
END;

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='fare_zones')
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='fare_zone_stops')
  BEGIN
    CREATE TABLE fare_zone_stops (
      id       INT NOT NULL IDENTITY(1,1) PRIMARY KEY,
      zone_id  INT NOT NULL REFERENCES fare_zones(zone_id) ON DELETE CASCADE,
      stop_id  INT NOT NULL,
      CONSTRAINT UQ_fare_zone_stops UNIQUE (zone_id, stop_id)
    );
  END
END;
`;

let routeTablesPromise = null;

export const ensureRouteTables = async (pool) => {
  if (!routeTablesPromise) {
    routeTablesPromise = pool.request().batch(routeTablesSql).catch((err) => {
      routeTablesPromise = null;
      console.error("[db] ensureRouteTables failed:", err.message);
      throw err;
    });
  }
  await routeTablesPromise;
};

let authTablesPromise = null;

export const ensureAuthTables = async (pool) => {
  if (!authTablesPromise) {
    const req = pool.request();
    req.timeout = 60000;
    authTablesPromise = req.batch(authTablesSql).catch((err) => {
      authTablesPromise = null;
      console.error("[db] ensureAuthTables failed:", err.message);
      throw err;
    });
  }
  await authTablesPromise;
};
