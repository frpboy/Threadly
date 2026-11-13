// Actual exported Next route + real owned PG/Prisma. Auth callback is an explicit test fixture, not provider proof.
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {readFileSync} from 'node:fs';import http from 'node:http';
import {NextRequest} from 'next/server';import {POST} from '../../app/api/attempt-v2/route.ts';import {setFixtureSession} from './auth-fixture.mjs';import {db} from './owned-db.mjs';import {PrismaClient} from '@prisma/client';
const url=process.env.DATABASE_URL;if(!url||new URL(url).pathname!=='/threadly_integration_owned'||new URL(url).searchParams.get('host')!=='/work')throw Error('Owned socket target required');
const observer=new PrismaClient({datasources:{db:{url}}}),editor=new PrismaClient({datasources:{db:{url}}}),blocker=new PrismaClient({datasources:{db:{url}}}),origin='https://route-test.invalid',account='RouteAccount-A',other='RouteAccount-B';
Object.assign(process.env,{ATTEMPT_V2_ORIGIN:origin,ATTEMPT_V2_REVISION_KEY_HEX:'2b'.repeat(32),ATTEMPT_V2_REVISION_EPOCH:'fixture1',ATTEMPT_V2_MAX_TOTAL:'50',ATTEMPT_V2_MAX_OWNER:'50',ATTEMPT_V2_MAX_PUZZLE:'50'});
const call=async(body,headers={})=>{const response=await POST(new NextRequest(origin+'/api/attempt-v2',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)}));return {status:response.status,body:await response.json(),cache:response.headers.get('cache-control')};};
const pause=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function waitingFor(pattern){const end=Date.now()+2500;while(Date.now()<end){const rows=await observer.$queryRawUnsafe("SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE $1",pattern);if(rows[0].n>0)return;await new Promise(r=>setTimeout(r,10));}throw Error('Expected bounded SQL lock wait not observed');}
const progress=puzzle_id=>call({action:'progress',puzzle_id});
const createPuzzle=async id=>db.puzzle.create({data:{id,title:'Synthetic',difficulty:1,answer:'synthetic answer',status:'published',clues:{create:Array.from({length:5},(_,i)=>({clueOrder:i+1,clueText:'Synthetic '+i}))}}});
const state=async puzzleId=>({guesses:await observer.guess.findMany({where:{puzzleId},orderBy:{clueNumber:'asc'}}),receipts:await observer.$queryRawUnsafe('SELECT * FROM guess_attempt_receipts WHERE puzzle_id=$1',puzzleId),stats:await observer.stats.findMany(),leaderboard:await observer.leaderboardEntry.findMany()});
await test('actual account-attempt Next route owned database qualification',async t=>{
 try{
  await db.$executeRawUnsafe(readFileSync(new URL('../../prisma/drafts/guess_attempt_receipts.up.sql',import.meta.url),'utf8').replace(/--[^\n]*/g,'').replace('BEGIN;','').replace('COMMIT;',''));
  await db.user.createMany({data:[{id:account,email:'route-a@example.invalid'},{id:other,email:'route-b@example.invalid'}]});
  await createPuzzle('Route-Puzzle');
  await t.test('unauthenticated/body-forged identity denied; missing config and wrong Origin fail closed',async()=>{
   setFixtureSession(null);assert.equal((await call({action:'progress',puzzle_id:'Route-Puzzle',user_id:account})).status,401);
   setFixtureSession({user:{id:'Deleted-fixture-account'}});assert.equal((await progress('Route-Puzzle')).status,401);
   setFixtureSession({user:{id:account}});const key=process.env.ATTEMPT_V2_REVISION_KEY_HEX;delete process.env.ATTEMPT_V2_REVISION_KEY_HEX;assert.equal((await progress('Route-Puzzle')).status,503);process.env.ATTEMPT_V2_REVISION_KEY_HEX=key;
   assert.equal((await call({action:'progress',puzzle_id:'Route-Puzzle'},{Origin:'https://foreign.invalid'})).status,403);
   assert.equal(await observer.guess.count(),0);
  });
  await t.test('bounded JSON/body/UUID validation and private no-store progress without answer',async()=>{
   assert.equal((await call('x'.repeat(4097))).status,413);assert.equal((await call('{')).status,400);assert.equal((await call({action:'guess',puzzle_id:'Route-Puzzle',guess:'x',attempt_id:'not-uuid',expected_revision:'x'})).status,400);
   assert.equal((await call({action:'progress',puzzle_id:'Route-Puzzle'},{'Content-Type':'application/jsonp'})).status,415);
   const slow=await POST(new NextRequest(origin+'/api/attempt-v2',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:new ReadableStream({start(){}}),duplex:'half'}));assert.equal(slow.status,408);
   const p=await progress('Route-Puzzle');assert.equal(p.status,200);assert.equal(p.cache,'private, no-store');assert.equal(p.body.state,'open');assert.equal(p.body.answer,undefined);assert.match(p.body.revision,/^r1\.fixture1\./);
  });
  await t.test('actual wrongguess durable replay and changed-payload conflict; new key stale revision no clue consumption',async()=>{
   const p=await progress('Route-Puzzle');const input={action:'guess',puzzle_id:'Route-Puzzle',guess:'xyz-not-close',attempt_id:randomUUID(),expected_revision:p.body.revision,user_id:other,guest_id:'forged-guest'};
   const first=await call(input);assert.equal(first.status,200);assert.equal(first.body.correct,false);assert.equal(first.body.clues_used,1);assert.equal(first.body.answer,undefined);
   const committed=await state('Route-Puzzle');assert.equal(committed.guesses[0].userId,account);assert.equal(committed.receipts[0].player_key,'u:'+account);
   assert.deepEqual(await call(input),first);assert.deepEqual(await state('Route-Puzzle'),committed);
   assert.equal((await call({...input,guess:'different'})).status,409);assert.deepEqual(await state('Route-Puzzle'),committed);
   assert.equal((await call({...input,attempt_id:randomUUID()})).status,409);assert.equal((await state('Route-Puzzle')).guesses.length,1);
  });
  await t.test('account switch cannot read another account progress',async()=>{
   setFixtureSession({user:{id:other}});const p=await progress('Route-Puzzle');assert.equal(p.body.guesses.length,0);assert.equal(p.body.clue_number,1);setFixtureSession({user:{id:account}});
  });
  await t.test('actual Next route commits successful solve, HTTP response lost, same key recovers exact result without award duplication',async()=>{
   const puzzle_id='Route-Lost-Solve';await createPuzzle(puzzle_id);const p=await progress(puzzle_id);const input={action:'guess',puzzle_id,guess:'synthetic answer',attempt_id:randomUUID(),expected_revision:p.body.revision};
   let first=null,dropped=false;const socketPath='/work/next-route-http.sock';
   const server=http.createServer(async(req,res)=>{
    try{let text='';for await(const chunk of req)text+=chunk;const response=await call(text);if(!dropped){first=response;dropped=true;res.destroy();return;}res.writeHead(response.status,{'content-type':'application/json'});res.end(JSON.stringify(response.body));}catch{res.destroy();}
   });
   const send=()=>new Promise((resolve,reject)=>{const req=http.request({socketPath,path:'/api/attempt-v2',method:'POST',timeout:3000},res=>{let text='';res.on('data',x=>text+=x);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(text)}));res.on('error',reject);});req.on('timeout',()=>req.destroy(Error('bounded test timeout')));req.on('error',reject);req.end(JSON.stringify(input));});
   try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(socketPath,resolve);});await assert.rejects(send(),e=>e.code==='ECONNRESET');
    const committed=await state(puzzle_id);assert.equal(committed.guesses.length,1);assert.equal(committed.receipts.length,1);assert.equal(first.status,200);assert.equal(first.body.score_awarded,100);
    const replay=await send();assert.equal(replay.status,first.status);assert.deepEqual(replay.body,first.body);assert.deepEqual(await state(puzzle_id),committed);
   }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  });
  await t.test('pause-controlled answer/clue edit cannot change authorized puzzle between revision and gameplay',async()=>{
   const puzzle_id='Route-Locked-Edit';await createPuzzle(puzzle_id);const p=await progress(puzzle_id);const input={action:'guess',puzzle_id,guess:'synthetic answer',attempt_id:randomUUID(),expected_revision:p.body.revision};
   const acquired=pause(),release=pause();const holding=blocker.$transaction(async tx=>{await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended('threadly:attempt-quota:v1',0))");acquired.resolve();await release.promise;},{timeout:9000});await acquired.promise;
   let pending;
   try{
    pending=call(input);await waitingFor('%threadly:attempt-quota:v1%');
    // This point is AFTER actual production authorization acquired share locks and BEFORE apply.
    for(const sql of ["UPDATE puzzles SET answer='changed answer' WHERE id=$1","UPDATE clues SET clue_text='changed clue' WHERE puzzle_id=$1"]){
     await assert.rejects(editor.$transaction(async tx=>{await tx.$executeRawUnsafe("SET LOCAL lock_timeout='200ms'");await tx.$executeRawUnsafe(sql,puzzle_id);}),e=>e.code==='P2010'&&e.meta?.code==='55P03');
    }
   }finally{release.resolve();await holding;}
   const reply=await pending;assert.equal(reply.status,200);assert.equal(reply.body.correct,true);assert.equal(reply.body.score_awarded,100);
  });
  await t.test('pause-controlled hide commits before replay authorization, stored receipt cannot bypass visibility',async()=>{
   const puzzle_id='Route-Replay-Hide';await createPuzzle(puzzle_id);const p=await progress(puzzle_id);const input={action:'guess',puzzle_id,guess:'xyz-not-close',attempt_id:randomUUID(),expected_revision:p.body.revision};assert.equal((await call(input)).status,200);const committed=await state(puzzle_id);
   const changed=pause(),release=pause();const hiding=editor.$transaction(async tx=>{await tx.puzzle.update({where:{id:puzzle_id},data:{status:'draft'}});changed.resolve();await release.promise;},{timeout:9000});await changed.promise;
   let pending;
   try{pending=call(input);await waitingFor('%SELECT id FROM puzzles WHERE id=$1 FOR SHARE%');}finally{release.resolve();await hiding;}
   assert.equal((await pending).status,404);assert.deepEqual(await state(puzzle_id),committed);
  });
  await t.test('unpublished puzzle rejects even known receipt replay; no write fallback',async()=>{
   const puzzle_id='Route-Hidden';await createPuzzle(puzzle_id);const p=await progress(puzzle_id);const input={action:'guess',puzzle_id,guess:'xyz-not-close',attempt_id:randomUUID(),expected_revision:p.body.revision};assert.equal((await call(input)).status,200);
   await db.puzzle.update({where:{id:puzzle_id},data:{status:'draft'}});const committed=await state(puzzle_id);assert.equal((await call(input)).status,404);assert.deepEqual(await state(puzzle_id),committed);
  });
 }finally{setFixtureSession(null);await Promise.all([db,observer,editor,blocker].map(c=>c.$disconnect()));}
});
