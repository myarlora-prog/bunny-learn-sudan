ALTER TABLE public.user_settings ADD COLUMN tutorial_completed_at timestamptz;
ALTER TABLE public.user_settings ALTER COLUMN dark_mode SET DEFAULT true;

CREATE OR REPLACE FUNCTION public.referral_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); code text; cnt int; granted boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT referral_code, referral_reward_granted INTO code, granted FROM public.profiles WHERE id = uid;
  IF code IS NULL THEN
    code := public.gen_referral_code();
    UPDATE public.profiles SET referral_code = code WHERE id = uid;
  END IF;
  SELECT COUNT(*) INTO cnt FROM public.referrals WHERE referrer_id = uid AND status = 'active';
  RETURN jsonb_build_object(
    'code', code,
    'goal', public.setting_int('referral_goal', 10),
    'reward_days', public.setting_int('referral_reward_days', 30),
    'count', cnt,
    'reward_granted', granted,
    'friends', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', COALESCE(NULLIF(p.display_name, ''), 'طالب نوابغ'),
        'status', r.status,
        'date', r.created_at
      ) ORDER BY r.created_at DESC)
      FROM public.referrals r
      JOIN public.profiles p ON p.id = r.referred_user_id
      WHERE r.referrer_id = uid
    ), '[]'::jsonb)
  );
END;
$$;