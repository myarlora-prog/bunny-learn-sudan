-- ============ profiles: referral fields ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_reward_granted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS avatar_emoji text NOT NULL DEFAULT '🐰';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key ON public.profiles(referral_code);

CREATE OR REPLACE FUNCTION public.gen_referral_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c text; ok boolean;
BEGIN
  LOOP
    c := 'BUNNY-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    SELECT NOT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = c) INTO ok;
    IF ok THEN RETURN c; END IF;
  END LOOP;
END; $$;

UPDATE public.profiles SET referral_code = public.gen_referral_code() WHERE referral_code IS NULL;

-- ============ referrals ============
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code_used text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz
);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals own read" ON public.referrals FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_user_id OR public.is_admin());

-- ============ new user trigger ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, referral_code)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name',''), COALESCE(NEW.email,''), public.gen_referral_code())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_stats (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_energy (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

-- ============ settings helpers ============
INSERT INTO public.app_settings(key, value) VALUES
  ('energy_daily','5'::jsonb),
  ('energy_regen_minutes','30'::jsonb),
  ('energy_regen_max','3'::jsonb),
  ('super_offer_enabled','true'::jsonb),
  ('whatsapp_link','""'::jsonb),
  ('referral_goal','10'::jsonb),
  ('referral_reward_days','14'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.setting_int(_key text, _default int)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT (value #>> '{}')::int FROM public.app_settings WHERE key = _key), _default);
$$;

-- ============ energy ============
CREATE OR REPLACE FUNCTION public.energy_state()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  e public.user_energy%ROWTYPE;
  daily int := public.setting_int('energy_daily',5);
  mins int := public.setting_int('energy_regen_minutes',30);
  maxr int := public.setting_int('energy_regen_max',3);
  granted int; daily_left int; nxt timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  INSERT INTO public.user_energy(user_id) VALUES (uid) ON CONFLICT DO NOTHING;
  SELECT * INTO e FROM public.user_energy WHERE user_id = uid;

  IF e.day_date <> CURRENT_DATE THEN
    UPDATE public.user_energy SET day_date = CURRENT_DATE, daily_used = 0, regen_granted = 0,
      regen_used = 0, regen_started_at = NULL, updated_at = now() WHERE user_id = uid
      RETURNING * INTO e;
  END IF;

  daily_left := GREATEST(daily - e.daily_used, 0);

  IF daily_left = 0 AND e.regen_started_at IS NULL AND e.regen_granted < maxr THEN
    UPDATE public.user_energy SET regen_started_at = now(), updated_at = now()
      WHERE user_id = uid RETURNING * INTO e;
  END IF;

  IF e.regen_started_at IS NOT NULL THEN
    granted := LEAST(maxr, FLOOR(EXTRACT(EPOCH FROM (now() - e.regen_started_at)) / (mins * 60))::int);
    IF granted > e.regen_granted THEN
      UPDATE public.user_energy SET regen_granted = granted, updated_at = now()
        WHERE user_id = uid RETURNING * INTO e;
    END IF;
    IF e.regen_granted < maxr THEN
      nxt := e.regen_started_at + ((e.regen_granted + 1) * (mins || ' minutes')::interval);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'daily_max', daily,
    'daily_left', GREATEST(daily - e.daily_used, 0),
    'regen_max', maxr,
    'regen_left', GREATEST(e.regen_granted - e.regen_used, 0),
    'available', GREATEST(daily - e.daily_used, 0) + GREATEST(e.regen_granted - e.regen_used, 0),
    'regen_granted', e.regen_granted,
    'regen_interval_minutes', mins,
    'next_regen_at', nxt,
    'exhausted', (GREATEST(daily - e.daily_used,0) + GREATEST(e.regen_granted - e.regen_used,0)) = 0 AND e.regen_granted >= maxr
  );
END; $$;

CREATE OR REPLACE FUNCTION public.spend_energy(_amount int DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); st jsonb; i int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _amount < 1 OR _amount > 5 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  st := public.energy_state();
  IF (st->>'available')::int < _amount THEN
    RETURN jsonb_build_object('ok', false, 'state', st);
  END IF;
  FOR i IN 1.._amount LOOP
    IF (SELECT public.setting_int('energy_daily',5) - daily_used FROM public.user_energy WHERE user_id = uid) > 0 THEN
      UPDATE public.user_energy SET daily_used = daily_used + 1, updated_at = now() WHERE user_id = uid;
    ELSE
      UPDATE public.user_energy SET regen_used = regen_used + 1, updated_at = now() WHERE user_id = uid;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'state', public.energy_state());
END; $$;

