CREATE OR REPLACE FUNCTION public.has_active_super(_uid uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    JOIN public.profiles p ON p.id = s.user_id
    WHERE s.user_id = _uid AND s.status = 'active' AND s.expires_at > now()
      AND p.grade_id IS NOT NULL AND s.grade_id = p.grade_id);
$function$;