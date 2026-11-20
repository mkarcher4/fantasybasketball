// Generates ESPN-shaped demo data (fake teams) so the app can be previewed
// and tested without ESPN access. Usage: node scripts/make-demo.mjs
import { writeFileSync, mkdirSync } from 'node:fs';

let seed = 20270101;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const R = (x) => Math.max(0, Math.round(x));

const TEAMS = [
  ['Downtown Dynamos', 'DYN', 'Alex', 'Rivera'], ['Glass Cleaners', 'GLS', 'Brooke', 'Chen'],
  ['Pick & Roll Call', 'PNR', 'Carlos', 'Diaz'], ['Bench Mob', 'MOB', 'Dana', 'Ellis'],
  ['Full Court Press', 'FCP', 'Evan', 'Foster'], ['Splash Bros Inc', 'SPL', 'Fiona', 'Grant'],
  ['Triple Doubles', 'TDB', 'Greg', 'Hughes'], ['Euro Steppers', 'EUR', 'Hana', 'Ito'],
  ['Brick City', 'BRK', 'Ian', 'Jones'], ['Paint Protectors', 'PNT', 'Jess', 'Kim'],
];

const teams = TEAMS.map(([name, abbrev, f, l], i) => ({
  id: i + 1, name, abbrev, logo: '', owners: [`{M${i + 1}}`], primaryOwner: `{M${i + 1}}`,
  skill: { vol: 0.92 + rnd() * 0.16, fg: (rnd() - 0.5) * 0.04, ft: (rnd() - 0.5) * 0.08, tp: 0.8 + rnd() * 0.4,
    reb: 0.85 + rnd() * 0.3, ast: 0.85 + rnd() * 0.3, stl: 0.85 + rnd() * 0.3, blk: 0.7 + rnd() * 0.6 },
}));
const members = TEAMS.map(([, , f, l], i) => ({ id: `{M${i + 1}}`, firstName: f, lastName: l, displayName: `${f}${l}`.toLowerCase() }));

const CATS = [0, 1, 2, 3, 6, 17, 19, 20]; // PTS BLK STL AST REB 3PM FG% FT%

function weekStats(t, frac = 1) {
  const s = t.skill, u = () => 1 + gauss() * 0.08;
  const fga = R(255 * s.vol * u() * frac), fgm = R(fga * (0.47 + s.fg + gauss() * 0.02));
  const fta = R(62 * s.vol * u() * frac), ftm = R(fta * (0.78 + s.ft + gauss() * 0.03));
  const tpm = R(33 * s.tp * u() * frac);
  return {
    13: fgm, 14: fga, 15: ftm, 16: fta, 17: tpm, 0: 2 * fgm + tpm + ftm,
    6: R(92 * s.reb * u() * frac), 3: R(62 * s.ast * u() * frac), 2: R(18 * s.stl * u() * frac), 1: R(11 * s.blk * u() * frac),
    19: fga ? fgm / fga : 0, 20: fta ? ftm / fta : 0,
  };
}

function scoreSide(a, b, final) {
  let w = 0, l = 0, t = 0; const sa = {}, sb = {};
  for (const c of CATS) {
    const x = +a[c].toFixed(4), y = +b[c].toFixed(4);
    const ra = x > y ? 'WIN' : x < y ? 'LOSS' : 'TIE';
    if (ra === 'WIN') w++; else if (ra === 'LOSS') l++; else t++;
    sa[c] = { score: a[c], result: final ? ra : null };
    sb[c] = { score: b[c], result: final ? (ra === 'WIN' ? 'LOSS' : ra === 'LOSS' ? 'WIN' : 'TIE') : null };
  }
  return [{ wins: w, losses: l, ties: t, scoreByStat: sa }, { wins: l, losses: w, ties: t, scoreByStat: sb }];
}

function roundRobin(ids) {
  const arr = [...ids], rounds = [];
  for (let r = 0; r < arr.length - 1; r++) {
    const pairs = [];
    for (let i = 0; i < arr.length / 2; i++) pairs.push([arr[i], arr[arr.length - 1 - i]]);
    rounds.push(pairs); arr.splice(1, 0, arr.pop());
  }
  return rounds;
}

