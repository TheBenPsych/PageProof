// Runs every check in this folder. Used by GitHub before each release (see
// .github/workflows/release.yml), and by hand:  node tests/app/run.js
// A check that fails is tried once more, because a slow test computer can make one stumble.
const { spawnSync } = require('child_process');
const path = require('path');
const FILES = ['checks-setup.js', 'checks-restore.js', 'checks-answers.js', 'checks-rows.js', 'checks-previews.js', 'checks-new.js', 'checks-look.js', 'checks-43.js', 'checks-44.js', 'checks-47.js', 'checks-badge.js', 'checks-49.js', 'checks-410.js', 'checks-411.js', 'speed.js'];
let bad = 0;
for (const f of FILES) {
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
console.log('\n' + (bad ? bad + ' of ' + FILES.length + ' check files FAILED. Nothing is released.' : 'Every check passed.'));
process.exit(bad ? 1 : 0);
