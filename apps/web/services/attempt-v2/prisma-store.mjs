// Account-only additive candidate. Requires reviewed additive table and explicit configuration.
import {SELECT_HISTORY_SQL} from '../guessSql.ts';
import {prismaUnitOfWork} from '../prismaAttemptStore.ts';
import {gameplayWithinOuterTx} from './bridge.mjs';
import {authorizePuzzle} from './authorization.mjs';
export function createAttemptStore(client,{total,owner,puzzle}){
 return {run:fn=>client.$transaction(async tx=>{
  await tx.$executeRawUnsafe("SET LOCAL lock_timeout='2500ms'");
  await tx.$executeRawUnsafe("SET LOCAL statement_timeout='5000ms'");
  await tx.$executeRawUnsafe("SET LOCAL idle_in_transaction_session_timeout='8000ms'");
  let authorizedPuzzle;
  const lookup=r=>tx.$queryRawUnsafe('SELECT fingerprint,status,response AS body FROM guess_attempt_receipts WHERE player_key=$1 AND puzzle_id=$2 AND attempt_id=$3::uuid',r.playerKey,r.puzzleId,r.attemptId);
  return fn({
   async lockScope(r){
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',JSON.stringify(['threadly:attempt:v2',r.playerKey,r.puzzleId]));
    authorizedPuzzle=await authorizePuzzle(tx,r.playerKey,r.puzzleId);
   },
   receipt:async r=>(await lookup(r))[0]??null,
   async admit(r){
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended('threadly:attempt-quota:v1',0))");
    const [x]=await tx.$queryRawUnsafe('SELECT count(*)::bigint AS n,coalesce(sum(octet_length(response::text)),0)::bigint AS bytes,count(*) FILTER(WHERE player_key=$1)::bigint AS owner,count(*) FILTER(WHERE player_key=$1 AND puzzle_id=$2)::bigint AS puzzle FROM guess_attempt_receipts',r.playerKey,r.puzzleId);
    // Reserve max8192response bytes, not average; lock remains through actual INSERT/commit.
    return Number(x.n)<total&&Number(x.owner)<owner&&Number(x.puzzle)<puzzle&&Number(x.bytes)+8192<=total*8192;
   },
   async snapshot(r){
    const user=r.playerKey.startsWith('u:'),id=r.playerKey.slice(2);
    const history=await tx.$queryRawUnsafe(SELECT_HISTORY_SQL,r.puzzleId,r.playerKey,user?id:null,user?null:id);
    return {history,puzzle:authorizedPuzzle};
   },
   async applyActualGameplay(r){
    return gameplayWithinOuterTx(tx,prismaUnitOfWork,r,authorizedPuzzle);
   },
   async saveReceipt(r,v){
    await tx.$executeRawUnsafe('INSERT INTO guess_attempt_receipts(player_key,puzzle_id,attempt_id,fingerprint,status,response) VALUES($1,$2,$3::uuid,$4,$5,$6::jsonb)',r.playerKey,r.puzzleId,r.attemptId,v.fingerprint,v.status,JSON.stringify(v.body));
   }
  });
 },{isolationLevel:'ReadCommitted',maxWait:4000,timeout:10000})};
}
