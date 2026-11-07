// Disposable runner DB only. No auth/provider mocks, no Prisma interception.
const assert = require('node:assert/strict');
function guardedUrl(value, expectedPassword) {
  const u = new URL(value);
  assert.equal(u.protocol,'postgresql:');assert.equal(u.hostname,'127.0.0.1');
  assert.equal(u.port,'5432');assert.equal(u.pathname,'/threadly_android_gate');
  assert.equal(u.username,'gate');assert.match(expectedPassword||'',/^[a-f0-9]{48}$/);
  assert.equal(u.password,expectedPassword);
  assert.equal(u.search,'');assert.equal(u.hash,'');return value;
}
const puzzle='00000000-0000-4000-8000-000000000010';
const guests={resume:'real-gate-resume',solve:'real-gate-solve',exhausted:'real-gate-exhausted'};
async function main() {
 guardedUrl(process.env.DATABASE_URL,process.env.THREADLY_GATE_PASSWORD);assert.equal(process.env.NODE_OPTIONS||'','');
 const {PrismaClient}=require('@prisma/client');
 const db=new PrismaClient();
 try {
  if(process.argv[2]==='seed') {
   assert.equal(await db.puzzle.count(),0,'database must be empty, no destructive reset');
   const indexes=await db.$queryRawUnsafe("SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='guesses_puzzle_player_clue_uq'");
   assert.equal(indexes.length,1);assert.match(indexes[0].indexdef,/UNIQUE INDEX/);assert.match(indexes[0].indexdef,/WHERE \(player_key IS NOT NULL\)/);
   const today=new Date();today.setUTCHours(0,0,0,0);
   await db.puzzle.create({data:{id:puzzle,title:'Real isolated integration',answer:'sentinel-answer',difficulty:1,status:'published',publishedDate:today,clues:{create:['First clue','Second clue','Third clue','Fourth clue','Fifth clue'].map((clueText,i)=>({clueOrder:i+1,clueText}))}}});
   for(const [kind,guestId] of Object.entries(guests)) {
    const count=kind==='exhausted'?5:1;
    for(let clueNumber=1;clueNumber<=count;clueNumber++)await db.guess.create({data:{puzzleId:puzzle,guestId,playerKey:'g:'+guestId,guessText:'wrong',isCorrect:false,clueNumber}});
   }
   for(const [name,orders] of [['short',[1,2]],['duplicate',[1,2,3,4,4]],['gap',[1,2,3,4,6]]]) {
    await db.puzzle.create({data:{id:'malformed-'+name,title:'Invalid synthetic only',answer:'sentinel-answer',difficulty:1,status:'published',clues:{create:orders.map(clueOrder=>({clueOrder,clueText:'Malformed clue'}))}}});
   }
   console.log('PASS empty disposable DB seed and reviewed partial unique index');
  } else if(process.argv[2]==='verify') {
   assert.equal(await db.puzzle.count(),4);assert.equal(await db.user.count(),0);
   for(const [kind,guestId] of Object.entries(guests)) {
    const rows=await db.guess.findMany({where:{puzzleId:puzzle,guestId},orderBy:{clueNumber:'asc'}});
    assert.equal(rows.length,kind==='resume'?1:kind==='exhausted'?5:2);assert.equal(rows.filter(r=>r.isCorrect).length,kind==='solve'?1:0);
    assert.deepEqual(rows.map(r=>r.clueNumber),kind==='resume'?[1]:kind==='exhausted'?[1,2,3,4,5]:[1,2]);
    assert(rows.every(r=>r.playerKey==='g:'+guestId));
    const stats=await db.stats.findMany({where:{guestId}});
    const streak=await db.streak.findMany({where:{guestId}});
    const scores=await db.leaderboardEntry.findMany({where:{guestId}});
    if(kind==='solve') {
     assert.equal(rows[1].guessText,'sentinel-answer');
     assert.equal(stats.length,1);assert.equal(stats[0].gamesPlayed,1);assert.equal(stats[0].gamesWon,1);assert.equal(Number(stats[0].averageClues),2);
     assert.equal(streak.length,1);assert.equal(streak[0].currentStreak,1);assert.equal(streak[0].bestStreak,1);
     assert.equal(scores.length,1);assert.equal(scores[0].score,80);
    } else {assert.equal(stats.length,0);assert.equal(streak.length,0);assert.equal(scores.length,0);}
   }
   assert.equal(await db.guess.count(),8);assert.equal(await db.stats.count(),1);assert.equal(await db.leaderboardEntry.count(),1);
   assert.equal(await db.guess.count({where:{guestId:'malformed-probe'}}),0);
   console.log('PASS real PostgreSQL poststate: eight guesses, one +80 award, one completed game, no duplicate or cross-guest effects');
  } else throw Error('unknown DB gate mode');
 } finally {await db.$disconnect();}
}
module.exports={guardedUrl};
if(require.main===module)main().catch(e=>{console.error('Local DB assertion failed: '+e.name);process.exitCode=1;});
