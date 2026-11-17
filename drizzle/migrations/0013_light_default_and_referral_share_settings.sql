ALTER TABLE public.user_settings ALTER COLUMN dark_mode SET DEFAULT false;
ALTER TABLE public.user_settings ALTER COLUMN theme_mode SET DEFAULT 'light';

CREATE OR REPLACE FUNCTION public.admin_save_referral_share(_message text, _app_url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  clean_message text := btrim(COALESCE(_message, ''));
  clean_url text := btrim(COALESCE(_app_url, ''));
  saved jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF clean_message = '' OR length(clean_message) > 4000 THEN RAISE EXCEPTION 'Invalid referral message'; END IF;
  IF length(clean_url) > 1000 OR clean_url !~* '^https://[a-z0-9.-]+(/[^[:space:]]*)?$' OR position('@' in clean_url) > 0 THEN
    RAISE EXCEPTION 'Invalid app URL';
  END IF;
  saved := jsonb_build_object('message', clean_message, 'url', clean_url);
  INSERT INTO public.app_settings(key, value, updated_at)
  VALUES ('referral_share', saved, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  RETURN saved;
END;
$function$;

COMMENT ON FUNCTION public.admin_save_referral_share(text, text) IS 'Owner-only editable referral invitation text and secure app URL.';