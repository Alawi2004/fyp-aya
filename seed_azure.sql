-- ============================================================
-- Yalla Transit System — Complete Database Seed
-- Generated : 2026-05-26
-- Based on  : DatabaseSchema.sql (exported 2026-05-26)
-- Safe to re-run: all inserts use MERGE or WHERE NOT EXISTS
-- Run order respects FK dependency chain
-- ============================================================
SET NOCOUNT ON;
PRINT '=== Yalla Transit Seed Start ===';

-- ─────────────────────────────────────────────────────────────
-- 1. SYSTEM SETTINGS
-- ─────────────────────────────────────────────────────────────
PRINT '1. system_settings';
MERGE system_settings AS t
USING (VALUES
  ('app.name',                  'Yalla Transit',        'general',  'Application Name',        'Public name shown in the UI',               'string'),
  ('app.timezone',              'Asia/Beirut',          'general',  'Timezone',                'System-wide timezone',                      'string'),
  ('app.currency',              'USD',                  'general',  'Currency Code',           'ISO 4217 currency code',                    'string'),
  ('app.exchange_rate',         '1',                    'general',  'Exchange Rate',           'Units of currency per 1 USD (1 = USD)',      'number'),
  ('app.language',              'en',                   'general',  'Default Language',        'BCP-47 language tag',                       'string'),
  ('app.support_email',         'support@yallatransit.lb','general','Support Email',           'Contact email shown to users',              'string'),
  ('app.support_phone',         '+961 1 999 000',       'general',  'Support Phone',           'Contact phone shown to users',              'string'),
  ('app.version',               '1.0.0',                'general',  'App Version',             'Semantic version string',                   'string'),
  ('fare.base_amount',          '1.50',                 'fare',     'Base Fare (USD)',          'Minimum fare for any trip segment',         'number'),
  ('fare.per_km_rate',          '0.10',                 'fare',     'Per-km Rate (USD)',        'Additional cost per kilometre',             'number'),
  ('fare.student_discount',     '0.25',                 'fare',     'Student Discount',        'Fraction off for student category',         'number'),
  ('fare.senior_discount',      '0.30',                 'fare',     'Senior Discount',         'Fraction off for senior category',          'number'),
  ('fare.school_discount',      '0.50',                 'fare',     'School Child Discount',   'Fraction off for school_child category',    'number'),
  ('fare.employee_discount',    '0.10',                 'fare',     'Employee Discount',       'Fraction off for employee category',        'number'),
  ('wallet.min_topup',          '5.00',                 'wallet',   'Min Top-up Amount',       'Minimum single top-up in USD',              'number'),
  ('wallet.max_topup',          '500.00',               'wallet',   'Max Top-up Amount',       'Maximum single top-up in USD',              'number'),
  ('wallet.max_balance',        '1000.00',              'wallet',   'Max Wallet Balance',      'Hard cap on wallet balance in USD',         'number'),
  ('wallet.low_balance_alert',  '5.00',                 'wallet',   'Low Balance Alert',       'Push alert threshold in USD',               'number'),
  ('gps.update_interval_sec',   '10',                   'tracking', 'GPS Update Interval (s)', 'Seconds between driver GPS pings',          'number'),
  ('gps.geofence_radius_m',     '150',                  'tracking', 'Geofence Radius (m)',     'Metres around stop to trigger arrival',     'number'),
  ('gps.stale_threshold_sec',   '60',                   'tracking', 'Stale GPS Threshold (s)', 'Seconds before a ping is considered stale','number'),
  ('booking.max_seats_per_trip','4',                    'booking',  'Max Seats Per Booking',   'Tickets a single user can buy per trip',    'number'),
  ('booking.qr_ttl_minutes',    '30',                   'booking',  'QR Token TTL (min)',       'Minutes before a boarding QR expires',      'number'),
  ('security.jwt_access_ttl',   '900',                  'security', 'Access Token TTL (s)',     'JWT access token lifetime in seconds',      'number'),
  ('security.jwt_refresh_ttl',  '604800',               'security', 'Refresh Token TTL (s)',    '7-day refresh token lifetime in seconds',   'number'),
  ('security.max_login_attempts','5',                   'security', 'Max Login Attempts',       'Failures before account lockout',           'number'),
  ('security.lockout_minutes',  '15',                   'security', 'Lockout Duration (min)',   'Minutes an account stays locked',           'number'),
  ('notifications.push_enabled','true',                 'notifications','Push Notifications',   'Enable FCM push notifications',             'boolean'),
  ('notifications.sms_enabled', 'false',                'notifications','SMS Notifications',    'Enable SMS fallback',                       'boolean'),
  ('maintenance.mode',          'false',                'system',   'Maintenance Mode',        'Put site into read-only maintenance mode',  'boolean'),
  ('maintenance.message',       'We are upgrading the system. Back shortly.',
                                                        'system',   'Maintenance Message',     'Shown to users during maintenance',         'string')
) AS s(setting_key, setting_value, category, label, description, value_type)
ON  t.setting_key = s.setting_key
WHEN NOT MATCHED THEN
  INSERT (setting_key, setting_value, category, label, description, value_type)
  VALUES (s.setting_key, s.setting_value, s.category, s.label, s.description, s.value_type)
WHEN MATCHED THEN UPDATE SET
  t.setting_value = s.setting_value,
  t.category      = s.category,
  t.label         = s.label,
  t.description   = s.description,
  t.value_type    = s.value_type;

-- ─────────────────────────────────────────────────────────────
-- 2. ROLES
-- ─────────────────────────────────────────────────────────────
PRINT '2. roles';
MERGE roles AS t
USING (VALUES
  ('super_admin',       'Super Administrator',   'Unrestricted access to all modules and settings',          1, 1),
  ('admin',             'Administrator',         'Full operational access; cannot modify system roles',      1, 1),
  ('transport_manager', 'Transport Manager',     'Manages drivers, vehicles, routes and trip scheduling',    1, 1),
  ('finance_officer',   'Finance Officer',       'Manages fares, wallet top-ups and financial analytics',    1, 1),
  ('ops_staff',         'Operations Staff',      'Monitors live tracking, handles notifications',            1, 1),
  ('auditor',           'Auditor',               'Read-only access to all operational data',                 1, 1),
  ('it_admin',          'IT Administrator',      'User management and system health monitoring',             1, 1),
  ('staff',             'Staff',                 'Counter staff — processes top-ups and tickets',            1, 1),
  ('driver',            'Driver',                'Manages own trips and views own schedule',                 1, 1),
  ('passenger',         'Passenger',             'Books tickets, manages own wallet and views routes',       1, 1)
) AS s(role_key, display_name, description, is_system, is_active)
ON  t.role_key = s.role_key
WHEN NOT MATCHED THEN
  INSERT (role_key, display_name, description, is_system, is_active)
  VALUES (s.role_key, s.display_name, s.description, s.is_system, s.is_active)
WHEN MATCHED THEN UPDATE SET
  t.display_name = s.display_name,
  t.description  = s.description,
  t.is_active    = s.is_active;

-- ─────────────────────────────────────────────────────────────
-- 3. PERMISSIONS
-- Merged on (module_name, action_name) — the UQ_permissions_module_action key
-- ─────────────────────────────────────────────────────────────
PRINT '3. permissions';
MERGE permissions AS t
USING (VALUES
  ('dashboard.view',       'dashboard',     'view',   'View main dashboard'),
  ('live.view',            'live',          'view',   'View live bus map'),
  ('live.edit',            'live',          'edit',   'Update live bus location'),
  ('camera.view',          'camera',        'view',   'Access camera feeds'),
  ('drivers.view',         'drivers',       'view',   'List and view driver profiles'),
  ('drivers.create',       'drivers',       'create', 'Register new drivers'),
  ('drivers.edit',         'drivers',       'edit',   'Edit driver details'),
  ('drivers.delete',       'drivers',       'delete', 'Remove a driver record'),
  ('vehicles.view',        'vehicles',      'view',   'List and view vehicles'),
  ('vehicles.create',      'vehicles',      'create', 'Add new vehicles'),
  ('vehicles.edit',        'vehicles',      'edit',   'Edit vehicle details'),
  ('vehicles.delete',      'vehicles',      'delete', 'Delete a vehicle record'),
  ('routes.view',          'routes',        'view',   'List and view routes'),
  ('routes.create',        'routes',        'create', 'Create new routes'),
  ('routes.edit',          'routes',        'edit',   'Edit route details'),
  ('routes.delete',        'routes',        'delete', 'Delete a route'),
  ('trips.view',           'trips',         'view',   'View trip list and details'),
  ('trips.create',         'trips',         'create', 'Schedule new trips'),
  ('trips.edit',           'trips',         'edit',   'Update trip status or details'),
  ('trips.delete',         'trips',         'delete', 'Cancel or remove trips'),
  ('analytics.view',       'analytics',     'view',   'View analytics and reports'),
  ('tickets.view',         'tickets',       'view',   'View ticket list'),
  ('tickets.create',       'tickets',       'create', 'Issue new tickets'),
  ('tickets.edit',         'tickets',       'edit',   'Modify ticket status'),
  ('tickets.delete',       'tickets',       'delete', 'Void tickets'),
  ('notifications.view',   'notifications', 'view',   'Read notifications'),
  ('notifications.create', 'notifications', 'create', 'Send notifications'),
  ('ratings.view',         'ratings',       'view',   'View ratings and comments'),
  ('ratings.create',       'ratings',       'create', 'Submit a rating'),
  ('users.view',           'users',         'view',   'List and view user accounts'),
  ('users.create',         'users',         'create', 'Create user accounts'),
  ('users.edit',           'users',         'edit',   'Edit user account details'),
  ('users.delete',         'users',         'delete', 'Delete or suspend user accounts'),
  ('wallet.view',          'wallet',        'view',   'View wallet balances'),
  ('wallet.create',        'wallet',        'create', 'Issue wallet top-ups'),
  ('wallet.edit',          'wallet',        'edit',   'Adjust wallet balances')
) AS s(permission_key, module_name, action_name, description)
ON  t.module_name = s.module_name AND t.action_name = s.action_name
WHEN NOT MATCHED THEN
  INSERT (permission_key, module_name, action_name, description)
  VALUES (s.permission_key, s.module_name, s.action_name, s.description)
