REVOKE EXECUTE ON FUNCTION public.seed_default_currencies() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_default_categories() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_followup_defaults(uuid) FROM anon, authenticated;