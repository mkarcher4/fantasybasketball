# FBB — Fantasy Basketball League App

Mobile-first app for our 10-team ESPN H2H categories league. Tabs: **Standings** (plus all-play power ranking / luck), **Scores** (weekly scoreboard), **Stats** (sortable category totals and Roto heat map, season or single week), **Prizes** (weekly category winners and money leaderboard), and **Playoffs** (projected bracket during the season, live bracket and podium once the playoffs start).

## Files
| Path | What it is |
|---|---|
| `index.html` | The whole app (HTML/CSS/JS, no build step) |
| `api/league.js` | Vercel serverless function that fetches ESPN with your cookies |
| `demo/*.json` | Fake-team demo data (`?demo=1` mid-season, `?demo=final` finished season) |
| `icons/`, `apple-touch-icon.png`, `manifest.webmanifest` | FBB logo and iPhone home-screen icon |
| `scripts/make-demo.mjs` | Regenerates the demo data |

## Deploy
1. Create a new GitHub repo (e.g. `FBB2027`) and upload everything in this folder (keep the folder structure).
2. In Vercel: **Add New → Project → Import** the repo. Framework preset: **Other**. No build command. Deploy.
3. In Vercel → Project → **Settings → Environment Variables**, add:
   - `ESPN_LEAGUE_ID` — the number after `leagueId=` in your ESPN league URL
   - `ESPN_S2` — your `espn_s2` cookie
   - `ESPN_SWID` — your `SWID` cookie, including the `{ }` braces
   - *(optional)* `ESPN_SEASON` — `2027` for the 2026-27 season (auto-detected otherwise)
4. **Redeploy** (Deployments → ⋯ → Redeploy) so the variables take effect.

**Getting the cookies:** log in at fantasy.espn.com on a desktop browser → DevTools (F12) → Application → Cookies → `https://fantasy.espn.com` → copy `espn_s2` and `SWID`. These are the same cookies as the football trackers if it's the same ESPN account. They stay server-side in Vercel and are never sent to the browser.

Until the variables are set, the app shows demo data with a yellow banner.

## Add to iPhone
Open the Vercel URL in Safari → Share → **Add to Home Screen**. It opens full-screen with the FBB icon.

## League rules built in (edit `RULES` near the top of the script in `index.html`)
- $100 × 10 = $1,000 pot · 1st $470 · 2nd $260 · $15 weekly category prize × 18 weeks ($270)
- Weekly prize schedule from the league doc (week 8 is a BYE); combined weeks add the two categories (FG% + FT% adds the two percentages). Ties split the $15.
- Roto: best in a category = 10, worst = 1; tied teams split the places they span.
- Playoffs: 6 teams, seeds 1–2 bye, 3v6 and 4v5, winners play 2 and 1, then the championship. A 4-4 tie goes to the better regular-season head-to-head category record; if that's also even, the higher seed advances.

## Notes
- Data is cached at Vercel for 2 minutes; the app auto-refreshes every 3 minutes while a week is live and when reopened.
- Season totals use ESPN's season stat totals (FG%/FT% computed from makes/attempts).
- "Week N" in the prize table = ESPN matchup period N.