WHEN MATCHED THEN UPDATE SET
  t.permission_key = s.permission_key,
  t.description    = s.description;

-- ─────────────────────────────────────────────────────────────
-- 4. USERS
-- Passwords (bcrypt 10 rounds):
--   Admin@123  = $2b$10$eG/v0ScZnqUGry5mcjsvqO7lP2OyZNaA.jL6yPW6M2ltE7a.N/pbe
--   Staff@123  = $2b$10$6kSHNZeRNaNTNQUXAIEbpOGzIpoWMrNtSljKvfvEt/4QCVO0qC5Ye
--   Driver@123 = $2b$10$Ioud0mU6hYQNDANn94R1DeO21jqBX7IiuAWJNezUU2rFyv0i1FUR2
--   Pass@1234  = $2b$10$1dRCfXAgao7ec271oOV8w.vbx3ig78/XMFBxv.adN9N30x81qdkRS
-- ─────────────────────────────────────────────────────────────
PRINT '4. users';
MERGE users AS t
USING (VALUES
  -- Admin / management (Admin@123)
  ('Super Admin',      'superadmin@yallatransit.lb', '$2b$10$eG/v0ScZnqUGry5mcjsvqO7lP2OyZNaA.jL6yPW6M2ltE7a.N/pbe', '+961 1 100001', 'admin'),
  ('Admin User',       'admin@yallatransit.lb',      '$2b$10$eG/v0ScZnqUGry5mcjsvqO7lP2OyZNaA.jL6yPW6M2ltE7a.N/pbe', '+961 1 100002', 'admin'),
  ('Karim Saad',       'karim.saad@yallatransit.lb', '$2b$10$eG/v0ScZnqUGry5mcjsvqO7lP2OyZNaA.jL6yPW6M2ltE7a.N/pbe', '+961 1 100003', 'transport_manager'),
  ('Lara Haddad',      'lara.haddad@yallatransit.lb','$2b$10$eG/v0ScZnqUGry5mcjsvqO7lP2OyZNaA.jL6yPW6M2ltE7a.N/pbe', '+961 1 100004', 'finance_officer'),
  ('Nour Khalil',      'nour.khalil@yallatransit.lb','$2b$10$eG/v0ScZnqUGry5mcjsvqO7lP2OyZNaA.jL6yPW6M2ltE7a.N/pbe', '+961 1 100005', 'ops_staff'),
  ('Samer Azar',       'samer.azar@yallatransit.lb', '$2b$10$eG/v0ScZnqUGry5mcjsvqO7lP2OyZNaA.jL6yPW6M2ltE7a.N/pbe', '+961 1 100006', 'auditor'),
  ('Dina Nassar',      'dina.nassar@yallatransit.lb','$2b$10$eG/v0ScZnqUGry5mcjsvqO7lP2OyZNaA.jL6yPW6M2ltE7a.N/pbe', '+961 1 100007', 'it_admin'),
  -- Counter staff (Staff@123)
  ('Rami Saleh',       'rami.saleh@yallatransit.lb', '$2b$10$6kSHNZeRNaNTNQUXAIEbpOGzIpoWMrNtSljKvfvEt/4QCVO0qC5Ye', '+961 1 200001', 'staff'),
  ('Maya Frem',        'maya.frem@yallatransit.lb',  '$2b$10$6kSHNZeRNaNTNQUXAIEbpOGzIpoWMrNtSljKvfvEt/4QCVO0qC5Ye', '+961 1 200002', 'staff'),
  -- Drivers (Driver@123)
  ('Ahmad Khalil',     'ahmad.khalil@yallatransit.lb','$2b$10$Ioud0mU6hYQNDANn94R1DeO21jqBX7IiuAWJNezUU2rFyv0i1FUR2','+961 3 300001', 'driver'),
  ('Fadi Mansour',     'fadi.mansour@yallatransit.lb','$2b$10$Ioud0mU6hYQNDANn94R1DeO21jqBX7IiuAWJNezUU2rFyv0i1FUR2','+961 3 300002', 'driver'),
  ('Omar Nassar',      'omar.nassar@yallatransit.lb', '$2b$10$Ioud0mU6hYQNDANn94R1DeO21jqBX7IiuAWJNezUU2rFyv0i1FUR2','+961 3 300003', 'driver'),
  ('Walid Haddad',     'walid.haddad@yallatransit.lb','$2b$10$Ioud0mU6hYQNDANn94R1DeO21jqBX7IiuAWJNezUU2rFyv0i1FUR2','+961 3 300004', 'driver'),
  ('Hassan Rizk',      'hassan.rizk@yallatransit.lb', '$2b$10$Ioud0mU6hYQNDANn94R1DeO21jqBX7IiuAWJNezUU2rFyv0i1FUR2','+961 3 300005', 'driver'),
  -- Passengers (Pass@1234)
  ('Sara Mousa',       'sara.mousa@gmail.com',         '$2b$10$1dRCfXAgao7ec271oOV8w.vbx3ig78/XMFBxv.adN9N30x81qdkRS', '+961 70 400001', 'passenger'),
  ('Ali Hassan',       'ali.hassan@gmail.com',          '$2b$10$1dRCfXAgao7ec271oOV8w.vbx3ig78/XMFBxv.adN9N30x81qdkRS', '+961 70 400002', 'passenger'),
  ('Hana Gergi',       'hana.gergi@gmail.com',          '$2b$10$1dRCfXAgao7ec271oOV8w.vbx3ig78/XMFBxv.adN9N30x81qdkRS', '+961 70 400003', 'passenger'),
  ('Jad Khoury',       'jad.khoury@gmail.com',          '$2b$10$1dRCfXAgao7ec271oOV8w.vbx3ig78/XMFBxv.adN9N30x81qdkRS', '+961 70 400004', 'passenger'),
  ('Nadia Bou',        'nadia.bou@gmail.com',           '$2b$10$1dRCfXAgao7ec271oOV8w.vbx3ig78/XMFBxv.adN9N30x81qdkRS', '+961 70 400005', 'passenger'),
  ('Tony Abi',         'tony.abi@gmail.com',            '$2b$10$1dRCfXAgao7ec271oOV8w.vbx3ig78/XMFBxv.adN9N30x81qdkRS', '+961 70 400006', 'passenger'),
  ('Rana Zein',        'rana.zein@gmail.com',           '$2b$10$1dRCfXAgao7ec271oOV8w.vbx3ig78/XMFBxv.adN9N30x81qdkRS', '+961 70 400007', 'passenger'),
  ('George Nader',     'george.nader@gmail.com',        '$2b$10$1dRCfXAgao7ec271oOV8w.vbx3ig78/XMFBxv.adN9N30x81qdkRS', '+961 70 400008', 'passenger'),
  ('Lina Tawk',        'lina.tawk@gmail.com',           '$2b$10$1dRCfXAgao7ec271oOV8w.vbx3ig78/XMFBxv.adN9N30x81qdkRS', '+961 70 400009', 'passenger'),
  ('Kamal Srour',      'kamal.srour@gmail.com',         '$2b$10$1dRCfXAgao7ec271oOV8w.vbx3ig78/XMFBxv.adN9N30x81qdkRS', '+961 70 400010', 'passenger')
) AS s(full_name, email, password_hash, phone, role)
ON  t.email = s.email
WHEN NOT MATCHED THEN
  INSERT (full_name, email, password_hash, phone, role, status)
  VALUES (s.full_name, s.email, s.password_hash, s.phone, s.role, 'active')
WHEN MATCHED THEN UPDATE SET
  t.full_name     = s.full_name,
  t.password_hash = s.password_hash,
  t.phone         = s.phone,
  t.role          = s.role,
  t.status        = 'active';

