REVOKE ALL ON FUNCTION public.seed_followup_defaults(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_followup_defaults(uuid) TO service_role;