ALTER TABLE public.ai_keys ADD COLUMN IF NOT EXISTS project_label text NOT NULL DEFAULT '';
ALTER TABLE public.ai_keys ADD COLUMN IF NOT EXISTS cooldown_until timestamptz;
ALTER TABLE public.ai_keys ADD COLUMN IF NOT EXISTS last_kind text;