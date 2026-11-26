# Eden Glow — Instagram Worker (Cloudflare Workers Free)

Connects the studio's Instagram **Business** account to the website's gallery. Free plans only:
Firebase stays on **Spark**, this Worker runs on **Cloudflare Workers Free**. Nothing here is
deployed until you follow the steps below.

| What | How |
| --- | --- |
| Connect / callback / disconnect | `POST /instagram/connect`, `GET /instagram/callback`, `POST /instagram/disconnect` (owner only) |
| "Sync now" / "Retry" | `POST /instagram/sync` (owner only, 30-second cooldown) |
| Admin edits → website | `POST /gallery/revalidate` (owner only) + a safety net every 15 minutes |
| Public gallery | `GET /gallery.json`, `GET /gallery/page/<id>` from KV: visitors cost **0 Firestore reads** |
| Schedule | cron every 5 min: new posts at :00 :15 :30 :45; 6-hourly link refresh in between |
| Instagram token | encrypted (AES-256-GCM) in KV with the `TOKEN_KEY` secret; renewed weekly; never in Firestore or the browser |
| Firestore writes | as the **Sync Bot** user; `firestore.rules` allow it only the Instagram fields of gallery posts, the sync status and the history |
| Instagram data used | id, caption, type (photo/video/Reel/carousel), file + cover links, permalink, date, **like count when Instagram returns it** (scope `instagram_business_basic`, read-only) |

---

## 0. Before you start
- **Node.js 22.12 or newer** on the computer you deploy from (`node -v`). Wrangler needs it.
- A free **Cloudflare** account (no payment method needed for Workers Free).
- The Firebase CLI logged in: `npx firebase login` (from the project folder).
- Keep demo mode off for real use: `VITE_ADMIN_DEMO=false` in `.env.local`.

## 1. Cloudflare Worker
From the project folder:
```bash
cd worker
npm install
npx wrangler login                       # opens the browser once
npx wrangler kv namespace create IG_KV   # prints an id
```
1. Paste that id into `wrangler.toml` → `[[kv_namespaces]]` → `id = "…"`.
2. In `wrangler.toml` → `[vars]` set:
   - `FIREBASE_API_KEY` = the same value as `VITE_FIREBASE_API_KEY` in `.env.local` (public, not a secret)
   - `ADMIN_ORIGINS` = your website and local dev, comma-separated, e.g.
     `https://eden-glow.pages.dev,https://www.yourdomain.com,http://localhost:5173`
   - leave `INSTAGRAM_APP_ID` and `INSTAGRAM_REDIRECT_URI` for step 4.
3. First deploy, to get the Worker's address:
   ```bash
   npx wrangler deploy
   ```
   It prints `https://eden-glow-instagram.<your-subdomain>.workers.dev` (Cloudflare asks you to pick
   the subdomain the first time). This is your **Worker URL**.
4. Set `INSTAGRAM_REDIRECT_URI` = `<Worker URL>/instagram/callback` in `wrangler.toml`.
5. Check it answers: open `<Worker URL>/gallery.json` → `{"v":2,…,"total":0,"pages":[],"featured":[]}`.

## 2. Firebase: the Sync Bot
1. Firebase Console → **eden-glow-studio** → Build → **Authentication** → Users → **Add user**:
   - Email: an address only for this purpose, e.g. `instagram-sync-bot@<yourdomain>` (nobody logs in with it)
   - Password: a long random one, e.g. from
     `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`
   - Copy the new user's **User UID**.
2. Build → **Firestore Database** → **Start collection** `syncBots` → Document ID = that **UID** →
   field `note` (string) = `Instagram Worker` → Save. (Like `admins`, this list is managed only here.)
3. Publish the rules and indexes (Spark plan is fine):
   ```bash
   npx firebase deploy --only firestore:rules,firestore:indexes --project eden-glow-studio
   ```
   If it asks to delete indexes that are not in `firestore.indexes.json`, answer **No**.
4. Authentication → Settings → **Authorized domains** → add your Cloudflare Pages domain (and your own domain).

## 3. Worker secrets
Each command asks for the value; it is stored encrypted at Cloudflare and never in any file:
```bash
cd worker
npx wrangler secret put TOKEN_KEY            # paste: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
npx wrangler secret put SYNC_BOT_EMAIL       # the Sync Bot's email from step 2
npx wrangler secret put SYNC_BOT_PASSWORD    # the Sync Bot's password from step 2
npx wrangler secret put INSTAGRAM_APP_SECRET # from the Meta app, step 4
```
Keep a private copy of `TOKEN_KEY`: if it changes, the saved Instagram connection can't be read
and you simply connect Instagram again.

