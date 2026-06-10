IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='trip_delays' AND xtype='U')
CREATE TABLE trip_delays (
  delay_id      INT           PRIMARY KEY IDENTITY(1,1),
  trip_id       INT           NOT NULL,
  reason        NVARCHAR(100) NOT NULL,
  delay_minutes INT           NOT NULL,
  notes         NVARCHAR(500) NULL,
  reported_at   DATETIME      NOT NULL DEFAULT GETDATE(),
  CONSTRAINT FK_delay_trip FOREIGN KEY (trip_id) REFERENCES trips(trip_id)
);
