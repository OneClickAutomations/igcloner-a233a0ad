-- Revoke direct EXECUTE on trigger functions to fix security linter warnings
-- These are internal trigger functions and should not be callable via PostgREST API

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, authenticated, anon;