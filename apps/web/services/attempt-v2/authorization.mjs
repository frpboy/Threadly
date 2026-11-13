import { validPuzzleContent } from "../puzzleContract.ts";
export class AttemptAuthorizationError extends Error {
 constructor(status) {super('Attempt scope unavailable');this.status=status;}
}
/** Called after scope lock, before receipt access. Locks existing account/puzzle/clue rows until commit.
 * Existing account presence is checked, not JWT revocation or real-provider sign-in.
 * Uncooperative new clue inserts/legacy guess writers are not an editor-wide locking protocol.
 */
export async function authorizePuzzle(tx,playerKey,puzzleId){
 const users=await tx.$queryRawUnsafe('SELECT id FROM users WHERE id=$1 FOR KEY SHARE',playerKey.slice(2));
 if(users.length!==1)throw new AttemptAuthorizationError(401);
 const rows=await tx.$queryRawUnsafe('SELECT id FROM puzzles WHERE id=$1 FOR SHARE',puzzleId);
 if(rows.length!==1)throw new AttemptAuthorizationError(404);
 await tx.$queryRawUnsafe('SELECT id FROM clues WHERE puzzle_id=$1 FOR SHARE',puzzleId);
 const puzzle=await tx.puzzle.findUnique({where:{id:puzzleId},include:{clues:true}});
 if(!puzzle||puzzle.status!=='published'||!validPuzzleContent(puzzle))throw new AttemptAuthorizationError(404);
 return puzzle;
}