function build({ currentPeriod, inProgressFrac }) {
  const REG = 19, rr = roundRobin(teams.map((t) => t.id));
  const schedule = []; let mid = 1;
  const totals = Object.fromEntries(teams.map((t) => [t.id, { 0: 0, 1: 0, 2: 0, 3: 0, 6: 0, 17: 0, 13: 0, 14: 0, 15: 0, 16: 0 }]));
  const rec = Object.fromEntries(teams.map((t) => [t.id, { wins: 0, losses: 0, ties: 0 }]));
  const addTot = (id, s) => { for (const k of Object.keys(totals[id])) totals[id][k] += s[k]; };

  for (let p = 1; p <= REG; p++) {
    for (const [h, a] of rr[(p - 1) % rr.length]) {
      const e = { id: mid++, matchupPeriodId: p, playoffTierType: 'NONE', home: { teamId: h }, away: { teamId: a }, winner: 'UNDECIDED' };
      if (p < currentPeriod || (p === currentPeriod && inProgressFrac != null)) {
        const final = p < currentPeriod, frac = final ? 1 : inProgressFrac;
        const sh = weekStats(teams[h - 1], frac), sa = weekStats(teams[a - 1], frac);
        [e.home.cumulativeScore, e.away.cumulativeScore] = scoreSide(sh, sa, final);
        addTot(h, sh); addTot(a, sa);
        if (final) {
          const hw = e.home.cumulativeScore.wins, aw = e.away.cumulativeScore.wins;
          e.winner = hw > aw ? 'HOME' : aw > hw ? 'AWAY' : 'TIE';
          for (const [id, cs] of [[h, e.home.cumulativeScore], [a, e.away.cumulativeScore]]) {
            rec[id].wins += cs.wins; rec[id].losses += cs.losses; rec[id].ties += cs.ties;
          }
        }
      }
      schedule.push(e);
    }
  }

  const order = teams.map((t) => t.id).sort((x, y) => {
    const px = (rec[x].wins + rec[x].ties / 2), py = (rec[y].wins + rec[y].ties / 2); return py - px;
  });
  const seeds = Object.fromEntries(order.map((id, i) => [id, i + 1]));
  const byseed = (s) => order[s - 1];

  // Playoffs (only when the regular season is done)
  if (currentPeriod > REG) {
    const play = (p, h, a, forceTie = false) => {
      const e = { id: mid++, matchupPeriodId: p, playoffTierType: 'WINNERS_BRACKET', home: { teamId: h }, away: { teamId: a } };
      let sh = weekStats(teams[h - 1]), sa = weekStats(teams[a - 1]);
      let sc = scoreSide(sh, sa, true);
      if (forceTie) { // force a 4-4 to exercise the H2H tiebreaker
        let guard = 0;
        while (sc[0].wins !== 4 || sc[0].ties) { sh = weekStats(teams[h - 1]); sa = weekStats(teams[a - 1]); sc = scoreSide(sh, sa, true); if (++guard > 5000) break; }
      }
      [e.home.cumulativeScore, e.away.cumulativeScore] = sc;
      e.winner = sc[0].wins > sc[1].wins ? 'HOME' : sc[1].wins > sc[0].wins ? 'AWAY' : 'TIE';
      schedule.push(e); return e;
    };
    const decide = (e) => {
      if (e.winner === 'HOME') return e.home.teamId;
      if (e.winner === 'AWAY') return e.away.teamId;
      // league rule: regular-season H2H category record
      let hw = 0, aw = 0;
      for (const m of schedule) if (m.playoffTierType === 'NONE' && m.home.cumulativeScore && m.winner !== 'UNDECIDED') {
        const ids = [m.home.teamId, m.away.teamId];
        if (ids.includes(e.home.teamId) && ids.includes(e.away.teamId)) {
          const hs = m.home.teamId === e.home.teamId ? m.home : m.away, as = hs === m.home ? m.away : m.home;
          hw += hs.cumulativeScore.wins; aw += as.cumulativeScore.wins;
        }
      }
      return hw >= aw ? e.home.teamId : e.away.teamId;
    };
    const lose = (e, w) => (e.home.teamId === w ? e.away.teamId : e.home.teamId);
    const r1a = play(20, byseed(3), byseed(6)), r1b = play(20, byseed(4), byseed(5), true);
    const w36 = decide(r1a), w45 = decide(r1b);
    const r2a = play(21, byseed(1), w45), r2b = play(21, byseed(2), w36);
    const fA = decide(r2a), fB = decide(r2b);
    play(22, fA, fB);
    const third = play(22, lose(r2a, fA), lose(r2b, fB)); third.playoffTierType = 'WINNERS_CONSOLATION_LADDER';
  }

  const outTeams = teams.map((t) => {
    const tt = totals[t.id];
    return {
      id: t.id, name: t.name, abbrev: t.abbrev, logo: t.logo, owners: t.owners, primaryOwner: t.primaryOwner,
      playoffSeed: seeds[t.id], rankCalculatedFinal: currentPeriod > 22 ? seeds[t.id] : 0,
      record: { overall: { ...rec[t.id], percentage: (rec[t.id].wins + rec[t.id].ties / 2) / Math.max(1, rec[t.id].wins + rec[t.id].losses + rec[t.id].ties) } },
      valuesByStat: { ...tt, 19: tt[14] ? tt[13] / tt[14] : 0, 20: tt[16] ? tt[15] / tt[16] : 0 },
    };
  });

  const matchupPeriods = {};
  for (let p = 1; p <= 22; p++) matchupPeriods[p] = [p * 7 - 6, p * 7 - 5, p * 7 - 4, p * 7 - 3, p * 7 - 2, p * 7 - 1, p * 7];
  return {
    id: 99999, seasonId: 2027, gameId: 'fba',
    status: { currentMatchupPeriod: Math.min(currentPeriod, 22), latestScoringPeriod: Math.min(currentPeriod, 22) * 7 - 3, isActive: true },
    settings: {
      name: 'FBB Demo League',
      scheduleSettings: { matchupPeriodCount: REG, playoffTeamCount: 6, playoffMatchupPeriodLength: 1, matchupPeriods },
      scoringSettings: { scoringType: 'H2H_CATEGORY', scoringItems: CATS.map((statId) => ({ statId })) },
    },
    members, teams: outTeams, schedule,
  };
}

mkdirSync('demo', { recursive: true });
writeFileSync('demo/midseason.json', JSON.stringify(build({ currentPeriod: 7, inProgressFrac: 0.6 })));
seed = 777;
writeFileSync('demo/final.json', JSON.stringify(build({ currentPeriod: 23, inProgressFrac: null })));
console.log('wrote demo/midseason.json and demo/final.json');
