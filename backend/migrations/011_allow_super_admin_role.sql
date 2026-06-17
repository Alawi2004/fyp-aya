-- Migration 011: Remove super_admin role — only admin is used
-- Converts any super_admin users to admin and tightens the role constraint.
-- Safe to re-run.

-- Drop any existing role constraint
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

-- Convert any super_admin users to admin
UPDATE users SET role = 'admin' WHERE role = 'super_admin';
PRINT 'Converted super_admin users to admin.';
GO

-- Add clean constraint without super_admin
IF NOT EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID('users')
    AND name = 'CK_users_role_v2'
)
BEGIN
  ALTER TABLE users
    ADD CONSTRAINT CK_users_role_v2
    CHECK (role IN ('passenger', 'driver', 'admin', 'staff'));

  PRINT 'Added CK_users_role_v2 constraint.';
END
ELSE
  PRINT 'CK_users_role_v2 already exists — skipped.';
GO

PRINT 'Migration 011 complete.';
GO
