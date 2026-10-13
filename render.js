// Renders one post as an X-style card. Shared by index.html and add.html (preview).
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
  if (diff < 60) return 'now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

// Avatar: profile.avatar, or the GitHub picture of the repo owner (owner.github.io).
function avatarUrl(profile = {}) {
  if (profile.avatar) return profile.avatar;
  const m = location.hostname.match(/^([^.]+)\.github\.io$/);
  return m ? 'https://github.com/' + m[1] + '.png?size=200' : '';
}
function avatarHtml(profile, letter, cls = 'avatar') {
  const src = avatarUrl(profile);
  return src ? `<img class="${cls}" src="${escapeHtml(src)}" alt="">` : `<div class="${cls}">${escapeHtml(letter)}</div>`;
}

function renderTweet(t, profile = {}) {
  const el = document.createElement('article');
  el.className = 'tweet';
  const name = profile.name || t.name || '';
  const handle = t.handle || profile.handle || '';
  const media = (t.media || []).filter(u => /^https:\/\//.test(u)).slice(0, 4);
  el.innerHTML = `
    ${avatarHtml(profile, (name || handle || '?')[0])}
    <div class="body">
      <div class="meta">
        <b>${escapeHtml(name)}</b>
        <span class="muted">${handle ? '@' + escapeHtml(handle) : ''} · ${escapeHtml(formatDate(t.date))}</span>
      </div>
      <div class="text">${linkify(t.text || '')}</div>
      ${media.length ? `<div class="media n${media.length}">${media.map(u => `<img src="${escapeHtml(u)}" loading="lazy" alt="">`).join('')}</div>` : ''}
      ${t.url ? `<div class="actions"><a href="${escapeHtml(t.url)}" target="_blank" rel="noopener">View on X ↗</a></div>` : ''}
    </div>`;
  return el;
}
