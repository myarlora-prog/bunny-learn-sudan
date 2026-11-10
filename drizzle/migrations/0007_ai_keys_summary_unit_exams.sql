CREATE TABLE public.ai_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT '',
  provider text NOT NULL,
  model text NOT NULL,
  api_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  last_used_at timestamptz,
  last_status text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_keys TO service_role;
ALTER TABLE public.ai_keys ENABLE ROW LEVEL SECURITY;
-- No policies: only server code (service role) after an owner check can touch keys.

CREATE OR REPLACE FUNCTION public.admin_save_lesson_summary(_lesson_id uuid, _summary text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.lesson_content SET summary = _summary, updated_at = now() WHERE lesson_id = _lesson_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lesson content not found'; END IF;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.admin_save_lesson_summary(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_lesson_summary(uuid, text) TO authenticated;

ALTER TABLE public.subject_exams ADD COLUMN unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE;
CREATE INDEX subject_exams_unit_idx ON public.subject_exams(unit_id);