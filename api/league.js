// Vercel serverless function: proxies ESPN Fantasy Basketball league data.
// ESPN blocks direct browser calls (CORS) and private leagues need cookies,
// so the browser calls /api/league and this function calls ESPN.
//
// Required Vercel environment variables:
//   ESPN_LEAGUE_ID   e.g. 12345678
//   ESPN_S2          espn_s2 cookie value (private leagues)
//   ESPN_SWID        SWID cookie value, including the {braces}
// Optional:
//   ESPN_SEASON      e.g. 2027 for the 2026-27 season (auto-detected if unset)

const VIEWS = ['mTeam', 'mSettings', 'mStandings', 'mStatus', 'mMatchupScore', 'mScoreboard'];

function defaultSeason() {
  const now = new Date();
  // ESPN labels NBA seasons by the year they end (2026-27 => 2027).
  return now.getUTCMonth() >= 7 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
}

export default async function handler(req, res) {
  const leagueId = process.env.ESPN_LEAGUE_ID;
  if (!leagueId) {
    res.status(503).json({ error: 'not_configured', message: 'ESPN_LEAGUE_ID is not set in Vercel.' });
    return;
  }

  const qSeason = parseInt((req.query && req.query.season) || '', 10);
  const season = Number.isFinite(qSeason) ? qSeason : parseInt(process.env.ESPN_SEASON || '', 10) || defaultSeason();

  const url =
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${season}` +
    `/segments/0/leagues/${encodeURIComponent(leagueId)}?` +
    VIEWS.map((v) => `view=${v}`).join('&');

  const headers = { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 FBB-League-App' };
  const s2 = process.env.ESPN_S2;
  const swid = process.env.ESPN_SWID;
  if (s2 && swid) headers.Cookie = `espn_s2=${s2}; SWID=${swid}`;

  try {
    const r = await fetch(url, { headers, redirect: 'follow' });
    const text = await r.text();
    if (!r.ok) {
      res.status(r.status === 401 ? 401 : 502).json({
        error: 'espn_error',
        status: r.status,
        message:
          r.status === 401
            ? 'ESPN refused access. Check ESPN_S2 / ESPN_SWID (cookies expire roughly yearly).'
            : `ESPN returned HTTP ${r.status}.`,
      });
      return;
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      res.status(502).json({ error: 'espn_bad_json', message: 'ESPN did not return JSON (cookies may be invalid).' });
      return;
    }
    // Cache at Vercel's edge briefly so a group chat full of refreshes doesn't hammer ESPN.
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: 'fetch_failed', message: String((e && e.message) || e) });
  }
}
