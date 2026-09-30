-- Fix: pgcrypto's crypt() and gen_salt() live in the "extensions" schema,
-- but the SECURITY DEFINER functions had search_path = public, so they
-- could not resolve crypt(). Recreate both functions with search_path
-- including extensions so login and credential changes work.

CREATE OR REPLACE FUNCTION verify_admin_login(p_username text, p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_stored text;
  v_username text;
BEGIN
  SELECT admin_password, admin_username
    INTO v_stored, v_username
  FROM admin_settings
  WHERE id = 1;

  IF v_stored IS NULL THEN
    RETURN false;
  END IF;

  RETURN v_username = p_username
     AND v_stored = extensions.crypt(p_password, v_stored);
END;
$$;

REVOKE EXECUTE ON FUNCTION verify_admin_login(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_admin_login(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION change_admin_credentials(
  p_current_password text,
  p_new_username text,
  p_new_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_stored text;
BEGIN
  SELECT admin_password INTO v_stored
  FROM admin_settings
  WHERE id = 1;

  IF v_stored IS NULL OR v_stored <> extensions.crypt(p_current_password, v_stored) THEN
    RETURN false;
  END IF;

  IF p_new_username IS NULL OR btrim(p_new_username) = '' THEN
    RAISE EXCEPTION 'Username cannot be empty';
  END IF;

  IF p_new_password IS NOT NULL AND btrim(p_new_password) <> '' THEN
    IF length(btrim(p_new_password)) < 6 THEN
      RAISE EXCEPTION 'Password must be at least 6 characters';
    END IF;

    UPDATE admin_settings
    SET admin_username  = btrim(p_new_username),
        admin_password  = extensions.crypt(btrim(p_new_password), extensions.gen_salt('bf')),
        updated_at      = now()
    WHERE id = 1;
  ELSE
    UPDATE admin_settings
    SET admin_username = btrim(p_new_username),
        updated_at     = now()
    WHERE id = 1;
  END IF;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION change_admin_credentials(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION change_admin_credentials(text, text, text) TO anon, authenticated;