-- ============ referrals logic ============
CREATE OR REPLACE FUNCTION public.apply_referral_code(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); ref uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_user_id = uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_used');
  END IF;
  SELECT id INTO ref FROM public.profiles WHERE referral_code = upper(trim(_code));
  IF ref IS NULL OR ref = uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;
  INSERT INTO public.referrals(referrer_id, referred_user_id, code_used)
  VALUES (ref, uid, upper(trim(_code)));
  UPDATE public.profiles SET referred_by = ref WHERE id = uid;
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.activate_referral(_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref uuid; cnt int; goal int := public.setting_int('referral_goal',10);
        days int := public.setting_int('referral_reward_days',14); g uuid; granted boolean;
BEGIN
  UPDATE public.referrals SET status = 'active', activated_at = now()
    WHERE referred_user_id = _uid AND status = 'pending' RETURNING referrer_id INTO ref;
  IF ref IS NULL THEN RETURN; END IF;
  SELECT COUNT(*) INTO cnt FROM public.referrals WHERE referrer_id = ref AND status = 'active';
  SELECT referral_reward_granted, grade_id INTO granted, g FROM public.profiles WHERE id = ref;
  IF cnt >= goal AND NOT granted AND g IS NOT NULL THEN
    INSERT INTO public.subscriptions(user_id, grade_id, plan, status, expires_at)
      VALUES (ref, g, 'referral', 'active', now() + (days || ' days')::interval);
    UPDATE public.profiles SET referral_reward_granted = true WHERE id = ref;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.referral_summary()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); code text; cnt int; granted boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT referral_code, referral_reward_granted INTO code, granted FROM public.profiles WHERE id = uid;
  IF code IS NULL THEN
    code := public.gen_referral_code();
    UPDATE public.profiles SET referral_code = code WHERE id = uid;
  END IF;
  SELECT COUNT(*) INTO cnt FROM public.referrals WHERE referrer_id = uid AND status = 'active';
  RETURN jsonb_build_object('code', code, 'goal', public.setting_int('referral_goal',10),
    'count', cnt, 'reward_granted', granted,
    'friends', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', COALESCE(NULLIF(p.display_name,''),'طالب بَني'),'status', r.status,'date', r.created_at) ORDER BY r.created_at DESC)
      FROM public.referrals r JOIN public.profiles p ON p.id = r.referred_user_id WHERE r.referrer_id = uid), '[]'::jsonb));
END; $$;

-- ============ progress / points ============
CREATE OR REPLACE FUNCTION public.bump_streak(_uid uuid, _minutes int, _points int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.user_stats%ROWTYPE;
BEGIN
  INSERT INTO public.user_stats(user_id) VALUES (_uid) ON CONFLICT DO NOTHING;
  SELECT * INTO s FROM public.user_stats WHERE user_id = _uid;
  IF s.last_study_date IS NULL THEN
    UPDATE public.user_stats SET streak = 1, longest_streak = GREATEST(longest_streak,1),
      study_days = study_days + 1, last_study_date = CURRENT_DATE WHERE user_id = _uid;
  ELSIF s.last_study_date = CURRENT_DATE THEN
    NULL;
  ELSIF s.last_study_date = CURRENT_DATE - 1 THEN
    UPDATE public.user_stats SET streak = streak + 1, longest_streak = GREATEST(longest_streak, streak + 1),
      study_days = study_days + 1, last_study_date = CURRENT_DATE WHERE user_id = _uid;
  ELSE
    UPDATE public.user_stats SET streak = 1, study_days = study_days + 1,
      last_study_date = CURRENT_DATE WHERE user_id = _uid;
  END IF;
  UPDATE public.user_stats SET total_minutes = total_minutes + GREATEST(_minutes,0),
    points = points + GREATEST(_points,0), updated_at = now() WHERE user_id = _uid;
END; $$;

CREATE OR REPLACE FUNCTION public.complete_lesson(_lesson_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); mins int; inserted boolean := false;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT duration_minutes INTO mins FROM public.lessons WHERE id = _lesson_id AND published;
  IF mins IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason','not_found'); END IF;
  INSERT INTO public.lesson_progress(user_id, lesson_id) VALUES (uid, _lesson_id)
    ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  IF inserted THEN
    PERFORM public.bump_streak(uid, mins, 25);
    PERFORM public.activate_referral(uid);
  END IF;
  RETURN jsonb_build_object('ok', true, 'awarded', inserted);
END; $$;

CREATE OR REPLACE FUNCTION public.record_quiz_attempt(_lesson_id uuid, _score int, _total int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _total < 1 OR _score < 0 OR _score > _total OR _total > 100 THEN
    RAISE EXCEPTION 'Invalid quiz result';
  END IF;
  INSERT INTO public.quiz_attempts(user_id, lesson_id, score, total) VALUES (uid, _lesson_id, _score, _total);
  PERFORM public.bump_streak(uid, 5, _score * 10);
  PERFORM public.activate_referral(uid);
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.set_flashcard_progress(_flashcard_id uuid, _known boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  INSERT INTO public.flashcard_progress(user_id, flashcard_id, known, updated_at)
  VALUES (uid, _flashcard_id, _known, now())
  ON CONFLICT (user_id, flashcard_id) DO UPDATE SET known = EXCLUDED.known, updated_at = now();
END; $$;

CREATE OR REPLACE FUNCTION public.log_ai_message(_role text, _content text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _role NOT IN ('user','assistant') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  INSERT INTO public.ai_messages(user_id, role, content) VALUES (uid, _role, left(_content, 8000));
END; $$;

-- ============ champions (per grade) ============
CREATE OR REPLACE FUNCTION public.grade_champions(_grade_id uuid DEFAULT NULL)
RETURNS TABLE(user_id uuid, display_name text, avatar_emoji text, points int, rank bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); g uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT grade_id INTO g FROM public.profiles WHERE id = uid;
  IF _grade_id IS NOT NULL AND (_grade_id <> g AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  g := COALESCE(_grade_id, g);
  IF g IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT p.id, COALESCE(NULLIF(p.display_name,''),'طالب بَني'), p.avatar_emoji,
           COALESCE(s.points,0), RANK() OVER (ORDER BY COALESCE(s.points,0) DESC, p.created_at ASC)
    FROM public.profiles p LEFT JOIN public.user_stats s ON s.user_id = p.id
    WHERE p.grade_id = g;
END; $$;

REVOKE EXECUTE ON FUNCTION public.gen_referral_code() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.activate_referral(uuid) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.bump_streak(uuid,int,int) FROM authenticated, anon;