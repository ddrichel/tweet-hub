// Renders one tweet in an X-like card. Shared by index.html and add.html (preview).
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function linkify(text) {
  return escapeHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|\s)#([\p{L}\p{N}_]+)/gu, '$1<a href="https://x.com/hashtag/$2" target="_blank" rel="noopener">#$2</a>')
    .replace(/(^|\s)@(\w{1,15})/g, '$1<a href="https://x.com/$2" target="_blank" rel="noopener">@$2</a>');
}

function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return 'jetzt';
  if (diff < 3600) return Math.floor(diff / 60) + ' Min.';
  if (diff < 86400) return Math.floor(diff / 3600) + ' Std.';
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

function renderTweet(t, profile = {}) {
  const el = document.createElement('article');
  el.className = 'tweet';
  const name = profile.name || t.name || '';
  const handle = t.handle || profile.handle || '';
  const media = (t.media || []).filter(u => /^https:\/\//.test(u)).slice(0, 4);
  el.innerHTML = `
    <div class="avatar">${escapeHtml((name || handle || '?')[0])}</div>
    <div class="body">
      <div class="meta">
        <b>${escapeHtml(name)}</b>
        <span class="muted">${handle ? '@' + escapeHtml(handle) : ''} · ${escapeHtml(formatDate(t.date))}</span>
      </div>
      <div class="text">${linkify(t.text || '')}</div>
      ${media.length ? `<div class="media n${media.length}">${media.map(u => `<img src="${escapeHtml(u)}" loading="lazy" alt="">`).join('')}</div>` : ''}
      ${t.url ? `<div class="actions"><a href="${escapeHtml(t.url)}" target="_blank" rel="noopener">Auf X ansehen ↗</a></div>` : ''}
    </div>`;
  return el;
}
