// Reads the post (JSON in the issue's ```json block) and prepends it to tweets.json.
// If the text is missing (e.g. only a link from mobile), it is fetched via X's oEmbed endpoint.
const fs = require('fs');
const {normalize,upsert}=require('./post-data.js');

const decode = s => s
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<a [^>]*>(.*?)<\/a>/gi, '$1')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&mdash;/g, '—')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));

async function fromOembed(url) {
  const r = await fetch('https://publish.twitter.com/oembed?omit_script=1&dnt=1&url=' + encodeURIComponent(url));
  if (!r.ok) throw new Error('oEmbed ' + r.status);
  const j = await r.json();
  const p = (j.html.match(/<p[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '';
  return { text: decode(p), handle: (j.author_url || '').split('/').pop(),
    source:{kind:'x-oembed',capturedAt:new Date().toISOString(),originalHtml:p},textStatus:'unconfirmed' };
}

(async () => {
  const body = process.env.ISSUE_BODY || '';
  const m = body.match(/```json\s*([\s\S]*?)```/);
  let t;
  if (m) t = JSON.parse(m[1]);
  else { const u = (body.match(/https:\/\/(?:x|twitter)\.com\/\S+\/status\/\d+/) || [])[0]; t = { url: u }; }
  t.url = String(t.url || '').split('?')[0].replace('twitter.com', 'x.com');
  if (!/^https:\/\/x\.com\/[^/]+\/status\/\d+$/.test(t.url)) t.url = '';
  if(t.id!=null && typeof t.id!=='string') throw new Error('X IDs must be exact strings.');
  t.id = t.id || (t.url.match(/status\/(\d+)/) || [])[1] || '';
  t.handle = String(t.handle || (t.url.match(/x\.com\/([^/]+)\/status/) || [])[1] || '');

  if (!String(t.text || '').trim() && t.url) {
    const o = await fromOembed(t.url);
    t.text = o.text; t.handle = o.handle || t.handle; t.source=o.source;t.textStatus=o.textStatus;
  }
  const tweet=normalize(t);
  if (!(typeof tweet.text==='string' && tweet.text.trim()) && !tweet.media.length) { console.error('No post text or media found.'); process.exit(1); }

  const data = JSON.parse(fs.readFileSync('tweets.json', 'utf8'));
  const result=upsert(data,tweet);
  if(!result.changed) {console.log('Already present with the same captured context.');return;}
  fs.writeFileSync('tweets.json', JSON.stringify(result.data, null, 2) + '\n');
  console.log('Saved '+result.added+' new entries; enriched '+result.updated+' existing entries.');
})().catch(e => { console.error(e.message); process.exit(1); });
