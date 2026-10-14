(function(root, factory) {
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.TweetHubConversations=api;
})(typeof globalThis!=='undefined'?globalThis:this, function() {
  const Media=typeof module==='object'?require('./media.js'):globalThis.TweetHubMedia;
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  const handle=value=>String(value||'').replace(/^@/,'').toLowerCase();
  const id=value=>typeof value==='string' && /^\d+$/.test(value)?value:'';
  const urlId=value=>{const m=String(value||'').match(/^https:\/\/(?:x|twitter)\.com\/(?:[^/?#]+\/status|i\/web\/status)\/(\d+)(?:[/?#]|$)/);return m?m[1]:'';};
  const identity=value=>id(value.id)||urlId(value.url);
  const urlHandle=value=>{const m=String(value||'').match(/^https:\/\/(?:x|twitter)\.com\/(\w{1,15})\/status\/\d+/);return m?m[1]:'';};
  const time=value=>{const n=Date.parse(value||'');return Number.isFinite(n)?n:0;};

  function build(data={}) {
    const profile=data.profile||{}, owner=handle(profile.handle), nodes=new Map(), edges=new Map(), warnings=[];
    function add(record,path,listed=false) {
      if(!record || typeof record!=='object' || Array.isArray(record)) return null;
      const canonical=identity(record), key=canonical||'local:'+path;
      if(id(record.id) && urlId(record.url) && id(record.id)!==urlId(record.url)) warnings.push({kind:'id_url_conflict',id:canonical,path});
      let node=nodes.get(key);
      if(!node) {node={key,id:canonical||null,records:[],listed:false,parentIds:new Set(),childIds:new Set()};nodes.set(key,node);}
      node.records.push({record,path});node.listed=node.listed||listed;
      return node;
    }
    function placeholder(parentId,parentHandle='') {
      if(!nodes.has(parentId)) nodes.set(parentId,{key:parentId,id:parentId,records:[],listed:false,parentIds:new Set(),childIds:new Set(),hintHandle:parentHandle});
      return nodes.get(parentId);
    }
    function connect(child,parent,evidence) {
      if(!child || !parent) return;
      if(child.key===parent.key) {warnings.push({kind:'self_edge',id:child.id,evidence});return;}
      const key=parent.key+'>'+child.key;
      if(!edges.has(key)) edges.set(key,{parent:parent.key,child:child.key,evidence:[]});
      edges.get(key).evidence.push(evidence);child.parentIds.add(parent.key);parent.childIds.add(child.key);
    }
    const active=new Set();
    function visit(record,path,listed=false) {
      if(!record || typeof record!=='object' || active.has(record)) return null;
      active.add(record);
      const node=add(record,path,listed);
      if(!node) {active.delete(record);return null;}
      if(record.inReplyTo && typeof record.inReplyTo==='object') connect(node,visit(record.inReplyTo,path+'.inReplyTo'),path+'.inReplyTo');
      const parentId=id(record.replyToId)||id(record.in_reply_to_status_id_str)||id(record.in_reply_to_status_id);
      if(parentId) connect(node,placeholder(parentId,record.replyToHandle||record.in_reply_to_screen_name||''),path+'.replyToId');
      (Array.isArray(record.replies)?record.replies:[]).forEach((reply,index)=>connect(visit(reply,path+'.replies['+index+']'),node,path+'.replies['+index+']'));
      (Array.isArray(record.captures)?record.captures:[]).forEach((capture,index)=>visit(capture,path+'.captures['+index+']',listed));
      (Array.isArray(record.capturedPosts)?record.capturedPosts:[]).forEach((capture,index)=>visit(capture,path+'.capturedPosts['+index+']'));
      active.delete(record);return node;
    }
    (Array.isArray(data.tweets)?data.tweets:[]).forEach((record,index)=>visit(record,'tweets['+index+']',true));
    for(const node of nodes.values()) {
      const candidates=node.records.slice().sort((a,b)=>{
        const score=r=>(r.textStatus==='complete'?1000000:0)+(typeof r.text==='string'?r.text.length:0)+(Array.isArray(r.media)?r.media.length*100:0);
        return score(b.record)-score(a.record);
      });
      node.post={};
      for(const {record} of candidates) for(const [key,value] of Object.entries(record)) if(!own(node.post,key) && value!=null) node.post[key]=value;
      node.post.media=Media.merge(...candidates.map(({record})=>Array.isArray(record.media)?record.media:[]));
      node.post.id=node.id;node.post.handle=node.post.handle||urlHandle(node.post.url)||node.hintHandle||'';
      node.missing=!node.records.some(({record})=>typeof record.text==='string' || (Array.isArray(record.media) && record.media.length));
      node.actor=handle(node.post.handle)===owner && owner?'owner':handle(node.post.handle)==='grok'?'grok':node.post.handle?'other':'unknown';
      const states=node.records.map(({record})=>record.replyStatus).filter(value=>['post','reply','unknown'].includes(value));
      const explicitPost=node.records.some(({record})=>record.replyStatus==='post' || (own(record,'replyToId') && record.replyToId===null) || (own(record,'inReplyTo') && record.inReplyTo===null));
      node.replyStatus=node.parentIds.size || states.includes('reply')?'reply':explicitPost?'post':'unknown';
      node.selfReply=node.actor==='owner' && [...node.parentIds].some(key=>{const parent=nodes.get(key);return handle(parent.post?.handle||parent.hintHandle||parent.records[0]?.record.handle||urlHandle(parent.records[0]?.record.url))===owner;});
      node.captureStatus=node.post.textStatus==='complete'?'complete':node.records.some(({record})=>record.textStatus==='excerpt' || record.truncated===true)?'excerpt':'unconfirmed';
      node.textVariants=[...new Set(node.records.map(({record})=>record.text).filter(value=>typeof value==='string'))];
      if(node.parentIds.size>1) warnings.push({kind:'multiple_parents',id:node.id,parents:[...node.parentIds]});
      if(node.textVariants.length>1) warnings.push({kind:'multiple_text_captures',id:node.id});
      if(explicitPost && node.parentIds.size) warnings.push({kind:'reply_status_conflict',id:node.id});
    }
    const visited=new Set(), conversations=[];
    for(const start of nodes.values()) {
      if(visited.has(start.key)) continue;
      const queue=[start.key], keys=[];
      while(queue.length) {const key=queue.pop();if(visited.has(key))continue;visited.add(key);keys.push(key);const n=nodes.get(key);queue.push(...n.parentIds,...n.childIds);}
      const component=new Set(keys), ordered=[], seen=new Set(), visiting=new Set();
      const compare=(a,b)=>time(nodes.get(a).post.date)-time(nodes.get(b).post.date)||a.localeCompare(b);
      function walk(key,depth=0) {
        if(visiting.has(key)) {warnings.push({kind:'cycle',id:nodes.get(key).id});return;}
        if(seen.has(key)) return;
        visiting.add(key);seen.add(key);ordered.push({node:nodes.get(key),depth});
        [...nodes.get(key).childIds].filter(child=>component.has(child)).sort(compare).forEach(child=>walk(child,depth+1));visiting.delete(key);
      }
      keys.filter(key=>![...nodes.get(key).parentIds].some(parent=>component.has(parent))).sort(compare).forEach(key=>walk(key));
      keys.sort(compare).forEach(key=>walk(key));
      conversations.push({id:ordered[0]?.node.key,entries:ordered,latest:Math.max(...keys.map(key=>time(nodes.get(key).post.date)))});
    }
    conversations.sort((a,b)=>b.latest-a.latest||a.id.localeCompare(b.id));
    const saved=[...nodes.values()].filter(node=>!node.missing), owners=saved.filter(node=>node.actor==='owner');
    const stats={savedEntries:saved.length,ownerEntries:owners.length,posts:owners.filter(node=>node.replyStatus==='post').length,
      replies:owners.filter(node=>node.replyStatus==='reply').length,selfReplies:owners.filter(node=>node.selfReply).length,
      unknownReplyStatus:owners.filter(node=>node.replyStatus==='unknown').length,grok:saved.filter(node=>node.actor==='grok').length,
      other:saved.filter(node=>node.actor==='other').length,missingParents:[...nodes.values()].filter(node=>node.missing).length,
      unresolvedReplyParents:saved.filter(node=>node.replyStatus==='reply'&&!node.parentIds.size).length,conversations:conversations.length};
    return {profile,nodes,edges,conversations,stats,warnings};
  }

  function matches(node,filter='all') {
    if(node.missing) return false;
    if(filter==='posts') return node.actor==='owner' && node.replyStatus==='post';
    if(filter==='replies') return node.actor==='owner' && node.replyStatus==='reply';
    if(filter==='grok') return node.actor==='grok';
    return true;
  }
  function select(graph,filter='all') {return graph.conversations.filter(conversation=>conversation.entries.some(({node})=>matches(node,filter)));}
  function label(node) {return node.actor==='grok'?(node.replyStatus==='reply'?'Grok answer':node.replyStatus==='post'?'Grok post':'Grok · reply status unknown'):node.selfReply?'Self reply':node.replyStatus==='reply'?'Reply':node.replyStatus==='post'?'Post':'Reply status unknown';}
  function transcript(conversation,graph) {
    return conversation.entries.map(({node})=>{
      const author=node.post.handle?'@'+node.post.handle:'Author not captured';
      const parent=[...node.parentIds].map(key=>nodesUrl(graph.nodes.get(key))).join(', ');
      const text=node.missing?'[Parent body not captured]':typeof node.post.text==='string'?node.post.text:'';
      return [author+' · '+label(node),node.post.date||'',node.id?'X ID: '+node.id:'',parent?'Reply to: '+parent:'',text,
        ...(node.post.media||[]).map(value=>'Media: '+Media.describe(value)),node.post.quote?'Quoted post: '+(node.post.quote.url||'')+'\n'+(node.post.quote.text||'')+'\n'+(node.post.quote.media||[]).map(Media.describe).join('\n'):'',node.post.card?'Link card: '+JSON.stringify(node.post.card):'',node.post.poll?'Poll: '+JSON.stringify(node.post.poll):'',nodesUrl(node),node.captureStatus!=='complete'?'Capture completeness '+node.captureStatus:''].filter(value=>value!=='').join('\n');
    }).join('\n\n');
  }
  function nodesUrl(node) {return node?.post.url || (node?.id?'https://x.com/i/web/status/'+node.id:'');}
  return {build,select,matches,label,transcript,identity,nodesUrl};
});

