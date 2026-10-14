// Enrich known saved IDs from X's public embed payload. A failure never removes saved data.
const fs=require('fs'),Graph=require('../conversation.js'),Media=require('../media.js'),Data=require('./post-data.js');
function fromPayload(raw,url,capturedAt){
  if(!raw||typeof raw.id_str!=='string'||typeof raw.text!=='string')throw new Error('No public post payload');
  const codepoints=[...raw.text],range=raw.display_text_range;
  const text=Array.isArray(range)?codepoints.slice(range[0],range[1]).join(''):raw.text;
  const post={id:raw.id_str,url:'https://x.com/'+(raw.user?.screen_name||'i/web')+'/status/'+raw.id_str,handle:raw.user?.screen_name||'',name:raw.user?.name,avatar:raw.user?.profile_image_url_https,text,date:raw.created_at,
    media:Media.fromEntities(raw.mediaDetails||raw.extended_entities?.media||raw.entities?.media||[]),
    entities:raw.entities,card:raw.card,poll:raw.poll,editControl:raw.edit_control,
    source:{kind:'x-public-embed',url,capturedAt,originalText:raw.text,originalDate:raw.created_at,originalPayload:raw,transformations:Array.isArray(range)?['X display_text_range for displayed text; original text retained']:[]}};
  if(raw.quoted_tweet)post.quote=fromPayload(raw.quoted_tweet,url,capturedAt);
  if(raw.in_reply_to_status_id_str)post.replyToId=raw.in_reply_to_status_id_str;
  return Object.fromEntries(Object.entries(post).filter(([,v])=>v!==undefined));
}
async function main(){
  let data=JSON.parse(fs.readFileSync('tweets.json','utf8'));
  const graph=Graph.build(data),pending=process.argv.includes('--pending'),ids=[...graph.nodes.values()].filter(n=>n.id&&!n.missing&&(!pending||!n.records.some(({record})=>record.source?.kind==='x-public-embed'||(record.sourceCaptures||[]).some(source=>source.kind==='x-public-embed')))).map(n=>n.id);
  const file=process.argv.slice(2).find(value=>!value.startsWith('--')),saved=file?JSON.parse(fs.readFileSync(file,'utf8')):null;
  let read=0,failed=0,mediaPosts=0;
  for(const id of ids){
    const url='https://cdn.syndication.twimg.com/tweet-result?id='+id+'&lang=en&token=1';
    try{
      let raw,capturedAt;
      if(saved){const record=saved.find(r=>r.id===id);if(!record?.data){failed++;continue;}raw=record.data;capturedAt=record.capturedAt;}
      else{const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(response.status===429){console.error('X rate limit: stopped; saved data retained.');break;}if(!response.ok)throw new Error('HTTP '+response.status);raw=await response.json();capturedAt=new Date().toISOString();}
      if(raw.id_str!==id)throw new Error('Response ID mismatch');
      const incoming=fromPayload(raw,url,capturedAt),result=Data.upsert(data,incoming);data=result.data;read++;if(incoming.media.length)mediaPosts++;
    }catch(error){failed++;console.error('Unchanged '+id+': '+error.message);}
  }
  fs.writeFileSync('tweets.json',JSON.stringify(data,null,2)+'\n');
  console.log(JSON.stringify({read,failed,mediaPosts}));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exit(1);});
module.exports={fromPayload};
