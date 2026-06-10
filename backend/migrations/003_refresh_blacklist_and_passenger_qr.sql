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
