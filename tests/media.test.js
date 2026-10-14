const test=require('node:test'),assert=require('node:assert/strict');
const Media=require('../media.js'),Graph=require('../conversation.js'),Data=require('../scripts/post-data.js'),Render=require('../render.js'),{fromPayload}=require('../scripts/hydrate-posts.js');
const image={type:'photo',url:'https://pbs.twimg.com/media/fixture.jpg',alt:'All of the meme text'};
const {assetPath,plan}=require('../scripts/mirror-media.js');
const gif={type:'animated_gif',poster:'https://pbs.twimg.com/tweet_video_thumb/fixture.jpg',variants:[{content_type:'video/mp4',bitrate:0,url:'https://video.twimg.com/tweet_video/fixture.mp4'}]};
const video={type:'video',poster:'https://pbs.twimg.com/ext_tw_video_thumb/fixture.jpg',variants:[{content_type:'video/mp4',bitrate:256000,url:'https://video.twimg.com/video/low.mp4'},{content_type:'video/mp4',bitrate:1024000,url:'https://video.twimg.com/video/high.mp4'}]};
test('later media enrichments survive old empty arrays and complete-text precedence',()=>{
  const old={id:'1',text:'Exact original',media:[],textStatus:'complete',handle:'owner'};
  const enriched=Data.upsert({profile:{handle:'owner'},tweets:[old]},{...old,media:[image,gif,video],textStatus:'unconfirmed',card:{title:'Original title'},quote:{id:'2',text:'Quoted text'}});
  const graph=Graph.build(enriched.data),post=graph.nodes.get('1').post;
  assert.equal(post.text,old.text);assert.equal(post.media.length,3);assert.equal(post.card.title,'Original title');assert.equal(post.quote.text,'Quoted text');
  assert.equal(Data.upsert(enriched.data,{...old,media:[image,gif,video],textStatus:'unconfirmed',card:{title:'Original title'},quote:{id:'2',text:'Quoted text'}}).changed,false);
  const copied=Graph.transcript(graph.conversations[0],graph);assert.match(copied,/GIF: https:\/\/video/);assert.match(copied,/Quoted text/);assert.ok(!copied.includes('[object Object]'));
});
test('same photo URL variants render once without losing alt text',()=>{
  const merged=Media.merge(['https://pbs.twimg.com/media/fixture?format=jpg&name=large'],[image]);
  assert.equal(merged.length,1);assert.equal(Media.normalize(merged[0]).alt,image.alt);
});
test('GIFs animate inline, videos have controls, and image text is not cropped',()=>{
  const html=Render.mediaHtml([image,gif,video]);assert.match(html,/autoplay loop muted/);assert.match(html,/controls/);assert.match(html,/playsinline/);assert.match(html,/All of the meme text/);assert.ok(!html.includes('[object Object]'));assert.match(html,/fixture.mp4/);
  assert.equal(Media.normalize(video).url,'https://video.twimg.com/video/high.mp4');
  assert.equal(Render.mediaHtml([{type:'photo',url:'javascript:alert(1)'}]),'');
});
test('public payload retains exact source text, GIF variants, quote, cards and publication time',()=>{
  const raw={id_str:'1',text:'Actual caption https://t.co/media',display_text_range:[0,14],created_at:'2026-10-14T10:00:00Z',user:{screen_name:'owner'},mediaDetails:[{type:'animated_gif',media_url_https:gif.poster,video_info:{variants:gif.variants}}],quoted_tweet:{id_str:'2',text:'Quote',created_at:'2026-10-14T09:00:00Z',user:{screen_name:'other'},mediaDetails:[{type:'photo',media_url_https:image.url}]},card:{title:'Card title'},poll:{options:[{label:'Option'}]},custom:'Retained raw field'};
  const post=fromPayload(raw,'https://cdn.syndication.twimg.com/tweet-result?id=1','2026-10-14T11:00:00Z');
  assert.equal(post.text,'Actual caption');assert.equal(post.source.originalText,raw.text);assert.deepEqual(post.source.originalPayload,raw);assert.equal(post.media[0].type,'animated_gif');assert.equal(post.quote.media.length,1);assert.equal(post.card.title,'Card title');assert.equal(post.poll.options[0].label,'Option');assert.equal(post.date,raw.created_at);
});
test('file-copy plan includes GIF playback and poster, and rendering prefers saved files',()=>{
  const data={tweets:[{id:'1',media:[gif],quote:{id:'2',media:[image]}}]},tasks=plan(data);
  assert.equal(tasks.length,3);assert.ok(tasks.some(x=>x.url.endsWith('.mp4')));assert.ok(tasks.some(x=>x.field==='localPoster'));assert.equal(assetPath('1',gif.variants[0].url,true),tasks[0].file);
  data.tweets[0].media[0].localUrl=tasks[0].file;data.tweets[0].media[0].localPoster=tasks[1].file;
  const html=Render.mediaHtml(data.tweets[0].media);assert.ok(html.includes('src="'+tasks[0].file+'"'));assert.ok(html.includes('poster="'+tasks[1].file+'"'));
});
