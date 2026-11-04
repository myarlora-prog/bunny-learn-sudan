ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS time_zone text NOT NULL DEFAULT 'Africa/Khartoum';

CREATE OR REPLACE FUNCTION public.bump_streak(_uid uuid, _minutes integer, _points integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE s public.user_stats%ROWTYPE; tz text; today date;
BEGIN
  SELECT time_zone INTO tz FROM public.profiles WHERE id = _uid;
  BEGIN
    today := (now() AT TIME ZONE COALESCE(NULLIF(tz,''), 'Africa/Khartoum'))::date;
  EXCEPTION WHEN others THEN
    today := (now() AT TIME ZONE 'Africa/Khartoum')::date;
  END;
  INSERT INTO public.user_stats(user_id) VALUES (_uid) ON CONFLICT DO NOTHING;
  SELECT * INTO s FROM public.user_stats WHERE user_id = _uid;
  IF s.last_study_date IS NULL THEN
    UPDATE public.user_stats SET streak = 1, longest_streak = GREATEST(longest_streak,1),
      study_days = study_days + 1, last_study_date = today WHERE user_id = _uid;
  ELSIF s.last_study_date >= today THEN
    NULL;
  ELSIF s.last_study_date = today - 1 THEN
    UPDATE public.user_stats SET streak = streak + 1, longest_streak = GREATEST(longest_streak, streak + 1),
      study_days = study_days + 1, last_study_date = today WHERE user_id = _uid;
  ELSE
    UPDATE public.user_stats SET streak = 1, study_days = study_days + 1,
      last_study_date = today WHERE user_id = _uid;
  END IF;
  UPDATE public.user_stats SET total_minutes = total_minutes + GREATEST(_minutes,0),
    points = points + GREATEST(_points,0), updated_at = now() WHERE user_id = _uid;
END; $function$;
REVOKE EXECUTE ON FUNCTION public.bump_streak(uuid,int,int) FROM authenticated, anon, public;