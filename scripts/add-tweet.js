// Reads the post (JSON in the issue's ```json block) and prepends it to tweets.json.
// If the text is missing (e.g. only a link from mobile), it is fetched via X's oEmbed endpoint.
const fs = require('fs');

const decode = s => s
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<a [^>]*>(.*?)<\/a>/gi, '$1')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&mdash;/g, '—')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));

// Post ID → timestamp (snowflake)
const idToDate = id => { try { return new Date(Number((BigInt(id) >> 22n) + 1288834974657n)).toISOString(); } catch { return ''; } };

async function fromOembed(url) {
  const r = await fetch('https://publish.twitter.com/oembed?omit_script=1&dnt=1&url=' + encodeURIComponent(url));
  if (!r.ok) throw new Error('oEmbed ' + r.status);
  const j = await r.json();
  const p = (j.html.match(/<p[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '';
  return { text: decode(p).trim(), handle: (j.author_url || '').split('/').pop() };
}

(async () => {
  const body = process.env.ISSUE_BODY || '';
  const m = body.match(/```json\s*([\s\S]*?)```/);
  let t;
  if (m) t = JSON.parse(m[1]);
  else { const u = (body.match(/https:\/\/(?:x|twitter)\.com\/\S+\/status\/\d+/) || [])[0]; t = { url: u }; }
  t.url = String(t.url || '').split('?')[0].replace('twitter.com', 'x.com');
  if (!/^https:\/\/x\.com\/[^/]+\/status\/\d+$/.test(t.url)) t.url = '';
  t.id = String(t.id || (t.url.match(/status\/(\d+)/) || [])[1] || '');
  t.handle = String(t.handle || (t.url.match(/x\.com\/([^/]+)\/status/) || [])[1] || '');

  if (!String(t.text || '').trim() && t.url) {
    const o = await fromOembed(t.url);
    t.text = o.text; t.handle = t.handle || o.handle;
  }
  const date = t.date && !isNaN(new Date(t.date)) ? new Date(t.date).toISOString() : (t.id && idToDate(t.id)) || new Date().toISOString();
  const tweet = {
    id: t.id, url: t.url, handle: t.handle,
    text: String(t.text || ''),
    date,
    media: (t.media || []).filter(u => /^https:\/\/pbs\.twimg\.com\//.test(u)).slice(0, 4)
  };
  if (!tweet.text.trim()) { console.error('No post text found.'); process.exit(1); }

  const data = JSON.parse(fs.readFileSync('tweets.json', 'utf8'));
  data.tweets = data.tweets || [];
  if (data.tweets.some(x => (tweet.id && x.id === tweet.id) || (!tweet.id && x.text === tweet.text))) {
    console.log('Already present.'); return;
  }
  data.tweets.unshift(tweet);
  fs.writeFileSync('tweets.json', JSON.stringify(data, null, 2) + '\n');
  console.log('Added:', tweet.text.slice(0, 60));
})().catch(e => { console.error(e.message); process.exit(1); });
