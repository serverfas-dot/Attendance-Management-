import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const logoSrc = `${import.meta.env.BASE_URL}png.png`;

export interface AdminSettings {
  id: number;
  admin_username: string;
  admin_password?: string;
  form_heading: string;
  form_subheading: string;
  form_open: boolean;
  form_start_time: string | null;
  form_end_time: string | null;
  use_time_restriction: boolean;
  location_enabled: boolean;
  location_lat: number | null;
  location_lng: number | null;
  location_radius_meters: number;
  location_name: string | null;
  updated_at: string;
}

export type StaffType = 'Admin' | 'Academic' | 'Both';

export interface Teacher {
  id: string;
  name: string;
  staff_type: StaffType;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Session {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  teacher_name: string;
  session_name: string;
  submitted_at: string;
}

// Public admin_settings excludes the password column (revoked at the database).
export type PublicAdminSettings = Omit<AdminSettings, 'admin_password'>;

export async function verifyAdminLogin(username: string, password: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('verify_admin_login', {
    p_username: username,
    p_password: password,
  });
  if (error) throw error;
  return data === true;
}

export async function changeAdminCredentials(
  currentPassword: string,
  newUsername: string,
  newPassword: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('change_admin_credentials', {
    p_current_password: currentPassword,
    p_new_username: newUsername,
    p_new_password: newPassword,
  });
  if (error) throw error;
  return data === true;
}
