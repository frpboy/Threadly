import {submitGuess} from '../guessTransaction.ts';
import {SELECT_HISTORY_SQL} from '../guessSql.ts';
import {checkAnswer} from '../answerService.ts';
import {calculateScore} from '../scoringService.ts';
import {canonicalRevision} from './canonical-revision.mjs';
/** Outer transaction/authorization/locks/admission belong to caller. No transaction starts here. */
export async function revisionFromActualHistory(tx,request,puzzle,config){
 const isUser=request.playerKey.startsWith('u:'),id=request.playerKey.slice(2);
 const history=await tx.$queryRawUnsafe(SELECT_HISTORY_SQL,request.puzzleId,request.playerKey,isUser?id:null,isUser?null:id);
 return canonicalRevision({...config,playerKey:request.playerKey,puzzle,history});
}
/** Factory must be actual prismaUnitOfWork in a future reviewed DB bridge, NOT db.$transaction. */
export async function gameplayWithinOuterTx(tx,prismaUnitOfWorkFactory,request,puzzle){
 const uow=prismaUnitOfWorkFactory(tx);
 const {isCorrect,similarity}=checkAnswer(request.guess.trim(),puzzle.answer);
 // submitGuess runs its callback on THIS exact uow; no nested runInPrismaTransaction.
 const result=await submitGuess(fn=>fn(uow),{puzzleId:request.puzzleId,playerKey:request.playerKey,guessText:request.guess.trim(),isCorrect,scoreFor:calculateScore});
 return publicResult(result,puzzle.answer,isCorrect,similarity);
}
export function publicResult({outcome:o,award},answer,isCorrect,similarity){
 if(o.status==='replay')return {status:409,body:{error:'Duplicate or concurrent guess'}};
 if(o.status==='already_solved')return {status:409,body:{correct:true,already_solved:true,clues_used:o.cluesUsed,score_awarded:0,answer,message:'Already solved'}};
 if(o.status==='exhausted')return {status:409,body:{correct:false,exhausted:true,answer,message:'No guesses left'}};
 if(o.status!=='scored'||!Number.isInteger(o.cluesUsed)||o.cluesUsed<1||o.cluesUsed>5||!Number.isFinite(similarity)||o.correct!==isCorrect)throw Error('Invalid gameplay outcome');
 const body={correct:isCorrect,similarity_score:parseFloat(similarity.toFixed(2)),clues_used:o.cluesUsed,score_awarded:o.scoreAwarded,streak:award?.streak?.currentStreak??0,message:isCorrect?'Correct!':'Incorrect answer'};
 if(isCorrect||o.cluesUsed>=5)body.answer=answer;
 // Exact StatsInfo fields, no passthrough DB identity/error/token attributes.
 if(award?.stats){const s=award.stats;if(![s.gamesPlayed,s.gamesWon,s.averageClues].every(Number.isFinite))throw Error('Invalid stats');body.stats={gamesPlayed:s.gamesPlayed,gamesWon:s.gamesWon,averageClues:s.averageClues};}
 return {status:200,body};
}
