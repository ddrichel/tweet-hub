const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),{execFileSync}=require('child_process');
const Graph=require('../conversation.js'),Data=require('../scripts/post-data.js'),Render=require('../render.js');
const root=path.resolve(__dirname,'..'),profile={name:'owner',handle:'owner'};
const entry=(id,text,handle='owner',extra={})=>({id,url:'https://x.com/'+handle+'/status/'+id,handle,text,date:'2026-10-14T09:00:00Z',media:[],...extra});
const source=()=>JSON.parse(fs.readFileSync(path.join(root,'tweets.json'),'utf8'));

test('all recorded canonical IDs and recursive conversation edges survive graph assembly',()=>{
  const data=source(),before=JSON.stringify(data),ids=new Set(),bodyIds=new Set(),edgeKeys=new Set();
  function visit(post,parent=null){ids.add(post.id);if(typeof post.text==='string'||post.media?.length)bodyIds.add(post.id);if(parent)edgeKeys.add(parent+'>'+post.id);if(post.inReplyTo){edgeKeys.add(post.inReplyTo.id+'>'+post.id);visit(post.inReplyTo);}if(post.replyToId){ids.add(post.replyToId);edgeKeys.add(post.replyToId+'>'+post.id);}for(const reply of post.replies||[])visit(reply,post.id);for(const capture of [...post.captures||[],...post.capturedPosts||[]])visit(capture);}
  data.tweets.forEach(post=>visit(post));
  const graph=Graph.build(data);assert.equal(graph.stats.savedEntries,bodyIds.size);assert.equal(graph.edges.size,edgeKeys.size);assert.equal(JSON.stringify(data),before);
  assert.deepEqual([...graph.nodes.keys()].sort(),[...ids].sort());
  const sequence=['2109756805530484933','2109757122904805855','2109758584611274996','2109758873993195744','2109760355308130367','2109760465815376271'];
  const conversation=graph.conversations.find(item=>item.entries.some(({node})=>node.id===sequence[0]));
  assert.deepEqual(conversation.entries.map(({node})=>node.id),sequence);
  for(let index=1;index<sequence.length;index++)assert.ok(graph.edges.has(sequence[index-1]+'>'+sequence[index]));
  assert.equal(graph.stats.grok,10);assert.equal(graph.stats.other,3);assert.ok(graph.stats.replies>=18);assert.ok(graph.stats.selfReplies>=10);
});

test('reply status requires source evidence and external speakers stay distinct',()=>{
  const graph=Graph.build({profile,tweets:[entry('1','unconfirmed'),entry('2','unknown'),entry('3','confirmed','owner',{replyToId:null,replyStatus:'post'}),entry('4','self','owner',{inReplyTo:entry('3','confirmed','owner',{replyStatus:'post'}),replies:[entry('5','answer','grok')]})]});
  assert.equal(graph.nodes.get('2').replyStatus,'unknown');assert.equal(graph.nodes.get('3').replyStatus,'post');assert.equal(graph.nodes.get('4').selfReply,true);assert.equal(graph.nodes.get('5').actor,'grok');
  assert.equal(Graph.select(graph,'grok').length,1);assert.equal(Graph.select(graph,'grok')[0].entries.length,3);
});

test('missing parents are references, with no invented text or author',()=>{
  const graph=Graph.build({profile,tweets:[entry('2110311314060918877','reply','owner',{replyToId:'2110310426944647275'})]});
  const missing=graph.nodes.get('2110310426944647275');assert.equal(missing.missing,true);assert.equal(missing.actor,'unknown');assert.equal(missing.post.text,undefined);
  assert.equal(graph.stats.savedEntries,1);assert.equal(graph.stats.missingParents,1);assert.match(Graph.transcript(graph.conversations[0],graph),/Parent body not captured/);
});

test('conflicting captures and cyclic relationships remain inspectable',()=>{
  const graph=Graph.build({profile,tweets:[entry('1','one','owner',{replyToId:'2'}),entry('2','two','grok',{replyToId:'1'}),entry('1','one longer','owner',{replyToId:'3'})]});
  assert.equal(graph.nodes.get('1').textVariants.length,2);assert.equal(graph.nodes.get('1').parentIds.size,2);assert.ok(graph.warnings.some(w=>w.kind==='multiple_parents'));
  assert.equal(new Set(graph.conversations[0].entries.map(({node})=>node.key)).size,3);assert.equal(graph.edges.size,3);
});

