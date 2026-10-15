const Conversations=globalThis.TweetHubConversations||(typeof module==='object'?require('./conversation.js'):null);
const Media=globalThis.TweetHubMedia||(typeof module==='object'?require('./media.js'):null);
function escapeHtml(value) {return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function safeUrl(value) {try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';}catch{return '';}}
function postUrl(value) {const url=safeUrl(value);return /^https:\/\/(?:x|twitter)\.com\/(?:\w{1,15}\/status|i\/web\/status)\/\d+(?:[/?#]|$)/.test(url)?url:'';}
function linkify(text) {
  const pattern=/https?:\/\/[^\s<>]+|(^|\s)([@#][\p{L}\p{N}_]+)/gu;
  let output='',last=0;
  for(const match of String(text).matchAll(pattern)) {
    output+=escapeHtml(String(text).slice(last,match.index));
    const token=match[0],prefix=match[1]||'',word=match[2];
    if(word) {const target=word[0]==='@'?'https://x.com/'+encodeURIComponent(word.slice(1)):'https://x.com/hashtag/'+encodeURIComponent(word.slice(1));output+=escapeHtml(prefix)+`<a href="${target}" target="_blank" rel="noopener noreferrer">${escapeHtml(word)}</a>`;}
    else {const url=safeUrl(token);output+=url?`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(token)}</a>`:escapeHtml(token);}
    last=match.index+token.length;
  }
  return output+escapeHtml(String(text).slice(last));
}
function formatDate(iso) {
  const date=new Date(iso);if(isNaN(date))return 'Date not captured';
  const diff=(Date.now()-date)/1000;
  if(diff>=0 && diff<60)return 'now';if(diff>=0 && diff<3600)return Math.floor(diff/60)+'m';if(diff>=0 && diff<86400)return Math.floor(diff/3600)+'h';
  return date.toLocaleDateString('en-US',{day:'numeric',month:'short',year:date.getFullYear()===new Date().getFullYear()?undefined:'numeric'});
}
function avatarUrl(profile={}) {if(safeUrl(profile.avatar))return safeUrl(profile.avatar);const match=location.hostname.match(/^([^.]+)\.github\.io$/);return match?'https://github.com/'+match[1]+'.png?size=200':'';}
function avatarHtml(profile,letter,cls='avatar') {const src=avatarUrl(profile);return src?`<img class="${cls}" src="${escapeHtml(src)}" alt="">`:`<div class="${cls}">${escapeHtml(letter)}</div>`;}
function postElementId(key) {return 'post-'+String(key).replace(/[^A-Za-z0-9_-]/g,'_');}

function mediaHtml(values=[]) {
  const media=values.map(Media.normalize).filter(Boolean);
  if(!media.length)return '';
  return `<div class="media n${Math.min(media.length,4)}">${media.map(item=>{
    const local=value=>/^media\/\d+\/[a-f0-9]{16}\.(?:mp4|jpe?g|png|webp|gif)$/.test(value||'')?value:'';
    const alt=escapeHtml(item.alt||'Post media'),poster=local(item.localPoster)||safeUrl(item.poster),src=local(item.localUrl)||safeUrl(item.url);
    if(item.type==='photo')return `<a class="media-item" href="${escapeHtml(src)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(src)}" loading="lazy" alt="${alt}"></a>`;
    const sources=(local(item.localUrl)?`<source src="${escapeHtml(src)}" type="video/mp4">`:'')+(item.variants||[]).filter(v=>v.content_type==='video/mp4').sort((a,b)=>(b.bitrate||0)-(a.bitrate||0)).map(v=>`<source src="${escapeHtml(v.url)}" type="video/mp4">`).join('')|| (src?`<source src="${escapeHtml(src)}" type="video/mp4">`:'');
    const gif=item.type==='animated_gif';
    return `<div class="media-item ${gif?'gif':'video'}">${sources?`<video ${gif?'autoplay loop muted':'controls'} playsinline preload="metadata" ${poster?`poster="${escapeHtml(poster)}"`:''} aria-label="${alt}">${sources}</video>`:poster?`<img src="${escapeHtml(poster)}" loading="lazy" alt="${alt}">`:''}${gif?'<span class="media-label">GIF</span>':''}${!sources?'<span class="media-label">Playback source not captured</span>':''}</div>`;
  }).join('')}</div>`;
}
function quoteHtml(quote) {if(!quote||typeof quote!=='object')return '';const url=postUrl(quote.url);return `<div class="quoted-post">${quote.handle?`<b>@${escapeHtml(quote.handle)}</b>`:''}<div class="text">${linkify(quote.text||'')}</div>${mediaHtml(quote.media||[])}${url?`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Quoted post ↗</a>`:''}</div>`;}
function cardHtml(card) {
  if(!card||typeof card!=='object')return '';
  const values=Array.isArray(card.binding_values)?Object.fromEntries(card.binding_values.map(x=>[x.key,x.value])):card.binding_values||{};
  const value=key=>values[key]?.string_value||'';
  const url=safeUrl(card.url||value('card_url')||value('vanity_url')),title=card.title||value('title'),description=card.description||value('description');
  const image=safeUrl(card.image||values.summary_photo_image_large?.image_value?.url||values.thumbnail_image_large?.image_value?.url);
  if(!title&&!description&&!image)return '';
  const contents=(image?`<img src="${escapeHtml(image)}" loading="lazy" alt="">`:'')+`<div>${title?`<b>${escapeHtml(title)}</b>`:''}${description?`<p>${escapeHtml(description)}</p>`:''}</div>`;
  return `<div class="link-card">${url?`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${contents}</a>`:contents}</div>`;
}

function postCard(post,profile={},opts={}) {
  const element=document.createElement('article'),node=opts.node;
  element.className='tweet'+(opts.cls?' '+opts.cls:'');
  if(node) {element.id=postElementId(node.key);element.dataset.postId=node.id||'';element.dataset.actor=node.actor;element.dataset.replyStatus=node.replyStatus;}
  const owner=post.handle&&profile.handle&&post.handle.toLowerCase()===profile.handle.toLowerCase();
  const name=owner?(profile.name||post.handle):(post.name||post.handle||'Author not captured'),handle=post.handle||'';
  const avatar=owner?avatarHtml(profile,(name||'?')[0]):safeUrl(post.avatar)?`<img class="avatar" src="${escapeHtml(safeUrl(post.avatar))}" alt="">`:`<div class="avatar">${escapeHtml((name||'?')[0])}</div>`;
  const url=postUrl(post.url);
  const parents=node&&opts.graph?[...node.parentIds].map(key=>opts.graph.nodes.get(key)):[];
  element.innerHTML=`<div class="side">${avatar}${opts.line?'<div class="line"></div>':''}</div><div class="body">
    <div class="meta"><b>${escapeHtml(name)}</b><span class="muted">${handle?'@'+escapeHtml(handle):''}</span><time class="muted" datetime="${escapeHtml(post.date||'')}" title="${escapeHtml(post.date||'')}">${escapeHtml(formatDate(post.date))}</time></div>
    ${node?`<div class="post-kind ${node.actor==='grok'?'grok':''}">${escapeHtml(node.missing?'Parent not captured':Conversations.label(node))}</div>`:''}
    ${parents.length?`<div class="reply-to">Replying to ${parents.map(parent=>`<a href="#${postElementId(parent.key)}">${parent.post.handle?'@'+escapeHtml(parent.post.handle):'post '+escapeHtml(parent.id||'')}</a>`).join(', ')}</div>`:node?.replyStatus==='reply'?'<div class="reply-to">Reply parent not captured.</div>':''}
    ${node?.missing?'<div class="text muted">Parent body not captured.</div>':typeof post.text==='string'?`<div class="text">${linkify(post.text)}</div>`:''}
    ${mediaHtml(Array.isArray(post.media)?post.media:[])}
    ${quoteHtml(post.quote||post.quotedTweet)}${cardHtml(post.card)}
    ${Array.isArray(post.poll?.options)?`<div class="poll">${post.poll.options.map(option=>`<div class="poll-option">${escapeHtml(option.label||'')}${Number.isFinite(option.votes)?` <span class="muted">${option.votes} votes</span>`:''}</div>`).join('')}</div>`:''}
    ${node?.captureStatus==='excerpt'?'<p class="capture-note">Captured excerpt · full text not saved.</p>':node?.actor==='grok'&&node.captureStatus!=='complete'?'<p class="capture-note">Capture completeness unconfirmed.</p>':''}
    ${node?.textVariants.length>1?`<details class="capture-versions"><summary>${node.textVariants.length} captured text versions</summary>${node.textVariants.map(text=>`<div class="text">${linkify(text)}</div>`).join('')}</details>`:''}
    ${Array.isArray(post.editHistory)&&post.editHistory.length?`<details class="capture-versions"><summary>Edited · ${post.editHistory.length} earlier version${post.editHistory.length>1?'s':''}</summary>${post.editHistory.map(v=>`<div class="text"><time class="muted" datetime="${escapeHtml(v.date||'')}">${escapeHtml(formatDate(v.date))}</time> ${linkify(v.text||'')}</div>`).join('')}</details>`:''}
    ${url?`<div class="actions"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">View on X ↗</a></div>`:''}</div>`;
  return element;
}
function renderConversation(conversation,graph,filter='all') {
  const wrapper=document.createElement('section');wrapper.className='thread';wrapper.dataset.conversationId=conversation.id;
  const saved=conversation.entries.filter(({node})=>!node.missing).length;
  if(conversation.entries.length>1) {const heading=document.createElement('h2');heading.className='thread-heading';heading.textContent='Conversation · '+saved+' saved entries';wrapper.appendChild(heading);}
  conversation.entries.forEach(({node},index)=>{const cls=node.missing?'context':Conversations.matches(node,filter)?'main':'context';wrapper.appendChild(postCard({...node.post,url:Conversations.nodesUrl(node)},graph.profile,{node,graph,cls,line:index<conversation.entries.length-1}));});
  const actions=document.createElement('div');actions.className='thread-actions';
  const button=document.createElement('button');button.className='copy-conversation';button.type='button';button.textContent=conversation.entries.length>1?'Copy conversation':'Copy entry';
  const status=document.createElement('span');status.className='muted small';status.setAttribute('role','status');
  button.onclick=async()=>{try{await navigator.clipboard.writeText(Conversations.transcript(conversation,graph));status.textContent='Copied';}catch{status.textContent='Clipboard unavailable';}};
  actions.append(button,status);wrapper.appendChild(actions);return wrapper;
}
function renderTweet(post,profile={}) {const graph=Conversations.build({profile,tweets:[post]});return renderConversation(graph.conversations[0],graph);}
if(typeof module==='object' && module.exports) module.exports={escapeHtml,safeUrl,postUrl,linkify,formatDate,postCard,renderTweet,renderConversation,postElementId,mediaHtml,quoteHtml,cardHtml};

