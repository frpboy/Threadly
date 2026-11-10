import test from 'node:test';import assert from 'node:assert/strict';import {randomBytes,randomUUID} from 'node:crypto';
import {db} from './db.mjs';
import {deviceStore,verifyTarget,allowEnrollment} from '../../../apps/web/services/nativeBeta/store.ts';
import {enroll,authenticate,digest} from '../../../apps/web/services/nativeBeta/deviceAccess.mjs';
import {betaTransaction,RequestConflict} from '../../../apps/web/services/nativeBeta/guessRequest.ts';
import {submitGuess} from '../../../apps/web/services/guessTransaction.ts';
let device,config;
test('actual PG: concurrent enrollment atomic, no caller identity, revocation + target verification',async()=>{
 const now=Date.now();config={enabled:true,syntheticOnly:true,targetId:'threadly-native-beta-local-pg',expiresAt:now+3600000};
 await db.$executeRaw`INSERT INTO threadly_beta_target(target_id,synthetic_only,expires_at) VALUES (${config.targetId},true,${new Date(config.expiresAt)})`;
 assert(await verifyTarget(config.targetId,config.expiresAt));assert(!await verifyTarget('other',config.expiresAt));
 const invite=randomBytes(32).toString('base64url');
 await db.$executeRaw`INSERT INTO threadly_beta_invitation(code_hash,target_id,expires_at) VALUES (${digest(invite)},${config.targetId},${new Date(config.expiresAt)})`;
 const results=await Promise.all(Array.from({length:20},()=>enroll(invite,{store:deviceStore,config})));
 assert.equal(results.filter(Boolean).length,1);device=results.find(Boolean);
 const principal=await authenticate('Bearer '+device.token,{store:deviceStore,config});assert(principal);device.guestId=principal.guestId;
 assert.equal(await authenticate('Bearer '+invite,{store:deviceStore,config}),null);
 await db.$executeRaw`UPDATE threadly_beta_device SET revoked=true WHERE guest_id=${device.guestId}`;
 assert.equal(await authenticate('Bearer '+device.token,{store:deviceStore,config}),null);
 await db.$executeRaw`UPDATE threadly_beta_device SET revoked=false WHERE guest_id=${device.guestId}`;
 const rows=await db.$queryRaw`SELECT token_hash FROM threadly_beta_device`;assert.equal(rows.length,1);assert.equal(rows[0].token_hash,digest(device.token));
});
test('actual PG: global enrollment limit atomic across simultaneous calls',async()=>{
 const accepted=await Promise.all(Array.from({length:40},()=>allowEnrollment(config.targetId)));assert.equal(accepted.filter(Boolean).length,30);
});
test('actual PG: committed wrong response loss + same ID yields one clue, altered payload conflicts, rollback retry works',async()=>{
 await db.puzzle.create({data:{id:'beta-puzzle',title:'Synthetic test',answer:'synthetic',difficulty:1,status:'published',publishedDate:new Date()}});
 const requestId=randomUUID(),args={puzzleId:'beta-puzzle',playerKey:'g:'+device.guestId,guessText:'wrong',isCorrect:false,scoreFor:n=>100-n};
 const run=()=>submitGuess(betaTransaction(device.guestId,requestId,'beta-puzzle','wrong'),args);
 const out=await Promise.all(Array.from({length:8},run));assert(out.every(r=>r.outcome.cluesUsed===1));
 assert.equal(await db.guess.count(),1);
 await assert.rejects(submitGuess(betaTransaction(device.guestId,requestId,'beta-puzzle','changed'),{...args,guessText:'changed'}),RequestConflict);
 assert.equal(await db.guess.count(),1);
 const rollbackId=randomUUID();
 await assert.rejects(betaTransaction(device.guestId,rollbackId,'beta-puzzle','wrong2')(async uow=>{
   await uow.insertGuess('beta-puzzle',args.playerKey,{clueNumber:2,isCorrect:false,guessText:'wrong2',scoreAwarded:0});throw Error('synthetic rollback');
 }));
 assert.equal(await db.guess.count(),1);
 const retry=await submitGuess(betaTransaction(device.guestId,rollbackId,'beta-puzzle','wrong2'),{...args,guessText:'wrong2'});
 assert.equal(retry.outcome.cluesUsed,2);assert.equal(await db.guess.count(),2);
});
test('actual PG: solve retries award once, cross-device same request ID does not reveal another progress',async()=>{
 const id=randomUUID();const args={puzzleId:'beta-puzzle',playerKey:'g:'+device.guestId,guessText:'synthetic',isCorrect:true,scoreFor:()=>42};
 for(let n=0;n<3;n++)assert.equal((await submitGuess(betaTransaction(device.guestId,id,'beta-puzzle','synthetic'),args)).outcome.scoreAwarded,42);
 assert.equal(await db.guess.count(),3);
 const rows=await db.$queryRaw`SELECT count(*)::int AS n FROM threadly_beta_request`;assert.equal(rows[0].n,3);
 // Another principal cannot retrieve this player's cached result by presenting its request UUID.
 await db.$executeRaw`INSERT INTO threadly_beta_invitation(code_hash,target_id,expires_at) VALUES (${digest('other')},${config.targetId},${new Date(config.expiresAt)})`;
 await db.$executeRaw`INSERT INTO threadly_beta_device(token_hash,invitation_hash,guest_id,target_id,expires_at) VALUES (${digest('other')},${digest('other')},'beta-other',${config.targetId},${new Date(config.expiresAt)})`;
 const other=await submitGuess(betaTransaction('beta-other',id,'beta-puzzle','wrong'),{...args,playerKey:'g:beta-other',guessText:'wrong',isCorrect:false});assert.equal(other.outcome.cluesUsed,1);assert.equal(other.outcome.correct,false);
});
test.after(async()=>{await db.$disconnect();});

