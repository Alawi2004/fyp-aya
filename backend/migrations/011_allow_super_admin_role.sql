-- Migration 011: Extend role CHECK constraint to include super_admin
-- Safe to re-run.

-- Drop the existing constraint
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

-- Re-add constraint including super_admin
IF NOT EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID('users')
    AND name = 'CK_users_role_v2'
)
BEGIN
  ALTER TABLE users
    ADD CONSTRAINT CK_users_role_v2
    CHECK (role IN ('passenger', 'driver', 'admin', 'super_admin', 'staff'));

  PRINT 'Added CK_users_role_v2 constraint (includes super_admin).';
END
ELSE
  PRINT 'CK_users_role_v2 already exists — skipped.';
GO

-- Restore any super_admin users whose role was reset to passenger by migration 009
UPDATE users
SET role = 'super_admin'
WHERE email IN (
  SELECT email FROM users WHERE full_name LIKE '%Super Admin%' AND role = 'passenger'
);

PRINT 'Migration 011 complete.';
GO
