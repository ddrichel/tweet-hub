function captureTweetPage(doc=document,page=location) {
  const articles=[...doc.querySelectorAll('article[data-testid="tweet"]')], status=(String(page.pathname||'').match(/\/status\/(\d+)/)||[])[1];
  const link=article=>{const time=article.querySelector('time');return time&&time.closest('a');};
  const text=node=>[...node.childNodes].map(child=>child.nodeType===3?child.textContent:child.tagName==='IMG'?(child.alt||''):child.tagName==='BR'?'\n':text(child)).join('');
  const webUrl=value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}};
  const mediaFrom=article=>{
    const images=[...article.querySelectorAll('img[src*="pbs.twimg.com/media"]')].filter(image=>!image.closest?.('[data-testid="quoteTweet"]'));
    const media=images.map(image=>({type:'photo',url:webUrl(image.currentSrc||image.src),alt:image.alt||'',width:image.naturalWidth||undefined,height:image.naturalHeight||undefined}));
    for(const video of article.querySelectorAll('video')) {
      if(video.closest?.('[data-testid="quoteTweet"]'))continue;
      const variants=[...video.querySelectorAll('source')].map(source=>({url:webUrl(source.src),content_type:source.type||'video/mp4'})).filter(source=>source.url);
      const src=webUrl(video.currentSrc||video.src);if(src&&!variants.some(value=>value.url===src))variants.push({url:src,content_type:'video/mp4'});
      const poster=webUrl(video.poster||video.getAttribute?.('poster')),gif=video.loop===true;
      media.push({type:gif?'animated_gif':'video',url:src,poster,variants,alt:video.getAttribute?.('aria-label')||'',width:video.videoWidth||undefined,height:video.videoHeight||undefined,sourceStatus:variants.length?'playable':'playback-not-exposed'});
    }
    return media;
  };
  const read=article=>{
    const anchor=link(article), url=anchor?anchor.href.split('?')[0]:'', id=(url.match(/\/status\/(\d+)/)||[])[1];
    if(!id)return null;
    const time=article.querySelector('time'),body=article.querySelector('[data-testid="tweetText"]'),replyContext=article.querySelector('[data-testid="replyingTo"]');
    const parentLink=replyContext&&[...replyContext.querySelectorAll('a[href]')].find(a=>/\/status\/\d+/.test(a.href));
    const parentId=article.getAttribute('data-in-reply-to-status-id')||article.getAttribute('data-reply-to-id')||(parentLink&&(parentLink.href.match(/\/status\/(\d+)/)||[])[1])||'';
    const handle=(url.match(/(?:x|twitter)\.com\/(\w{1,15})\/status/)||[])[1]||'';
    const excerpt=!!article.querySelector('[data-testid="tweet-text-show-more-link"]');
    const post={id,url,handle,text:body?text(body):'',date:time?time.getAttribute('datetime')||'':'',
      media:mediaFrom(article),
      replyStatus:parentId||replyContext?'reply':'unknown',textStatus:excerpt?'excerpt':'unconfirmed',
      source:{kind:'x-visible-dom',viewUrl:String(page.href||'').split('?')[0],capturedAt:new Date().toISOString(),coverage:'visible loaded entries; not a complete X conversation'}};
    if(parentId)post.replyToId=parentId;
    return post;
  };
  const entries=articles.map(read).filter(Boolean), selected=status?entries.find(entry=>entry.id===status):entries[0];
  if(!selected)throw new Error('No selected post found. Open its own X post page first.');
  if(status) {
    const byId=new Map(entries.map(entry=>[entry.id,entry])), keep=new Set(entries.filter(entry=>entry.handle.toLowerCase()===selected.handle.toLowerCase()||entry.handle.toLowerCase()==='grok').map(entry=>entry.id));
    for(const id of [...keep]) {let entry=byId.get(id);const seen=new Set();while(entry?.replyToId && !seen.has(entry.id)){seen.add(entry.id);keep.add(entry.replyToId);entry=byId.get(entry.replyToId);}}
    selected.capturedPosts=entries.filter(entry=>entry.id!==selected.id&&keep.has(entry.id));
  }
  return selected;
}
if(typeof module==='object' && module.exports)module.exports={captureTweetPage};