test('actual route functions + PG: unauth denied before puzzle read, caller guest ignored, progress isolation and idempotent reply',async()=>{
 const [{POST:guess},{POST:progress},{GET:daily}]=await Promise.all([
 import('../../../apps/web/app/api/guess/route.ts'),import('../../../apps/web/app/api/progress/route.ts'),import('../../../apps/web/app/api/daily/route.ts')]);
 Object.assign(process.env,{THREADLY_NATIVE_BETA:'isolated-synthetic-only',THREADLY_BETA_SYNTHETIC_ONLY:'true',THREADLY_BETA_TARGET_ID:config.targetId,THREADLY_BETA_EXPIRES_AT_MS:String(config.expiresAt)});
 await db.puzzle.update({where:{id:'beta-puzzle'},data:{clues:{create:Array.from({length:5},(_,n)=>({clueOrder:n+1,clueText:'Synthetic clue '+n}))}}});
 let privateReads=0;db.$use(async(params,next)=>{if(params.model==='Puzzle')privateReads++;return next(params);});
 const request=(path,body,token)=>new Request('http://localhost/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
 const before=privateReads;
 assert.equal((await guess(request('guess',{puzzle_id:'beta-puzzle',guess:'wrong'}))).status,401);
 assert.equal((await progress(request('progress',{puzzle_id:'beta-puzzle'}))).status,401);
 assert.equal((await daily(new Request('http://localhost/api/daily'))).status,401);assert.equal(privateReads,before);
 const forged=await progress(request('progress',{puzzle_id:'beta-puzzle',guest_id:'beta-other'},device.token));assert.equal(forged.status,200);assert.equal((await forged.json()).state,'solved');assert.equal(forged.headers.get('cache-control'),'private, no-store');
 const another=randomBytes(32).toString('base64url');await db.$executeRaw`INSERT INTO threadly_beta_invitation(code_hash,target_id,expires_at) VALUES (${digest(another)},${config.targetId},${new Date(config.expiresAt)})`;await db.$executeRaw`INSERT INTO threadly_beta_device(token_hash,invitation_hash,guest_id,target_id,expires_at) VALUES (${digest(another)},${digest(another)},'beta-route-two',${config.targetId},${new Date(config.expiresAt)})`;
 const hidden=await progress(request('progress',{puzzle_id:'beta-puzzle',guest_id:device.guestId},another));assert.equal((await hidden.json()).state,'open');
 const id=randomUUID();const body={puzzle_id:'beta-puzzle',guest_id:device.guestId,guess:'routewrong',request_id:id};
 const first=await guess(request('guess',body,another)),second=await guess(request('guess',body,another));assert.equal(first.status,200);assert.deepEqual(await first.json(),await second.json());
 const own=await progress(request('progress',{puzzle_id:'beta-puzzle'},another));assert.equal((await own.json()).clue_number,2);
 const conflict=await guess(request('guess',{...body,guess:'changed'},another));assert.equal(conflict.status,409);
 const day=await daily(new Request('http://localhost/api/daily',{headers:{Authorization:'Bearer '+another}}));assert.equal(day.status,200);assert.equal(day.headers.get('cache-control'),'private, no-store');assert(!JSON.stringify(await day.json()).includes('"answer"'));
 await db.$executeRaw`UPDATE threadly_beta_device SET request_count=2000 WHERE guest_id='beta-route-two'`;
 assert.equal((await progress(request('progress',{puzzle_id:'beta-puzzle'},another))).status,401);
 delete process.env.THREADLY_NATIVE_BETA;
});
