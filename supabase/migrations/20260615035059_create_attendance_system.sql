
-- Admin settings table
CREATE TABLE IF NOT EXISTS admin_settings (
  id INT PRIMARY KEY DEFAULT 1,
  admin_username TEXT NOT NULL DEFAULT 'admin',
  admin_password TEXT NOT NULL DEFAULT 'admin123',
  form_heading TEXT NOT NULL DEFAULT 'Attendance Record',
  form_subheading TEXT NOT NULL DEFAULT 'Please sign in your attendance below',
  form_open BOOLEAN NOT NULL DEFAULT true,
  form_start_time TIME,
  form_end_time TIME,
  use_time_restriction BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default admin settings
INSERT INTO admin_settings (id, admin_username, admin_password)
VALUES (1, 'admin', 'admin123')
ON CONFLICT (id) DO NOTHING;

-- Teachers table
CREATE TABLE IF NOT EXISTS teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default teachers
INSERT INTO teachers (name, sort_order) VALUES
  ('Mr. Ahmed Ali', 1),
  ('Ms. Sara Hassan', 2),
  ('Mr. Mohamed Omar', 3),
  ('Ms. Fatima Noor', 4),
  ('Mr. Khalid Ibrahim', 5),
  ('Ms. Amina Yusuf', 6),
  ('Mr. Hassan Abdi', 7),
  ('Ms. Khadija Mohamed', 8),
  ('Mr. Abdullahi Warsame', 9),
  ('Ms. Hodan Farah', 10),
  ('Mr. Abdirahman Jama', 11),
  ('Ms. Safia Aden', 12)
ON CONFLICT DO NOTHING;

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default sessions
INSERT INTO sessions (name, sort_order) VALUES
  ('General Cordination', 1),
  ('SMT Meeting', 2),
  ('Staff Meeting', 3),
  ('Gathering', 4),
  ('Assembly', 5),
  ('Walk way painting', 6)
ON CONFLICT DO NOTHING;

-- Attendance records table
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_name TEXT NOT NULL,
  session_name TEXT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Admin settings policies (allow all for anon)
CREATE POLICY "allow_select_admin_settings" ON admin_settings FOR SELECT TO anon USING (true);
CREATE POLICY "allow_update_admin_settings" ON admin_settings FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Teachers policies
CREATE POLICY "allow_select_teachers" ON teachers FOR SELECT TO anon USING (true);
CREATE POLICY "allow_insert_teachers" ON teachers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "allow_update_teachers" ON teachers FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_delete_teachers" ON teachers FOR DELETE TO anon USING (true);

-- Sessions policies
CREATE POLICY "allow_select_sessions" ON sessions FOR SELECT TO anon USING (true);
CREATE POLICY "allow_insert_sessions" ON sessions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "allow_update_sessions" ON sessions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_delete_sessions" ON sessions FOR DELETE TO anon USING (true);

-- Attendance policies
CREATE POLICY "allow_select_attendance" ON attendance FOR SELECT TO anon USING (true);
CREATE POLICY "allow_insert_attendance" ON attendance FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "allow_update_attendance" ON attendance FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_delete_attendance" ON attendance FOR DELETE TO anon USING (true);
