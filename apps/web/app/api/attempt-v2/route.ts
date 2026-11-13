import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { validPuzzleId, validGuess } from "@/services/requestValidation";
import { authorizePuzzle, AttemptAuthorizationError } from "@/services/attempt-v2/authorization.mjs";
import { readAttemptJson, AttemptBodyError } from "@/services/attempt-v2/requestBody";
import { SELECT_HISTORY_SQL } from "@/services/guessSql";
import { buildProgress } from "@/services/progressService";
import { calculateScore } from "@/services/scoringService";
import { attemptConfiguration } from "@/services/attempt-v2/config";
import { createAttemptStore } from "@/services/attempt-v2/prisma-store.mjs";
import { proposedAdapter } from "@/services/attempt-v2/protocol.mjs";
import { canonicalRevision } from "@/services/attempt-v2/canonical-revision.mjs";

export const runtime = "nodejs";
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {status, headers:{"Cache-Control":"private, no-store"}});
}
/** Additive account-only lane. Body identity is never used. Legacy routes/clients are unchanged. */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (typeof userId !== "string" || !userId.trim()) return reply({error:"Account sign-in required"},401);
    const config = attemptConfiguration();
    if (!config) return reply({error:"Attempt protocol unavailable"},503);
    // Cookie-backed account authentication needs an exact trusted configured Origin.
    if (req.headers.get("Origin") !== config.origin) return reply({error:"Origin not allowed"},403);
    const input:unknown=await readAttemptJson(req);
    if (!input || typeof input!=="object" || Array.isArray(input)) return reply({error:"Invalid request"},400);
    const body=input as Record<string,unknown>;
    if (!validPuzzleId(body.puzzle_id)) return reply({error:"Invalid puzzle_id"},400);
    const puzzleId=body.puzzle_id,playerKey=`u:${userId}`;
    if (body.action === "progress") {
      // One authorized puzzle object and one history query feed both outputs. Legacy writers are not locked by this lane.
      const result=await db.$transaction(async tx=>{
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout='2500ms'");
        await tx.$executeRawUnsafe("SET LOCAL statement_timeout='5000ms'");
        await tx.$executeRawUnsafe("SET LOCAL idle_in_transaction_session_timeout='8000ms'");
        await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",JSON.stringify(['threadly:attempt:v2',playerKey,puzzleId]));
        const puzzle=await authorizePuzzle(tx,playerKey,puzzleId);
        const history=await tx.$queryRawUnsafe<{clueNumber:number;isCorrect:boolean;guessText:string}[]>(SELECT_HISTORY_SQL,puzzleId,playerKey,userId,null);
        return {...buildProgress({history:history.map(r=>({...r,scoreAwarded:0})),clues:puzzle.clues.map((c:{clueOrder:number;clueText:string})=>({order:c.clueOrder,text:c.clueText})),answer:puzzle.answer,scoreFor:calculateScore}),revision:canonicalRevision({...config,playerKey,puzzle,history}).revision};
      },{maxWait:4000,timeout:10000});
      return result ? reply(result) : reply({error:"Puzzle not found"},404);
    }
    if (body.action !== "guess") return reply({error:"Invalid action"},400);
    if (!validGuess(body.guess) || typeof body.attempt_id!=="string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.attempt_id) || typeof body.expected_revision!=="string" || !/^r1\.[A-Za-z0-9_-]{1,32}\.[A-Za-z0-9_-]{43}$/.test(body.expected_revision)) return reply({error:"Invalid attempt request"},400);
    // Store authorizes existing account and stable puzzle inside the transaction BEFORE receipt lookup.
    const result=await proposedAdapter(createAttemptStore(db,config.limits),{playerKey,puzzleId,guess:body.guess,attemptId:body.attempt_id,expectedRevision:body.expected_revision},config);
    return reply(result.body,result.status);
  } catch (error) {
    if (error instanceof AttemptBodyError || error instanceof AttemptAuthorizationError) return reply({error:"Request or account/puzzle scope unavailable"},error.status);
    // No exception text, identifiers, submitted guesses, revision keys or database diagnostics in logs.
    return reply({error:"Attempt protocol unavailable"},503);
  }
}
