const fs=require('fs'),Graph=require('../conversation.js');
const graph=Graph.build(JSON.parse(fs.readFileSync(process.argv[2]||'tweets.json','utf8')));
const reference=node=>({id:node.id,url:Graph.nodesUrl(node),handle:node.post.handle});
console.log(JSON.stringify({scope:'currently saved source data; X coverage is not exhaustive',stats:graph.stats,warnings:graph.warnings,
  unconfirmedReplyStatus:[...graph.nodes.values()].filter(node=>node.actor==='owner'&&node.replyStatus==='unknown').map(reference),
  unconfirmedGrokBodies:[...graph.nodes.values()].filter(node=>node.actor==='grok'&&node.captureStatus!=='complete').map(reference),
  missingParentBodies:[...graph.nodes.values()].filter(node=>node.missing).map(reference)},null,2));
