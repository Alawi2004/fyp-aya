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
