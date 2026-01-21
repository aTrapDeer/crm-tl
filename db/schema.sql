PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'worker', 'client')),
  phone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'on_hold', 'completed')),
  address TEXT,
  start_date TEXT,
  end_date TEXT,
  budget_amount REAL,
  is_funded INTEGER NOT NULL DEFAULT 0,
  funding_notes TEXT,
  on_hold_reason TEXT,
  expected_resume_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_tasks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_completed INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  completed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_assignments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, user_id)
);

CREATE TABLE IF NOT EXISTS project_updates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_project_assignments_project ON project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_user ON project_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_project_updates_project ON project_updates(project_id);
CREATE TABLE IF NOT EXISTS project_images (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  s3_key TEXT,
  s3_url TEXT,
  caption TEXT,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_completed ON project_tasks(project_id, is_completed);
CREATE INDEX IF NOT EXISTS idx_project_images_project ON project_images(project_id);

CREATE TABLE IF NOT EXISTS project_invitations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_project_invitations_project ON project_invitations(project_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_email ON project_invitations(email);
CREATE INDEX IF NOT EXISTS idx_project_invitations_token ON project_invitations(token);

-- ============ WORK ORDERS ============

CREATE TABLE IF NOT EXISTS work_orders (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  -- Work Order Identification
  work_order_number TEXT NOT NULL UNIQUE,
  date TEXT NOT NULL DEFAULT (date('now')),
  time_received TEXT,

  -- Contact Information
  phone TEXT,
  email TEXT,
  company TEXT,
  department TEXT,

  -- Location Information
  location TEXT,
  unit TEXT,
  area TEXT,
  access_needed TEXT,
  preferred_entry_time TEXT,

  -- Work Details
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('emergency', 'high', 'normal', 'low')),
  service_type TEXT NOT NULL DEFAULT 'maintenance' CHECK (service_type IN ('maintenance', 'repair', 'replace', 'inspection', 'preventive', 'cleaning', 'other')),
  description TEXT NOT NULL,

  -- Internal Use and Execution
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  scheduled_date TEXT,
  scheduled_time TEXT,
  time_in TEXT,
  time_out TEXT,
  total_labor_hours REAL,

  -- Completion and Close Out
  work_completed TEXT NOT NULL DEFAULT 'pending' CHECK (work_completed IN ('pending', 'in_progress', 'completed', 'cancelled')),
  completed_date TEXT,
  completed_time TEXT,
  work_summary TEXT,

  -- Optional Project Linking
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,

  -- Metadata
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_work_orders_number ON work_orders(work_order_number);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(work_completed);
CREATE INDEX IF NOT EXISTS idx_work_orders_priority ON work_orders(priority);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned ON work_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_orders_project ON work_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_date ON work_orders(date);

-- ============ WORK ORDER MATERIALS ============

CREATE TABLE IF NOT EXISTS work_order_materials (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  material_name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT,
  unit_cost REAL,
  total_cost REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_work_order_materials_order ON work_order_materials(work_order_id);

-- ============ WORK ORDER SIGNATURES ============

CREATE TABLE IF NOT EXISTS work_order_signatures (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  signer_type TEXT NOT NULL CHECK (signer_type IN ('tl_corp_rep', 'building_rep')),
  signer_name TEXT NOT NULL,
  signer_title TEXT,
  signature_data TEXT NOT NULL,
  signed_date TEXT NOT NULL DEFAULT (date('now')),
  signed_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_work_order_signatures_order ON work_order_signatures(work_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_order_signatures_unique ON work_order_signatures(work_order_id, signer_type);

-- ============ DOCUMENTS ============

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  filename TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  file_type TEXT,
  file_size INTEGER,
  s3_key TEXT,
  s3_url TEXT,

  -- Source linking
  work_order_id TEXT REFERENCES work_orders(id) ON DELETE SET NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,

  -- Metadata
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_documents_work_order ON documents(work_order_id);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);

-- ============ CLIENT DOCUMENT SHARING ============

CREATE TABLE IF NOT EXISTS client_documents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  client_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_by TEXT REFERENCES users(id) ON DELETE SET NULL,

  -- Access control
  can_download INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,

  -- Tracking
  viewed_at TEXT,
  downloaded_at TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(document_id, client_user_id)
);

CREATE INDEX IF NOT EXISTS idx_client_documents_document ON client_documents(document_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_client ON client_documents(client_user_id);