-- ─────────────────────────────────────────────────────────────
-- 5. ROLE PERMISSIONS
-- ─────────────────────────────────────────────────────────────
PRINT '5. role_permissions';
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM (VALUES
  -- transport_manager
  ('transport_manager','dashboard','view'),
  ('transport_manager','live','view'),
  ('transport_manager','live','edit'),
  ('transport_manager','camera','view'),
  ('transport_manager','drivers','view'),
  ('transport_manager','drivers','create'),
  ('transport_manager','drivers','edit'),
  ('transport_manager','vehicles','view'),
  ('transport_manager','vehicles','create'),
  ('transport_manager','vehicles','edit'),
  ('transport_manager','routes','view'),
  ('transport_manager','routes','create'),
  ('transport_manager','routes','edit'),
  ('transport_manager','trips','view'),
  ('transport_manager','trips','create'),
  ('transport_manager','trips','edit'),
  ('transport_manager','trips','delete'),
  ('transport_manager','analytics','view'),
  ('transport_manager','tickets','view'),
  ('transport_manager','notifications','view'),
  ('transport_manager','ratings','view'),
  ('transport_manager','users','view'),
  -- finance_officer
  ('finance_officer','dashboard','view'),
  ('finance_officer','analytics','view'),
  ('finance_officer','tickets','view'),
  ('finance_officer','tickets','create'),
  ('finance_officer','tickets','edit'),
  ('finance_officer','wallet','view'),
  ('finance_officer','wallet','create'),
  ('finance_officer','wallet','edit'),
  ('finance_officer','ratings','view'),
  ('finance_officer','users','view'),
  -- ops_staff
  ('ops_staff','dashboard','view'),
  ('ops_staff','live','view'),
  ('ops_staff','trips','view'),
  ('ops_staff','notifications','view'),
  ('ops_staff','notifications','create'),
  ('ops_staff','camera','view'),
  ('ops_staff','users','view'),
  -- auditor
  ('auditor','dashboard','view'),
  ('auditor','live','view'),
  ('auditor','camera','view'),
  ('auditor','drivers','view'),
  ('auditor','vehicles','view'),
  ('auditor','routes','view'),
  ('auditor','trips','view'),
  ('auditor','analytics','view'),
  ('auditor','tickets','view'),
  ('auditor','notifications','view'),
  ('auditor','ratings','view'),
  ('auditor','wallet','view'),
  ('auditor','users','view'),
  -- it_admin
  ('it_admin','dashboard','view'),
  ('it_admin','users','view'),
  ('it_admin','users','create'),
  ('it_admin','users','edit'),
  ('it_admin','users','delete'),
  ('it_admin','vehicles','view'),
  ('it_admin','vehicles','edit'),
  ('it_admin','live','view'),
  ('it_admin','camera','view'),
  ('it_admin','notifications','view'),
  ('it_admin','drivers','view'),
  -- staff
  ('staff','dashboard','view'),
  ('staff','live','view'),
  ('staff','trips','view'),
  ('staff','notifications','view'),
  ('staff','notifications','create'),
  ('staff','camera','view'),
  ('staff','wallet','view'),
  ('staff','wallet','create'),
  ('staff','wallet','edit'),
  ('staff','users','view'),
  -- driver
  ('driver','trips','view'),
  ('driver','trips','edit'),
  ('driver','notifications','view'),
  ('driver','ratings','view'),
  ('driver','live','view'),
  -- passenger
  ('passenger','tickets','view'),
  ('passenger','tickets','create'),
  ('passenger','wallet','view'),
  ('passenger','notifications','view'),
  ('passenger','ratings','create'),
  ('passenger','trips','view')
) AS m(role_key, module_name, action_name)
JOIN roles       r ON r.role_key    = m.role_key
JOIN permissions p ON p.module_name = m.module_name AND p.action_name = m.action_name
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp2
  WHERE rp2.role_id = r.role_id AND rp2.permission_id = p.permission_id
);

-- ─────────────────────────────────────────────────────────────
-- 6. VEHICLES
-- status CHECK: 'active' | 'inactive' | 'maintenance'
-- ─────────────────────────────────────────────────────────────
PRINT '6. vehicles';
MERGE vehicles AS t
USING (VALUES
  ('BEY-1001', 'bus',     45, 'Mercedes Citaro 2022',    'active'),
  ('BEY-1002', 'bus',     45, 'Mercedes Citaro 2021',    'active'),
  ('BEY-1003', 'bus',     40, 'Volvo 7900 2020',         'active'),
  ('BEY-2001', 'minibus', 22, 'Toyota Coaster 2023',     'active'),
  ('BEY-2002', 'minibus', 22, 'Toyota Coaster 2019',     'maintenance')
) AS s(plate_number, vehicle_type, capacity, model, status)
ON  t.plate_number = s.plate_number
WHEN NOT MATCHED THEN
  INSERT (plate_number, vehicle_type, capacity, model, status)
  VALUES (s.plate_number, s.vehicle_type, s.capacity, s.model, s.status)
WHEN MATCHED THEN UPDATE SET
  t.vehicle_type = s.vehicle_type,
  t.capacity     = s.capacity,
  t.model        = s.model,
  t.status       = s.status;

-- ─────────────────────────────────────────────────────────────
-- 7. ROUTES
-- ─────────────────────────────────────────────────────────────
PRINT '7. routes';
MERGE routes AS t
USING (VALUES
  ('Route 1 - Riad El Solh to Ras Beirut',  'Riad El Solh Square', 'Ras Beirut Terminal'),
  ('Route 2 - Dora to Downtown Beirut',      'Dora Terminal',       'Downtown Beirut'),
  ('Route 3 - Jounieh to Dora',              'Jounieh Waterfront',  'Dora Terminal'),
  ('Route 4 - Airport to Achrafieh',         'Beirut Airport',      'Ashrafieh Center')
) AS s(route_name, start_location, end_location)
ON  t.route_name = s.route_name AND t.is_deleted = 0
WHEN NOT MATCHED THEN
  INSERT (route_name, start_location, end_location, is_deleted)
  VALUES (s.route_name, s.start_location, s.end_location, 0)
WHEN MATCHED THEN UPDATE SET
  t.start_location = s.start_location,
  t.end_location   = s.end_location;

-- ─────────────────────────────────────────────────────────────
-- 8. STOPS
-- ─────────────────────────────────────────────────────────────
PRINT '8. stops';
MERGE stops AS t
USING (VALUES
  ('Riad El Solh Square',     33.889410, 35.500270),
  ('Hamra Main St',           33.897150, 35.484200),
  ('Ras Beirut Terminal',     33.900200, 35.479100),
  ('Dora Terminal',           33.905180, 35.555900),
  ('Ashrafieh Center',        33.882130, 35.514600),
  ('Downtown Beirut',         33.883980, 35.507430),
  ('Jounieh Waterfront',      33.981200, 35.616800),
  ('Antelias Junction',       33.927400, 35.572500),
  ('Beirut Airport Terminal', 33.820230, 35.490140),
  ('Mar Elias',               33.867100, 35.494800)
) AS s(stop_name, latitude, longitude)
ON  t.stop_name = s.stop_name AND t.is_deleted = 0
WHEN NOT MATCHED THEN
  INSERT (stop_name, latitude, longitude, is_deleted)
  VALUES (s.stop_name, s.latitude, s.longitude, 0)
WHEN MATCHED THEN UPDATE SET
  t.latitude  = s.latitude,
  t.longitude = s.longitude;

-- ─────────────────────────────────────────────────────────────
-- 9. ROUTE_STOPS  (composite PK: route_id + stop_id — no id column)
-- ─────────────────────────────────────────────────────────────
PRINT '9. route_stops';
INSERT INTO route_stops (route_id, stop_id, stop_order)
SELECT r.route_id, s.stop_id, m.stop_order
FROM (VALUES
  ('Route 1 - Riad El Solh to Ras Beirut',  'Riad El Solh Square',     1),
  ('Route 1 - Riad El Solh to Ras Beirut',  'Hamra Main St',            2),
  ('Route 1 - Riad El Solh to Ras Beirut',  'Ras Beirut Terminal',      3),
  ('Route 2 - Dora to Downtown Beirut',      'Dora Terminal',            1),
  ('Route 2 - Dora to Downtown Beirut',      'Ashrafieh Center',         2),
  ('Route 2 - Dora to Downtown Beirut',      'Downtown Beirut',          3),
  ('Route 3 - Jounieh to Dora',              'Jounieh Waterfront',       1),
  ('Route 3 - Jounieh to Dora',              'Antelias Junction',        2),
  ('Route 3 - Jounieh to Dora',              'Dora Terminal',            3),
  ('Route 4 - Airport to Achrafieh',         'Beirut Airport Terminal',  1),
  ('Route 4 - Airport to Achrafieh',         'Mar Elias',                2),
  ('Route 4 - Airport to Achrafieh',         'Hamra Main St',            3),
  ('Route 4 - Airport to Achrafieh',         'Ashrafieh Center',         4)
) AS m(route_name, stop_name, stop_order)
JOIN routes r ON r.route_name = m.route_name AND r.is_deleted = 0
JOIN stops  s ON s.stop_name  = m.stop_name  AND s.is_deleted = 0
WHERE NOT EXISTS (
  SELECT 1 FROM route_stops rs
  WHERE rs.route_id = r.route_id AND rs.stop_id = s.stop_id
);

-- ─────────────────────────────────────────────────────────────
-- 10. STOP AMENITIES
-- ─────────────────────────────────────────────────────────────
PRINT '10. stop_amenities';
INSERT INTO stop_amenities
  (stop_id, has_shelter, has_seating, has_lighting, has_wheelchair, has_ticket_machine, has_wifi, nearby_landmark)
SELECT s.stop_id,
       m.has_shelter, m.has_seating, m.has_lighting,
       m.has_wheelchair, m.has_ticket_machine, m.has_wifi, m.nearby_landmark
FROM (VALUES
  ('Riad El Solh Square',     1,1,1,1,1,1,'Grand Serail'),
  ('Hamra Main St',           1,1,1,1,0,0,'AUB Main Gate'),
  ('Ras Beirut Terminal',     1,1,1,0,0,0,'Corniche'),
  ('Dora Terminal',           1,1,1,1,1,0,'Dora Interchange'),
  ('Ashrafieh Center',        1,0,1,0,0,0,'Sassine Square'),
  ('Downtown Beirut',         1,1,1,1,1,1,'Martyrs Square'),
  ('Jounieh Waterfront',      1,1,1,0,0,0,'Jounieh Bay'),
  ('Antelias Junction',       0,0,1,0,0,0,'Antelias Bridge'),
  ('Beirut Airport Terminal', 1,1,1,1,1,1,'Rafic Hariri Airport'),
  ('Mar Elias',               0,1,1,0,0,0,'Mar Elias Church')
) AS m(stop_name, has_shelter, has_seating, has_lighting,
        has_wheelchair, has_ticket_machine, has_wifi, nearby_landmark)
