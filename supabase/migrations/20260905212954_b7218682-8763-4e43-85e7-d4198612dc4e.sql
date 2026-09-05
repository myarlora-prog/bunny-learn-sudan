CREATE OR REPLACE FUNCTION public.gen_referral_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c text; ok boolean;
BEGIN
  LOOP
    c := 'SAQRO-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    SELECT NOT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = c) INTO ok;
    IF ok THEN RETURN c; END IF;
  END LOOP;
END; $function$;

UPDATE public.profiles SET referral_code = 'SAQRO-' || split_part(referral_code, '-', 2)
  WHERE referral_code LIKE 'BUNNY-%';
UPDATE public.referrals SET code_used = 'SAQRO-' || split_part(code_used, '-', 2)
  WHERE code_used LIKE 'BUNNY-%';

INSERT INTO public.app_settings(key, value) VALUES
  ('whatsapp_link', '"https://wa.me/966557110297"'::jsonb),
  ('super_price_label', '"اشترك عبر واتساب"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();