test('normalization preserves exact text and recursive payload fields; IDs cannot lose digits',()=>{
  const text=' \n@owner … & <tag>\n ',payload=entry('2110311314060918877',text,'owner',{custom:{source:'retained'},inReplyTo:entry('2110310426944647275','root'),replies:[entry('2110310456944647275','Grok answer','grok',{replies:[entry('2110310486944647275','follow-up')]})]});
  const normalized=Data.normalize(payload);assert.equal(normalized.text,text);assert.deepEqual(normalized.custom,payload.custom);assert.equal(normalized.replies[0].replies[0].text,'follow-up');assert.equal(normalized.replyToId,payload.inReplyTo.id);
  assert.throws(()=>Data.normalize({...payload,id:2110311314060918877}),/exact strings/);assert.throws(()=>Data.normalize({...payload,url:'https://x.com/owner/status/999'}),/disagree/);
});

test('duplicate imports enrich parent/reply context and retain differing original text captures',()=>{
  const original=entry('2110311314060918877','original'),incoming={...original,text:'longer captured original',inReplyTo:entry('2110310426944647275','parent'),replies:[entry('2110310456944647275','answer','grok')]};
  const first=Data.upsert({profile,tweets:[original]},incoming);assert.equal(first.added,0);assert.equal(first.data.tweets[0].text,'original');assert.equal(first.data.tweets[0].inReplyTo.text,'parent');assert.equal(first.data.tweets[0].replies[0].handle,'grok');
  assert.equal(first.data.tweets[0].captures[0].text,incoming.text);assert.equal(Graph.build(first.data).nodes.get(original.id).post.text,incoming.text);
  const second=Data.upsert(first.data,incoming);assert.equal(second.changed,false);
});

test('issue ingestion saves nested Grok/self replies instead of dropping context',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tweet-hub-issue-'));
  try{
    fs.writeFileSync(path.join(dir,'tweets.json'),JSON.stringify({profile,tweets:[]}));
    const payload=entry('2110311314060918877','own reply','owner',{inReplyTo:entry('2110310426944647275','root'),replies:[entry('2110310456944647275','Grok exact body','grok',{replies:[entry('2110310486944647275','self follow-up')]})]});
    execFileSync(process.execPath,[path.join(root,'scripts/add-tweet.js')],{cwd:dir,env:{...process.env,TWEET_HUB_ENRICH:'0',ISSUE_BODY:'```json\n'+JSON.stringify(payload)+'\n```'}});
    const saved=JSON.parse(fs.readFileSync(path.join(dir,'tweets.json'),'utf8')),graph=Graph.build(saved);assert.equal(graph.stats.savedEntries,4);assert.equal(graph.nodes.get('2110310456944647275').post.text,'Grok exact body');assert.equal(saved.tweets[0].inReplyTo.id,payload.inReplyTo.id);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('archive import retains reply IDs, explicit standalone status and exact original source wording',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tweet-hub-archive-')),archive=path.join(dir,'archive/data');fs.mkdirSync(archive,{recursive:true});
  try{
    fs.writeFileSync(path.join(dir,'tweets.json'),JSON.stringify({profile,tweets:[]}));
    fs.writeFileSync(path.join(archive,'account.js'),'window.YTD.account.part0 = '+JSON.stringify([{account:{username:'owner',accountDisplayName:'Owner Account'}}]));
    const raw=' \nsource &amp; exact\n ',tweets=[{tweet:{id_str:'2110311314060918877',full_text:raw,created_at:'Wed Oct 14 09:00:00 +0000 2026',in_reply_to_status_id_str:'2110310426944647275',in_reply_to_screen_name:'grok'}},{tweet:{id_str:'2110310456944647275',full_text:'standalone',created_at:'Wed Oct 14 09:00:00 +0000 2026'}}];
    fs.writeFileSync(path.join(archive,'tweets.js'),'window.YTD.tweets.part0 = '+JSON.stringify(tweets));
    execFileSync(process.execPath,[path.join(root,'scripts/import-archive.js'),path.join(dir,'archive'),'--replies','--since','2026-01-01'],{cwd:dir});
    const saved=JSON.parse(fs.readFileSync(path.join(dir,'tweets.json'),'utf8')),reply=saved.tweets.find(item=>item.id===tweets[0].tweet.id_str),post=saved.tweets.find(item=>item.id===tweets[1].tweet.id_str);
    assert.equal(reply.replyToId,tweets[0].tweet.in_reply_to_status_id_str);assert.equal(reply.source.originalText,raw);assert.equal(reply.text,' \nsource & exact\n ');assert.equal(reply.inReplyTo.handle,'grok');assert.equal(post.replyStatus,'post');assert.equal(post.replyToId,null);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('render helpers keep unsafe URLs and markup out of HTML while preserving source text',()=>{
  assert.equal(Render.safeUrl('javascript:alert(1)'),'');assert.equal(Render.postUrl('https://example.org/owner/status/1'),'');assert.match(Render.linkify('<img src=x onerror=bad> @grok #AI'),/&lt;img/);assert.ok(!Render.linkify('https://example.org/" onclick="bad').includes('href="https://example.org/"'));
});