JOIN stops s ON s.stop_name = m.stop_name AND s.is_deleted = 0
WHERE NOT EXISTS (
  SELECT 1 FROM stop_amenities sa WHERE sa.stop_id = s.stop_id
);

-- ─────────────────────────────────────────────────────────────
-- 11. ROUTE WAYPOINTS
-- ─────────────────────────────────────────────────────────────
PRINT '11. route_waypoints';
INSERT INTO route_waypoints (route_id, latitude, longitude, wp_order)
SELECT r.route_id, m.latitude, m.longitude, m.wp_order
FROM (VALUES
  ('Route 1 - Riad El Solh to Ras Beirut', 33.889410, 35.500270, 1),
  ('Route 1 - Riad El Solh to Ras Beirut', 33.893000, 35.492500, 2),
  ('Route 1 - Riad El Solh to Ras Beirut', 33.897150, 35.484200, 3),
  ('Route 1 - Riad El Solh to Ras Beirut', 33.900200, 35.479100, 4),
  ('Route 2 - Dora to Downtown Beirut',     33.905180, 35.555900, 1),
  ('Route 2 - Dora to Downtown Beirut',     33.896000, 35.540000, 2),
  ('Route 2 - Dora to Downtown Beirut',     33.882130, 35.514600, 3),
  ('Route 2 - Dora to Downtown Beirut',     33.883980, 35.507430, 4),
  ('Route 3 - Jounieh to Dora',             33.981200, 35.616800, 1),
  ('Route 3 - Jounieh to Dora',             33.960000, 35.598000, 2),
  ('Route 3 - Jounieh to Dora',             33.927400, 35.572500, 3),
  ('Route 3 - Jounieh to Dora',             33.905180, 35.555900, 4),
  ('Route 4 - Airport to Achrafieh',        33.820230, 35.490140, 1),
  ('Route 4 - Airport to Achrafieh',        33.847000, 35.492000, 2),
  ('Route 4 - Airport to Achrafieh',        33.867100, 35.494800, 3),
  ('Route 4 - Airport to Achrafieh',        33.897150, 35.484200, 4),
  ('Route 4 - Airport to Achrafieh',        33.882130, 35.514600, 5)
) AS m(route_name, latitude, longitude, wp_order)
JOIN routes r ON r.route_name = m.route_name AND r.is_deleted = 0
WHERE NOT EXISTS (
  SELECT 1 FROM route_waypoints w
  WHERE w.route_id = r.route_id AND w.wp_order = m.wp_order
);

-- ─────────────────────────────────────────────────────────────
-- 12. DRIVERS
-- ─────────────────────────────────────────────────────────────
PRINT '12. drivers';
INSERT INTO drivers (user_id, license_number, hire_date, license_expiry_date, is_deleted)
SELECT u.user_id, m.license_number, m.hire_date, m.license_expiry_date, 0
FROM (VALUES
  ('ahmad.khalil@yallatransit.lb',  'LB-2020-DRV-001', '2020-01-15', '2027-01-14'),
  ('fadi.mansour@yallatransit.lb',  'LB-2019-DRV-002', '2019-06-01', '2026-05-31'),
  ('omar.nassar@yallatransit.lb',   'LB-2021-DRV-003', '2021-03-10', '2028-03-09'),
  ('walid.haddad@yallatransit.lb',  'LB-2018-DRV-004', '2018-09-20', '2026-09-19'),
  ('hassan.rizk@yallatransit.lb',   'LB-2022-DRV-005', '2022-11-01', '2029-10-31')
) AS m(email, license_number, hire_date, license_expiry_date)
JOIN users u ON u.email = m.email
WHERE NOT EXISTS (
  SELECT 1 FROM drivers d WHERE d.user_id = u.user_id
);

-- ─────────────────────────────────────────────────────────────
-- 13. TOP-UP LOCATIONS
-- ─────────────────────────────────────────────────────────────
PRINT '13. top_up_locations';
MERGE top_up_locations AS t
USING (VALUES
  ('Riad El Solh Transit Hub',      '5 Riad El Solh Square',           'Beirut',         '+961 1 201010', 'Mon-Fri 06:00-20:00, Sat-Sun 08:00-18:00'),
  ('Hamra Customer Service Centre', '12 Hamra Main Street',             'Beirut',         '+961 1 202020', 'Daily 07:00-21:00'),
  ('Dora Terminal Office',          'Dora Bus Terminal, Ground Floor',  'Dora',           '+961 1 203030', 'Daily 06:00-22:00'),
  ('Jounieh Service Point',         '3 Jounieh Waterfront Road',        'Jounieh',        '+961 9 204040', 'Mon-Fri 08:00-18:00'),
  ('Antelias Agent Counter',        'Antelias Center, Shop 5',          'Antelias',       '+961 4 205050', 'Mon-Sat 09:00-19:00'),
  ('Airport Transit Kiosk',         'Terminal 1, Arrivals Hall',        'Beirut Airport', '+961 1 206060', 'Daily 05:00-23:00')
) AS s(name, address, city, phone, hours)
ON  t.name = s.name
WHEN NOT MATCHED THEN
  INSERT (name, address, city, phone, hours, is_active)
  VALUES (s.name, s.address, s.city, s.phone, s.hours, 1)
WHEN MATCHED THEN UPDATE SET
  t.address   = s.address,
  t.city      = s.city,
  t.phone     = s.phone,
  t.hours     = s.hours,
  t.is_active = 1;

-- ─────────────────────────────────────────────────────────────
-- 14. WALLETS (one per user)
-- ─────────────────────────────────────────────────────────────
PRINT '14. wallets';
MERGE wallets AS t
USING (
  SELECT u.user_id, m.balance
  FROM (VALUES
    ('superadmin@yallatransit.lb',    0.00),
    ('admin@yallatransit.lb',         0.00),
    ('karim.saad@yallatransit.lb',    0.00),
    ('lara.haddad@yallatransit.lb',   0.00),
    ('nour.khalil@yallatransit.lb',   0.00),
    ('samer.azar@yallatransit.lb',    0.00),
    ('dina.nassar@yallatransit.lb',   0.00),
    ('rami.saleh@yallatransit.lb',    0.00),
    ('maya.frem@yallatransit.lb',     0.00),
    ('ahmad.khalil@yallatransit.lb',  0.00),
    ('fadi.mansour@yallatransit.lb',  0.00),
    ('omar.nassar@yallatransit.lb',   0.00),
    ('walid.haddad@yallatransit.lb',  0.00),
    ('hassan.rizk@yallatransit.lb',   0.00),
    ('sara.mousa@gmail.com',         75.00),
    ('ali.hassan@gmail.com',         40.00),
    ('hana.gergi@gmail.com',         90.00),
    ('jad.khoury@gmail.com',         55.00),
    ('nadia.bou@gmail.com',          30.00),
    ('tony.abi@gmail.com',           60.00),
    ('rana.zein@gmail.com',          35.00),
    ('george.nader@gmail.com',       85.00),
    ('lina.tawk@gmail.com',          50.00),
    ('kamal.srour@gmail.com',        45.00)
  ) AS m(email, balance)
  JOIN users u ON u.email = m.email
) AS s
ON t.user_id = s.user_id
WHEN NOT MATCHED THEN
  INSERT (user_id, balance, is_frozen)
  VALUES (s.user_id, s.balance, 0)
WHEN MATCHED THEN UPDATE SET
  t.balance = s.balance;

-- ─────────────────────────────────────────────────────────────
-- 15. TRIPS
-- status CHECK: 'scheduled' | 'ongoing' | 'completed' | 'cancelled'
-- ─────────────────────────────────────────────────────────────
PRINT '15. trips';
INSERT INTO trips (vehicle_id, driver_id, route_id, start_time, end_time, status)
SELECT v.vehicle_id, d.driver_id, r.route_id, m.start_time, m.end_time, m.status
FROM (VALUES
  ('BEY-1001', 'ahmad.khalil@yallatransit.lb',  'Route 1 - Riad El Solh to Ras Beirut', '2026-05-25 07:00:00', '2026-05-25 09:30:00', 'completed'),
  ('BEY-1002', 'fadi.mansour@yallatransit.lb',  'Route 2 - Dora to Downtown Beirut',    '2026-05-25 08:00:00', '2026-05-25 10:00:00', 'completed'),
  ('BEY-1003', 'omar.nassar@yallatransit.lb',   'Route 3 - Jounieh to Dora',            '2026-05-26 07:00:00', NULL,                  'ongoing'),
  ('BEY-2001', 'walid.haddad@yallatransit.lb',  'Route 4 - Airport to Achrafieh',       '2026-05-26 14:00:00', NULL,                  'scheduled'),
  ('BEY-1001', 'hassan.rizk@yallatransit.lb',   'Route 1 - Riad El Solh to Ras Beirut', '2026-05-27 07:00:00', NULL,                  'scheduled'),
  ('BEY-1002', 'ahmad.khalil@yallatransit.lb',  'Route 2 - Dora to Downtown Beirut',    '2026-05-24 08:00:00', '2026-05-24 10:15:00', 'completed'),
  ('BEY-1003', 'fadi.mansour@yallatransit.lb',  'Route 3 - Jounieh to Dora',            '2026-05-24 07:00:00', '2026-05-24 09:45:00', 'completed'),
  ('BEY-2002', 'walid.haddad@yallatransit.lb',  'Route 4 - Airport to Achrafieh',       '2026-05-23 10:00:00', NULL,                  'cancelled'),
  -- Upcoming trips (relative to "today" = 2026-06-08)
  ('BEY-1001', 'ahmad.khalil@yallatransit.lb',  'Route 1 - Riad El Solh to Ras Beirut', '2026-06-10 07:00:00', NULL,                  'scheduled'),
  ('BEY-1002', 'fadi.mansour@yallatransit.lb',  'Route 2 - Dora to Downtown Beirut',    '2026-06-10 08:30:00', NULL,                  'scheduled'),
  ('BEY-1003', 'omar.nassar@yallatransit.lb',   'Route 3 - Jounieh to Dora',            '2026-06-11 07:00:00', NULL,                  'scheduled'),
  ('BEY-2001', 'walid.haddad@yallatransit.lb',  'Route 4 - Airport to Achrafieh',       '2026-06-12 14:00:00', NULL,                  'scheduled'),
  ('BEY-1001', 'hassan.rizk@yallatransit.lb',   'Route 1 - Riad El Solh to Ras Beirut', '2026-06-13 07:00:00', NULL,                  'scheduled')
) AS m(plate_number, driver_email, route_name, start_time, end_time, status)
JOIN vehicles v ON v.plate_number = m.plate_number
JOIN users    u ON u.email        = m.driver_email
JOIN drivers  d ON d.user_id      = u.user_id
JOIN routes   r ON r.route_name   = m.route_name AND r.is_deleted = 0
WHERE NOT EXISTS (
  SELECT 1 FROM trips t2
  WHERE t2.vehicle_id = v.vehicle_id
    AND t2.driver_id  = d.driver_id
    AND t2.route_id   = r.route_id
    AND t2.start_time = m.start_time
);

