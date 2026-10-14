// Imports posts from an X data archive into tweets.json.
// Usage: node scripts/import-archive.js <archive-folder> [--since YYYY-MM-DD] [--replies] [--retweets]
// The folder is the unzipped archive (contains data/tweets.js and data/account.js).
const fs = require('fs');
const path = require('path');
const {upsert}=require('./post-data.js');

const dir = process.argv[2];
const withReplies = process.argv.includes('--replies');
const withRetweets = process.argv.includes('--retweets');
// --since 2026-01-01: only posts from this date on (default: January 1 of the current year)
const sinceArg = process.argv[process.argv.indexOf('--since') + 1];
const since = new Date(process.argv.includes('--since') ? sinceArg : new Date().getFullYear() + '-01-01');
if (!dir) { console.error('Usage: node scripts/import-archive.js <archive-folder>'); process.exit(1); }

// Archive files are JS ("window.YTD.tweets.part0 = [...]"); read only the JSON part.
const readYtd = file => {
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw.slice(raw.indexOf('=') + 1).trim().replace(/;$/, ''));
};
const find = name => {
  const data = path.join(dir, 'data');
  return fs.readdirSync(data).filter(f => new RegExp('^' + name + '(-part\\d+)?\\.js$').test(f)).map(f => path.join(data, f));
};

let handle = '';
try {
  const acc = readYtd(find('account')[0])[0].account;
  handle = acc.username;
} catch {}

const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

const imported = [];
for (const file of find('tweets')) {
  for (const { tweet: t } of readYtd(file)) {
    const text0 = t.full_text || t.text || '';
    if (!withRetweets && text0.startsWith('RT @')) continue;
    if (!withReplies && t.in_reply_to_status_id_str) continue;
    if (new Date(t.created_at) < since) continue;
    const text = text0;
    const media = ((t.extended_entities || t.entities || {}).media || []);
    const parentId=t.in_reply_to_status_id_str||null, parentHandle=t.in_reply_to_screen_name||'';
    const post={
      id: t.id_str,
      url: handle ? `https://x.com/${handle}/status/${t.id_str}` : '',
      handle,
      text: decode(text),
      date: new Date(t.created_at).toISOString(),
      media: media.filter(m => m.type === 'photo').map(m => m.media_url_https),
      replyToId:parentId,replyStatus:parentId?'reply':'post',textStatus:'complete',
      source:{kind:'x-archive',file:path.basename(file),originalText:text0,originalDate:t.created_at,transformations:['HTML entity decoding']}
    };
    if(parentId) post.inReplyTo={id:parentId,handle:parentHandle,url:`https://x.com/${parentHandle||'i/web'}/status/${parentId}`,media:[],missing:true};
    imported.push(post);
  }
}

const data = JSON.parse(fs.readFileSync('tweets.json', 'utf8'));
const result=upsert(data,imported);
if (handle && !result.data.profile.handle) result.data.profile.handle = handle;
if (handle && !result.data.profile.name) result.data.profile.name = handle;
fs.writeFileSync('tweets.json', JSON.stringify(result.data, null, 2) + '\n');
console.log(`Imported ${result.added} new entries; enriched ${result.updated} (${imported.length} archive entries after filters).`);
