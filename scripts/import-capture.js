const fs=require('fs');
const {upsert}=require('./post-data.js');
const file=process.argv[2];
if(!file) {console.error('Usage: node scripts/import-capture.js conversation.json');process.exit(1);}
try {
  const capture=JSON.parse(fs.readFileSync(file,'utf8')), data=JSON.parse(fs.readFileSync('tweets.json','utf8')), result=upsert(data,capture);
  if(result.changed)fs.writeFileSync('tweets.json',JSON.stringify(result.data,null,2)+'\n');
  console.log('Saved '+result.added+' new entries; enriched '+result.updated+' existing entries.');
} catch(error) {console.error(error.message);process.exit(1);}
