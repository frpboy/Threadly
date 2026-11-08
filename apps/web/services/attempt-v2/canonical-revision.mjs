import {createHmac} from 'node:crypto';
/** Account-only revision candidate. Input history MUST be authorized SQL DISTINCT ON projection.
 * No DB/auth/route access. Synthetic caller supplies explicit HMAC key, not session key. */
export function canonicalRevision({key, epoch, playerKey, puzzle, history}) {
  if (!(key instanceof Uint8Array) || key.byteLength<32 || typeof epoch!=='string' || !/^[a-zA-Z0-9_-]{1,32}$/.test(epoch)) throw new TypeError('Revision configuration');
  if (typeof playerKey!=='string' || !/^[ug]:/.test(playerKey) || playerKey.length<3 || typeof puzzle?.id!=='string' || !puzzle.id.trim() || puzzle.id.length>100) throw new TypeError('Revision scope');
  if (puzzle.status!=='published' || typeof puzzle.answer!=='string' || !puzzle.answer.trim() || !Array.isArray(puzzle.clues) || puzzle.clues.length!==5) throw new TypeError('Puzzle contract');
  const clues=[...puzzle.clues].sort((a,b)=>a.clueOrder-b.clueOrder);
  if(clues.some((c,i)=>c.clueOrder!==i+1||typeof c.clueText!=='string'||!c.clueText.trim())) throw new TypeError('Puzzle contract');
  if(!Array.isArray(history)||history.length>5) throw new TypeError('History projection');
  let last=0;
  const records=history.map(r=>{
    if(!Number.isInteger(r.clueNumber)||r.clueNumber<=last||r.clueNumber>5||typeof r.isCorrect!=='boolean'||typeof r.guessText!=='string') throw new TypeError('History projection');
    last=r.clueNumber;
    return [r.clueNumber,r.isCorrect,r.guessText];
  });
  const winning=history.find(r=>r.isCorrect);
  const state=winning?['solved',winning.clueNumber]:last>=5?['exhausted',5]:['open',last+1];
  const bytes=JSON.stringify(['threadly-revision',1,epoch,playerKey,puzzle.id,puzzle.status,puzzle.answer,clues.map(c=>[c.clueOrder,c.clueText]),records,state]);
  return {revision:`r1.${epoch}.${createHmac('sha256',key).update(bytes).digest('base64url')}`, state:state[0],clueNumber:state[1]};
}
