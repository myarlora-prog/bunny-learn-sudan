ALTER TABLE public.lesson_content_revisions ADD COLUMN IF NOT EXISTS field text NOT NULL DEFAULT 'explanation';
CREATE OR REPLACE FUNCTION public.admin_save_lesson_summary(_lesson_id uuid, _summary text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT summary INTO old FROM public.lesson_content WHERE lesson_id = _lesson_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lesson content not found'; END IF;
  IF coalesce(old,'') <> '' AND old IS DISTINCT FROM _summary THEN
    INSERT INTO public.lesson_content_revisions(lesson_id, explanation, edited_by, field) VALUES (_lesson_id, old, auth.uid(), 'summary');
  END IF;
  UPDATE public.lesson_content SET summary = _summary, updated_at = now() WHERE lesson_id = _lesson_id;
  RETURN jsonb_build_object('ok', true);
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS subject_exams_one_per_unit ON public.subject_exams(unit_id) WHERE unit_id IS NOT NULL;