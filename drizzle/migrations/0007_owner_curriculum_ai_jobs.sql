CREATE TABLE public.curriculum_ai_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, subject_id uuid NOT NULL REFERENCES public.subjects(id), kind text NOT NULL CHECK (kind IN ('exam','format')), status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','running','paused','review','cancelled')), items jsonb NOT NULL DEFAULT '[]', results jsonb NOT NULL DEFAULT '[]', settings jsonb NOT NULL DEFAULT '{}', cursor integer NOT NULL DEFAULT 0, pause_reason text, lease_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.curriculum_ai_jobs TO authenticated;
GRANT ALL ON public.curriculum_ai_jobs TO service_role;
ALTER TABLE public.curriculum_ai_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages curriculum AI jobs" ON public.curriculum_ai_jobs FOR ALL TO authenticated USING (public.is_admin() AND owner_id = auth.uid()) WITH CHECK (public.is_admin() AND owner_id = auth.uid());
CREATE OR REPLACE FUNCTION public.claim_curriculum_ai_job(_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
 UPDATE public.curriculum_ai_jobs SET lease_until=now()+interval '10 minutes',status='running',updated_at=now() WHERE id=_id AND owner_id=auth.uid() AND status IN ('ready','running') AND (lease_until IS NULL OR lease_until<now());
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n=1;
END; $$;
REVOKE ALL ON FUNCTION public.claim_curriculum_ai_job(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_curriculum_ai_job(uuid) TO authenticated,service_role;