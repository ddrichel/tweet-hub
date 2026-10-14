const Graph=require('../conversation.js');
const Media=require('../media.js');
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const clone=value=>JSON.parse(JSON.stringify(value));
const dateFromId=id=>{try{return new Date(Number((BigInt(id)>>22n)+1288834974657n)).toISOString();}catch{return '';}};

function normalize(input,depth=0) {
  if(depth>50 || !input || typeof input!=='object' || Array.isArray(input)) throw new Error('Invalid conversation entry.');
  const post=clone(input), match=String(post.url||'').match(/^https:\/\/(?:x|twitter)\.com\/(\w{1,15}|i\/web)\/status\/(\d+)(?:[/?#]|$)/);
  if(own(post,'id') && typeof post.id!=='string') throw new Error('X IDs must be exact strings.');
  const id=Graph.identity(post);
  if(!id) throw new Error('A canonical X post ID or URL is required.');
  if(match && post.id && post.id!==match[2]) throw new Error('Post ID and URL disagree.');
  post.id=id;
  if(post.text!=null && typeof post.text!=='string') throw new Error('Post text must be a string.');
  post.handle=String(post.handle||match&&match[1]!=='i/web'&&match[1]||'').replace(/^@/,'');
  if(post.handle && !/^\w{1,15}$/.test(post.handle)) throw new Error('Invalid author handle.');
  const canonical='https://x.com/'+(post.handle||'i/web')+'/status/'+id;
  if(post.url && post.url!==canonical) post.sourceUrl=post.sourceUrl||post.url;
  post.url=canonical;
  if(!post.date || isNaN(Date.parse(post.date))) {post.date=dateFromId(id);post.dateSource='x-id-snowflake';}
  if(post.media && !Array.isArray(post.media)) throw new Error('Post media must be an array.');
  post.media=post.media||[];
  if(own(post,'inReplyTo') && post.inReplyTo!==null) post.inReplyTo=normalize(post.inReplyTo,depth+1);
  for(const field of ['replies','capturedPosts','captures']) {
    if(own(post,field) && !Array.isArray(post[field])) throw new Error(field+' must be an array.');
    if(post[field]) post[field]=post[field].map(value=>normalize(value,depth+1));
  }
  if(post.replyToId!=null && (typeof post.replyToId!=='string' || !/^\d+$/.test(post.replyToId))) throw new Error('Reply parent IDs must be exact strings.');
  const parent=post.inReplyTo&&post.inReplyTo.id;
  if(parent && post.replyToId && parent!==post.replyToId) throw new Error('Reply parent references disagree.');
  if(parent) post.replyToId=parent;
  if(post.replyStatus && !['post','reply','unknown'].includes(post.replyStatus)) throw new Error('Invalid reply status.');
  if(post.replyStatus==='post' && post.replyToId) throw new Error('A standalone post cannot also identify a reply parent.');
  post.replyStatus=post.replyToId?'reply':post.replyStatus||'unknown';
  return post;
}

function merge(existing,incoming) {
  const result=clone(existing), conflicts=[];
  for(const [key,value] of Object.entries(incoming)) {
    if(key==='captures') continue;
    if(key==='media') result.media=Media.merge(result.media||[],value||[]);
    else if(key==='source' && value && result.source && JSON.stringify(result.source)!==JSON.stringify(value)) {
      result.sourceCaptures=Array.isArray(result.sourceCaptures)?result.sourceCaptures:[];
      if(!result.sourceCaptures.some(source=>JSON.stringify(source)===JSON.stringify(value)))result.sourceCaptures.push(clone(value));
    }
    else if(key==='replies' || key==='capturedPosts') {
      result[key]=Array.isArray(result[key])?result[key]:[];
      for(const child of value) {const index=result[key].findIndex(saved=>Graph.identity(saved)===Graph.identity(child));if(index<0)result[key].push(clone(child));else result[key][index]=merge(result[key][index],child);}
    } else if(key==='inReplyTo' && value && result[key] && Graph.identity(value)===Graph.identity(result[key])) result[key]=merge(result[key],value);
    else if(!own(result,key) || result[key]===null || result[key]==='' || result[key]==='unknown') result[key]=clone(value);
    else if(JSON.stringify(result[key])!==JSON.stringify(value) && !['source','sourceUrl','dateSource'].includes(key)) conflicts.push(key);
  }
  if(conflicts.length) {
    const snapshot=clone(incoming);delete snapshot.captures;
    result.captures=Array.isArray(result.captures)?result.captures:[];
    if(!result.captures.some(capture=>JSON.stringify(capture)===JSON.stringify(snapshot))) result.captures.push(snapshot);
  }
  for(const capture of incoming.captures||[]) {
    result.captures=Array.isArray(result.captures)?result.captures:[];
    if(!result.captures.some(saved=>JSON.stringify(saved)===JSON.stringify(capture))) result.captures.push(clone(capture));
  }
  return result;
}

function upsert(data,payload) {
  const entries=Array.isArray(payload)?payload:[payload], before=JSON.stringify(data), result=clone(data);
  result.tweets=Array.isArray(result.tweets)?result.tweets:[];
  let added=0,updated=0;
  for(const input of entries) {
    const post=normalize(input), candidates=[post,...(post.capturedPosts||[])];
    for(const candidate of candidates) {
      if(typeof candidate.text!=='string' && !candidate.media.length) continue;
      const index=result.tweets.findIndex(saved=>Graph.identity(saved)===candidate.id);
      if(index<0) {result.tweets.push(candidate);added++;}
      else {const merged=merge(result.tweets[index],candidate);if(JSON.stringify(merged)!==JSON.stringify(result.tweets[index]))updated++;result.tweets[index]=merged;}
    }
  }
  if(added || updated) result.tweets.sort((a,b)=>Date.parse(b.date||'')-Date.parse(a.date||''));
  return {data:result,added,updated,changed:JSON.stringify(result)!==before};
}
module.exports={normalize,merge,upsert,dateFromId};

