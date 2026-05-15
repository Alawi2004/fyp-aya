IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='trip_checklists' AND xtype='U')
CREATE TABLE trip_checklists (
  checklist_id  INT          PRIMARY KEY IDENTITY(1,1),
  trip_id       INT          NOT NULL,
  fuel_ok       BIT          NOT NULL DEFAULT 0,
  lights_ok     BIT          NOT NULL DEFAULT 0,
  tires_ok      BIT          NOT NULL DEFAULT 0,
  submitted_at  DATETIME     NOT NULL DEFAULT GETDATE(),
  CONSTRAINT FK_checklist_trip FOREIGN KEY (trip_id) REFERENCES trips(trip_id)
);