-- ─────────────────────────────────────────────────────────────
-- 16. TICKETS
-- status CHECK: 'confirmed' | 'boarded' | 'completed' | 'cancelled'
-- ─────────────────────────────────────────────────────────────
PRINT '16. tickets';
INSERT INTO tickets (user_id, trip_id, seat_number, status, amount, share_count)
SELECT u.user_id, t.trip_id, m.seat_number, m.status, m.amount, 0
FROM (VALUES
  -- Trip 1 completed (Route 1, BEY-1001, 2026-05-25 07:00)
  ('sara.mousa@gmail.com',   'Route 1 - Riad El Solh to Ras Beirut', 'BEY-1001', '2026-05-25 07:00:00', 'A1', 'completed', 1.50),
  ('ali.hassan@gmail.com',   'Route 1 - Riad El Solh to Ras Beirut', 'BEY-1001', '2026-05-25 07:00:00', 'A2', 'completed', 1.13),
  ('hana.gergi@gmail.com',   'Route 1 - Riad El Solh to Ras Beirut', 'BEY-1001', '2026-05-25 07:00:00', 'A3', 'completed', 1.05),
  ('jad.khoury@gmail.com',   'Route 1 - Riad El Solh to Ras Beirut', 'BEY-1001', '2026-05-25 07:00:00', 'A4', 'completed', 1.35),
  ('nadia.bou@gmail.com',    'Route 1 - Riad El Solh to Ras Beirut', 'BEY-1001', '2026-05-25 07:00:00', 'A5', 'completed', 0.75),
  -- Trip 2 completed (Route 2, BEY-1002, 2026-05-25 08:00)
  ('tony.abi@gmail.com',     'Route 2 - Dora to Downtown Beirut',    'BEY-1002', '2026-05-25 08:00:00', 'B1', 'completed', 1.50),
  ('rana.zein@gmail.com',    'Route 2 - Dora to Downtown Beirut',    'BEY-1002', '2026-05-25 08:00:00', 'B2', 'completed', 1.13),
  ('george.nader@gmail.com', 'Route 2 - Dora to Downtown Beirut',    'BEY-1002', '2026-05-25 08:00:00', 'B3', 'completed', 1.50),
  ('lina.tawk@gmail.com',    'Route 2 - Dora to Downtown Beirut',    'BEY-1002', '2026-05-25 08:00:00', 'B4', 'completed', 1.35),
  ('kamal.srour@gmail.com',  'Route 2 - Dora to Downtown Beirut',    'BEY-1002', '2026-05-25 08:00:00', 'B5', 'completed', 1.05),
  -- Trip 3 ongoing (Route 3, BEY-1003, 2026-05-26 07:00) — boarded / confirmed
  ('sara.mousa@gmail.com',   'Route 3 - Jounieh to Dora',            'BEY-1003', '2026-05-26 07:00:00', 'C1', 'boarded',   1.50),
  ('ali.hassan@gmail.com',   'Route 3 - Jounieh to Dora',            'BEY-1003', '2026-05-26 07:00:00', 'C2', 'confirmed', 1.13),
  -- Trip 4 scheduled (Route 4, BEY-2001, 2026-05-26 14:00) — confirmed
  ('tony.abi@gmail.com',     'Route 4 - Airport to Achrafieh',       'BEY-2001', '2026-05-26 14:00:00', 'D1', 'confirmed', 1.50),
  ('george.nader@gmail.com', 'Route 4 - Airport to Achrafieh',       'BEY-2001', '2026-05-26 14:00:00', 'D2', 'confirmed', 1.50)
) AS m(passenger_email, route_name, plate_number, trip_start, seat_number, status, amount)
JOIN users    u ON u.email        = m.passenger_email
JOIN vehicles v ON v.plate_number = m.plate_number
JOIN routes   r ON r.route_name   = m.route_name AND r.is_deleted = 0
JOIN trips    t ON t.vehicle_id   = v.vehicle_id
               AND t.route_id     = r.route_id
               AND t.start_time   = m.trip_start
WHERE NOT EXISTS (
  SELECT 1 FROM tickets tk
  WHERE tk.user_id     = u.user_id
    AND tk.trip_id     = t.trip_id
    AND tk.seat_number = m.seat_number
);

-- ─────────────────────────────────────────────────────────────
-- 17. WALLET RECHARGES (staff cash top-ups for passengers)
-- ─────────────────────────────────────────────────────────────
PRINT '17. wallet_recharges';
INSERT INTO wallet_recharges (user_id, staff_id, amount, location_name, tx_ref, notes)
SELECT pu.user_id, su.user_id, s.amount, s.location_name, s.tx_ref, s.notes
FROM (VALUES
  ('sara.mousa@gmail.com',   'rami.saleh@yallatransit.lb',  50.00, 'Hamra Customer Service Centre', 'TXN-2026-0001', 'Cash top-up'),
  ('ali.hassan@gmail.com',   'rami.saleh@yallatransit.lb',  20.00, 'Hamra Customer Service Centre', 'TXN-2026-0002', 'Cash top-up'),
  ('hana.gergi@gmail.com',   'maya.frem@yallatransit.lb',   65.00, 'Dora Terminal Office',          'TXN-2026-0003', 'Cash top-up'),
  ('jad.khoury@gmail.com',   'maya.frem@yallatransit.lb',   25.00, 'Dora Terminal Office',          'TXN-2026-0004', 'Cash top-up'),
  ('tony.abi@gmail.com',     'rami.saleh@yallatransit.lb',  35.00, 'Riad El Solh Transit Hub',      'TXN-2026-0005', 'Cash top-up'),
  ('george.nader@gmail.com', 'maya.frem@yallatransit.lb',   55.00, 'Airport Transit Kiosk',         'TXN-2026-0006', 'Cash top-up'),
  ('lina.tawk@gmail.com',    'rami.saleh@yallatransit.lb',  30.00, 'Riad El Solh Transit Hub',      'TXN-2026-0007', 'Cash top-up'),
  ('kamal.srour@gmail.com',  'maya.frem@yallatransit.lb',   25.00, 'Hamra Customer Service Centre', 'TXN-2026-0008', 'Cash top-up')
) AS s(passenger_email, staff_email, amount, location_name, tx_ref, notes)
JOIN users pu ON pu.email = s.passenger_email
JOIN users su ON su.email = s.staff_email
WHERE NOT EXISTS (
  SELECT 1 FROM wallet_recharges wr WHERE wr.tx_ref = s.tx_ref
);

-- ─────────────────────────────────────────────────────────────
-- 18. WALLET TRANSACTIONS
-- Credit for each recharge + debit for completed/boarded tickets
-- ─────────────────────────────────────────────────────────────
PRINT '18. wallet_transactions (credits)';
INSERT INTO wallet_transactions (user_id, recharge_id, type, amount, description)
SELECT wr.user_id, wr.recharge_id, 'credit', wr.amount,
       'Wallet top-up at ' + wr.location_name
FROM wallet_recharges wr
WHERE NOT EXISTS (
  SELECT 1 FROM wallet_transactions wt
  WHERE wt.recharge_id = wr.recharge_id AND wt.type = 'credit'
);

PRINT '18b. wallet_transactions (debits)';
INSERT INTO wallet_transactions (user_id, recharge_id, type, amount, description)
SELECT tk.user_id, NULL, 'debit', tk.amount,
       'Trip fare — ' + r.route_name
FROM tickets  tk
JOIN trips    tr ON tr.trip_id  = tk.trip_id
JOIN routes   r  ON r.route_id  = tr.route_id
WHERE tk.status IN ('completed', 'boarded')
  AND NOT EXISTS (
    SELECT 1 FROM wallet_transactions wt
    WHERE wt.user_id     = tk.user_id
      AND wt.type        = 'debit'
      AND wt.amount      = tk.amount
      AND wt.description = 'Trip fare — ' + r.route_name
      AND wt.created_at >= DATEADD(day, -7, GETDATE())
  );

