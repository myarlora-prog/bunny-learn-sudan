DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.energy_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_energy(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.referral_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_lesson(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_quiz_attempt(uuid, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_flashcard_progress(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_ai_message(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grade_champions(uuid) TO authenticated;