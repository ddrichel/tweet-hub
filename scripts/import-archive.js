// Importiert alle Tweets aus dem X-Datenarchiv in tweets.json.
// Aufruf: node scripts/import-archive.js <archiv-ordner> [--since JJJJ-MM-TT] [--replies] [--retweets]
// Der Ordner ist das entpackte Archiv (enthält data/tweets.js und data/account.js).
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
const withReplies = process.argv.includes('--replies');
const withRetweets = process.argv.includes('--retweets');
// --since 2026-01-01: nur Tweets ab diesem Datum (Standard: ab 1. Januar des laufenden Jahres)
const sinceArg = process.argv[process.argv.indexOf('--since') + 1];
const since = new Date(process.argv.includes('--since') ? sinceArg : new Date().getFullYear() + '-01-01');
if (!dir) { console.error('Aufruf: node scripts/import-archive.js <archiv-ordner>'); process.exit(1); }

// Die Archivdateien sind JS ("window.YTD.tweets.part0 = [...]") – nur den JSON-Teil lesen.
const readYtd = file => {
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw.slice(raw.indexOf('=') + 1).trim().replace(/;$/, ''));
};
const find = name => {
  const data = path.join(dir, 'data');
  return fs.readdirSync(data).filter(f => new RegExp('^' + name + '(-part\\d+)?\\.js$').test(f)).map(f => path.join(data, f));
};

let handle = '', name = '';
try {
  const acc = readYtd(find('account')[0])[0].account;
  handle = acc.username; name = acc.accountDisplayName || '';
} catch {}

const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

const imported = [];
for (const file of find('tweets')) {
  for (const { tweet: t } of readYtd(file)) {
    const text0 = t.full_text || t.text || '';
    if (!withRetweets && text0.startsWith('RT @')) continue;
    if (!withReplies && t.in_reply_to_status_id_str) continue;
    if (new Date(t.created_at) < since) continue;
    let text = text0;
    for (const u of (t.entities && t.entities.urls) || []) text = text.split(u.url).join(u.expanded_url);
    const media = ((t.extended_entities || t.entities || {}).media || []);
    for (const m of media) text = text.split(m.url).join('');
    imported.push({
      id: t.id_str,
      url: handle ? `https://x.com/${handle}/status/${t.id_str}` : '',
      handle,
      text: decode(text).trim(),
      date: new Date(t.created_at).toISOString(),
      media: media.filter(m => m.type === 'photo').map(m => m.media_url_https).slice(0, 4)
    });
  }
}

const data = JSON.parse(fs.readFileSync('tweets.json', 'utf8'));
data.tweets = data.tweets || [];
const known = new Set(data.tweets.map(t => t.id).filter(Boolean));
const fresh = imported.filter(t => !known.has(t.id));
data.tweets = data.tweets.concat(fresh).sort((a, b) => new Date(b.date) - new Date(a.date));
if (handle && !data.profile.handle) data.profile.handle = handle;
if (name && !data.profile.name) data.profile.name = name;
fs.writeFileSync('tweets.json', JSON.stringify(data, null, 2) + '\n');
console.log(`${fresh.length} neue Tweets importiert (${imported.length} im Archiv nach Filter), gesamt ${data.tweets.length}.`);
