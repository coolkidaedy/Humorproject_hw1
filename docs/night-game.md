# Where the hell are we?

The homepage is now the daily deduction game. The restaurant collection is preserved at `/restaurants`; the previous caption tools remain at `/captions`.

## Local preview

Run `npm run dev`. Without the live database migration and episode, the site serves an explicitly labeled editorial practice case. Practice guesses are checked on the server. Browser drafts and practice stories stay on the device; they never generate leaderboard points or fake community votes.

## Connect ranked play

1. Apply `supabase/night-game.sql` in the existing project's Supabase SQL editor. It adds the game tables and narrowly scoped RPC functions; it does not change the old restaurant, profile or caption data. Re-run the file after this update so live runs store each player's guess trail and published stories can become community cases.
2. Set server-only `GEMINI_API_KEY`, optional `GEMINI_MODEL`, and `SUPABASE_SERVICE_ROLE_KEY`. The existing public Supabase URL and publishable key remain in use. Never prefix these server secrets with `NEXT_PUBLIC_`.
3. Generate today's draft: `node --env-file=.env.local scripts/generate-night.mjs`.
4. Review `.night-drafts/YYYY-MM-DD.json`, particularly that location hints are true and form a solvable progression. Publish the reviewed draft: `node --env-file=.env.local scripts/generate-night.mjs --day=YYYY-MM-DD --from=.night-drafts/YYYY-MM-DD.json --publish`.
5. Sign in through the existing Google flow. An available shared episode opens ranked play automatically.

A stable, random `GAME_SESSION_SECRET` preserves unranked practice progress across server restarts and key rotations. If omitted, deployments with `GEMINI_API_KEY` derive a separate practice-cookie signature from that server-only secret so progress remains valid across Vercel instances. Neither value authorizes ranked scores.

## Daily generation

`GET /api/night/generate` requires `Authorization: Bearer <CRON_SECRET>`. Set a long random `CRON_SECRET` server-side. A daily scheduler can call this route at 19:00 UTC to prepare tomorrow's New York date before midnight. No scheduler or deployment has been created automatically.

The route never replaces an existing episode. It validates the AI response and inserts one shared case; it never generates a different mystery per player. An existing episode returns `already-published`. Missing configuration returns 503; invalid credentials 401; generation or validation failure 502. Failures leave existing cases unchanged.

The initial destination pool contains two sourced locations in `src/lib/night/destinations.json`. Expand this editorial pool before a public launch to avoid repeating destinations. AI invents the fictional night and artifact wording, using these place facts. Schema validation and fact IDs reduce mistakes but do not prove every generated assertion is true; manually review drafts when adding destinations or changing the prompt. The scheduler is an optional automatic publishing path.

## Game and competition rules

- One ranked run and one immutable story per account per New York day.
- Four clues; three guesses. Start at 1,000 potential points. An extra clue costs 200 and a wrong guess costs 100. A solved case earns at least 100; giving up or three wrong guesses earns 0.
- Answer aliases, unrevealed clues and the answer are kept behind database functions. Only evidence already unlocked is sent to the browser during play; all four clues unlock after finishing so every storyteller has the same material. Each move locks the run row to serialize concurrent requests.
- Finishing, including giving up, unlocks the story editor and the day's reconstructions. Story length: 80–1,200 characters; title: 3–80; public handle: 3–20 ASCII letters, digits or underscores.
- Each completed player gives one “Best night” vote per day. Choosing another story moves that vote. Self-votes are rejected. Each received vote adds 50 points to the author's all-time total. Counts and rankings derive from rows, not client-supplied totals.
- After completing the case, signed-in players receive an AI reconstruction based on their server-recorded guesses, clue count, and the shared evidence. Wrong guesses become story detours. The player can edit the title and every word before publishing. A replacement draft never overwrites the current editor unless generation succeeds. Each account can request five drafts per New York day.
- Any signed-in player who has unlocked a published reconstruction can turn it into one canonical community case. AI selects a real NYC place named in the story and builds four progressive artifacts from the story's events. The first generated version is saved for everyone; later players open the same clues instead of spending another AI request. Each account can originate up to three community cases per New York day.
- Community answers, aliases, unrevealed clues, attempts and scores remain behind database functions. A current-day story case stays locked until the player finishes the original daily, preventing it from becoming a shortcut to the daily answer. Community cases have shareable `/night/story/[id]` routes and do not alter the ranked daily leaderboard.
- Voting and submissions close at midnight America/New_York, enforced by the database. Refresh is required when a tab crosses into the next day.
- Story order is stable but varied per viewer, not sorted by popularity. Today's stories are hidden from unfinished players. Tonight and all-time leaderboard tabs contain only actual published players. Ties are resolved by handle for tonight and by completed nights then handle for all time.
- Guests can play the practice case; authentication is required for ranked actions. Practice drafts are separate from live drafts and do not import into the leaderboard.
- Guests can also generate up to three AI drafts from the practice hints each New York day. The signed practice cookie enforces that quota without requiring an account; publishing, voting and ranked play still require authentication.

## Validation

`node --test tests/*.test.mjs` covers input and generation validation and existing app behavior. `npx tsc --noEmit` checks types. `npm run build` checks the production build.

`tests/night-game.sql` exercises the database against a temporary PostgreSQL instance with Supabase auth-role shims. Run only on a disposable test database, after `tests/night-bootstrap.sql` and the migration; the test file uses a transaction and rolls back.
