CREATE OR REPLACE FUNCTION public.admin_save_social_links(_links jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item record;
  clean jsonb := '{}'::jsonb;
  platform text;
  url text;
  expected_domain text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _links IS NULL OR jsonb_typeof(_links) <> 'object' THEN RAISE EXCEPTION 'Links must be an object'; END IF;
  FOR item IN SELECT key, value FROM jsonb_each(_links) LOOP
    platform := item.key;
    IF platform NOT IN ('instagram', 'tiktok', 'facebook') THEN RAISE EXCEPTION 'Unsupported social platform'; END IF;
    IF jsonb_typeof(item.value) <> 'string' THEN RAISE EXCEPTION 'Social link must be text'; END IF;
    url := btrim(item.value #>> '{}');
    IF url = '' THEN CONTINUE; END IF;
    IF length(url) > 500 THEN RAISE EXCEPTION 'Social link is too long'; END IF;
    expected_domain := platform || '.com';
    IF url !~* ('^https://([a-z0-9-]+\.)*' || replace(expected_domain, '.', '\.') || '(/[^[:space:]]*)?$') THEN
      RAISE EXCEPTION 'Invalid % URL', platform;
    END IF;
    clean := clean || jsonb_build_object(platform, url);
  END LOOP;
  INSERT INTO public.app_settings(key, value, updated_at)
  VALUES ('social_links', clean, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  RETURN clean;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_save_social_links(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_social_links(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_update_subject_exam(
  _id uuid,
  _title text,
  _questions jsonb,
  _status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  question jsonb;
  option_item jsonb;
  correct integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF btrim(COALESCE(_title, '')) = '' OR length(_title) > 200 THEN RAISE EXCEPTION 'Invalid exam title'; END IF;
  IF _status NOT IN ('draft', 'published') THEN RAISE EXCEPTION 'Invalid exam status'; END IF;
  IF _questions IS NULL OR jsonb_typeof(_questions) <> 'array' OR jsonb_array_length(_questions) = 0 THEN RAISE EXCEPTION 'Exam questions are required'; END IF;
  FOR question IN SELECT value FROM jsonb_array_elements(_questions) LOOP
    IF jsonb_typeof(question) <> 'object' OR btrim(COALESCE(question->>'q', '')) = '' THEN RAISE EXCEPTION 'Invalid question text'; END IF;
    IF jsonb_typeof(question->'options') <> 'array' OR jsonb_array_length(question->'options') < 2 OR jsonb_array_length(question->'options') > 6 THEN RAISE EXCEPTION 'Invalid question options'; END IF;
    FOR option_item IN SELECT value FROM jsonb_array_elements(question->'options') LOOP
      IF jsonb_typeof(option_item) <> 'string' OR btrim(option_item #>> '{}') = '' THEN RAISE EXCEPTION 'Invalid option text'; END IF;
    END LOOP;
    IF jsonb_typeof(question->'correct') <> 'number' THEN RAISE EXCEPTION 'Invalid correct answer'; END IF;
    correct := (question->>'correct')::integer;
    IF correct < 0 OR correct >= jsonb_array_length(question->'options') THEN RAISE EXCEPTION 'Correct answer is out of range'; END IF;
  END LOOP;
  UPDATE public.subject_exams
  SET title = btrim(_title), questions = _questions, status = _status,
      published_at = CASE WHEN _status = 'published' THEN COALESCE(published_at, now()) ELSE NULL END
  WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exam not found'; END IF;
  RETURN jsonb_build_object('ok', true, 'id', _id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_subject_exam(uuid, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_subject_exam(uuid, text, jsonb, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_delete_subject_exam(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  DELETE FROM public.subject_exams WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exam not found'; END IF;
  RETURN jsonb_build_object('ok', true, 'id', _id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_subject_exam(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_subject_exam(uuid) TO authenticated, service_role;