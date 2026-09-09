-- ===========================================================================
-- Promote a user to admin
-- ===========================================================================
--
-- 1. Edit OWNER_EMAIL below to your sign-in email.
-- 2. Have that user sign in at least once so a row exists in auth.users.
-- 3. Run this file with the service-role key (NOT the anon key), e.g. via the
--    Supabase SQL editor. The is_admin guard trigger allows the change because
--    service-role sets the JWT role accordingly.
--
-- Re-run whenever you need to add another admin.
-- ---------------------------------------------------------------------------

update public.profiles
   set is_admin = true
 where id = (select id from auth.users where email = 'OWNER_EMAIL@example.com');
