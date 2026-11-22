// Plain-text diagnostic: what ESPN returns for the current matchup week.
// Open /api/debug in a browser. Never prints cookies.
const CATS = { 19: 'FG%', 20: 'FT%', 17: '3PM', 6: 'REB', 3: 'AST', 2: 'STL', 1: 'BLK', 0: 'PTS' };

function defaultSeason() {
  const now = new Date();
  return now.getUTCMonth() >= 7 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
}

export default async function handler(req, res) {
  const out = [];
  const log = (s = '') => out.push(s);
  const leagueId = process.env.ESPN_LEAGUE_ID;
  const season = parseInt(process.env.ESPN_SEASON || '', 10) || defaultSeason();
  const headers = { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 FBB-League-App' };
  if (process.env.ESPN_S2 && process.env.ESPN_SWID) headers.Cookie = `espn_s2=${process.env.ESPN_S2}; SWID=${process.env.ESPN_SWID}`;
  const base = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${season}/segments/0/leagues/${encodeURIComponent(leagueId || '')}`;
  const get = async (q, extra = {}) => {
    const r = await fetch(`${base}?${q}`, { headers: { ...headers, ...extra } });
    const t = await r.text();
    try { return { status: r.status, json: JSON.parse(t) }; } catch { return { status: r.status, json: null, text: t.slice(0, 200) }; }
  };
  const fmt = (id, v) => (v == null ? '-' : CATS[id] && +id >= 19 ? (+v).toFixed(4) : Math.round(v));
  const side = (label, s, names) => {
    if (!s) return log(`  ${label}: (none)`);
    const cs = s.cumulativeScore || {};
    const sbs = cs.scoreByStat || {};
    log(`  ${label}: ${names[s.teamId] || s.teamId}  W-L-T ${cs.wins ?? '?'}-${cs.losses ?? '?'}-${cs.ties ?? '?'}`);
    log(`     ${Object.keys(CATS).map((id) => `${CATS[id]} ${fmt(id, sbs[id] && sbs[id].score)}`).join(' | ')}`);
    log(`     keys: ${Object.keys(s).join(', ')}`);
    for (const k of Object.keys(s)) if (/live/i.test(k)) log(`     ${k}: ${JSON.stringify(s[k]).slice(0, 400)}`);
  };

  try {
    log(`FBB debug  ${new Date().toISOString()}`);
    log(`season=${season} leagueIdSet=${!!leagueId} cookiesSet=${!!headers.Cookie}`);
    const a = await get('view=mTeam&view=mStatus&view=mSettings&view=mMatchupScore&view=mScoreboard');
    if (!a.json) { log(`ESPN HTTP ${a.status} ${a.text || ''}`); throw 0; }
    const d = a.json;
    const names = Object.fromEntries((d.teams || []).map((t) => [t.id, t.name || `${t.location || ''} ${t.nickname || ''}`.trim()]));
    const cur = d.status && d.status.currentMatchupPeriod;
    const sp = d.scoringPeriodId;
    log(`status: ${JSON.stringify(d.status && { currentMatchupPeriod: cur, latestScoringPeriod: d.status.latestScoringPeriod, finalScoringPeriod: d.status.finalScoringPeriod, isActive: d.status.isActive })}`);
    log(`top-level scoringPeriodId=${sp}`);
    const mp = d.settings && d.settings.scheduleSettings && d.settings.scheduleSettings.matchupPeriods;
    if (mp) log(`matchupPeriods[${cur}] = ${JSON.stringify(mp[cur])}`);
    log('');
    log(`== A) Default request, matchup period ${cur} ==`);
    for (const m of (d.schedule || []).filter((x) => x.matchupPeriodId === cur)) {
      log(`#${m.id} winner=${m.winner}`); side('home', m.home, names); side('away', m.away, names);
    }
    const filt = { 'x-fantasy-filter': JSON.stringify({ schedule: { filterMatchupPeriodIds: { value: [cur] } } }) };
    for (const [lbl, spv] of [['B) scoringPeriodId=' + sp, sp], ['C) scoringPeriodId=' + (d.status && d.status.latestScoringPeriod), d.status && d.status.latestScoringPeriod]]) {
      if (!spv) continue;
      const b = await get(`view=mMatchupScore&view=mScoreboard&scoringPeriodId=${spv}`, filt);
      log(''); log(`== ${lbl} (HTTP ${b.status}) ==`);
      for (const m of ((b.json && b.json.schedule) || []).filter((x) => x.matchupPeriodId === cur)) {
        log(`#${m.id} winner=${m.winner}`); side('home', m.home, names); side('away', m.away, names);
      }
    }
  } catch (e) {
    if (e) log(`error: ${e.message || e}`);
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(out.join('\n'));
}
