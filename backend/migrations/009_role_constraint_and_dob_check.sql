-- Migration 009: Enforce role enum and prevent future birth_date
-- Safe to re-run. Run via: node run_migration_009.mjs

-- ── 1. Drop old role check constraint if one exists ───────────────────────────
DECLARE @roleConstraint NVARCHAR(200) = '';
DECLARE @dropSql        NVARCHAR(500);

SELECT TOP 1 @roleConstraint = name
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('users')
  AND LOWER(definition) LIKE '%role%';

IF @roleConstraint <> ''
BEGIN
  SET @dropSql = N'ALTER TABLE users DROP CONSTRAINT [' + @roleConstraint + N']';
  EXEC sp_executesql @dropSql;
  PRINT 'Dropped old role constraint.';
END
GO

-- ── 2. Fix any invalid role values then add role CHECK constraint ─────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID('users')
    AND name = 'CK_users_role'
)
BEGIN
  UPDATE users
  SET role = 'passenger'
  WHERE role NOT IN ('passenger', 'driver', 'admin', 'staff');

  ALTER TABLE users
    ADD CONSTRAINT CK_users_role
    CHECK (role IN ('passenger', 'driver', 'admin', 'staff'));

  PRINT 'Added CK_users_role constraint.';
END
ELSE
  PRINT 'CK_users_role already exists — skipped.';
GO

-- ── 3. Fix future birth_date values then add CHECK constraint ─────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID('users')
    AND name = 'CK_users_birth_date_not_future'
)
BEGIN
  UPDATE users
  SET birth_date = NULL
  WHERE birth_date > CAST(GETUTCDATE() AS DATE);

  ALTER TABLE users
    ADD CONSTRAINT CK_users_birth_date_not_future
    CHECK (birth_date IS NULL OR birth_date <= CAST(GETUTCDATE() AS DATE));

  PRINT 'Added CK_users_birth_date_not_future constraint.';
END
ELSE
  PRINT 'CK_users_birth_date_not_future already exists — skipped.';
GO

PRINT 'Migration 009 complete.';
GO
