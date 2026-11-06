CREATE TABLE public.lesson_content_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  explanation text NOT NULL,
  edited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lesson_content_revisions TO authenticated;
GRANT ALL ON public.lesson_content_revisions TO service_role;
ALTER TABLE public.lesson_content_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read revisions" ON public.lesson_content_revisions FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.admin_save_lesson_explanation(_lesson_id uuid, _explanation text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE old text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lessons WHERE id = _lesson_id) THEN RAISE EXCEPTION 'Lesson not found'; END IF;
  SELECT explanation INTO old FROM public.lesson_content WHERE lesson_id = _lesson_id;
  IF FOUND THEN
    INSERT INTO public.lesson_content_revisions(lesson_id, explanation, edited_by) VALUES (_lesson_id, old, auth.uid());
    UPDATE public.lesson_content SET explanation = _explanation WHERE lesson_id = _lesson_id;
  ELSE
    INSERT INTO public.lesson_content(lesson_id, explanation) VALUES (_lesson_id, _explanation);
  END IF;
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_save_lesson_explanation(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_save_lesson_explanation(uuid, text) TO authenticated;

CREATE TABLE public.subject_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_text text NOT NULL DEFAULT '',
  created_by uuid,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_exams TO authenticated;
GRANT ALL ON public.subject_exams TO service_role;
ALTER TABLE public.subject_exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage exams" ON public.subject_exams FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "students read published exams of own grade" ON public.subject_exams FOR SELECT TO authenticated
  USING (status = 'published' AND EXISTS (
    SELECT 1 FROM public.subjects s JOIN public.profiles p ON p.id = auth.uid()
    WHERE s.id = subject_exams.subject_id AND s.grade_id = p.grade_id));
CREATE TRIGGER t_subject_exams_updated BEFORE UPDATE ON public.subject_exams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();