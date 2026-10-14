// Keep a file copy of each captured photo, GIF/video and poster alongside its source URLs.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),Media=require('../media.js');
function assetPath(id,url,video=false){const parsed=new URL(url),extension=video?'mp4':parsed.searchParams.get('format')||parsed.pathname.match(/\.(jpe?g|png|webp|gif)$/i)?.[1]||'jpg';return 'media/'+id+'/'+crypto.createHash('sha256').update(url).digest('hex').slice(0,16)+'.'+extension;}
function plan(data){const tasks=[],active=new Set();
  function visit(post){if(!post||typeof post!=='object'||active.has(post))return;active.add(post);
    post.media=(post.media||[]).map(value=>{const media=Media.normalize(value);if(!media)return value;const stored=typeof value==='string'?{...media}:value;
      if(media.url)tasks.push({id:post.id,url:media.url,file:assetPath(post.id,media.url,media.type!=='photo'),field:'localUrl',media:stored});
      if(media.poster&&media.poster!==media.url)tasks.push({id:post.id,url:media.poster,file:assetPath(post.id,media.poster),field:'localPoster',media:stored});return stored;});
    visit(post.inReplyTo);visit(post.quote);for(const field of ['replies','captures','capturedPosts'])for(const item of post[field]||[])visit(item);
    active.delete(post);
  }for(const post of data.tweets||[])visit(post);return tasks;}
async function main(){const data=JSON.parse(fs.readFileSync('tweets.json','utf8')),tasks=plan(data),cache=new Map();let saved=0,failed=0;
  for(const task of tasks){try{
    if(!fs.existsSync(task.file)){fs.mkdirSync(path.dirname(task.file),{recursive:true});let bytes=cache.get(task.url);if(!bytes){const response=await fetch(task.url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('HTTP '+response.status);bytes=Buffer.from(await response.arrayBuffer());if(!bytes.length||bytes.length>90*1024*1024)throw new Error('Unsupported asset size');cache.set(task.url,bytes);}fs.writeFileSync(task.file,bytes);saved++;}
    task.media[task.field]=task.file;
  }catch(error){failed++;console.error('Source URL retained: '+task.id+' ('+error.message+')');}}
  fs.writeFileSync('tweets.json',JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify({saved,failed}));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exit(1);});
module.exports={assetPath,plan};
