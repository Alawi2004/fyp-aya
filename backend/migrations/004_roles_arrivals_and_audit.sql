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

MERGE roles AS target
USING (VALUES
  ('super_admin',       'Super Admin',       'Full platform access', 1, 1),
  ('transport_manager', 'Transport Manager', 'Fleet, route, and trip operations', 1, 1),
  ('finance_officer',   'Finance Officer',   'Wallet, ticket, and revenue oversight', 1, 1),
  ('ops_staff',         'Ops Staff',         'Operational monitoring and communications', 1, 1),
  ('auditor',           'Auditor',           'Read-only compliance and audit access', 1, 1),
  ('it_admin',          'IT Admin',          'Technical administration and user management', 1, 1),
  ('admin',             'Admin',             'Legacy admin role with broad access', 1, 1),
  ('staff',             'Staff',             'Legacy staff role for kiosk and ops access', 1, 1),
  ('driver',            'Driver',            'Driver mobile application role', 1, 1),
  ('passenger',         'Passenger',         'Passenger mobile application role', 1, 1)
) AS source (role_key, display_name, description, is_system, is_active)
ON target.role_key = source.role_key
WHEN MATCHED THEN
  UPDATE SET
    display_name = source.display_name,
    description = source.description,
    is_system = source.is_system,
    is_active = source.is_active,
    updated_at = GETUTCDATE()
WHEN NOT MATCHED THEN
  INSERT (role_key, display_name, description, is_system, is_active)
  VALUES (source.role_key, source.display_name, source.description, source.is_system, source.is_active);

MERGE permissions AS target
USING (VALUES
  ('all.view',              '*',            'view',   'View all modules'),
  ('all.create',            '*',            'create', 'Create across all modules'),
  ('all.edit',              '*',            'edit',   'Edit across all modules'),
  ('all.delete',            '*',            'delete', 'Delete across all modules'),
  ('dashboard.view',        'dashboard',    'view',   'View dashboard'),
  ('live.view',             'live',         'view',   'View live tracking'),
  ('live.edit',             'live',         'edit',   'Edit live operations'),
  ('camera.view',           'camera',       'view',   'View camera feeds'),
  ('drivers.view',          'drivers',      'view',   'View drivers'),
  ('drivers.create',        'drivers',      'create', 'Create drivers'),
  ('drivers.edit',          'drivers',      'edit',   'Edit drivers'),
  ('vehicles.view',         'vehicles',     'view',   'View vehicles'),
  ('vehicles.create',       'vehicles',     'create', 'Create vehicles'),
  ('vehicles.edit',         'vehicles',     'edit',   'Edit vehicles'),
  ('routes.view',           'routes',       'view',   'View routes'),
  ('routes.create',         'routes',       'create', 'Create routes'),
  ('routes.edit',           'routes',       'edit',   'Edit routes'),
  ('trips.view',            'trips',        'view',   'View trips'),
  ('trips.create',          'trips',        'create', 'Create trips'),
  ('trips.edit',            'trips',        'edit',   'Edit trips'),
  ('trips.delete',          'trips',        'delete', 'Delete trips'),
  ('analytics.view',        'analytics',    'view',   'View analytics'),
  ('tickets.view',          'tickets',      'view',   'View tickets'),
  ('tickets.create',        'tickets',      'create', 'Create tickets'),
  ('tickets.edit',          'tickets',      'edit',   'Edit tickets'),
  ('notifications.view',    'notifications','view',   'View notifications'),
  ('notifications.create',  'notifications','create', 'Create notifications'),
  ('ratings.view',          'ratings',      'view',   'View ratings'),
  ('ratings.create',        'ratings',      'create', 'Create ratings'),
  ('users.view',            'users',        'view',   'View users'),
  ('users.create',          'users',        'create', 'Create users'),
  ('users.edit',            'users',        'edit',   'Edit users'),
  ('users.delete',          'users',        'delete', 'Delete users'),
  ('wallet.view',           'wallet',       'view',   'View wallets'),
  ('wallet.create',         'wallet',       'create', 'Create wallet transactions'),
  ('wallet.edit',           'wallet',       'edit',   'Edit wallet data')
) AS source (permission_key, module_name, action_name, description)
ON target.permission_key = source.permission_key
WHEN MATCHED THEN
  UPDATE SET
    module_name = source.module_name,
    action_name = source.action_name,
    description = source.description
WHEN NOT MATCHED THEN
  INSERT (permission_key, module_name, action_name, description)
  VALUES (source.permission_key, source.module_name, source.action_name, source.description);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN permissions p ON
  (r.role_key IN ('super_admin', 'admin') AND p.module_name = '*')
  OR (r.role_key = 'transport_manager' AND p.permission_key IN (
    'dashboard.view','live.view','live.edit','camera.view','drivers.view','drivers.create','drivers.edit',
    'vehicles.view','vehicles.create','vehicles.edit','routes.view','routes.create','routes.edit',
    'trips.view','trips.create','trips.edit','trips.delete','analytics.view','tickets.view',
    'notifications.view','ratings.view','users.view'
  ))
  OR (r.role_key = 'finance_officer' AND p.permission_key IN (
    'dashboard.view','analytics.view','tickets.view','tickets.create','tickets.edit',
    'wallet.view','wallet.create','wallet.edit','ratings.view','users.view'
  ))
  OR (r.role_key = 'ops_staff' AND p.permission_key IN (
    'dashboard.view','live.view','trips.view','notifications.view','notifications.create','camera.view','users.view'
  ))
  OR (r.role_key = 'auditor' AND p.permission_key IN (
    'dashboard.view','live.view','camera.view','drivers.view','vehicles.view','routes.view',
    'trips.view','analytics.view','tickets.view','notifications.view','ratings.view','wallet.view','users.view'
  ))
  OR (r.role_key = 'it_admin' AND p.permission_key IN (
    'dashboard.view','users.view','users.create','users.edit','users.delete',
    'vehicles.view','vehicles.edit','live.view','camera.view','notifications.view','drivers.view'
  ))
  OR (r.role_key = 'staff' AND p.permission_key IN (
    'dashboard.view','live.view','trips.view','notifications.view','notifications.create',
    'camera.view','wallet.view','wallet.create','wallet.edit','users.view'
  ))
  OR (r.role_key = 'driver' AND p.permission_key IN (
    'trips.view','trips.edit','notifications.view','ratings.view','live.view'
  ))
  OR (r.role_key = 'passenger' AND p.permission_key IN (
    'tickets.view','tickets.create','wallet.view','notifications.view','ratings.create','trips.view'
  ))
WHERE NOT EXISTS (
  SELECT 1
  FROM role_permissions rp
  WHERE rp.role_id = r.role_id
    AND rp.permission_id = p.permission_id
);
