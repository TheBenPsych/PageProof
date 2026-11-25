// Runs every check in this folder. Used by GitHub before each release (see
// .github/workflows/release.yml), and by hand:  node tests/app/run.js
// A check that fails is tried once more, because a slow test computer can make one stumble.
//   node tests/app/run.js checks-43.js      only the files named
//   SHARD=2/6 node tests/app/run.js         only the 2nd of 6 equal-length parts (GitHub runs the
//                                           6 parts side by side, so all checks take ~3 minutes)
const { spawnSync } = require('child_process');
const path = require('path');
const FILES = ['checks-setup.js', 'checks-restore.js', 'checks-answers.js', 'checks-rows.js', 'checks-previews.js', 'checks-new.js', 'checks-look.js', 'checks-43.js', 'checks-44.js', 'checks-47.js', 'checks-badge.js', 'checks-49.js', 'checks-410.js', 'checks-accts.js', 'checks-411.js', 'checks-414.js', 'checks-415.js', 'checks-416.js', 'checks-418.js', 'checks-421.js', 'checks-422.js', 'checks-423.js', 'checks-424.js', 'checks-postcheck.js', 'checks-reposts.js', 'checks-4302.js', 'checks-431.js', 'checks-tiktok.js', 'checks-forums.js', 'checks-433.js', 'checks-435.js', 'checks-stats.js', 'checks-signin.js', 'checks-ui1.js', 'checks-ui2.js', 'checks-ui3.js', 'checks-ui4.js', 'checks-ui5.js', 'checks-439.js', 'checks-440.js', 'checks-443.js', 'checks-444.js', 'checks-447.js', 'checks-ui6.js', 'checks-ui7.js', 'checks-ui8.js', 'checks-ui9.js', 'checks-speed.js', 'checks-stopped.js', 'speed.js'];
// About how long each file takes on GitHub, in seconds, so the parts come out even.
// A new file not listed here counts as 40 seconds: add it here once you know its time.
const TIMES = { 'checks-stopped.js': 5, 'checks-speed.js': 25, 'checks-ui9.js': 20, 'checks-447.js': 40, 'checks-ui8.js': 15, 'checks-ui7.js': 20, 'checks-ui6.js': 25, 'checks-443.js': 30, 'checks-444.js': 60, 'checks-439.js': 45, 'checks-440.js': 30, 'checks-ui5.js': 12, 'checks-ui4.js': 12, 'checks-ui3.js': 12, 'checks-ui2.js': 12, 'checks-ui1.js': 10, 'checks-signin.js': 8, 'checks-stats.js': 75, 'checks-435.js': 45, 'checks-433.js': 8, 'checks-forums.js': 30, 'checks-setup.js': 16, 'checks-restore.js': 7, 'checks-answers.js': 21, 'checks-rows.js': 90, 'checks-previews.js': 8, 'checks-new.js': 164, 'checks-look.js': 116, 'checks-43.js': 35, 'checks-44.js': 25, 'checks-47.js': 64, 'checks-badge.js': 7, 'checks-49.js': 40, 'checks-410.js': 15, 'checks-accts.js': 46, 'checks-411.js': 36, 'checks-414.js': 44, 'checks-415.js': 52, 'checks-416.js': 5, 'checks-418.js': 26, 'checks-421.js': 3, 'checks-422.js': 8, 'checks-423.js': 18, 'checks-424.js': 12, 'checks-postcheck.js': 6, 'checks-reposts.js': 15, 'checks-tiktok.js': 10, 'speed.js': 15 };
function pick() {
  const named = process.argv.slice(2);
  if (named.length) return named;
  const m = /^(\d+)\/(\d+)$/.exec(process.env.SHARD || '');
  if (!m) return FILES;
  const [k, n] = [+m[1], +m[2]], parts = Array.from({ length: n }, () => ({ t: 0, f: [] }));
  for (const f of [...FILES].sort((a, b) => (TIMES[b] || 40) - (TIMES[a] || 40))) {
    const p = parts.reduce((x, y) => (y.t < x.t ? y : x)); p.t += TIMES[f] || 40; p.f.push(f);
  }
  return FILES.filter(f => parts[k - 1].f.includes(f));
}
const RUN = pick();
let bad = 0;
for (const f of RUN) {
  let ok = false;
  for (let go = 1; go <= 2 && !ok; go++) {
    console.log('\n=== ' + f + (go > 1 ? ' (second try)' : '') + ' ===');
    const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', timeout: 15 * 60000 });
    const out = (r.stdout || '') + (r.stderr || '');
    console.log(out.split('\n').filter(l => /^(PASS|FAIL|PAGE ?ERROR|ERR|library|ALL|\d+ FAILED)/.test(l) || r.status !== 0).join('\n'));
    ok = r.status === 0 && !/^FAIL /m.test(out);
  }
  if (!ok) { bad++; console.log('>>> ' + f + ' FAILED'); }
}
console.log('\n' + (bad ? bad + ' of ' + RUN.length + ' check files FAILED.' : 'Every check passed (' + RUN.length + ' files).'));
process.exit(bad ? 1 : 0);
