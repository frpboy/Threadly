import {createHash} from 'node:crypto';
import {canonicalRevision} from './canonical-revision.mjs';
/** Account-only transaction adapter candidate. Store guarantees atomicity/locks; no DB/auth/key loading inside this module.
 * Caller authorizes scope first; immutable committed receipts survive all current-state changes. */
export async function proposedAdapter(store,input,revisionConfig) {
  if(typeof input?.playerKey!=='string'||!input.playerKey.startsWith('u:')||input.playerKey.length<3||typeof input.puzzleId!=='string'||!input.puzzleId.trim()||input.puzzleId.length>100||
     typeof input.guess!=='string'||!input.guess.trim()||input.guess.length>200||typeof input.expectedRevision!=='string'||!/^r1\.[A-Za-z0-9_-]{1,32}\.[A-Za-z0-9_-]{43}$/.test(input.expectedRevision)||
     !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.attemptId??'')) throw new TypeError('Invalid proposed request');
  // Account-only proposed lane. This is NOT installed as a guest/legacy rejection route.
  const request={...input,guess:input.guess.trim(),attemptId:input.attemptId.toLowerCase()};
  request.fingerprint=createHash('sha256').update(JSON.stringify(['threadly-attempt',2,request.guess,request.expectedRevision])).digest('hex');
  return store.run(async tx=>{
    await tx.lockScope(request);
    const old=await tx.receipt(request);
    if(old) return old.fingerprint===request.fingerprint?{status:old.status,body:old.body,replayed:true}:{status:409,body:{error:'Attempt key conflict'},replayed:false};
    // Atomic persistent global+identity+puzzle count/byte admission, held to transaction end.
    // Scope -> admission -> guess -> award(player) -> leaderboard(global). No reverse paths allowed.
    if(!await tx.admit(request)) return {status:429,body:{error:'New attempts unavailable'},replayed:false};
    const snapshot=await tx.snapshot(request);
    const current=canonicalRevision({...revisionConfig,playerKey:request.playerKey,...snapshot});
    const result=current.revision!==request.expectedRevision?{status:409,body:{error:'Stale revision',revision:current.revision}}:await tx.applyActualGameplay(request);
    if(![200,409].includes(result.status)||!result.body||typeof result.body!=='object'||Array.isArray(result.body)) throw new Error('Unsafe durable result');
    // Port contract: applyActualGameplay must return only actual route-safe bounded JSON.
    const encoded=JSON.stringify(result.body);
    if(Buffer.byteLength(encoded)>8192) throw new Error('Receipt too large');
    await tx.saveReceipt(request,{fingerprint:request.fingerprint,status:result.status,body:JSON.parse(encoded)});
    return {...result,replayed:false};
  });
}
