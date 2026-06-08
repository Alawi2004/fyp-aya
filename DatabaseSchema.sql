/****** Object:  Table [dbo].[audit_logs]    Script Date: 5/26/2026 10:14:22 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[audit_logs](
	[audit_log_id] [bigint] IDENTITY(1,1) NOT NULL,
	[actor_user_id] [int] NULL,
	[actor_role] [nvarchar](50) NULL,
	[action_name] [nvarchar](100) NOT NULL,
	[entity_type] [nvarchar](100) NOT NULL,
	[entity_id] [nvarchar](100) NULL,
	[old_values_json] [nvarchar](max) NULL,
	[new_values_json] [nvarchar](max) NULL,
	[ip_address] [nvarchar](64) NULL,
	[user_agent] [nvarchar](500) NULL,
	[request_id] [nvarchar](100) NULL,
	[created_at] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[audit_log_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[camera_driver_alerts]    Script Date: 5/26/2026 10:14:22 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[camera_driver_alerts](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[bus_id] [varchar](20) NOT NULL,
	[alert_type] [varchar](30) NOT NULL,
	[confidence] [int] NOT NULL,
	[recorded_at] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[camera_health_log]    Script Date: 5/26/2026 10:14:23 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[camera_health_log](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[bus_id] [varchar](20) NOT NULL,
	[cam_type] [varchar](20) NOT NULL,
	[status] [varchar](10) NOT NULL,
	[recorded_at] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[camera_passenger_events]    Script Date: 5/26/2026 10:14:23 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[camera_passenger_events](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[bus_id] [varchar](20) NOT NULL,
	[event_type] [varchar](10) NOT NULL,
	[track_id] [int] NULL,
	[passenger_count] [int] NOT NULL,
	[available_seats] [int] NULL,
	[recorded_at] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[complaint_updates]    Script Date: 5/26/2026 10:14:23 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[complaint_updates](
	[update_id] [int] IDENTITY(1,1) NOT NULL,
	[complaint_id] [int] NOT NULL,
	[actor_user_id] [int] NULL,
	[action_type] [nvarchar](30) NOT NULL,
	[old_status] [nvarchar](20) NULL,
	[new_status] [nvarchar](20) NULL,
	[comment] [nvarchar](1000) NULL,
	[created_at] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[update_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[complaints]    Script Date: 5/26/2026 10:14:23 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[complaints](
	[complaint_id] [int] IDENTITY(1,1) NOT NULL,
	[tracking_code] [nvarchar](30) NOT NULL,
	[submitted_by_user_id] [int] NOT NULL,
	[assigned_to_user_id] [int] NULL,
	[trip_id] [int] NULL,
	[driver_id] [int] NULL,
	[route_id] [int] NULL,
	[title] [nvarchar](200) NOT NULL,
	[description] [nvarchar](max) NOT NULL,
	[category] [nvarchar](50) NOT NULL,
	[priority] [nvarchar](20) NOT NULL,
	[status] [nvarchar](20) NOT NULL,
	[submitted_at] [datetime2](7) NOT NULL,
	[assigned_at] [datetime2](7) NULL,
	[resolved_at] [datetime2](7) NULL,
	[resolution_notes] [nvarchar](1000) NULL,
	[last_updated_at] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[complaint_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[tracking_code] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[drivers]    Script Date: 5/26/2026 10:14:24 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[drivers](
	[driver_id] [int] IDENTITY(1,1) NOT NULL,
	[user_id] [int] NOT NULL,
	[license_number] [varchar](50) NOT NULL,
	[hire_date] [date] NULL,
	[license_expiry_date] [date] NULL,
	[is_deleted] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[driver_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[user_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[eta_predictions]    Script Date: 5/26/2026 10:14:24 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[eta_predictions](
	[eta_id] [int] IDENTITY(1,1) NOT NULL,
	[trip_id] [int] NOT NULL,
	[predicted_arrival] [datetime] NULL,
	[confidence] [decimal](5, 2) NULL,
PRIMARY KEY CLUSTERED 
(
	[eta_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[fare_zone_stops]    Script Date: 5/26/2026 10:14:24 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[fare_zone_stops](
	[id] [int] IDENTITY(1,1) NOT NULL,
	[zone_id] [int] NOT NULL,
	[stop_id] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_fare_zone_stops] UNIQUE NONCLUSTERED 
(
	[zone_id] ASC,
	[stop_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[fare_zones]    Script Date: 5/26/2026 10:14:24 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[fare_zones](
	[zone_id] [int] IDENTITY(1,1) NOT NULL,
	[route_id] [int] NOT NULL,
	[zone_name] [nvarchar](60) NOT NULL,
	[zone_color] [nvarchar](7) NOT NULL,
	[base_fare] [decimal](6, 2) NOT NULL,
	[created_at] [datetime2](7) NOT NULL,
	[updated_at] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[zone_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[geofence_events]    Script Date: 5/26/2026 10:14:25 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[geofence_events](
	[event_id] [int] IDENTITY(1,1) NOT NULL,
	[trip_id] [int] NOT NULL,
	[route_id] [int] NULL,
	[latitude] [decimal](9, 6) NOT NULL,
	[longitude] [decimal](9, 6) NOT NULL,
	[distance_m] [int] NOT NULL,
	[status] [nvarchar](20) NOT NULL,
	[detected_at] [datetime2](7) NOT NULL,
	[resolved_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[event_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[gps_logs]    Script Date: 5/26/2026 10:14:25 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[gps_logs](
	[gps_id] [int] IDENTITY(1,1) NOT NULL,
	[trip_id] [int] NOT NULL,
	[latitude] [decimal](9, 6) NULL,
	[longitude] [decimal](9, 6) NULL,
	[recorded_at] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[gps_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[login_audit_logs]    Script Date: 5/26/2026 10:14:25 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[login_audit_logs](
	[log_id] [bigint] IDENTITY(1,1) NOT NULL,
	[user_id] [int] NULL,
	[email_attempted] [nvarchar](120) NOT NULL,
	[ip_address] [nvarchar](64) NOT NULL,
	[user_agent] [nvarchar](500) NULL,
	[device_fingerprint] [nvarchar](64) NULL,
	[success] [bit] NOT NULL,
	[failure_reason] [nvarchar](100) NULL,
	[logged_at] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[log_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[login_lockouts]    Script Date: 5/26/2026 10:14:25 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[login_lockouts](
	[email] [nvarchar](120) NOT NULL,
	[failed_attempts] [int] NOT NULL,
	[locked_until] [datetime2](7) NULL,
	[lockout_count] [int] NOT NULL,
	[last_attempt_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[email] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[nfc_cards]    Script Date: 5/26/2026 10:14:25 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[nfc_cards](
	[nfc_id] [int] IDENTITY(1,1) NOT NULL,
	[user_id] [int] NOT NULL,
	[card_uid] [nvarchar](64) NOT NULL,
	[status] [nvarchar](20) NOT NULL,
	[linked_at] [datetime2](7) NOT NULL,
	[unlinked_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[nfc_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[notifications]    Script Date: 5/26/2026 10:14:26 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[notifications](
	[notification_id] [int] IDENTITY(1,1) NOT NULL,
	[user_id] [int] NOT NULL,
	[message] [text] NOT NULL,
	[is_read] [bit] NULL,
	[created_at] [datetime] NULL,
	[title] [nvarchar](200) NULL,
	[body] [nvarchar](2000) NULL,
	[type] [nvarchar](20) NULL,
	[target_group] [nvarchar](50) NULL,
	[sent_count] [int] NOT NULL,
	[read_count] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[notification_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[passenger_counts]    Script Date: 5/26/2026 10:14:26 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[passenger_counts](
	[count_id] [int] IDENTITY(1,1) NOT NULL,
	[trip_id] [int] NOT NULL,
	[passenger_count] [int] NOT NULL,
	[recorded_at] [datetime] NULL,
	[method] [varchar](20) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[count_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[passenger_qr_tokens]    Script Date: 5/26/2026 10:14:26 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[passenger_qr_tokens](
	[qr_token_id] [int] IDENTITY(1,1) NOT NULL,
	[user_id] [int] NOT NULL,
	[jti] [nvarchar](64) NOT NULL,
	[token_hash] [nvarchar](64) NOT NULL,
	[expires_at] [datetime2](7) NOT NULL,
	[created_at] [datetime2](7) NOT NULL,
	[used_at] [datetime2](7) NULL,
	[revoked_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[qr_token_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[token_hash] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[jti] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[password_reset_tokens]    Script Date: 5/26/2026 10:14:26 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[password_reset_tokens](
	[token_id] [int] IDENTITY(1,1) NOT NULL,
	[user_id] [int] NOT NULL,
	[token_hash] [nvarchar](64) NOT NULL,
	[expires_at] [datetime2](7) NOT NULL,
	[used_at] [datetime2](7) NULL,
	[created_at] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[token_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[token_hash] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[permissions]    Script Date: 5/26/2026 10:14:27 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[permissions](
	[permission_id] [int] IDENTITY(1,1) NOT NULL,
	[permission_key] [nvarchar](100) NOT NULL,
	[module_name] [nvarchar](50) NOT NULL,
	[action_name] [nvarchar](20) NOT NULL,
	[description] [nvarchar](255) NULL,
	[created_at] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[permission_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[permission_key] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_permissions_module_action] UNIQUE NONCLUSTERED 
(
	[module_name] ASC,
	[action_name] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[ratings]    Script Date: 5/26/2026 10:14:27 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[ratings](
	[rating_id] [int] IDENTITY(1,1) NOT NULL,
	[user_id] [int] NOT NULL,
	[trip_id] [int] NOT NULL,
	[rating] [int] NULL,
	[comment] [text] NULL,
PRIMARY KEY CLUSTERED 
(
	[rating_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[recurring_trip_schedules]    Script Date: 5/26/2026 10:14:27 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[recurring_trip_schedules](
	[schedule_id] [int] IDENTITY(1,1) NOT NULL,
	[route_name] [nvarchar](100) NOT NULL,
	[driver_name] [nvarchar](100) NULL,
	[vehicle_plate] [nvarchar](50) NULL,
	[departure_time] [time](7) NOT NULL,
	[recurrence] [nvarchar](20) NOT NULL,
	[custom_days] [nvarchar](200) NULL,
	[status] [nvarchar](20) NOT NULL,
	[active_from] [date] NOT NULL,
	[next_run] [date] NULL,
	[created_at] [datetime] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[schedule_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[refresh_token_blacklist]    Script Date: 5/26/2026 10:14:27 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[refresh_token_blacklist](
	[blacklist_id] [int] IDENTITY(1,1) NOT NULL,
	[user_id] [int] NULL,
	[token_hash] [nvarchar](64) NOT NULL,
	[reason] [nvarchar](30) NOT NULL,
	[blacklisted_at] [datetime2](7) NOT NULL,
	[expires_at] [datetime2](7) NULL,
PRIMARY KEY CLUSTERED 
(
	[blacklist_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[token_hash] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[refresh_tokens]    Script Date: 5/26/2026 10:14:27 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[refresh_tokens](
	[token_id] [int] IDENTITY(1,1) NOT NULL,
	[user_id] [int] NOT NULL,
	[token_hash] [nvarchar](64) NOT NULL,
	[expires_at] [datetime2](7) NOT NULL,
	[created_at] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[token_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[token_hash] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[role_permissions]    Script Date: 5/26/2026 10:14:28 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[role_permissions](
	[role_id] [int] NOT NULL,
	[permission_id] [int] NOT NULL,
	[granted_at] [datetime2](7) NOT NULL,
	[granted_by] [int] NULL,
 CONSTRAINT [PK_role_permissions] PRIMARY KEY CLUSTERED 
(
	[role_id] ASC,
	[permission_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[roles]    Script Date: 5/26/2026 10:14:28 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[roles](
	[role_id] [int] IDENTITY(1,1) NOT NULL,
	[role_key] [nvarchar](50) NOT NULL,
	[display_name] [nvarchar](100) NOT NULL,
	[description] [nvarchar](500) NULL,
	[is_system] [bit] NOT NULL,
	[is_active] [bit] NOT NULL,
	[created_at] [datetime2](7) NOT NULL,
	[updated_at] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[role_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[role_key] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[route_stops]    Script Date: 5/26/2026 10:14:28 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[route_stops](
	[route_id] [int] NOT NULL,
	[stop_id] [int] NOT NULL,
	[stop_order] [int] NULL,
 CONSTRAINT [pk_route_stops] PRIMARY KEY CLUSTERED 
(
	[route_id] ASC,
	[stop_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[route_waypoints]    Script Date: 5/26/2026 10:14:28 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[route_waypoints](
	[waypoint_id] [int] IDENTITY(1,1) NOT NULL,
	[route_id] [int] NOT NULL,
	[latitude] [decimal](9, 6) NOT NULL,
	[longitude] [decimal](9, 6) NOT NULL,
	[wp_order] [int] NOT NULL,
	[created_at] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[waypoint_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[routes]    Script Date: 5/26/2026 10:14:29 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[routes](
	[route_id] [int] IDENTITY(1,1) NOT NULL,
	[route_name] [varchar](100) NOT NULL,
	[start_location] [varchar](100) NULL,
	[end_location] [varchar](100) NULL,
	[is_deleted] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[route_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[scheduled_reports]    Script Date: 5/26/2026 10:14:29 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[scheduled_reports](
	[schedule_id] [int] IDENTITY(1,1) NOT NULL,
	[report_name] [nvarchar](100) NOT NULL,
	[report_type] [nvarchar](50) NOT NULL,
	[frequency] [nvarchar](20) NOT NULL,
	[day_of_week] [int] NULL,
	[hour_of_day] [int] NOT NULL,
	[recipients] [nvarchar](max) NOT NULL,
	[enabled] [bit] NOT NULL,
	[last_sent_at] [datetime2](7) NULL,
	[next_send_at] [datetime2](7) NULL,
	[created_by] [int] NULL,
	[created_at] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[schedule_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[staff_reconciliation]    Script Date: 5/26/2026 10:14:29 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[staff_reconciliation](
	[reconciliation_id] [int] IDENTITY(1,1) NOT NULL,
	[staff_id] [int] NOT NULL,
	[reconciliation_date] [date] NOT NULL,
	[expected_amount] [decimal](10, 2) NOT NULL,
	[actual_amount] [decimal](10, 2) NULL,
	[discrepancy]  AS ([actual_amount]-[expected_amount]),
	[status] [nvarchar](50) NOT NULL,
	[notes] [nvarchar](500) NULL,
	[reviewed_by] [int] NULL,
	[reviewed_at] [datetime] NULL,
	[created_at] [datetime] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[reconciliation_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[staff_id] ASC,
	[reconciliation_date] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[staff_shift_sessions]    Script Date: 5/26/2026 10:14:29 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[staff_shift_sessions](
	[shift_id] [int] IDENTITY(1,1) NOT NULL,
	[staff_user_id] [int] NOT NULL,
	[opening_cash] [decimal](10, 2) NOT NULL,
	[expected_cash] [decimal](10, 2) NULL,
	[closing_cash] [decimal](10, 2) NULL,
	[cash_difference] [decimal](10, 2) NULL,
	[opened_at] [datetime2](7) NOT NULL,
	[closed_at] [datetime2](7) NULL,
	[opening_notes] [nvarchar](500) NULL,
	[closing_notes] [nvarchar](500) NULL,
	[summary_json] [nvarchar](max) NULL,
	[reported_cash] [decimal](10, 2) NULL,
PRIMARY KEY CLUSTERED 
(
	[shift_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[staff_top_ups]    Script Date: 5/26/2026 10:14:29 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[staff_top_ups](
	[top_up_id] [int] IDENTITY(1,1) NOT NULL,
	[user_id] [int] NOT NULL,
	[wallet_id] [int] NULL,
	[amount] [decimal](10, 2) NOT NULL,
	[transaction_type] [nvarchar](50) NOT NULL,
	[balance_before] [decimal](10, 2) NOT NULL,
	[balance_after] [decimal](10, 2) NOT NULL,
	[processed_by_staff_id] [int] NOT NULL,
	[recharge_location] [nvarchar](255) NOT NULL,
	[payment_method] [nvarchar](100) NOT NULL,
	[transaction_reference] [nvarchar](100) NOT NULL,
	[notes] [nvarchar](500) NULL,
	[status] [nvarchar](50) NOT NULL,
	[created_at] [datetime] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[top_up_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[transaction_reference] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[stop_amenities]    Script Date: 5/26/2026 10:14:30 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[stop_amenities](
	[stop_id] [int] NOT NULL,
	[has_shelter] [bit] NOT NULL,
	[has_seating] [bit] NOT NULL,
	[has_lighting] [bit] NOT NULL,
	[has_wheelchair] [bit] NOT NULL,
	[has_ticket_machine] [bit] NOT NULL,
	[has_wifi] [bit] NOT NULL,
	[nearby_landmark] [nvarchar](200) NULL,
	[nfc_tag_id] [nvarchar](100) NULL,
	[updated_at] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[stop_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[stops]    Script Date: 5/26/2026 10:14:30 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[stops](
	[stop_id] [int] IDENTITY(1,1) NOT NULL,
	[stop_name] [varchar](100) NOT NULL,
	[latitude] [decimal](9, 6) NULL,
	[longitude] [decimal](9, 6) NULL,
	[is_deleted] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[stop_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[system_settings]    Script Date: 5/26/2026 10:14:30 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[system_settings](
	[setting_key] [nvarchar](100) NOT NULL,
	[setting_value] [nvarchar](max) NOT NULL,
	[category] [nvarchar](50) NOT NULL,
	[label] [nvarchar](200) NULL,
	[description] [nvarchar](500) NULL,
	[value_type] [nvarchar](20) NOT NULL,
	[updated_at] [datetime2](7) NOT NULL,
	[updated_by] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[setting_key] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[tickets]    Script Date: 5/26/2026 10:14:30 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[tickets](
	[ticket_id] [int] IDENTITY(1,1) NOT NULL,
	[user_id] [int] NOT NULL,
	[trip_id] [int] NOT NULL,
	[seat_number] [varchar](10) NULL,
	[booking_time] [datetime] NULL,
	[status] [nvarchar](20) NOT NULL,
	[amount] [decimal](10, 2) NOT NULL,
	[share_count] [int] NOT NULL,
	[last_shared_at] [datetime2](7) NULL,
	[qr_code] [nvarchar](max) NULL,
	[created_at] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[ticket_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

/****** Object:  Table [dbo].[top_up_locations]    Script Date: 5/26/2026 10:14:31 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[top_up_locations](
	[location_id] [int] IDENTITY(1,1) NOT NULL,
	[name] [nvarchar](200) NOT NULL,
	[address] [nvarchar](300) NULL,
	[city] [nvarchar](100) NULL,
	[phone] [nvarchar](50) NULL,
	[hours] [nvarchar](200) NULL,
	[is_active] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[location_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[trip_checklists]    Script Date: 5/26/2026 10:14:31 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[trip_checklists](
	[checklist_id] [int] IDENTITY(1,1) NOT NULL,
	[trip_id] [int] NOT NULL,
	[fuel_ok] [bit] NOT NULL,
	[lights_ok] [bit] NOT NULL,
	[tires_ok] [bit] NOT NULL,
	[submitted_at] [datetime] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[checklist_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[trip_delays]    Script Date: 5/26/2026 10:14:31 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[trip_delays](
	[delay_id] [int] IDENTITY(1,1) NOT NULL,
	[trip_id] [int] NOT NULL,
	[reason] [nvarchar](100) NOT NULL,
	[delay_minutes] [int] NOT NULL,
	[notes] [nvarchar](500) NULL,
	[reported_at] [datetime] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[delay_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[trip_stop_arrivals]    Script Date: 5/26/2026 10:14:31 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[trip_stop_arrivals](
	[trip_stop_arrival_id] [int] IDENTITY(1,1) NOT NULL,
	[trip_id] [int] NOT NULL,
	[stop_id] [int] NOT NULL,
	[route_id] [int] NULL,
	[stop_order] [int] NULL,
	[scheduled_arrival_at] [datetime2](7) NULL,
	[actual_arrival_at] [datetime2](7) NULL,
	[delay_seconds] [int] NULL,
	[arrival_status] [nvarchar](20) NOT NULL,
	[notes] [nvarchar](500) NULL,
	[created_at] [datetime2](7) NOT NULL,
	[updated_at] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[trip_stop_arrival_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_trip_stop_arrivals_trip_stop] UNIQUE NONCLUSTERED 
(
	[trip_id] ASC,
	[stop_id] ASC,
	[stop_order] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[trips]    Script Date: 5/26/2026 10:14:31 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[trips](
	[trip_id] [int] IDENTITY(1,1) NOT NULL,
	[vehicle_id] [int] NOT NULL,
	[driver_id] [int] NOT NULL,
	[route_id] [int] NOT NULL,
	[start_time] [datetime] NULL,
	[end_time] [datetime] NULL,
	[status] [varchar](20) NULL,
PRIMARY KEY CLUSTERED 
(
	[trip_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[user_favorite_routes]    Script Date: 5/26/2026 10:14:32 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[user_favorite_routes](
	[favorite_id] [int] IDENTITY(1,1) NOT NULL,
	[user_id] [int] NOT NULL,
	[route_id] [int] NOT NULL,
	[nickname] [nvarchar](100) NULL,
	[created_at] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[favorite_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_user_favorite_route] UNIQUE NONCLUSTERED 
(
	[user_id] ASC,
	[route_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[user_sessions]    Script Date: 5/26/2026 10:14:32 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[user_sessions](
	[session_id] [int] IDENTITY(1,1) NOT NULL,
	[user_id] [int] NOT NULL,
	[token_hash] [nvarchar](64) NOT NULL,
	[device_fingerprint] [nvarchar](64) NULL,
	[device_name] [nvarchar](200) NULL,
	[ip_address] [nvarchar](64) NULL,
	[user_agent] [nvarchar](500) NULL,
	[expires_at] [datetime2](7) NOT NULL,
	[last_active_at] [datetime2](7) NULL,
	[created_at] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[session_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[token_hash] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[user_suspension_logs]    Script Date: 5/26/2026 10:14:32 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[user_suspension_logs](
	[log_id] [int] IDENTITY(1,1) NOT NULL,
	[user_id] [int] NOT NULL,
	[action] [nvarchar](20) NOT NULL,
	[reason] [nvarchar](100) NOT NULL,
	[notes] [nvarchar](500) NULL,
	[duration_days] [int] NULL,
	[suspended_until] [datetime2](7) NULL,
	[acted_by] [int] NOT NULL,
	[acted_at] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[log_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[user_totp]    Script Date: 5/26/2026 10:14:32 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[user_totp](
	[totp_id] [int] IDENTITY(1,1) NOT NULL,
	[user_id] [int] NOT NULL,
	[secret] [nvarchar](100) NOT NULL,
	[enabled] [bit] NOT NULL,
	[verified_at] [datetime2](7) NULL,
	[created_at] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[totp_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[user_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[users]    Script Date: 5/26/2026 10:14:33 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[users](
	[user_id] [int] IDENTITY(1,1) NOT NULL,
	[full_name] [varchar](100) NOT NULL,
	[email] [varchar](120) NOT NULL,
	[password_hash] [varchar](255) NOT NULL,
	[phone] [varchar](20) NULL,
	[role] [varchar](20) NULL,
	[created_at] [datetime] NULL,
	[category] [varchar](20) NOT NULL,
	[status] [nvarchar](20) NOT NULL,
	[push_token] [nvarchar](200) NULL,
	[deleted_at] [datetime2](7) NULL,
	[fcm_token] [nvarchar](300) NULL,
PRIMARY KEY CLUSTERED 
(
	[user_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[email] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[vehicle_docs]    Script Date: 5/26/2026 10:14:33 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[vehicle_docs](
	[plate] [nvarchar](50) NOT NULL,
	[registration_expiry] [date] NULL,
	[insurance_expiry] [date] NULL,
	[roadworthiness_expiry] [date] NULL,
	[updated_at] [datetime] NULL,
	[updated_by_admin_id] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[plate] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[vehicle_fuel_records]    Script Date: 5/26/2026 10:14:33 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[vehicle_fuel_records](
	[fuel_id] [int] IDENTITY(1,1) NOT NULL,
	[vehicle_id] [int] NOT NULL,
	[fuel_date] [date] NOT NULL,
	[liters] [decimal](8, 2) NOT NULL,
	[cost] [decimal](10, 2) NULL,
	[odometer_km] [int] NOT NULL,
	[station] [nvarchar](200) NULL,
	[notes] [nvarchar](500) NULL,
	[created_at] [datetime] NOT NULL,
	[cost_per_liter] [decimal](6, 3) NULL,
	[recorded_by] [int] NULL,
	[km_per_liter]  AS (CONVERT([decimal](10,2),[odometer_km])/nullif([liters],(0))) PERSISTED,
PRIMARY KEY CLUSTERED 
(
	[fuel_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[vehicle_maintenance_records]    Script Date: 5/26/2026 10:14:33 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[vehicle_maintenance_records](
	[record_id] [int] IDENTITY(1,1) NOT NULL,
	[vehicle_id] [int] NOT NULL,
	[service_date] [date] NOT NULL,
	[service_type] [nvarchar](100) NOT NULL,
	[mechanic] [nvarchar](200) NOT NULL,
	[workshop] [nvarchar](200) NULL,
	[cost] [decimal](10, 2) NULL,
	[odometer_km] [int] NULL,
	[notes] [nvarchar](500) NULL,
	[next_service_date] [date] NULL,
	[created_at] [datetime] NOT NULL,
	[created_by] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[record_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[vehicles]    Script Date: 5/26/2026 10:14:33 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[vehicles](
	[vehicle_id] [int] IDENTITY(1,1) NOT NULL,
	[plate_number] [nvarchar](50) NOT NULL,
	[vehicle_type] [varchar](20) NOT NULL,
	[capacity] [int] NOT NULL,
	[model] [varchar](50) NULL,
	[status] [varchar](20) NULL,
	[created_at] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[vehicle_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_vehicles_plate_number] UNIQUE NONCLUSTERED 
(
	[plate_number] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[wallet_adjustments]    Script Date: 5/26/2026 10:14:34 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[wallet_adjustments](
	[adjustment_id] [int] IDENTITY(1,1) NOT NULL,
	[user_id] [int] NOT NULL,
	[admin_id] [int] NOT NULL,
	[type] [nvarchar](10) NOT NULL,
	[amount] [decimal](10, 2) NOT NULL,
	[reason] [nvarchar](200) NOT NULL,
	[notes] [nvarchar](500) NULL,
	[balance_before] [decimal](10, 2) NOT NULL,
	[balance_after] [decimal](10, 2) NOT NULL,
	[created_at] [datetime] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[adjustment_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[wallet_freeze_log]    Script Date: 5/26/2026 10:14:34 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[wallet_freeze_log](
	[log_id] [int] IDENTITY(1,1) NOT NULL,
	[user_id] [int] NOT NULL,
	[action] [nvarchar](20) NOT NULL,
	[reason] [nvarchar](200) NULL,
	[notes] [nvarchar](500) NULL,
	[admin_id] [int] NULL,
	[created_at] [datetime] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[log_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[wallet_recharges]    Script Date: 5/26/2026 10:14:34 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[wallet_recharges](
	[recharge_id] [int] IDENTITY(1,1) NOT NULL,
	[user_id] [int] NOT NULL,
	[staff_id] [int] NOT NULL,
	[amount] [decimal](10, 2) NOT NULL,
	[location_name] [nvarchar](255) NOT NULL,
	[tx_ref] [nvarchar](100) NOT NULL,
	[notes] [nvarchar](500) NULL,
	[created_at] [datetime] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[recharge_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[tx_ref] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[wallet_transactions]    Script Date: 5/26/2026 10:14:34 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[wallet_transactions](
	[transaction_id] [int] IDENTITY(1,1) NOT NULL,
	[user_id] [int] NOT NULL,
	[recharge_id] [int] NULL,
	[type] [nvarchar](20) NOT NULL,
	[amount] [decimal](10, 2) NOT NULL,
	[description] [nvarchar](500) NULL,
	[created_at] [datetime] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[transaction_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[wallets]    Script Date: 5/26/2026 10:14:35 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[wallets](
	[wallet_id] [int] IDENTITY(1,1) NOT NULL,
	[user_id] [int] NOT NULL,
	[balance] [decimal](10, 2) NOT NULL,
	[is_frozen] [bit] NOT NULL,
	[freeze_reason] [nvarchar](200) NULL,
	[freeze_notes] [nvarchar](500) NULL,
	[frozen_at] [datetime] NULL,
	[frozen_by_admin_id] [int] NULL,
	[updated_at] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[wallet_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[user_id] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[audit_logs] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[camera_driver_alerts] ADD  DEFAULT ((0)) FOR [confidence]
GO

ALTER TABLE [dbo].[camera_driver_alerts] ADD  DEFAULT (getutcdate()) FOR [recorded_at]
GO

ALTER TABLE [dbo].[camera_health_log] ADD  DEFAULT (getutcdate()) FOR [recorded_at]
GO

ALTER TABLE [dbo].[camera_passenger_events] ADD  DEFAULT (getutcdate()) FOR [recorded_at]
GO

ALTER TABLE [dbo].[complaint_updates] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[complaints] ADD  DEFAULT ('medium') FOR [priority]
GO

ALTER TABLE [dbo].[complaints] ADD  DEFAULT ('submitted') FOR [status]
GO

ALTER TABLE [dbo].[complaints] ADD  DEFAULT (getutcdate()) FOR [submitted_at]
GO

ALTER TABLE [dbo].[complaints] ADD  DEFAULT (getutcdate()) FOR [last_updated_at]
GO

ALTER TABLE [dbo].[drivers] ADD  DEFAULT ((0)) FOR [is_deleted]
GO

ALTER TABLE [dbo].[fare_zones] ADD  DEFAULT ('#2563EB') FOR [zone_color]
GO

ALTER TABLE [dbo].[fare_zones] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[fare_zones] ADD  DEFAULT (getutcdate()) FOR [updated_at]
GO

ALTER TABLE [dbo].[geofence_events] ADD  DEFAULT ('active') FOR [status]
GO

ALTER TABLE [dbo].[geofence_events] ADD  DEFAULT (getutcdate()) FOR [detected_at]
GO

ALTER TABLE [dbo].[gps_logs] ADD  DEFAULT (getdate()) FOR [recorded_at]
GO

ALTER TABLE [dbo].[login_audit_logs] ADD  DEFAULT (getutcdate()) FOR [logged_at]
GO

ALTER TABLE [dbo].[login_lockouts] ADD  DEFAULT ((0)) FOR [failed_attempts]
GO

ALTER TABLE [dbo].[login_lockouts] ADD  DEFAULT ((0)) FOR [lockout_count]
GO

ALTER TABLE [dbo].[nfc_cards] ADD  DEFAULT ('active') FOR [status]
GO

ALTER TABLE [dbo].[nfc_cards] ADD  DEFAULT (getutcdate()) FOR [linked_at]
GO

ALTER TABLE [dbo].[notifications] ADD  DEFAULT ((0)) FOR [is_read]
GO

ALTER TABLE [dbo].[notifications] ADD  DEFAULT (getdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[notifications] ADD  DEFAULT ('info') FOR [type]
GO

ALTER TABLE [dbo].[notifications] ADD  DEFAULT ('all_users') FOR [target_group]
GO

ALTER TABLE [dbo].[notifications] ADD  DEFAULT ((0)) FOR [sent_count]
GO

ALTER TABLE [dbo].[notifications] ADD  DEFAULT ((0)) FOR [read_count]
GO

ALTER TABLE [dbo].[passenger_counts] ADD  DEFAULT (getdate()) FOR [recorded_at]
GO

ALTER TABLE [dbo].[passenger_counts] ADD  DEFAULT ('camera') FOR [method]
GO

ALTER TABLE [dbo].[passenger_qr_tokens] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[password_reset_tokens] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[permissions] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[recurring_trip_schedules] ADD  DEFAULT ('daily') FOR [recurrence]
GO

ALTER TABLE [dbo].[recurring_trip_schedules] ADD  DEFAULT ('Active') FOR [status]
GO

ALTER TABLE [dbo].[recurring_trip_schedules] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[refresh_token_blacklist] ADD  DEFAULT (getutcdate()) FOR [blacklisted_at]
GO

ALTER TABLE [dbo].[refresh_tokens] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[role_permissions] ADD  DEFAULT (getutcdate()) FOR [granted_at]
GO

ALTER TABLE [dbo].[roles] ADD  DEFAULT ((1)) FOR [is_system]
GO

ALTER TABLE [dbo].[roles] ADD  DEFAULT ((1)) FOR [is_active]
GO

ALTER TABLE [dbo].[roles] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[roles] ADD  DEFAULT (getutcdate()) FOR [updated_at]
GO

ALTER TABLE [dbo].[route_waypoints] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[routes] ADD  DEFAULT ((0)) FOR [is_deleted]
GO

ALTER TABLE [dbo].[scheduled_reports] ADD  DEFAULT ((8)) FOR [hour_of_day]
GO

ALTER TABLE [dbo].[scheduled_reports] ADD  DEFAULT ((1)) FOR [enabled]
GO

ALTER TABLE [dbo].[scheduled_reports] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[staff_reconciliation] ADD  DEFAULT ((0)) FOR [expected_amount]
GO

ALTER TABLE [dbo].[staff_reconciliation] ADD  DEFAULT ('pending') FOR [status]
GO

ALTER TABLE [dbo].[staff_reconciliation] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[staff_shift_sessions] ADD  DEFAULT ((0)) FOR [opening_cash]
GO

ALTER TABLE [dbo].[staff_shift_sessions] ADD  DEFAULT (getutcdate()) FOR [opened_at]
GO

ALTER TABLE [dbo].[staff_top_ups] ADD  DEFAULT ('top_up') FOR [transaction_type]
GO

ALTER TABLE [dbo].[staff_top_ups] ADD  DEFAULT ('completed') FOR [status]
GO

ALTER TABLE [dbo].[staff_top_ups] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[stop_amenities] ADD  DEFAULT ((0)) FOR [has_shelter]
GO

ALTER TABLE [dbo].[stop_amenities] ADD  DEFAULT ((0)) FOR [has_seating]
GO

ALTER TABLE [dbo].[stop_amenities] ADD  DEFAULT ((0)) FOR [has_lighting]
GO

ALTER TABLE [dbo].[stop_amenities] ADD  DEFAULT ((0)) FOR [has_wheelchair]
GO

ALTER TABLE [dbo].[stop_amenities] ADD  DEFAULT ((0)) FOR [has_ticket_machine]
GO

ALTER TABLE [dbo].[stop_amenities] ADD  DEFAULT ((0)) FOR [has_wifi]
GO

ALTER TABLE [dbo].[stop_amenities] ADD  DEFAULT (getutcdate()) FOR [updated_at]
GO

ALTER TABLE [dbo].[stops] ADD  DEFAULT ((0)) FOR [is_deleted]
GO

ALTER TABLE [dbo].[system_settings] ADD  DEFAULT ('string') FOR [value_type]
GO

ALTER TABLE [dbo].[system_settings] ADD  DEFAULT (getutcdate()) FOR [updated_at]
GO

ALTER TABLE [dbo].[tickets] ADD  DEFAULT (getdate()) FOR [booking_time]
GO

ALTER TABLE [dbo].[tickets] ADD  DEFAULT ('confirmed') FOR [status]
GO

ALTER TABLE [dbo].[tickets] ADD  DEFAULT ((0)) FOR [amount]
GO

ALTER TABLE [dbo].[tickets] ADD  DEFAULT ((0)) FOR [share_count]
GO

ALTER TABLE [dbo].[tickets] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[top_up_locations] ADD  DEFAULT ((1)) FOR [is_active]
GO

ALTER TABLE [dbo].[trip_checklists] ADD  DEFAULT ((0)) FOR [fuel_ok]
GO

ALTER TABLE [dbo].[trip_checklists] ADD  DEFAULT ((0)) FOR [lights_ok]
GO

ALTER TABLE [dbo].[trip_checklists] ADD  DEFAULT ((0)) FOR [tires_ok]
GO

ALTER TABLE [dbo].[trip_checklists] ADD  DEFAULT (getdate()) FOR [submitted_at]
GO

ALTER TABLE [dbo].[trip_delays] ADD  DEFAULT (getdate()) FOR [reported_at]
GO

ALTER TABLE [dbo].[trip_stop_arrivals] ADD  DEFAULT ('pending') FOR [arrival_status]
GO

ALTER TABLE [dbo].[trip_stop_arrivals] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[trip_stop_arrivals] ADD  DEFAULT (getutcdate()) FOR [updated_at]
GO

ALTER TABLE [dbo].[user_favorite_routes] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[user_sessions] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[user_suspension_logs] ADD  DEFAULT (getutcdate()) FOR [acted_at]
GO

ALTER TABLE [dbo].[user_totp] ADD  DEFAULT ((0)) FOR [enabled]
GO

ALTER TABLE [dbo].[user_totp] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[users] ADD  DEFAULT ('passenger') FOR [role]
GO

ALTER TABLE [dbo].[users] ADD  DEFAULT (getdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[users] ADD  DEFAULT ('regular') FOR [category]
GO

ALTER TABLE [dbo].[users] ADD  DEFAULT ('active') FOR [status]
GO

ALTER TABLE [dbo].[vehicle_fuel_records] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[vehicle_maintenance_records] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[vehicles] ADD  DEFAULT ('active') FOR [status]
GO

ALTER TABLE [dbo].[vehicles] ADD  DEFAULT (getdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[wallet_adjustments] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[wallet_freeze_log] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[wallet_recharges] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[wallet_transactions] ADD  DEFAULT (getutcdate()) FOR [created_at]
GO

ALTER TABLE [dbo].[wallets] ADD  DEFAULT ((0)) FOR [balance]
GO

ALTER TABLE [dbo].[wallets] ADD  DEFAULT ((0)) FOR [is_frozen]
GO

ALTER TABLE [dbo].[audit_logs]  WITH CHECK ADD FOREIGN KEY([actor_user_id])
REFERENCES [dbo].[users] ([user_id])
GO

ALTER TABLE [dbo].[complaint_updates]  WITH CHECK ADD FOREIGN KEY([actor_user_id])
REFERENCES [dbo].[users] ([user_id])
GO

ALTER TABLE [dbo].[complaint_updates]  WITH CHECK ADD FOREIGN KEY([complaint_id])
REFERENCES [dbo].[complaints] ([complaint_id])
ON DELETE CASCADE
GO

ALTER TABLE [dbo].[complaints]  WITH CHECK ADD FOREIGN KEY([assigned_to_user_id])
REFERENCES [dbo].[users] ([user_id])
GO

ALTER TABLE [dbo].[complaints]  WITH CHECK ADD FOREIGN KEY([driver_id])
REFERENCES [dbo].[drivers] ([driver_id])
GO

ALTER TABLE [dbo].[complaints]  WITH CHECK ADD FOREIGN KEY([route_id])
REFERENCES [dbo].[routes] ([route_id])
GO

ALTER TABLE [dbo].[complaints]  WITH CHECK ADD FOREIGN KEY([submitted_by_user_id])
REFERENCES [dbo].[users] ([user_id])
GO

ALTER TABLE [dbo].[complaints]  WITH CHECK ADD FOREIGN KEY([trip_id])
REFERENCES [dbo].[trips] ([trip_id])
GO

ALTER TABLE [dbo].[drivers]  WITH NOCHECK ADD  CONSTRAINT [fk_drivers_users] FOREIGN KEY([user_id])
REFERENCES [dbo].[users] ([user_id])
GO

ALTER TABLE [dbo].[drivers] CHECK CONSTRAINT [fk_drivers_users]
GO

ALTER TABLE [dbo].[eta_predictions]  WITH NOCHECK ADD  CONSTRAINT [fk_eta_predictions_trips] FOREIGN KEY([trip_id])
REFERENCES [dbo].[trips] ([trip_id])
GO

ALTER TABLE [dbo].[eta_predictions] CHECK CONSTRAINT [fk_eta_predictions_trips]
GO

ALTER TABLE [dbo].[fare_zone_stops]  WITH CHECK ADD FOREIGN KEY([zone_id])
REFERENCES [dbo].[fare_zones] ([zone_id])
ON DELETE CASCADE
GO

ALTER TABLE [dbo].[fare_zones]  WITH CHECK ADD FOREIGN KEY([route_id])
REFERENCES [dbo].[routes] ([route_id])
ON DELETE CASCADE
GO

ALTER TABLE [dbo].[geofence_events]  WITH CHECK ADD FOREIGN KEY([route_id])
REFERENCES [dbo].[routes] ([route_id])
GO

ALTER TABLE [dbo].[geofence_events]  WITH CHECK ADD FOREIGN KEY([trip_id])
REFERENCES [dbo].[trips] ([trip_id])
ON DELETE CASCADE
GO

ALTER TABLE [dbo].[gps_logs]  WITH NOCHECK ADD  CONSTRAINT [fk_gpslogs_trips] FOREIGN KEY([trip_id])
REFERENCES [dbo].[trips] ([trip_id])
GO

ALTER TABLE [dbo].[gps_logs] CHECK CONSTRAINT [fk_gpslogs_trips]
GO

ALTER TABLE [dbo].[login_audit_logs]  WITH CHECK ADD FOREIGN KEY([user_id])
REFERENCES [dbo].[users] ([user_id])
GO

ALTER TABLE [dbo].[nfc_cards]  WITH CHECK ADD FOREIGN KEY([user_id])
REFERENCES [dbo].[users] ([user_id])
ON DELETE CASCADE
GO

ALTER TABLE [dbo].[notifications]  WITH NOCHECK ADD  CONSTRAINT [fk_notifications_users] FOREIGN KEY([user_id])
REFERENCES [dbo].[users] ([user_id])
GO

ALTER TABLE [dbo].[notifications] CHECK CONSTRAINT [fk_notifications_users]
GO

ALTER TABLE [dbo].[passenger_counts]  WITH NOCHECK ADD  CONSTRAINT [fk_passengercounts_trips] FOREIGN KEY([trip_id])
REFERENCES [dbo].[trips] ([trip_id])
GO

ALTER TABLE [dbo].[passenger_counts] CHECK CONSTRAINT [fk_passengercounts_trips]
GO

ALTER TABLE [dbo].[passenger_qr_tokens]  WITH CHECK ADD FOREIGN KEY([user_id])
REFERENCES [dbo].[users] ([user_id])
GO

ALTER TABLE [dbo].[password_reset_tokens]  WITH CHECK ADD FOREIGN KEY([user_id])
REFERENCES [dbo].[users] ([user_id])
ON DELETE CASCADE
GO

ALTER TABLE [dbo].[ratings]  WITH NOCHECK ADD  CONSTRAINT [fk_ratings_trips] FOREIGN KEY([trip_id])
REFERENCES [dbo].[trips] ([trip_id])
GO

ALTER TABLE [dbo].[ratings] CHECK CONSTRAINT [fk_ratings_trips]
GO

ALTER TABLE [dbo].[ratings]  WITH NOCHECK ADD  CONSTRAINT [fk_ratings_users] FOREIGN KEY([user_id])
REFERENCES [dbo].[users] ([user_id])
GO

ALTER TABLE [dbo].[ratings] CHECK CONSTRAINT [fk_ratings_users]
GO

ALTER TABLE [dbo].[refresh_token_blacklist]  WITH CHECK ADD FOREIGN KEY([user_id])
REFERENCES [dbo].[users] ([user_id])
GO

ALTER TABLE [dbo].[refresh_tokens]  WITH CHECK ADD FOREIGN KEY([user_id])
REFERENCES [dbo].[users] ([user_id])
ON DELETE CASCADE
GO

ALTER TABLE [dbo].[role_permissions]  WITH CHECK ADD FOREIGN KEY([granted_by])
REFERENCES [dbo].[users] ([user_id])
GO

ALTER TABLE [dbo].[role_permissions]  WITH CHECK ADD FOREIGN KEY([permission_id])
REFERENCES [dbo].[permissions] ([permission_id])
ON DELETE CASCADE
GO

ALTER TABLE [dbo].[role_permissions]  WITH CHECK ADD FOREIGN KEY([role_id])
REFERENCES [dbo].[roles] ([role_id])
ON DELETE CASCADE
GO

ALTER TABLE [dbo].[route_stops]  WITH NOCHECK ADD  CONSTRAINT [fk_route_stops_routes] FOREIGN KEY([route_id])
REFERENCES [dbo].[routes] ([route_id])
GO

ALTER TABLE [dbo].[route_stops] CHECK CONSTRAINT [fk_route_stops_routes]
GO

ALTER TABLE [dbo].[route_stops]  WITH NOCHECK ADD  CONSTRAINT [fk_route_stops_stops] FOREIGN KEY([stop_id])
REFERENCES [dbo].[stops] ([stop_id])
GO

ALTER TABLE [dbo].[route_stops] CHECK CONSTRAINT [fk_route_stops_stops]
GO

ALTER TABLE [dbo].[route_waypoints]  WITH CHECK ADD FOREIGN KEY([route_id])
REFERENCES [dbo].[routes] ([route_id])
ON DELETE CASCADE
GO

ALTER TABLE [dbo].[staff_shift_sessions]  WITH CHECK ADD FOREIGN KEY([staff_user_id])
REFERENCES [dbo].[users] ([user_id])
GO

ALTER TABLE [dbo].[stop_amenities]  WITH CHECK ADD FOREIGN KEY([stop_id])
REFERENCES [dbo].[stops] ([stop_id])
ON DELETE CASCADE
GO

ALTER TABLE [dbo].[tickets]  WITH NOCHECK ADD  CONSTRAINT [fk_tickets_trips] FOREIGN KEY([trip_id])
REFERENCES [dbo].[trips] ([trip_id])
GO

ALTER TABLE [dbo].[tickets] CHECK CONSTRAINT [fk_tickets_trips]
GO

ALTER TABLE [dbo].[tickets]  WITH NOCHECK ADD  CONSTRAINT [fk_tickets_users] FOREIGN KEY([user_id])
REFERENCES [dbo].[users] ([user_id])
GO

ALTER TABLE [dbo].[tickets] CHECK CONSTRAINT [fk_tickets_users]
GO

ALTER TABLE [dbo].[trip_checklists]  WITH CHECK ADD FOREIGN KEY([trip_id])
REFERENCES [dbo].[trips] ([trip_id])
GO

ALTER TABLE [dbo].[trip_delays]  WITH CHECK ADD FOREIGN KEY([trip_id])
REFERENCES [dbo].[trips] ([trip_id])
GO

ALTER TABLE [dbo].[trip_stop_arrivals]  WITH CHECK ADD FOREIGN KEY([route_id])
REFERENCES [dbo].[routes] ([route_id])
GO

ALTER TABLE [dbo].[trip_stop_arrivals]  WITH CHECK ADD FOREIGN KEY([stop_id])
REFERENCES [dbo].[stops] ([stop_id])
GO

ALTER TABLE [dbo].[trip_stop_arrivals]  WITH CHECK ADD FOREIGN KEY([trip_id])
REFERENCES [dbo].[trips] ([trip_id])
ON DELETE CASCADE
GO

ALTER TABLE [dbo].[trips]  WITH NOCHECK ADD  CONSTRAINT [fk_trips_drivers] FOREIGN KEY([driver_id])
REFERENCES [dbo].[drivers] ([driver_id])
GO

ALTER TABLE [dbo].[trips] CHECK CONSTRAINT [fk_trips_drivers]
GO

ALTER TABLE [dbo].[trips]  WITH NOCHECK ADD  CONSTRAINT [fk_trips_routes] FOREIGN KEY([route_id])
REFERENCES [dbo].[routes] ([route_id])
GO

ALTER TABLE [dbo].[trips] CHECK CONSTRAINT [fk_trips_routes]
GO

ALTER TABLE [dbo].[trips]  WITH NOCHECK ADD  CONSTRAINT [fk_trips_vehicles] FOREIGN KEY([vehicle_id])
REFERENCES [dbo].[vehicles] ([vehicle_id])
GO

ALTER TABLE [dbo].[trips] CHECK CONSTRAINT [fk_trips_vehicles]
GO

ALTER TABLE [dbo].[user_favorite_routes]  WITH CHECK ADD FOREIGN KEY([route_id])
REFERENCES [dbo].[routes] ([route_id])
ON DELETE CASCADE
GO

ALTER TABLE [dbo].[user_favorite_routes]  WITH CHECK ADD FOREIGN KEY([user_id])
REFERENCES [dbo].[users] ([user_id])
ON DELETE CASCADE
GO

ALTER TABLE [dbo].[user_sessions]  WITH CHECK ADD FOREIGN KEY([user_id])
REFERENCES [dbo].[users] ([user_id])
ON DELETE CASCADE
GO

ALTER TABLE [dbo].[user_suspension_logs]  WITH CHECK ADD FOREIGN KEY([acted_by])
REFERENCES [dbo].[users] ([user_id])
GO

ALTER TABLE [dbo].[user_suspension_logs]  WITH CHECK ADD FOREIGN KEY([user_id])
REFERENCES [dbo].[users] ([user_id])
GO

ALTER TABLE [dbo].[user_totp]  WITH CHECK ADD FOREIGN KEY([user_id])
REFERENCES [dbo].[users] ([user_id])
ON DELETE CASCADE
GO

ALTER TABLE [dbo].[vehicle_docs]  WITH CHECK ADD  CONSTRAINT [FK_vdocs_admin] FOREIGN KEY([updated_by_admin_id])
REFERENCES [dbo].[users] ([user_id])
GO

ALTER TABLE [dbo].[vehicle_docs] CHECK CONSTRAINT [FK_vdocs_admin]
GO

ALTER TABLE [dbo].[vehicle_docs]  WITH CHECK ADD  CONSTRAINT [FK_vdocs_plate] FOREIGN KEY([plate])
REFERENCES [dbo].[vehicles] ([plate_number])
GO

ALTER TABLE [dbo].[vehicle_docs] CHECK CONSTRAINT [FK_vdocs_plate]
GO

ALTER TABLE [dbo].[vehicle_fuel_records]  WITH CHECK ADD  CONSTRAINT [FK_vfr_recorder] FOREIGN KEY([recorded_by])
REFERENCES [dbo].[users] ([user_id])
GO

ALTER TABLE [dbo].[vehicle_fuel_records] CHECK CONSTRAINT [FK_vfr_recorder]
GO

ALTER TABLE [dbo].[vehicle_fuel_records]  WITH CHECK ADD  CONSTRAINT [FK_vfr_vehicle] FOREIGN KEY([vehicle_id])
REFERENCES [dbo].[vehicles] ([vehicle_id])
GO

ALTER TABLE [dbo].[vehicle_fuel_records] CHECK CONSTRAINT [FK_vfr_vehicle]
GO

ALTER TABLE [dbo].[vehicle_maintenance_records]  WITH CHECK ADD  CONSTRAINT [FK_vmr_creator] FOREIGN KEY([created_by])
REFERENCES [dbo].[users] ([user_id])
GO

ALTER TABLE [dbo].[vehicle_maintenance_records] CHECK CONSTRAINT [FK_vmr_creator]
GO

ALTER TABLE [dbo].[vehicle_maintenance_records]  WITH CHECK ADD  CONSTRAINT [FK_vmr_vehicle] FOREIGN KEY([vehicle_id])
REFERENCES [dbo].[vehicles] ([vehicle_id])
GO

ALTER TABLE [dbo].[vehicle_maintenance_records] CHECK CONSTRAINT [FK_vmr_vehicle]
GO

ALTER TABLE [dbo].[wallet_freeze_log]  WITH CHECK ADD  CONSTRAINT [FK_wfl_admin] FOREIGN KEY([admin_id])
REFERENCES [dbo].[users] ([user_id])
GO

ALTER TABLE [dbo].[wallet_freeze_log] CHECK CONSTRAINT [FK_wfl_admin]
GO

ALTER TABLE [dbo].[wallet_freeze_log]  WITH CHECK ADD  CONSTRAINT [FK_wfl_user] FOREIGN KEY([user_id])
REFERENCES [dbo].[users] ([user_id])
GO

ALTER TABLE [dbo].[wallet_freeze_log] CHECK CONSTRAINT [FK_wfl_user]
GO

ALTER TABLE [dbo].[wallets]  WITH CHECK ADD  CONSTRAINT [FK_wallets_user] FOREIGN KEY([user_id])
REFERENCES [dbo].[users] ([user_id])
GO

ALTER TABLE [dbo].[wallets] CHECK CONSTRAINT [FK_wallets_user]
GO

ALTER TABLE [dbo].[passenger_counts]  WITH NOCHECK ADD  CONSTRAINT [chk_method] CHECK  (([method]='qr_scan' OR [method]='camera'))
GO

ALTER TABLE [dbo].[passenger_counts] CHECK CONSTRAINT [chk_method]
GO

ALTER TABLE [dbo].[ratings]  WITH NOCHECK ADD CHECK  (([rating]>=(1) AND [rating]<=(5)))
GO

ALTER TABLE [dbo].[tickets]  WITH CHECK ADD CHECK  (([status]='completed' OR [status]='cancelled' OR [status]='boarded' OR [status]='confirmed'))
GO

ALTER TABLE [dbo].[trips]  WITH NOCHECK ADD  CONSTRAINT [chk_trip_status] CHECK  (([status]='cancelled' OR [status]='completed' OR [status]='ongoing' OR [status]='scheduled'))
GO

ALTER TABLE [dbo].[trips] CHECK CONSTRAINT [chk_trip_status]
GO

ALTER TABLE [dbo].[users]  WITH CHECK ADD  CONSTRAINT [CK_users_category] CHECK  (([category]='school_child' OR [category]='employee' OR [category]='senior' OR [category]='student' OR [category]='regular'))
GO

ALTER TABLE [dbo].[users] CHECK CONSTRAINT [CK_users_category]
GO

ALTER TABLE [dbo].[vehicles]  WITH NOCHECK ADD  CONSTRAINT [chk_vehicle_status] CHECK  (([status]='inactive' OR [status]='maintenance' OR [status]='active'))
GO

ALTER TABLE [dbo].[vehicles] CHECK CONSTRAINT [chk_vehicle_status]
GO

ALTER TABLE [dbo].[wallet_freeze_log]  WITH CHECK ADD  CONSTRAINT [CK_wallet_freeze_log_action] CHECK  (([action]='unfrozen' OR [action]='frozen'))
GO

ALTER TABLE [dbo].[wallet_freeze_log] CHECK CONSTRAINT [CK_wallet_freeze_log_action]
GO