-- ─────────────────────────────────────────────────────────────
-- 19. GPS LOGS (5 pings for the ongoing trip)
-- ─────────────────────────────────────────────────────────────
PRINT '19. gps_logs';
INSERT INTO gps_logs (trip_id, latitude, longitude, recorded_at)
SELECT t.trip_id, m.latitude, m.longitude, m.recorded_at
FROM (VALUES
  ('Route 3 - Jounieh to Dora', 'BEY-1003', '2026-05-26 07:00:00', 33.981200, 35.616800, '2026-05-26 07:00:00'),
  ('Route 3 - Jounieh to Dora', 'BEY-1003', '2026-05-26 07:00:00', 33.970000, 35.608000, '2026-05-26 07:10:00'),
  ('Route 3 - Jounieh to Dora', 'BEY-1003', '2026-05-26 07:00:00', 33.960000, 35.598000, '2026-05-26 07:20:00'),
  ('Route 3 - Jounieh to Dora', 'BEY-1003', '2026-05-26 07:00:00', 33.950000, 35.590000, '2026-05-26 07:30:00'),
  ('Route 3 - Jounieh to Dora', 'BEY-1003', '2026-05-26 07:00:00', 33.940000, 35.582000, '2026-05-26 07:40:00')
) AS m(route_name, plate_number, trip_start, latitude, longitude, recorded_at)
JOIN vehicles v ON v.plate_number = m.plate_number
JOIN routes   r ON r.route_name   = m.route_name AND r.is_deleted = 0
JOIN trips    t ON t.vehicle_id   = v.vehicle_id
               AND t.route_id     = r.route_id
               AND t.start_time   = m.trip_start
WHERE NOT EXISTS (
  SELECT 1 FROM gps_logs g
  WHERE g.trip_id     = t.trip_id
    AND g.recorded_at = m.recorded_at
);

-- ─────────────────────────────────────────────────────────────
-- 20. NOTIFICATIONS
-- user_id is NOT NULL — use the admin user for broadcasts
-- ─────────────────────────────────────────────────────────────
PRINT '20. notifications';
INSERT INTO notifications (user_id, message, title, body, type, target_group, is_read, sent_count, read_count)
SELECT u.user_id, m.message, m.title, m.body, m.type, m.target_group, 0, 0, 0
FROM (VALUES
  ('superadmin@yallatransit.lb',
   'System launched successfully.',
   'Welcome to Yalla Transit',
   'The Yalla Transit system is now live and operational.',
   'info', 'all_users'),
  ('superadmin@yallatransit.lb',
   'Scheduled maintenance on 2026-06-01 from 02:00-04:00.',
   'Planned Maintenance',
   'The system will be unavailable for 2 hours on June 1st for upgrades.',
   'warning', 'all_users'),
  ('superadmin@yallatransit.lb',
   'Route 3 (Jounieh to Dora) is currently running on schedule.',
   'Route 3 Status Update',
   'Bus BEY-1003 on Route 3 is running on schedule today.',
   'info', 'passengers'),
  ('nour.khalil@yallatransit.lb',
   'Trip BEY-1003 on Route 3 is now active.',
   'Trip Started',
   'Driver Omar Nassar has started Trip on Route 3.',
   'info', 'staff')
) AS m(sender_email, message, title, body, type, target_group)
JOIN users u ON u.email = m.sender_email
WHERE NOT EXISTS (
  SELECT 1 FROM notifications n
  WHERE n.user_id = u.user_id AND n.title = m.title
);

-- ─────────────────────────────────────────────────────────────
-- 21. RATINGS  (rating CHECK: 1–5)
-- ─────────────────────────────────────────────────────────────
PRINT '21. ratings';
INSERT INTO ratings (user_id, trip_id, rating, comment)
SELECT u.user_id, t.trip_id, m.rating, m.comment
FROM (VALUES
  ('sara.mousa@gmail.com',   'Route 1 - Riad El Solh to Ras Beirut', 'BEY-1001', '2026-05-25 07:00:00', 5, 'Smooth ride, very professional driver!'),
  ('ali.hassan@gmail.com',   'Route 1 - Riad El Solh to Ras Beirut', 'BEY-1001', '2026-05-25 07:00:00', 4, 'Good service, a bit crowded.'),
  ('tony.abi@gmail.com',     'Route 2 - Dora to Downtown Beirut',    'BEY-1002', '2026-05-25 08:00:00', 5, 'Excellent punctuality.'),
  ('rana.zein@gmail.com',    'Route 2 - Dora to Downtown Beirut',    'BEY-1002', '2026-05-25 08:00:00', 3, 'AC was not working well.'),
  ('george.nader@gmail.com', 'Route 2 - Dora to Downtown Beirut',    'BEY-1002', '2026-05-25 08:00:00', 4, 'On time, comfortable seats.')
) AS m(passenger_email, route_name, plate_number, trip_start, rating, comment)
JOIN users    u ON u.email        = m.passenger_email
JOIN vehicles v ON v.plate_number = m.plate_number
JOIN routes   r ON r.route_name   = m.route_name AND r.is_deleted = 0
JOIN trips    t ON t.vehicle_id   = v.vehicle_id
               AND t.route_id     = r.route_id
               AND t.start_time   = m.trip_start
WHERE NOT EXISTS (
  SELECT 1 FROM ratings rt
  WHERE rt.user_id = u.user_id AND rt.trip_id = t.trip_id
);

-- ─────────────────────────────────────────────────────────────
-- 22. TRIP CHECKLISTS (pre-departure safety checks)
-- ─────────────────────────────────────────────────────────────
PRINT '22. trip_checklists';
INSERT INTO trip_checklists (trip_id, fuel_ok, lights_ok, tires_ok, submitted_at)
SELECT t.trip_id, 1, 1, 1, t.start_time
FROM trips t
WHERE t.status IN ('completed', 'ongoing', 'scheduled')
  AND NOT EXISTS (
    SELECT 1 FROM trip_checklists tc WHERE tc.trip_id = t.trip_id
  );

-- ─────────────────────────────────────────────────────────────
-- 23. TRIP DELAYS
-- ─────────────────────────────────────────────────────────────
PRINT '23. trip_delays';
INSERT INTO trip_delays (trip_id, reason, delay_minutes, notes, reported_at)
SELECT t.trip_id,
       'Heavy traffic near Ashrafieh',
       8,
       'Delay due to rush-hour congestion on Charles Helou Avenue',
       '2026-05-25 08:40:00'
FROM vehicles v
JOIN routes   r ON r.route_name = 'Route 2 - Dora to Downtown Beirut' AND r.is_deleted = 0
JOIN trips    t ON t.vehicle_id = v.vehicle_id
               AND t.route_id   = r.route_id
               AND t.start_time = '2026-05-25 08:00:00'
WHERE v.plate_number = 'BEY-1002'
  AND NOT EXISTS (SELECT 1 FROM trip_delays td WHERE td.trip_id = t.trip_id);

-- ─────────────────────────────────────────────────────────────
-- 24. ETA PREDICTIONS (for the current ongoing trip)
-- ─────────────────────────────────────────────────────────────
PRINT '24. eta_predictions';
INSERT INTO eta_predictions (trip_id, predicted_arrival, confidence)
SELECT t.trip_id, '2026-05-26 09:30:00', 82.50
FROM vehicles v
JOIN routes   r ON r.route_name = 'Route 3 - Jounieh to Dora' AND r.is_deleted = 0
JOIN trips    t ON t.vehicle_id = v.vehicle_id
               AND t.route_id   = r.route_id
               AND t.start_time = '2026-05-26 07:00:00'
WHERE v.plate_number = 'BEY-1003'
  AND NOT EXISTS (SELECT 1 FROM eta_predictions e WHERE e.trip_id = t.trip_id);

-- ─────────────────────────────────────────────────────────────
-- 25. PASSENGER COUNTS
-- method CHECK: 'qr_scan' | 'camera'
-- ─────────────────────────────────────────────────────────────
PRINT '25. passenger_counts';
INSERT INTO passenger_counts (trip_id, passenger_count, method, recorded_at)
SELECT t.trip_id, m.passenger_count, m.method, m.recorded_at
FROM (VALUES
  ('Route 1 - Riad El Solh to Ras Beirut', 'BEY-1001', '2026-05-25 07:00:00', 28, 'qr_scan', '2026-05-25 08:00:00'),
  ('Route 2 - Dora to Downtown Beirut',    'BEY-1002', '2026-05-25 08:00:00', 35, 'camera',  '2026-05-25 09:00:00'),
  ('Route 3 - Jounieh to Dora',            'BEY-1003', '2026-05-26 07:00:00', 18, 'camera',  '2026-05-26 07:45:00')
) AS m(route_name, plate_number, trip_start, passenger_count, method, recorded_at)
JOIN vehicles v ON v.plate_number = m.plate_number
JOIN routes   r ON r.route_name   = m.route_name AND r.is_deleted = 0
JOIN trips    t ON t.vehicle_id   = v.vehicle_id
               AND t.route_id     = r.route_id
               AND t.start_time   = m.trip_start
WHERE NOT EXISTS (
  SELECT 1 FROM passenger_counts pc
  WHERE pc.trip_id = t.trip_id AND pc.recorded_at = m.recorded_at
);

