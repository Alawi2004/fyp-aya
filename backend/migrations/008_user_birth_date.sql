-- Migration 008: Add birth_date to users, drop category column
-- Run once on the target database.
-- Note: category column may have a default constraint and a check constraint
-- that must be dropped before the column can be removed.

-- Add birth_date if it doesn't exist
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'birth_date'
)
  ALTER TABLE users ADD birth_date DATE NULL;
GO

-- Drop category column constraints (names vary per environment — drop by querying sys)
DECLARE @sql NVARCHAR(MAX) = '';
SELECT @sql = @sql + 'ALTER TABLE users DROP CONSTRAINT ' + name + ';' + CHAR(13)
FROM sys.objects
WHERE parent_object_id = OBJECT_ID('users')
  AND type IN ('D', 'C')
  AND name LIKE '%category%';
IF @sql <> '' EXEC sp_executesql @sql;
GO

-- Drop category column if it still exists
IF EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'category'
)
  ALTER TABLE users DROP COLUMN category;
GO
