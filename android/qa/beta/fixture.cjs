// Runner-owned empty disposable loopback database only. No app/provider mocks.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {guardedUrl}=require('../real_db_gate.cjs');
async function main(){
 guardedUrl(process.env.DATABASE_URL,process.env.THREADLY_GATE_PASSWORD);
 assert(!process.env.NODE_OPTIONS&&!process.env.NODE_PATH);
 const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();
 const state=process.argv[3];
 try{
  if(process.argv[2]==='seed'){
   assert(!fs.existsSync(state));
   for(const table of ['puzzle','user','guess'])assert.equal(await db[table].count(),0);
   const markers=await db.$queryRaw`SELECT count(*)::int AS n FROM threadly_beta_target`;assert.equal(markers[0].n,0);
   const invite=crypto.randomBytes(32).toString('base64url'),hash=crypto.createHash('sha256').update(invite).digest('hex');
   const expires=Date.now()+3600000,target='threadly-native-beta-runner-'+process.env.GITHUB_RUN_ID;
   assert(/^threadly-native-beta-runner-[0-9]+$/.test(target));
   await db.$executeRaw`INSERT INTO threadly_beta_target(target_id,synthetic_only,expires_at) VALUES (${target},true,${new Date(expires)})`;
   await db.$executeRaw`INSERT INTO threadly_beta_invitation(code_hash,target_id,expires_at) VALUES (${hash},${target},${new Date(expires)})`;
   const date=new Date();date.setUTCHours(0,0,0,0);
   await db.puzzle.create({data:{id:'beta-native-owned',title:'Synthetic native beta fixture',answer:'synthetic connection',difficulty:1,status:'published',publishedDate:date,clues:{create:['one','two','three','four','five'].map((word,n)=>({clueOrder:n+1,clueText:'Synthetic native clue '+word}))}}});
   fs.writeFileSync(state,JSON.stringify({invite,expires,target}),{mode:0o600,flag:'wx'});
   console.log('::add-mask::'+invite);console.log('PASS one owned synthetic beta puzzle and one expiring invitation, no users/inherited data');
  }else if(process.argv[2]==='verify'){
   assert.equal(await db.user.count(),0);assert.equal(await db.puzzle.count(),1);
   const devices=await db.$queryRaw`SELECT guest_id,revoked FROM threadly_beta_device`;assert.equal(devices.length,1);assert(!devices[0].revoked);
   const guestId=devices[0].guest_id,rows=await db.guess.findMany({where:{guestId},orderBy:{clueNumber:'asc'}});
   assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.clueNumber),[1,2]);assert.deepEqual(rows.map(r=>r.isCorrect),[false,true]);assert(rows.every(r=>r.playerKey==='g:'+guestId));
   const stats=await db.stats.findMany({where:{guestId}});assert.equal(stats.length,1);assert.equal(stats[0].gamesPlayed,1);assert.equal(stats[0].gamesWon,1);
   const scores=await db.leaderboardEntry.findMany({where:{guestId}});assert.equal(scores.length,1);assert.equal(scores[0].score,80);
   const reqs=await db.$queryRaw`SELECT count(*)::int AS n FROM threadly_beta_request`;assert.equal(reqs[0].n,2);
   console.log('PASS actual PostgreSQL poststate: 1 device,2 ordered guesses,2 request receipts,one80-point award,one finished game,zero users');
  }else throw Error('invalid fixture mode');
 }finally{await db.$disconnect();}
}
main().catch(()=>{console.error('Owned synthetic beta fixture assertion failed');process.exitCode=1;});
