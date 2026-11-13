// Actual exported Next route + real owned PG/Prisma. Auth callback is an explicit test fixture, not provider proof.
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {readFileSync} from 'node:fs';
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
await test('current account deletion and replay boundary, actual route with owned PG',async t=>{
 try{
  await db.$executeRawUnsafe(readFileSync(new URL('../../prisma/drafts/guess_attempt_receipts.up.sql',import.meta.url),'utf8').replace(/--[^\n]*/g,'').replace('BEGIN;','').replace('COMMIT;',''));
  await t.test('deleted account cannot replay its committed receipt or write a new attempt',async()=>{
   const id='Delete-Replay-Account',puzzle_id='Delete-Replay-Puzzle';
   await db.user.create({data:{id,email:'delete-replay@example.invalid'}});await createPuzzle(puzzle_id);setFixtureSession({user:{id}});
   const p=await progress(puzzle_id);assert.equal(p.status,200);
   const input={action:'guess',puzzle_id,guess:'xyz-not-close',attempt_id:randomUUID(),expected_revision:p.body.revision};
   assert.equal((await call(input)).status,200);const before=await state(puzzle_id);assert.equal(before.receipts.length,1);assert.equal(before.guesses.length,1);
   await editor.user.delete({where:{id}});
   const deleted=await state(puzzle_id);assert.deepEqual(deleted.receipts,before.receipts);assert.equal(await observer.user.count({where:{id}}),0);
   for(const body of [input,{...input,attempt_id:randomUUID()},{action:'progress',puzzle_id}]){
    const response=await call(body);assert.equal(response.status,401);assert.equal(response.cache,'private, no-store');assert.equal(response.body.answer,undefined);assert.equal(response.body.correct,undefined);assert.deepEqual(await state(puzzle_id),deleted);
   }
  });
  await t.test('account FOR KEY SHARE blocks concurrent delete during commit, then delete succeeds after commit',async()=>{
   const id='Delete-Locked-Account',puzzle_id='Delete-Locked-Puzzle';
   await db.user.create({data:{id,email:'delete-locked@example.invalid'}});await createPuzzle(puzzle_id);setFixtureSession({user:{id}});
   const p=await progress(puzzle_id);assert.equal(p.status,200);const input={action:'guess',puzzle_id,guess:'synthetic answer',attempt_id:randomUUID(),expected_revision:p.body.revision};
   const acquired=pause(),release=pause();const holding=blocker.$transaction(async tx=>{await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended('threadly:attempt-quota:v1',0))");acquired.resolve();await release.promise;},{timeout:9000});await acquired.promise;
   let pending;
   try{
    pending=call(input);await waitingFor('%threadly:attempt-quota:v1%');
    await assert.rejects(editor.$transaction(async tx=>{await tx.$executeRawUnsafe("SET LOCAL lock_timeout='200ms'");await tx.$executeRawUnsafe('DELETE FROM users WHERE id=$1',id);}),e=>e.code==='P2010'&&e.meta?.code==='55P03');
    assert.equal(await observer.user.count({where:{id}}),1);
   }finally{release.resolve();await holding;}
   const response=await pending;assert.equal(response.status,200);assert.equal(response.body.correct,true);assert.equal(response.body.score_awarded,100);
   const committed=await state(puzzle_id);assert.equal(committed.receipts.length,1);assert.equal(committed.guesses.length,1);assert.equal(committed.guesses[0].userId,id);
   await editor.user.delete({where:{id}});assert.equal(await observer.user.count({where:{id}}),0);const deleted=await state(puzzle_id);assert.deepEqual(deleted.receipts,committed.receipts);
   assert.equal((await call(input)).status,401);assert.deepEqual(await state(puzzle_id),deleted);
  });
 }finally{setFixtureSession(null);await Promise.all([db,observer,editor,blocker].map(c=>c.$disconnect()));}
});