-- ─────────────────────────────────────────────────────────────
-- 26. RECURRING TRIP SCHEDULES
-- ─────────────────────────────────────────────────────────────
PRINT '26. recurring_trip_schedules';
MERGE recurring_trip_schedules AS t
USING (VALUES
  ('Route 1 - Riad El Solh to Ras Beirut', 'Ahmad Khalil',  'BEY-1001', '07:00:00', 'daily',   NULL,              'Active', '2026-05-01', '2026-05-27'),
  ('Route 2 - Dora to Downtown Beirut',    'Fadi Mansour',  'BEY-1002', '08:00:00', 'weekdays','Mon,Tue,Wed,Thu,Fri','Active','2026-05-01','2026-05-27'),
  ('Route 3 - Jounieh to Dora',            'Omar Nassar',   'BEY-1003', '07:00:00', 'daily',   NULL,              'Active', '2026-05-01', '2026-05-27'),
  ('Route 4 - Airport to Achrafieh',       'Walid Haddad',  'BEY-2001', '14:00:00', 'daily',   NULL,              'Active', '2026-05-01', '2026-05-27')
) AS s(route_name, driver_name, vehicle_plate, departure_time, recurrence, custom_days, status, active_from, next_run)
ON  t.route_name     = s.route_name
AND t.vehicle_plate  = s.vehicle_plate
AND t.departure_time = s.departure_time
WHEN NOT MATCHED THEN
  INSERT (route_name, driver_name, vehicle_plate, departure_time, recurrence, custom_days, status, active_from, next_run)
  VALUES (s.route_name, s.driver_name, s.vehicle_plate, s.departure_time, s.recurrence, s.custom_days, s.status, s.active_from, s.next_run)
WHEN MATCHED THEN UPDATE SET
  t.driver_name = s.driver_name,
  t.status      = s.status,
  t.next_run    = s.next_run;

-- ─────────────────────────────────────────────────────────────
-- 27. VEHICLE FUEL RECORDS
-- km_per_liter is a PERSISTED computed column — do NOT insert it
-- odometer_km is NOT NULL
-- ─────────────────────────────────────────────────────────────
PRINT '27. vehicle_fuel_records';
INSERT INTO vehicle_fuel_records
  (vehicle_id, fuel_date, liters, cost, odometer_km, station, cost_per_liter, notes, recorded_by)
SELECT v.vehicle_id, m.fuel_date, m.liters, m.cost, m.odometer_km,
       m.station, m.cost_per_liter, m.notes, u.user_id
FROM (VALUES
  ('BEY-1001', '2026-05-20', 80.00, 128.00, 245800, 'Total Hamra',     1.600, 'Regular refuel',    'karim.saad@yallatransit.lb'),
  ('BEY-1001', '2026-05-25', 75.00, 120.00, 246550, 'Total Hamra',     1.600, 'Post-trip refuel',  'karim.saad@yallatransit.lb'),
  ('BEY-1002', '2026-05-21', 82.00, 131.20, 189400, 'Shell Dora',      1.600, 'Regular refuel',    'karim.saad@yallatransit.lb'),
  ('BEY-1003', '2026-05-19', 70.00, 112.00, 312100, 'Medco Jounieh',   1.600, 'Regular refuel',    'karim.saad@yallatransit.lb'),
  ('BEY-2001', '2026-05-22', 45.00,  72.00,  98600, 'Total Hamra',     1.600, 'Regular refuel',    'karim.saad@yallatransit.lb'),
  ('BEY-2002', '2026-05-18', 50.00,  80.00, 152300, 'Shell Dora',      1.600, 'Pre-maintenance',   'karim.saad@yallatransit.lb')
) AS m(plate_number, fuel_date, liters, cost, odometer_km, station, cost_per_liter, notes, recorded_by_email)
JOIN vehicles v ON v.plate_number = m.plate_number
JOIN users    u ON u.email        = m.recorded_by_email
WHERE NOT EXISTS (
  SELECT 1 FROM vehicle_fuel_records fr
  WHERE fr.vehicle_id  = v.vehicle_id
    AND fr.fuel_date   = m.fuel_date
    AND fr.odometer_km = m.odometer_km
);

-- ─────────────────────────────────────────────────────────────
-- 28. VEHICLE MAINTENANCE RECORDS
-- ─────────────────────────────────────────────────────────────
PRINT '28. vehicle_maintenance_records';
INSERT INTO vehicle_maintenance_records
  (vehicle_id, service_date, service_type, mechanic, workshop, cost, odometer_km, notes, next_service_date, created_by)
SELECT v.vehicle_id, m.service_date, m.service_type, m.mechanic, m.workshop,
       m.cost, m.odometer_km, m.notes, m.next_service_date, u.user_id
FROM (VALUES
  ('BEY-1001', '2026-04-01', 'Oil change & filter',     'Pierre Gemayel', 'ProAuto Hamra',   85.00, 244000, 'Synthetic 10W-40',   '2026-07-01', 'karim.saad@yallatransit.lb'),
  ('BEY-1002', '2026-04-05', 'Brake pads replacement',  'Hassan Mrad',    'Mrad Workshop',  220.00, 187500, 'Front brakes only',  '2026-10-05', 'karim.saad@yallatransit.lb'),
  ('BEY-1003', '2026-03-20', 'Tyre rotation & balance', 'Elie Khoury',    'TyrePlus Dora',   65.00, 310000, 'All four tyres',     '2026-09-20', 'karim.saad@yallatransit.lb'),
  ('BEY-2002', '2026-05-18', 'Full service inspection', 'Hassan Mrad',    'Mrad Workshop',  350.00, 152300, 'Engine fault found', '2026-06-01', 'karim.saad@yallatransit.lb')
) AS m(plate_number, service_date, service_type, mechanic, workshop, cost, odometer_km, notes, next_service_date, created_by_email)
JOIN vehicles v ON v.plate_number = m.plate_number
JOIN users    u ON u.email        = m.created_by_email
WHERE NOT EXISTS (
  SELECT 1 FROM vehicle_maintenance_records mr
  WHERE mr.vehicle_id   = v.vehicle_id
    AND mr.service_date = m.service_date
    AND mr.service_type = m.service_type
);

-- ─────────────────────────────────────────────────────────────
-- 29. VEHICLE DOCS (keyed on plate_number FK to vehicles)
-- ─────────────────────────────────────────────────────────────
PRINT '29. vehicle_docs';
MERGE vehicle_docs AS t
USING (VALUES
  ('BEY-1001', '2026-12-31', '2026-12-31', '2026-12-31'),
  ('BEY-1002', '2027-03-15', '2026-11-30', '2026-11-30'),
  ('BEY-1003', '2026-09-01', '2026-09-01', '2026-09-01'),
  ('BEY-2001', '2027-06-30', '2027-06-30', '2027-06-30'),
  ('BEY-2002', '2026-06-30', '2026-06-30', '2026-06-30')
) AS s(plate, registration_expiry, insurance_expiry, roadworthiness_expiry)
ON  t.plate = s.plate
WHEN NOT MATCHED THEN
  INSERT (plate, registration_expiry, insurance_expiry, roadworthiness_expiry, updated_at)
  VALUES (s.plate, s.registration_expiry, s.insurance_expiry, s.roadworthiness_expiry, GETDATE())
WHEN MATCHED THEN UPDATE SET
  t.registration_expiry   = s.registration_expiry,
  t.insurance_expiry      = s.insurance_expiry,
  t.roadworthiness_expiry = s.roadworthiness_expiry,
  t.updated_at            = GETDATE();

-- ─────────────────────────────────────────────────────────────
-- 30. FARE ZONES + FARE ZONE STOPS
-- ─────────────────────────────────────────────────────────────
PRINT '30. fare_zones';
INSERT INTO fare_zones (route_id, zone_name, zone_color, base_fare)
SELECT r.route_id, m.zone_name, m.zone_color, m.base_fare
FROM (VALUES
  ('Route 1 - Riad El Solh to Ras Beirut', 'Zone A - Central',  '#2563EB', 1.50),
  ('Route 2 - Dora to Downtown Beirut',    'Zone A - Central',  '#2563EB', 1.50),
  ('Route 3 - Jounieh to Dora',            'Zone B - Extended', '#16A34A', 2.00),
  ('Route 4 - Airport to Achrafieh',       'Zone C - Airport',  '#DC2626', 2.50)
) AS m(route_name, zone_name, zone_color, base_fare)
JOIN routes r ON r.route_name = m.route_name AND r.is_deleted = 0
WHERE NOT EXISTS (
  SELECT 1 FROM fare_zones fz
  WHERE fz.route_id  = r.route_id AND fz.zone_name = m.zone_name
);

PRINT '30b. fare_zone_stops';
INSERT INTO fare_zone_stops (zone_id, stop_id)
SELECT fz.zone_id, s.stop_id
FROM (VALUES
  ('Route 1 - Riad El Solh to Ras Beirut', 'Zone A - Central',  'Riad El Solh Square'),
  ('Route 1 - Riad El Solh to Ras Beirut', 'Zone A - Central',  'Hamra Main St'),
  ('Route 1 - Riad El Solh to Ras Beirut', 'Zone A - Central',  'Ras Beirut Terminal'),
  ('Route 2 - Dora to Downtown Beirut',    'Zone A - Central',  'Dora Terminal'),
  ('Route 2 - Dora to Downtown Beirut',    'Zone A - Central',  'Ashrafieh Center'),
  ('Route 2 - Dora to Downtown Beirut',    'Zone A - Central',  'Downtown Beirut'),
  ('Route 3 - Jounieh to Dora',            'Zone B - Extended', 'Jounieh Waterfront'),
  ('Route 3 - Jounieh to Dora',            'Zone B - Extended', 'Antelias Junction'),
  ('Route 3 - Jounieh to Dora',            'Zone B - Extended', 'Dora Terminal'),
  ('Route 4 - Airport to Achrafieh',       'Zone C - Airport',  'Beirut Airport Terminal'),
  ('Route 4 - Airport to Achrafieh',       'Zone C - Airport',  'Mar Elias'),
  ('Route 4 - Airport to Achrafieh',       'Zone C - Airport',  'Hamra Main St'),
  ('Route 4 - Airport to Achrafieh',       'Zone C - Airport',  'Ashrafieh Center')
) AS m(route_name, zone_name, stop_name)
JOIN routes     r  ON r.route_name  = m.route_name AND r.is_deleted = 0
JOIN fare_zones fz ON fz.route_id   = r.route_id   AND fz.zone_name = m.zone_name
JOIN stops      s  ON s.stop_name   = m.stop_name  AND s.is_deleted = 0
WHERE NOT EXISTS (
  SELECT 1 FROM fare_zone_stops fzs
  WHERE fzs.zone_id = fz.zone_id AND fzs.stop_id = s.stop_id
);

