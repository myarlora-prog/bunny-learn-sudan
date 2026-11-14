ALTER TABLE public.user_settings ADD COLUMN theme_mode text NOT NULL DEFAULT 'dark';
UPDATE public.user_settings SET theme_mode = CASE WHEN dark_mode THEN 'dark' ELSE 'light' END;
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_theme_mode_check CHECK (theme_mode IN ('dark','light','system'));
ALTER TABLE public.profiles ALTER COLUMN time_zone SET DEFAULT 'Asia/Riyadh';

CREATE TABLE public.user_study_days (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  study_date date NOT NULL,
  first_opened_at timestamptz NOT NULL DEFAULT now(),
  last_opened_at timestamptz NOT NULL DEFAULT now(),
  lessons_opened integer NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, study_date)
);
GRANT SELECT ON public.user_study_days TO authenticated;
GRANT ALL ON public.user_study_days TO service_role;
ALTER TABLE public.user_study_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "study days own read" ON public.user_study_days FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  student_email text NOT NULL,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback own read" ON public.feedback FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

CREATE TABLE public.app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_id uuid UNIQUE REFERENCES public.referrals(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  kind text NOT NULL DEFAULT 'referral',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_notifications TO authenticated;
GRANT ALL ON public.app_notifications TO service_role;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications own read" ON public.app_notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.bump_streak(_uid uuid, _minutes integer, _points integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE s public.user_stats%ROWTYPE; tz text; today date;
BEGIN
  SELECT time_zone INTO tz FROM public.profiles WHERE id = _uid;
  BEGIN
    today := (now() AT TIME ZONE COALESCE(NULLIF(tz,''), 'Asia/Riyadh'))::date;
  EXCEPTION WHEN others THEN
    today := (now() AT TIME ZONE 'Asia/Riyadh')::date;
  END;
  INSERT INTO public.user_stats(user_id) VALUES (_uid) ON CONFLICT DO NOTHING;
  SELECT * INTO s FROM public.user_stats WHERE user_id = _uid;
  IF s.last_study_date IS NULL THEN
    UPDATE public.user_stats SET streak = 1, longest_streak = GREATEST(longest_streak,1), study_days = study_days + 1, last_study_date = today WHERE user_id = _uid;
  ELSIF s.last_study_date >= today THEN NULL;
  ELSIF s.last_study_date = today - 1 THEN
    UPDATE public.user_stats SET streak = streak + 1, longest_streak = GREATEST(longest_streak, streak + 1), study_days = study_days + 1, last_study_date = today WHERE user_id = _uid;
  ELSE
    UPDATE public.user_stats SET streak = 1, study_days = study_days + 1, last_study_date = today WHERE user_id = _uid;
  END IF;
  UPDATE public.user_stats SET total_minutes = total_minutes + GREATEST(_minutes,0), points = points + GREATEST(_points,0), updated_at = now() WHERE user_id = _uid;
END; $function$;

CREATE OR REPLACE FUNCTION public.record_lesson_open(_lesson_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE uid uuid := auth.uid(); tz text; today date;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT public.can_access_lesson(_lesson_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT time_zone INTO tz FROM public.profiles WHERE id = uid;
  BEGIN today := (now() AT TIME ZONE COALESCE(NULLIF(tz,''), 'Asia/Riyadh'))::date;
  EXCEPTION WHEN others THEN today := (now() AT TIME ZONE 'Asia/Riyadh')::date; END;
  INSERT INTO public.user_study_days(user_id, study_date) VALUES (uid, today)
    ON CONFLICT (user_id, study_date) DO UPDATE SET last_opened_at = now(), lessons_opened = public.user_study_days.lessons_opened + 1;
  PERFORM public.bump_streak(uid, 0, 0);
  RETURN jsonb_build_object('ok', true, 'study_date', today);
END; $function$;
REVOKE ALL ON FUNCTION public.record_lesson_open(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_lesson_open(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_feedback(_content text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE uid uuid := auth.uid(); p public.profiles%ROWTYPE; clean text := trim(COALESCE(_content,'')); fid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF clean = '' THEN RAISE EXCEPTION 'Feedback cannot be empty'; END IF;
  IF length(clean) > 4000 THEN RAISE EXCEPTION 'Feedback is too long'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = uid;
  INSERT INTO public.feedback(user_id, student_name, student_email, content) VALUES (uid, p.display_name, p.email, clean) RETURNING id INTO fid;
  RETURN jsonb_build_object('ok', true, 'id', fid);
END; $function$;
REVOKE ALL ON FUNCTION public.submit_feedback(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_feedback(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.activate_referral(_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE ref uuid; rid uuid; cnt int; goal int := public.setting_int('referral_goal',10); days int := public.setting_int('referral_reward_days',14); g uuid; granted boolean;
BEGIN
  UPDATE public.referrals SET status = 'active', activated_at = now() WHERE referred_user_id = _uid AND status = 'pending' RETURNING referrer_id, id INTO ref, rid;
  IF ref IS NULL THEN RETURN; END IF;
  INSERT INTO public.app_notifications(user_id, referral_id, title, content)
    VALUES (ref, rid, 'انضم صديق بدعوتك 🎁', 'تم احتساب دعوة جديدة بنجاح. تقدّمك نحو المكافأة تحدّث تلقائيًا.') ON CONFLICT (referral_id) DO NOTHING;
  PERFORM pg_advisory_xact_lock(hashtext(ref::text));
  SELECT COUNT(*) INTO cnt FROM public.referrals WHERE referrer_id = ref AND status = 'active';
  SELECT referral_reward_granted, grade_id INTO granted, g FROM public.profiles WHERE id = ref;
  IF cnt >= goal AND NOT granted AND g IS NOT NULL THEN
    INSERT INTO public.subscriptions(user_id, grade_id, plan, status, expires_at) VALUES (ref, g, 'referral', 'active', now() + (days || ' days')::interval);
    UPDATE public.profiles SET referral_reward_granted = true WHERE id = ref;
    INSERT INTO public.app_notifications(user_id, title, content, kind) VALUES (ref, 'تم فتح جميع الدروس 🎉', 'اكتملت دعواتك وتم تفعيل مكافأتك تلقائيًا.', 'reward');
  END IF;
END; $function$;

CREATE OR REPLACE FUNCTION public.qualify_referral()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE uid uuid := auth.uid(); ref uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT referrer_id INTO ref FROM public.referrals WHERE referred_user_id = uid AND status = 'pending';
  IF ref IS NULL THEN RETURN jsonb_build_object('ok', true, 'qualified', false); END IF;
  PERFORM public.activate_referral(uid);
  RETURN jsonb_build_object('ok', true, 'qualified', true);
END; $function$;
REVOKE ALL ON FUNCTION public.qualify_referral() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qualify_referral() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.apply_referral_code(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE uid uuid := auth.uid(); ref uuid; is_new boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_user_id = uid) THEN RETURN jsonb_build_object('ok', false, 'reason', 'already_used'); END IF;
  SELECT created_at >= now() - interval '24 hours' INTO is_new FROM auth.users WHERE id = uid;
  IF NOT COALESCE(is_new, false) THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_new'); END IF;
  SELECT id INTO ref FROM public.profiles WHERE referral_code = upper(trim(_code));
  IF ref IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code'); END IF;
  IF ref = uid THEN RETURN jsonb_build_object('ok', false, 'reason', 'own_code'); END IF;
  INSERT INTO public.referrals(referrer_id, referred_user_id, code_used) VALUES (ref, uid, upper(trim(_code)));
  UPDATE public.profiles SET referred_by = ref WHERE id = uid;
  PERFORM public.activate_referral(uid);
  RETURN jsonb_build_object('ok', true, 'qualified', true);
END; $function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE ref uuid; code text := upper(trim(COALESCE(NEW.raw_user_meta_data->>'referral_code','')));
BEGIN
  INSERT INTO public.profiles (id, display_name, email, referral_code) VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name',''), NULLIF(NEW.raw_user_meta_data->>'full_name',''), NULLIF(NEW.raw_user_meta_data->>'name',''), ''), COALESCE(NEW.email,''), public.gen_referral_code()) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_stats (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_energy (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  IF code <> '' THEN
    SELECT id INTO ref FROM public.profiles WHERE referral_code = code AND id <> NEW.id;
    IF ref IS NOT NULL THEN
      INSERT INTO public.referrals(referrer_id, referred_user_id, code_used) VALUES (ref, NEW.id, code) ON CONFLICT DO NOTHING;
      UPDATE public.profiles SET referred_by = ref WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.mark_notifications_read()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.app_notifications SET read_at = now() WHERE user_id = auth.uid() AND read_at IS NULL;
END; $function$;
REVOKE ALL ON FUNCTION public.mark_notifications_read() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read() TO authenticated, service_role;