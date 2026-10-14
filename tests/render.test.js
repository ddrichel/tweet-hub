const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const {captureTweetPage}=require('../capture.js');
const root=path.resolve(__dirname,'..');

class Element {
  constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.attributes={};this.className='';this._html='';this.classList={toggle:(name,enabled)=>{const values=new Set(this.className.split(' ').filter(Boolean));enabled?values.add(name):values.delete(name);this.className=[...values].join(' ');}};}
  set innerHTML(html){this._html=html;this.children=[];}
  get innerHTML(){return this._html;}
  appendChild(child){this.children.push(child);return child;}
  append(...children){this.children.push(...children);}
  setAttribute(name,value){this.attributes[name]=value;}
}
const descendants=element=>[element,...element.children.flatMap(descendants)];

test('actual feed script renders every unique saved body once and filters retain full context',async()=>{
  const ids=Object.fromEntries(['feed','name','handle','bio','avatar','count','coverage'].map(id=>[id,new Element()]));
  const buttons=['all','posts','replies','grok'].map(filter=>{const button=new Element('button');button.dataset.filter=filter;return button;});
  const data=JSON.parse(fs.readFileSync(path.join(root,'tweets.json'),'utf8'));
  const context=vm.createContext({console,URL,Date,Map,Set,document:{createElement:tag=>new Element(tag),getElementById:id=>ids[id],querySelectorAll:()=>buttons},
    location:{hostname:'ddrichel.github.io'},navigator:{clipboard:{writeText:async text=>{context.copied=text;}}},fetch:async()=>({ok:true,json:async()=>data})});
  for(const name of ['media.js','conversation.js','render.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context);
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]).join('\n');
  await vm.runInContext(inline,context);
  let cards=descendants(ids.feed).filter(element=>element.tag==='article');
  const canonical=new Set();function collect(post){canonical.add(post.id);if(post.replyToId)canonical.add(post.replyToId);if(post.inReplyTo)collect(post.inReplyTo);[...post.replies||[],...post.captures||[],...post.capturedPosts||[]].forEach(collect);}data.tweets.forEach(collect);
  assert.equal(cards.length,canonical.size);assert.equal(new Set(cards.map(card=>card.id)).size,cards.length);assert.ok(cards.every(card=>card.dataset.actor));assert.match(ids.coverage.textContent,/unconfirmed reply status/);
  buttons.find(button=>button.dataset.filter==='grok').onclick();
  const conversation=ids.feed.children.find(thread=>thread.dataset.conversationId==='2109756805530484933');assert.ok(conversation);
  const required=['2109756805530484933','2109757122904805855','2109758584611274996','2109758873993195744','2109760355308130367','2109760465815376271'];
  const rendered=descendants(conversation).filter(element=>element.tag==='article');assert.deepEqual(rendered.map(card=>card.dataset.postId),required);assert.equal(rendered.filter(card=>card.innerHTML.includes('Replying to')).length,5);
  const copy=descendants(conversation).find(element=>element.tag==='button');await copy.onclick();assert.equal((context.copied.match(/X ID:/g)||[]).length,6);
  for(const card of rendered)assert.ok(context.copied.includes(card.dataset.postId));
  buttons.find(button=>button.dataset.filter==='posts').onclick();assert.match(ids.feed.innerHTML,/No standalone posts have confirmed context/);
});

test('DOM capture preserves emoji/newlines and never infers reply edges from neighboring posts',()=>{
  function article(id,author,body,parent='',excerpt=false){
    const anchor={href:'https://x.com/'+author+'/status/'+id},time={closest:()=>anchor,getAttribute:()=> '2026-10-14T09:00:00Z'};
    return {getAttribute:name=>name==='data-in-reply-to-status-id'?parent:null,querySelector:selector=>selector==='time'?time:selector==='[data-testid="tweetText"]'?{childNodes:body}:selector==='[data-testid="tweet-text-show-more-link"]'&&excerpt?{}:null,querySelectorAll:()=>[]};
  }
  const text=value=>({nodeType:3,textContent:value}),articles=[article('2110310426944647275','owner',[text('parent-looking neighbor')]),
    article('2110311314060918877','owner',[text('exact '),{tagName:'IMG',alt:'🙂'},text('…'),{tagName:'BR'},text('line')],'2110310426944647275'),
    article('2110310456944647275','grok',[text('visible Grok body')],'',true)];
  const captured=captureTweetPage({querySelectorAll:()=>articles},{pathname:'/owner/status/2110311314060918877',href:'https://x.com/owner/status/2110311314060918877'});
  assert.equal(captured.text,'exact 🙂…\nline');assert.equal(captured.replyToId,'2110310426944647275');assert.equal(captured.capturedPosts.length,2);
  const grok=captured.capturedPosts.find(post=>post.handle==='grok');assert.equal(grok.replyStatus,'unknown');assert.equal(grok.replyToId,undefined);assert.equal(grok.textStatus,'excerpt');
  assert.match(captured.source.coverage,/not a complete X conversation/);
});

