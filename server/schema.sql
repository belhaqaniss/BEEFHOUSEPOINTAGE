PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS restaurants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hyper_admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hyper_sessions (
  token TEXT PRIMARY KEY,
  hyper_admin_id INTEGER NOT NULL REFERENCES hyper_admins(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'superadmin')),
  restaurant_id INTEGER REFERENCES restaurants(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Équipe',
  color TEXT NOT NULL DEFAULT 'blue',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(first_name, last_name)
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  type TEXT NOT NULL CHECK (type IN ('Arrivée', 'Départ')),
  timestamp TEXT NOT NULL,
  work_date TEXT NOT NULL,
  service TEXT NOT NULL DEFAULT 'matin' CHECK (service IN ('matin', 'soir')),
  signature TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_date
ON attendance(employee_id, work_date, timestamp);

CREATE TABLE IF NOT EXISTS daily_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_date TEXT NOT NULL,
  cashier_morning TEXT NOT NULL,
  cashier_evening TEXT NOT NULL,
  fdc_morning TEXT NOT NULL,
  fdc_evening TEXT NOT NULL,
  fdc_final TEXT NOT NULL DEFAULT '',
  cb_amount TEXT NOT NULL DEFAULT '',
  cash_amount TEXT NOT NULL DEFAULT '',
  total_amount TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES admins(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('depense', 'offert')),
  label TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  note TEXT,
  source_detail INTEGER NOT NULL DEFAULT 0 CHECK (source_detail IN (0, 1)),
  created_by INTEGER REFERENCES admins(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_financial_entries_date
ON financial_entries(entry_date, kind);

CREATE TABLE IF NOT EXISTS schedule_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date TEXT NOT NULL,
  start_minutes INTEGER NOT NULL CHECK (start_minutes >= 420 AND start_minutes < 1560 AND start_minutes % 30 = 0),
  service TEXT NOT NULL DEFAULT 'matin' CHECK (service IN ('matin', 'soir')),
  created_by INTEGER REFERENCES admins(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, work_date, start_minutes)
);

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_week
ON schedule_blocks(work_date, employee_id, start_minutes);

CREATE TABLE IF NOT EXISTS schedule_closings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date TEXT NOT NULL,
  service TEXT NOT NULL DEFAULT 'soir' CHECK (service IN ('matin', 'soir')),
  created_by INTEGER REFERENCES admins(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, work_date, service)
);

CREATE TABLE IF NOT EXISTS tip_days (
  work_date TEXT PRIMARY KEY,
  morning_cents INTEGER NOT NULL DEFAULT 0 CHECK (morning_cents >= 0),
  evening_cents INTEGER NOT NULL DEFAULT 0 CHECK (evening_cents >= 0),
  created_by INTEGER REFERENCES admins(id),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tip_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_date TEXT NOT NULL REFERENCES tip_days(work_date) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN ('matin', 'soir')),
  recipient_key TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  claimed INTEGER NOT NULL DEFAULT 0 CHECK (claimed IN (0, 1)),
  claimed_at TEXT,
  UNIQUE(work_date, service, recipient_key)
);

CREATE INDEX IF NOT EXISTS idx_tip_allocations_recipient
ON tip_allocations(recipient_key, claimed, work_date);

CREATE TABLE IF NOT EXISTS whatsapp_pending_actions (
  phone_number TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  payload TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number TEXT NOT NULL,
  action TEXT NOT NULL,
  employee_id INTEGER REFERENCES employees(id),
  work_date TEXT,
  service TEXT,
  details TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_audit_date
ON whatsapp_audit_log(work_date, phone_number);
