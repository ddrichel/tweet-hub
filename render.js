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

// One post card. `author` overrides the profile for posts by other accounts (e.g. a reply from @grok).
function postCard(t, profile, opts = {}) {
  const el = document.createElement('article');
  el.className = 'tweet' + (opts.cls ? ' ' + opts.cls : '');
  const other = t.handle && profile.handle && t.handle.toLowerCase() !== profile.handle.toLowerCase();
  const name = other ? (t.name || t.handle) : (profile.name || t.name || '');
  const handle = t.handle || profile.handle || '';
  const avatar = other
    ? (t.avatar ? `<img class="avatar" src="${escapeHtml(t.avatar)}" alt="">` : `<div class="avatar">${escapeHtml((name || '?')[0])}</div>`)
    : avatarHtml(profile, (name || handle || '?')[0]);
  const media = (t.media || []).filter(u => /^https:\/\//.test(u)).slice(0, 4);
  el.innerHTML = `
    <div class="side">${avatar}${opts.line ? '<div class="line"></div>' : ''}</div>
    <div class="body">
      <div class="meta">
        <b>${escapeHtml(name)}</b>
        <span class="muted">${handle ? '@' + escapeHtml(handle) : ''} · ${escapeHtml(formatDate(t.date))}</span>
      </div>
      ${opts.replyingTo ? `<div class="muted small">Replying to <a href="https://x.com/${escapeHtml(opts.replyingTo)}" target="_blank" rel="noopener">@${escapeHtml(opts.replyingTo)}</a></div>` : ''}
      ${t.text ? `<div class="text">${linkify(t.text)}</div>` : ''}
      ${media.length ? `<div class="media n${media.length}">${media.map(u => `<img src="${escapeHtml(u)}" loading="lazy" alt="">`).join('')}</div>` : ''}
      ${t.url ? `<div class="actions"><a href="${escapeHtml(t.url)}" target="_blank" rel="noopener">View on X ↗</a></div>` : ''}
    </div>`;
  return el;
}

// A post with its context: the post it replies to above, answers (e.g. from @grok) below.
function renderTweet(t, profile = {}) {
  const parent = t.inReplyTo;
  const replies = t.replies || [];
  if (!parent && !replies.length) return postCard(t, profile);
  const wrap = document.createElement('div');
  wrap.className = 'thread';
  if (parent) wrap.appendChild(postCard(parent, profile, { cls: 'context', line: true }));
  wrap.appendChild(postCard(t, profile, { cls: 'main', line: replies.length > 0, replyingTo: parent && parent.handle }));
  replies.forEach((r, i) => wrap.appendChild(postCard(r, profile, { cls: 'answer', line: i < replies.length - 1, replyingTo: t.handle || profile.handle })));
  return wrap;
}
