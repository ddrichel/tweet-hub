// Privacy guard: fails when files contain private terms.
// Terms are stored only as SHA-256 hashes in privacy-terms.json, so the list itself reveals nothing.
// Add a term: node scripts/privacy-guard.js --add "term"
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execSync } = require('child_process');
const listFile = path.join(__dirname, 'privacy-terms.json');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const hashes = new Set(JSON.parse(fs.readFileSync(listFile, 'utf8')));

if (process.argv[2] === '--add') {
  hashes.add(sha(process.argv.slice(3).join(' ').toLowerCase().trim()));
  fs.writeFileSync(listFile, JSON.stringify([...hashes].sort(), null, 1) + '\n');
  console.log('Added.'); process.exit(0);
}

const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean)
  .filter(f => !/(^|\/)privacy-terms\.json$/.test(f));
let hits = 0;
for (const f of files) {
  let txt; try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
  if (txt.includes('\u0000')) continue; // binary file
  txt.split('\n').forEach((line, i) => {
    const w = line.toLowerCase().match(/[\p{L}\p{N}-]+/gu) || [];
    for (let n = 1; n <= 3; n++)
      for (let k = 0; k + n <= w.length; k++)
        if (hashes.has(sha(w.slice(k, k + n).join(' ')))) { console.log(`::error file=${f},line=${i + 1}::Private term found`); hits++; }
  });
}
if (hits) { console.log(`${hits} match(es), please remove.`); process.exit(1); }
console.log('Privacy check passed.');