## 4. Meta app and redirect URI
1. Instagram app (phone) → Settings → **Account type and tools** → **Switch to professional account** →
   **Business**. (Do this only when you are ready.)
2. <https://developers.facebook.com/apps> → **Create app** → choose the Instagram use case
   (wording varies; it is the one for "Instagram API" / managing content on Instagram) → app type
   **Business** if asked.
3. In the app: **Instagram → API setup with Instagram login**.
   - Copy the **Instagram app ID** → `wrangler.toml` `INSTAGRAM_APP_ID`.
   - Copy the **Instagram app secret** → `npx wrangler secret put INSTAGRAM_APP_SECRET`.
   - (These are the *Instagram* app ID/secret on that page, not the Facebook app's.)
4. Same page → **Set up Instagram business login** → **Business login settings** → **OAuth redirect URIs** →
   add exactly `<Worker URL>/instagram/callback` → Save.
5. App roles → **Roles** → add your Instagram account as an **Instagram Tester**, then accept the invite
   in Instagram (Settings → Website permissions / Apps and websites → Tester invites; the menu name varies).
   While the app is in Development mode, only accounts with a role can connect.
6. Deploy again so the new settings are live: `npx wrangler deploy`.

## 5. Website and connecting the Business account
1. `.env.local`: `VITE_INSTAGRAM_API_URL=<Worker URL>` and `VITE_ADMIN_DEMO=false`, then `npm run dev`.
   For Cloudflare Pages: project → Settings → **Environment variables** → add the same
   `VITE_FIREBASE_*`, `VITE_INSTAGRAM_API_URL` and `VITE_ADMIN_DEMO=false` → redeploy
   (build command `npm run build`, output folder `dist`).
2. Sign in to the admin → **Instagram Gallery**. It shows **Not connected**.
3. **Connect Instagram** → Instagram's own page → log in there and **Allow** (read-only access;
   the website never sees your password) → you return to the admin with
   *"Instagram is connected…"* and your **@username** and **Business** are shown.
4. The first import starts at once (newest 25 posts) and continues every 5 minutes, 25 posts at a time.
   With **New posts: Publish automatically** on (default) they appear on the website as they arrive;
   switch it off to approve each post first.
5. If something goes wrong the admin says why:
   - *only Business or Creator accounts* → finish step 4.1;
   - *could not be connected* → check the app ID, secret and that the redirect URI matches exactly;
   - live logs: `cd worker && npx wrangler tail`.

## 6. Test: publish a Reel and watch it arrive
1. Note the time, then publish a Reel on the studio's Instagram.
2. Wait for the next quarter hour (:00, :15, :30 or :45) plus a minute — or press **Sync now** in the
   admin for an immediate check.
3. Admin → Instagram Gallery → **Sync history**: a **New posts** run with **New = 1**; the Reel is in
   **Imported posts** as **Published** (or Hidden if auto-publish is off: press **Publish**).
4. Website → **/gallery**: the Reel leads the **Reels from the studio** section (reload; the browser may
   keep the previous list for up to 60 seconds). Open it → its page `/gallery/reel/ig_<id>` plays the
   video, with caption, category, date, like count (when Instagram returns one) and **View on Instagram**.
   If Instagram doesn't provide the video file (it can withhold it, e.g. for licensed music), the page
   shows the cover with **Watch on Instagram**.
5. Optional checks: **Hide** it in the admin → it leaves the website within about a minute;
   `npx wrangler tail` shows each scheduled run.

**Disconnect:** admin → **Disconnect** removes the token and takes imported posts off the website (they stay
in the admin with your choices). To also remove the app's access on Instagram's side: Instagram → Settings →
Website permissions → Apps and websites.
**Expired or revoked access:** syncing pauses and the admin shows **Reconnect Instagram**; reconnecting
replaces the token and syncing resumes.

---

### Free-tier budget (measured in `test/budget.test.ts` and `test/cpu.test.ts`)
Per day with 2,000 posts, 3 new posts, 20 admin edits and 2,000 gallery visits: about 4,300 Worker requests
(limit 100,000), ≤ 8 outgoing requests per run (limit 50), ~6,000 KV reads (100,000), ≤ ~600 KV writes
(1,000), ≤ ~450 Firestore reads (50,000) and ≤ ~3,000 Firestore writes (20,000). CPU per run measured
1.6–5.6 ms at 1,000 posts and up to ~8 ms at 2,000 (limit 10 ms): check Workers → Metrics → CPU time after
deploying.

### Development
- `npm run typecheck` · tests run from the project root with `npm test` (uses the Firebase emulators, never
  the real project or Instagram).
- `npm run dev` runs the Worker locally (Node 22.12+); copy `.dev.vars.example` to `.dev.vars` and point it at
  the Firebase emulators.
