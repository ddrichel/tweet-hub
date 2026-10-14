(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TweetHubMedia=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const safe=value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}};
  function normalize(value){
    if(typeof value==='string'){const url=safe(value);return url?{type:/\.mp4(?:[?#]|$)/i.test(url)?'video':'photo',url,alt:''}:null;}
    if(!value||typeof value!=='object')return null;
    const variants=(value.variants||value.video_info?.variants||[]).map(v=>({...v,url:safe(v.url||v.src),content_type:v.content_type||v.type||''})).filter(v=>v.url);
    const playable=variants.filter(v=>v.content_type==='video/mp4'||/\.mp4(?:[?#]|$)/i.test(v.url)).sort((a,b)=>(b.bitrate||0)-(a.bitrate||0))[0];
    const type=value.type==='animated_gif'||value.type==='gif'?'animated_gif':value.type==='video'||variants.length?'video':'photo';
    const poster=safe(value.poster||value.preview_image_url||value.media_url_https||value.media_url);
    const url=type==='photo'?safe(value.url||value.media_url_https||value.media_url):playable?.url||safe(value.src||(/\.mp4(?:[?#]|$)/i.test(value.url||'')?value.url:''));
    if(!url&&!poster)return null;
    return {...value,type,url,poster,variants,alt:String(value.alt||value.alt_text||value.ext_alt_text||''),width:value.width||value.original_info?.width,height:value.height||value.original_info?.height};
  }
  function key(value){const media=normalize(value);if(!media)return JSON.stringify(value);const u=media.type==='photo'?media.url:media.poster||media.url;try{const parsed=new URL(u);const pathname=parsed.hostname==='pbs.twimg.com'?parsed.pathname.replace(/\.(?:jpe?g|png|webp)$/i,''):parsed.pathname;return parsed.host+pathname;}catch{return u;}}
  function merge(...lists){const out=[],indices=new Map();for(const value of lists.flat()){const k=key(value);if(!indices.has(k)){indices.set(k,out.length);out.push(value);}else if(typeof value==='object'&&value){const index=indices.get(k),previous=out[index],merged=typeof previous==='string'?{...normalize(previous),...value}:{...previous,...value};if(previous.variants||value.variants)merged.variants=[...new Map([...(previous.variants||[]),...(value.variants||[])].map(v=>[v.url||v.src,v])).values()];out[index]=merged;}}return out;}
  function fromEntities(entries=[]){return entries.map(m=>({...m,type:m.type||'photo',url:m.type==='photo'?m.media_url_https||m.media_url||m.url:'',poster:m.type==='photo'?'':m.media_url_https||m.media_url||m.preview_image_url||'',variants:m.video_info?.variants||m.variants||[],alt:m.ext_alt_text||m.alt_text||'',width:m.original_info?.width||m.sizes?.large?.w,height:m.original_info?.height||m.sizes?.large?.h}));}
  function describe(value){const m=normalize(value);if(!m)return 'Media metadata: '+JSON.stringify(value);return (m.type==='animated_gif'?'GIF':m.type==='video'?'Video':'Image')+': '+(m.url||m.poster)+(m.alt?'\nAlt text: '+m.alt:'')+(m.poster&&m.poster!==m.url?'\nPoster: '+m.poster:'')+(m.variants.length?'\nVariants: '+m.variants.map(v=>v.url).join(', '):'');}
  return {normalize,merge,fromEntities,describe,safe};
});