-- ─────────────────────────────────────────────────────────────
-- 31. SCHEDULED REPORTS
-- ─────────────────────────────────────────────────────────────
PRINT '31. scheduled_reports';
INSERT INTO scheduled_reports
  (report_name, report_type, frequency, day_of_week, hour_of_day, recipients, enabled, next_send_at, created_by)
SELECT m.report_name, m.report_type, m.frequency, m.day_of_week, m.hour_of_day,
       m.recipients, 1, DATEADD(day, 1, CAST(GETDATE() AS date)), u.user_id
FROM (VALUES
  ('Daily Operations Summary',    'operations', 'daily',   NULL, 8,
   'karim.saad@yallatransit.lb,nour.khalil@yallatransit.lb', 'lara.haddad@yallatransit.lb'),
  ('Weekly Financial Report',     'financial',  'weekly',  1,    9,
   'lara.haddad@yallatransit.lb', 'lara.haddad@yallatransit.lb'),
  ('Monthly Ridership Analytics', 'analytics',  'monthly', NULL, 10,
   'karim.saad@yallatransit.lb,lara.haddad@yallatransit.lb', 'lara.haddad@yallatransit.lb')
) AS m(report_name, report_type, frequency, day_of_week, hour_of_day, recipients, created_by_email)
JOIN users u ON u.email = m.created_by_email
WHERE NOT EXISTS (
  SELECT 1 FROM scheduled_reports sr WHERE sr.report_name = m.report_name
);

-- ─────────────────────────────────────────────────────────────
-- 32. COMPLAINTS + COMPLAINT UPDATES
-- ─────────────────────────────────────────────────────────────
PRINT '32. complaints';
INSERT INTO complaints
  (tracking_code, submitted_by_user_id, trip_id, title, description, category, priority, status, submitted_at, last_updated_at)
SELECT m.tracking_code, u.user_id, t.trip_id,
       m.title, m.description, m.category, m.priority, m.status,
       m.submitted_at, m.submitted_at
FROM (VALUES
  ('YT-2026-0001', 'sara.mousa@gmail.com',
   'Route 1 - Riad El Solh to Ras Beirut', 'BEY-1001', '2026-05-25 07:00:00',
   'AC not cooling sufficiently',
   'Air conditioning was barely working during the full trip.',
   'comfort', 'medium', 'submitted', '2026-05-25 10:00:00'),
  ('YT-2026-0002', 'rana.zein@gmail.com',
   'Route 2 - Dora to Downtown Beirut', 'BEY-1002', '2026-05-25 08:00:00',
   'Driver speeding near Ashrafieh',
   'Bus was travelling noticeably above speed limit at Sassine roundabout.',
   'safety', 'high', 'submitted', '2026-05-25 11:30:00')
) AS m(tracking_code, passenger_email, route_name, plate_number, trip_start,
        title, description, category, priority, status, submitted_at)
JOIN users    u ON u.email        = m.passenger_email
JOIN vehicles v ON v.plate_number = m.plate_number
JOIN routes   r ON r.route_name   = m.route_name AND r.is_deleted = 0
JOIN trips    t ON t.vehicle_id   = v.vehicle_id
               AND t.route_id     = r.route_id
               AND t.start_time   = m.trip_start
WHERE NOT EXISTS (
  SELECT 1 FROM complaints c WHERE c.tracking_code = m.tracking_code
);

-- ─────────────────────────────────────────────────────────────
-- 33. STAFF RECONCILIATION
-- discrepancy is a computed column — do NOT insert it
-- UNIQUE on (staff_id, reconciliation_date)
-- ─────────────────────────────────────────────────────────────
PRINT '33. staff_reconciliation';
INSERT INTO staff_reconciliation
  (staff_id, reconciliation_date, expected_amount, actual_amount, status, notes, created_at)
SELECT u.user_id, m.reconciliation_date, m.expected_amount, m.actual_amount, m.status, m.notes, GETDATE()
FROM (VALUES
  ('rami.saleh@yallatransit.lb',  '2026-05-25', 190.00, 190.00, 'approved', 'All receipts matched'),
  ('maya.frem@yallatransit.lb',   '2026-05-25', 135.00, 133.50, 'pending',  'Minor shortfall of $1.50 under investigation')
) AS m(staff_email, reconciliation_date, expected_amount, actual_amount, status, notes)
JOIN users u ON u.email = m.staff_email
WHERE NOT EXISTS (
  SELECT 1 FROM staff_reconciliation sr
  WHERE sr.staff_id              = u.user_id
    AND sr.reconciliation_date   = m.reconciliation_date
);

-- ─────────────────────────────────────────────────────────────
-- 34. TRIP STOP ARRIVALS (for the two completed trips)
-- UNIQUE on (trip_id, stop_id, stop_order)
-- ─────────────────────────────────────────────────────────────
PRINT '34. trip_stop_arrivals';
INSERT INTO trip_stop_arrivals
  (trip_id, stop_id, route_id, stop_order,
   scheduled_arrival_at, actual_arrival_at, delay_seconds, arrival_status)
SELECT t.trip_id, s.stop_id, r.route_id, m.stop_order,
       DATEADD(minute, m.sched_offset, t.start_time),
       DATEADD(minute, m.actual_offset, t.start_time),
       (m.actual_offset - m.sched_offset) * 60,
       m.arrival_status
FROM (VALUES
  ('Route 1 - Riad El Solh to Ras Beirut', 'BEY-1001', '2026-05-25 07:00:00', 'Riad El Solh Square',  1,  0,  0, 'on_time'),
  ('Route 1 - Riad El Solh to Ras Beirut', 'BEY-1001', '2026-05-25 07:00:00', 'Hamra Main St',        2, 45, 47, 'late'),
  ('Route 1 - Riad El Solh to Ras Beirut', 'BEY-1001', '2026-05-25 07:00:00', 'Ras Beirut Terminal',  3, 90, 90, 'on_time'),
  ('Route 2 - Dora to Downtown Beirut',    'BEY-1002', '2026-05-25 08:00:00', 'Dora Terminal',        1,  0,  0, 'on_time'),
  ('Route 2 - Dora to Downtown Beirut',    'BEY-1002', '2026-05-25 08:00:00', 'Ashrafieh Center',     2, 40, 48, 'late'),
  ('Route 2 - Dora to Downtown Beirut',    'BEY-1002', '2026-05-25 08:00:00', 'Downtown Beirut',      3, 80, 88, 'late')
) AS m(route_name, plate_number, trip_start, stop_name, stop_order, sched_offset, actual_offset, arrival_status)
JOIN vehicles v ON v.plate_number = m.plate_number
JOIN routes   r ON r.route_name   = m.route_name AND r.is_deleted = 0
JOIN trips    t ON t.vehicle_id   = v.vehicle_id
               AND t.route_id     = r.route_id
               AND t.start_time   = m.trip_start
JOIN stops    s ON s.stop_name    = m.stop_name AND s.is_deleted = 0
WHERE NOT EXISTS (
  SELECT 1 FROM trip_stop_arrivals tsa
  WHERE tsa.trip_id    = t.trip_id
    AND tsa.stop_id    = s.stop_id
    AND tsa.stop_order = m.stop_order
);

-- ─────────────────────────────────────────────────────────────
PRINT '=== Yalla Transit Seed Complete ===';
PRINT '';
PRINT 'Credentials summary:';
PRINT '  superadmin@yallatransit.lb / Admin@123  (super_admin)';
PRINT '  admin@yallatransit.lb      / Admin@123  (admin)';
PRINT '  karim.saad@yallatransit.lb / Admin@123  (transport_manager)';
PRINT '  lara.haddad@yallatransit.lb/ Admin@123  (finance_officer)';
PRINT '  nour.khalil@yallatransit.lb/ Admin@123  (ops_staff)';
PRINT '  samer.azar@yallatransit.lb / Admin@123  (auditor)';
PRINT '  dina.nassar@yallatransit.lb/ Admin@123  (it_admin)';
PRINT '  rami.saleh@yallatransit.lb / Staff@123  (staff)';
PRINT '  maya.frem@yallatransit.lb  / Staff@123  (staff)';
PRINT '  ahmad.khalil@yallatransit.lb/Driver@123 (driver)';
PRINT '  fadi.mansour@yallatransit.lb/Driver@123 (driver)';
PRINT '  omar.nassar@yallatransit.lb /Driver@123 (driver) — has ongoing trip';
PRINT '  walid.haddad@yallatransit.lb/Driver@123 (driver)';
PRINT '  hassan.rizk@yallatransit.lb /Driver@123 (driver)';
PRINT '  sara.mousa@gmail.com       / Pass@1234  (passenger, regular, $47.50)';
PRINT '  ali.hassan@gmail.com       / Pass@1234  (passenger, student, $18.75)';
PRINT '  hana.gergi@gmail.com       / Pass@1234  (passenger, senior, $62.00)';
PRINT '  jad.khoury@gmail.com       / Pass@1234  (passenger, employee, $25.00)';
PRINT '  nadia.bou@gmail.com        / Pass@1234  (passenger, school_child, $8.50)';
PRINT '  tony.abi@gmail.com         / Pass@1234  (passenger, regular, $35.00)';
PRINT '  sara.mousa@gmail.com       / Pass@1234  (passenger, regular, $47.50)';
