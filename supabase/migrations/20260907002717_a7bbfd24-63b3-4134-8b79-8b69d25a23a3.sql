CREATE TABLE public.curriculum_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid REFERENCES public.stages(id) ON DELETE SET NULL,
  grade_id uuid REFERENCES public.grades(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  source_name text NOT NULL DEFAULT '',
  source_text text NOT NULL DEFAULT '',
  content jsonb NOT NULL DEFAULT '{"units":[]}'::jsonb,
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_drafts TO authenticated;
GRANT ALL ON public.curriculum_drafts TO service_role;

ALTER TABLE public.curriculum_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drafts admin only" ON public.curriculum_drafts FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER t_drafts_updated BEFORE UPDATE ON public.curriculum_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "roles admin read" ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "roles admin write" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "energy admin read" ON public.user_energy FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "referrals admin read all" ON public.referrals FOR SELECT TO authenticated
  USING (public.is_admin());