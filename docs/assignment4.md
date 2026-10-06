# Assignment 4: Campus captions

Implemented at `/captions`: authenticated Gemini generation, persisted exact prompts and output, a public paginated feed, individual share links, daily inspiration, three tones, private per-user voting, and changeable up/down votes. The first vote inserts a row; subsequent votes update it. Restaurant browsing and profile editing remain available.

## Manual setup required

1. In the existing Supabase project's SQL Editor, run `supabase/assignment4.sql`. It creates the caption/vote tables and replaces existing policies on `restaurants`, `profiles`, `captions`, and `caption_votes`. It preserves rows and signup triggers. The existing restaurant and profile tables must already exist.
2. Inspect the table inventory returned by the script. For any additional application tables (such as an old `jokes` table), enable RLS and review their existing policies according to their intended use. The repository cannot establish what other tables exist in your live project. Review Storage policies too; `supabase/assignment3-storage.sql` describes the avatar permissions. Do not rerun the original restaurant setup on an existing table.
3. Create a Gemini key in https://aistudio.google.com/apikey. Add `GEMINI_API_KEY` to `.env.local` and Vercel project environment variables. Never prefix it with `NEXT_PUBLIC_` or commit it. Default model: `gemini-3.5-flash`; optionally set `GEMINI_MODEL` to another generateContent-compatible model available to your account. Provider quota/pricing depends on your account. Restart locally or redeploy after changing environment variables.
4. Keep the existing public Supabase URL and publishable/anon key configured in Vercel. Generation and voting use the user's session and RLS; no service-role key is required.
5. Commit and push the changes to your connected Vercel repository. After the deployment succeeds, disable applicable project Settings → Deployment Protection. Ensure the Supabase Auth redirect allowlist permits your deployment's `/auth/callback` URL (the existing login flow uses that callback).
6. Open the unique URL for that exact deployment in Incognito. Confirm public browsing works without a Vercel login; log in to test generation/voting. Submit that deployment URL, not a moving branch alias.

## Acceptance checks on your real project

- Logged out: feed and individual caption links load; generation/voting require login.
- Logged in: use today's idea or your own situation, select a tone, and generate. Refresh and confirm the caption persists. Check its exact prompt, model, and owner in Supabase.
- Vote and refresh. Change the vote and verify there is still one row for that user/caption.
- Log in as a second user. Confirm they cannot see or change the first user's vote/profile through the API. Their own vote creates a second row.
- Existing profile name/photo editing and restaurant browsing still work after the migration.
- Empty responses, provider errors, missing API key, and database failures do not display success. The app does not impose a daily generation limit; Gemini provider quotas still apply.
- Try the app at phone width and share an individual caption link.

## Product rationale and PM feedback

Sam gets campus/NYC context, a rotating daily prompt, and tone choices including Midwest culture shock. A public feed and direct links make content easy to share. Voting gives users a role beyond generation. No public leaderboard is included: individual voting records remain private. Daily prompts rotate through seven ideas; they are not AI-generated daily.

Have your PM generate and rate a caption unaided. Record the date, friction they encountered, requested change, implemented change, and retest result. This user feedback session must still happen; no feedback has been invented.

## Verification

Run `npm run lint`, `npx tsc --noEmit`, `node --test tests/*.test.mjs`, and `npm run build`. If your local Turbopack process cannot bind its worker port, `npm run build -- --webpack` is an alternate production build.

`tests/captions-rls.sql` checks insert/update behavior, duplicate constraints, owner spoofing, cross-user privacy, unauthenticated access, and profile upsert against a disposable PostgreSQL database with Supabase-style auth roles. Do not run its synthetic auth fixtures on production. The migration is tested locally, but your real Supabase schema, API grants, signup triggers, Storage policies, and Gemini account still need the acceptance checks above.

## Removing the former daily limit

Deploying the updated app removes the limit immediately. No Supabase SQL changes are required for existing installations: the old `caption_generation_limits` table and `reserve_caption_generation()` function are unused and may remain in place. New installations no longer create them.
