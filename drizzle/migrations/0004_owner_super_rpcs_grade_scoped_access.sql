CREATE TABLE IF NOT EXISTS public.subscription_requests (
  request_key uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  subscription_id uuid,
  action text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.subscription_requests TO service_role;
GRANT SELECT ON public.subscription_requests TO authenticated;
ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sub requests admin read" ON public.subscription_requests FOR SELECT TO authenticated USING (public.is_admin());

-- Lesson grade helper
CREATE OR REPLACE FUNCTION public.lesson_grade(_lesson_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.grade_id FROM public.lessons l JOIN public.units u ON u.id = l.unit_id
  JOIN public.subjects s ON s.id = u.subject_id WHERE l.id = _lesson_id;
$$;

-- Centralized access: admin, or published lesson in the student's own grade that is Free or covered by active Super for that grade
CREATE OR REPLACE FUNCTION public.can_access_lesson(_lesson_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.lessons l
    JOIN public.units u ON u.id = l.unit_id
    JOIN public.subjects s ON s.id = u.subject_id
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE l.id = _lesson_id AND l.published AND p.grade_id IS NOT NULL AND s.grade_id = p.grade_id
      AND (l.free_access OR public.has_active_super(auth.uid()))
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_grant_super(_user_id uuid, _months integer, _days integer, _request_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE g uuid; cur public.subscriptions%ROWTYPE; period interval; new_exp timestamptz; sid uuid; prev public.subscription_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _request_key IS NULL THEN RAISE EXCEPTION 'Missing request key'; END IF;
  SELECT * INTO prev FROM public.subscription_requests WHERE request_key = _request_key;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'subscription_id', prev.subscription_id,
      'expires_at', (SELECT expires_at FROM public.subscriptions WHERE id = prev.subscription_id));
  END IF;
  IF COALESCE(_months,0) > 0 AND COALESCE(_days,0) = 0 AND _months <= 12 THEN
    period := (_months || ' months')::interval;
  ELSIF COALESCE(_days,0) BETWEEN 1 AND 3650 AND COALESCE(_months,0) = 0 THEN
    period := (_days || ' days')::interval;
  ELSE RAISE EXCEPTION 'Invalid duration'; END IF;
  SELECT grade_id INTO g FROM public.profiles WHERE id = _user_id;
  IF g IS NULL THEN RAISE EXCEPTION 'Student has no grade'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_user_id::text));
  SELECT * INTO cur FROM public.subscriptions
    WHERE user_id = _user_id AND grade_id = g AND status = 'active' AND expires_at > now()
    ORDER BY expires_at DESC LIMIT 1;
  IF FOUND THEN
    new_exp := cur.expires_at + period;
    UPDATE public.subscriptions SET expires_at = new_exp WHERE id = cur.id;
    sid := cur.id;
  ELSE
    new_exp := now() + period;
    INSERT INTO public.subscriptions(user_id, grade_id, plan, status, starts_at, expires_at)
      VALUES (_user_id, g, 'super', 'active', now(), new_exp) RETURNING id INTO sid;
  END IF;
  INSERT INTO public.subscription_requests(request_key, user_id, subscription_id, action, created_by)
    VALUES (_request_key, _user_id, sid, CASE WHEN cur.id IS NULL THEN 'activate' ELSE 'extend' END, auth.uid());
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'subscription_id', sid, 'expires_at', new_exp, 'extended', cur.id IS NOT NULL);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_cancel_super(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.subscriptions SET status = 'cancelled'
    WHERE user_id = _user_id AND status = 'active' AND expires_at > now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'cancelled', n);
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_grant_super(uuid, integer, integer, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_cancel_super(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_super(uuid, integer, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_super(uuid) TO authenticated;