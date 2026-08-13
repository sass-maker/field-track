PRAGMA foreign_keys = ON;

CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tracking_policies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('always', 'schedule')),
  time_zone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  days_of_week TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
  start_minute INTEGER NOT NULL DEFAULT 0 CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute INTEGER NOT NULL DEFAULT 1439 CHECK (end_minute BETWEEN 0 AND 1439),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tracking_policies
  (id, name, mode, time_zone, days_of_week, start_minute, end_minute)
VALUES
  ('policy-always', 'Always retain', 'always', 'Asia/Kolkata', '0,1,2,3,4,5,6', 0, 1439),
  ('policy-day-duty', 'Day duty', 'schedule', 'Asia/Kolkata', '1,2,3,4,5,6', 480, 1080);

CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  employee_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone_number TEXT,
  team_id TEXT NOT NULL REFERENCES teams(id),
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX employees_active_phone
  ON employees(phone_number) WHERE deleted_at IS NULL;

CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  token_hash TEXT NOT NULL UNIQUE,
  install_id TEXT UNIQUE,
  enrollment_code_id TEXT UNIQUE REFERENCES enrollment_codes(id),
  policy_id TEXT NOT NULL REFERENCES tracking_policies(id),
  label TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  last_seen_at TEXT,
  sim_subscription_id INTEGER,
  sim_slot_index INTEGER,
  sim_display_name TEXT,
  sim_carrier_name TEXT,
  sim_phone_number TEXT,
  sim_country_iso TEXT,
  sim_mcc_mnc TEXT,
  sim_present INTEGER CHECK (sim_present IN (0, 1)),
  sim_last_reported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE enrollment_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  policy_id TEXT NOT NULL REFERENCES tracking_policies(id),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE managers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manager', 'admin')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE manager_teams (
  manager_id TEXT NOT NULL REFERENCES managers(id),
  team_id TEXT NOT NULL REFERENCES teams(id),
  PRIMARY KEY (manager_id, team_id)
);

CREATE TABLE location_points (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  device_id TEXT NOT NULL REFERENCES devices(id),
  latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_meters REAL NOT NULL CHECK (accuracy_meters >= 0),
  recorded_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  battery_percentage INTEGER CHECK (battery_percentage BETWEEN 0 AND 100),
  source TEXT NOT NULL,
  policy_id TEXT NOT NULL REFERENCES tracking_policies(id)
);

CREATE INDEX location_points_employee_recorded
  ON location_points(employee_id, recorded_at);
CREATE INDEX location_points_policy_recorded
  ON location_points(policy_id, recorded_at);
CREATE INDEX location_points_recorded
  ON location_points(recorded_at);

CREATE TABLE latest_locations (
  employee_id TEXT PRIMARY KEY REFERENCES employees(id),
  point_id TEXT NOT NULL REFERENCES location_points(id),
  device_id TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy_meters REAL NOT NULL,
  recorded_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  battery_percentage INTEGER,
  source TEXT NOT NULL,
  policy_id TEXT NOT NULL
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  employee_id TEXT,
  occurred_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX audit_events_employee_occurred
  ON audit_events(employee_id, occurred_at);

CREATE TABLE daily_route_summaries (
  employee_id TEXT NOT NULL REFERENCES employees(id),
  summary_date TEXT NOT NULL,
  window_started_at TEXT,
  window_ended_at TEXT,
  first_point_id TEXT,
  last_point_id TEXT,
  approximate_distance_meters INTEGER NOT NULL DEFAULT 0,
  point_count INTEGER NOT NULL DEFAULT 0,
  moving_seconds INTEGER NOT NULL DEFAULT 0,
  stationary_seconds INTEGER NOT NULL DEFAULT 0,
  tracking_gaps_json TEXT NOT NULL DEFAULT '[]',
  generated_at TEXT NOT NULL,
  PRIMARY KEY (employee_id, summary_date)
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO settings (key, value, updated_at) VALUES
  ('raw_location_retention_days', '90', CURRENT_TIMESTAMP),
  ('daily_summary_retention_days', '365', CURRENT_TIMESTAMP);
