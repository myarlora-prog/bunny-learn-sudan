ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS free_access boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.has_active_super(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = _uid AND status = 'active' AND expires_at > now());
$$;

CREATE OR REPLACE FUNCTION public.can_access_lesson(_lesson_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.lessons l WHERE l.id = _lesson_id AND l.published
      AND (l.free_access OR public.has_active_super(auth.uid()))
  );
$$;

CREATE POLICY "lesson_content readable when accessible" ON public.lesson_content FOR SELECT TO authenticated USING (public.can_access_lesson(lesson_id));
CREATE POLICY "flashcards readable when accessible" ON public.flashcards FOR SELECT TO authenticated USING (public.can_access_lesson(lesson_id));
CREATE POLICY "quiz readable when accessible" ON public.quiz_questions FOR SELECT TO authenticated USING (public.can_access_lesson(lesson_id));