-- Run once against your Azure SQL database
CREATE TABLE refresh_tokens (
  id          INT            IDENTITY(1,1) PRIMARY KEY,
  user_id     INT            NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash  NVARCHAR(64)   NOT NULL,   -- SHA-256 hex of the raw token
  expires_at  DATETIME2      NOT NULL,
  created_at  DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
  CONSTRAINT UQ_refresh_token_hash UNIQUE (token_hash)
);

CREATE INDEX IX_refresh_tokens_user_id ON refresh_tokens(user_id);
