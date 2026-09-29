# Assignment 3: authentication and profiles

The existing restaurant page, styles, public restaurant client, SQL setup, and package changes are preserved. No project was created, no remote SQL was applied, and nothing was deployed or pushed.

## Existing schema inspection

Read-only API requests confirmed `profiles.id`, `first_name`, `last_name`, and `avatar_url` exist. Google is enabled. The supplied trigger definition confirms `on_auth_user_created` calls `public.handle_new_user()` after auth.users INSERT. Its SECURITY DEFINER function has an empty search_path and inserts only `id` into public.profiles. This implementation preserves that trigger and all column definitions. Column nullability and current profiles RLS settings were not exposed by available credentials; no changes were made to either. The anonymous bucket list was empty, which does not establish whether a bucket exists for an authenticated administrator.

Missing profiles are treated as incomplete; saving the form upserts only the verified user's ID and submitted names. Existing rows retain their photo when no new file is selected. The application requires nonblank trimmed names without making the database columns NOT NULL. Authenticated users with incomplete profiles are sent to /profile from the homepage, login page, and members page. The /protected page also verifies the user and profile on the server, independently of proxy.

## Existing Supabase project setup

1. Keep the existing signup trigger and nullable names. Do not rerun `supabase/setup.sql` for this assignment; it belongs to the restaurant setup.
2. Confirm `profiles.id` is a unique/primary key referencing auth.users, name columns accept NULL, and `avatar_url` is text. The authenticated role needs SELECT, INSERT, and UPDATE for the app's profile operations. Do not enable table RLS just for this change. If RLS already exists, its policies must allow the user's own row. Without table RLS, the app's user-ID checks do not restrict direct Data API access; this implementation preserves the assignment's database configuration.
3. Review/run `supabase/assignment3-storage.sql`. Use a public `avatars` bucket, maximum 2 MB, JPEG/PNG/WebP only. If that bucket already exists, verify settings manually (the script preserves them). Policies restrict upload and cleanup to paths whose first folder equals auth.uid(). Inspect any existing broad Storage policies separately. These are Storage policies, separate from public.profiles RLS.
4. Under Authentication → URL Configuration, set Site URL to the existing production site's origin. Allow exact URLs `http://localhost:3000/auth/callback` and `https://YOUR-EXISTING-DOMAIN/auth/callback`. Add exact preview callback URLs only if testing previews. The app sends no extra query parameters in redirectTo; Supabase naturally adds its authorization code when returning.
5. Keep Google enabled. In Google Cloud's existing OAuth client, the authorized redirect URI is `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`, not the Next.js callback. Verify consent-screen testing users if the Google application is in testing mode.

## Environment and existing Vercel project

Keep `.env.local` ignored. Local and Vercel environments require `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also accepted). Use only public credentials here; no service-role key is required. These browser variables are embedded at build time, so environment changes require a new build when you choose to deploy.

Check the existing Vercel project's environment scopes and callback domain. Its deployment protection must let the intended tester reach both the site and OAuth callback. A protected preview may require the tester to authenticate with Vercel first; use the production domain for grading if preview protection prevents access. No protection settings were changed.

## Implementation and limitations

`src/proxy.ts` uses Next.js 16's convention, verifies the user, refreshes cookies on both request and response, and sends private/no-store headers. `src/lib/supabase/client.ts` uses browser cookie storage; `server.ts` uses async Next cookies. Callback exchanges the PKCE code and retains the session cookies even if profile loading fails. Logout is a POST Server Action and signs out the current session. Server Actions independently validate identity and input.

Photos are checked for size, MIME type, and file signature on the server, with early browser checks. Only a public URL goes into profiles. Unique object names avoid overwrite permissions. Failed database saves attempt to delete the newly uploaded object; a Storage outage can leave an orphan. Replacing a successful photo retains the old object so concurrent saves cannot break another successful upload. Old unused objects can be cleaned up later. Photos from this app's avatars bucket are displayed using authenticated one-hour signed URLs, including when the bucket is private. Both stored object paths and public URLs are supported; arbitrary external avatar URLs are not loaded. The picker provides a circular local preview and separate save messages for photo uploads and names-only edits.

## Verification

Lint, TypeScript, three validation tests, and the Webpack production build passed. HTTP checks confirmed signed-out redirects and missing/denied/invalid callback handling. The user confirmed Google login and onboarding work. Authenticated photo retrieval, token expiry refresh, and logout have not been independently verified end-to-end. The default Turbopack build was blocked by an environment port restriction. Repeat locally:

```
npm run lint
npx tsc --noEmit
node --test tests/*.test.mjs
npm run build
npm run dev
```

Browser checklist (requires Google account and configured Storage):

- Signed out: / and /login render; /profile and /protected redirect to /login.
- /auth/callback without code, with provider denial, or with an invalid/expired code shows a useful login error, without logging the code.
- Google login uses exactly origin + /auth/callback and redirects incomplete/missing profiles to /profile.
- Blank names are rejected. Existing users without rows can save. Both names persist on reload.
- JPEG/PNG/WebP under 2 MB uploads, displays, and saves a URL only. Oversized, wrong MIME/signature, and policy-denied uploads report errors. Saving names alone retains the photo.
- Incomplete users cannot bypass onboarding by visiting / or /protected directly.
- Complete users can open /protected, reload, and remain signed in. Verify refresh after token expiry.
- Logout returns to /login; protected URLs then deny access, including after reload.

Unit tests cover validation/onboarding decisions only; they are not OAuth, Storage, or browser end-to-end tests.
