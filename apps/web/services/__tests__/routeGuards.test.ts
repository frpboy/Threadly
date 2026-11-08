import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as validation from "../requestValidation.ts";
import { validPuzzleContent } from "../puzzleContract.ts";
import { buildProgress } from "../progressService.ts";
const require = createRequire(import.meta.url);
/** Execute the actual route source, transpiled without rewriting its logic; external services are fakes. */
function route(name: string, mocks: Record<string, unknown>) {
  const source = readFileSync(new URL(`../../app/api/${name}/route.ts`, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} as any };
  new Function("require", "module", "exports", js)((id: string) => {
    if (id === "@/services/puzzleContract") return { validPuzzleContent };
    if (id in mocks) return mocks[id];
    if (id === "next/server") return require(id);
    throw new Error(`Unexpected route dependency: ${id}`);
  }, mod, mod.exports);
  return mod.exports;
}
function guessRoute(published = true) {
  const calls = { puzzle: 0, matcher: 0, submit: 0 };
  const post = route("guess", {
    "@/lib/db": { db: { puzzle: { findUnique: async () => { calls.puzzle++; return { id: "p", answer: "answer", status: published ? "published" : "draft", clues: Array.from({length:5},(_,i)=>({clueOrder:i+1,clueText:"clue"})) }; } } } },
    "@/auth": { auth: async () => null },
    "@/services/answerService": { checkAnswer: () => { calls.matcher++; return { isCorrect: true, similarity: 1 }; } },
    "@/services/scoringService": { calculateScore: () => 100 },
    "@/services/difficultyService": { recalculatePuzzleDifficulty: async () => {} },
    "@/services/attemptService": { MAX_CLUES: 5 },
    "@/services/guessTransaction": { submitGuess: async () => { calls.submit++; return { outcome: { status: "scored", correct: true, cluesUsed: 1, scoreAwarded: 100 } }; } },
    "@/services/prismaAttemptStore": { runInPrismaTransaction: () => { throw new Error("not expected"); } },
    "@/services/requestValidation": validation,
  }).POST;
  return { calls, post, send: (body: unknown) => post(new Request("http://localhost/api/guess", { method: "POST", body: JSON.stringify(body) })) };
}
test("actual guess route rejects invalid input before database or edit-distance work", async () => {
  const f = guessRoute();
  for (const guess of [null, 42, {}, "", " ", "x".repeat(201)]) {
    assert.equal((await f.send({ puzzle_id: "p", guess, guest_id: "guest123" })).status, 400);
  }
  assert.deepEqual(f.calls, { puzzle: 0, matcher: 0, submit: 0 });
});
test("actual guess route rejects an unpublished puzzle without matching or awarding", async () => {
  const f = guessRoute(false);
  assert.equal((await f.send({ puzzle_id: "p", guess: "answer", guest_id: "guest123" })).status, 404);
  assert.deepEqual(f.calls, { puzzle: 1, matcher: 0, submit: 0 });
});
test("actual guess route still accepts a valid published puzzle and does not accept client score", async () => {
  const f = guessRoute();
  const r = await f.send({ puzzle_id: "p", guess: "answer", guest_id: "guest123", clues_revealed: 0, score: 999999 });
  assert.equal(r.status, 200); assert.equal(r.headers.get("cache-control"), "private, no-store"); assert.equal((await r.json()).score_awarded, 100);
  assert.deepEqual(f.calls, { puzzle: 1, matcher: 1, submit: 1 });
});
test("actual leaderboard POST refuses arbitrary points and cannot touch database", async () => {
  const f = route("leaderboard", { "@/lib/db": { db: new Proxy({}, { get() { throw new Error("database touched"); } }) } });
  const r = await f.POST(new Request("http://localhost/api/leaderboard", { method: "POST", body: JSON.stringify({ score: 1000000, guest_id: "guest123" }) }));
  assert.equal(r.status, 405); assert.equal(r.headers.get("cache-control"), "private, no-store"); assert.equal(r.headers.get("Allow"), "GET");
});
test("leaderboard GET with no active season does not create one", async () => {
  const f = route("leaderboard", { "@/lib/db": { db: { leaderboardSeason: { findFirst: async () => null, create: () => { throw new Error("create forbidden"); } } } } });
  const r = await f.GET(); assert.equal(r.status, 200); assert.equal(r.headers.get("cache-control"), "private, no-store"); assert.deepEqual((await r.json()).entries, []);
});
test("actual guess route returns private400 for malformed JSON and non-object JSON", async () => {
  const f = guessRoute();
  // send() serializes JSON; unsupported top-level JSON must not reach DB or matcher.
  for (const body of [null, [], 42, "guess"]) assert.equal((await f.send(body)).status, 400);
  const bad = await f.post(new Request("http://localhost/api/guess", { method: "POST", body: "{" }));
  assert.equal(bad.status, 400);
  assert.equal(bad.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(f.calls, { puzzle: 0, matcher: 0, submit: 0 });
});

test("malformed published puzzle cannot match or award a nonexistent clue slot",async()=>{
 for(const orders of [[1,2],[1,2,3,4,4],[1,2,3,4,6]]) {
  let touched=0;
  const post=route("guess",{
   "@/lib/db":{db:{puzzle:{findUnique:async()=>({id:"p",status:"published",answer:"answer",clues:orders.map(clueOrder=>({clueOrder,clueText:"clue"}))})}}},
   "@/auth":{auth:async()=>null},"@/services/answerService":{checkAnswer:()=>{touched++;throw Error("matcher forbidden");}},
   "@/services/scoringService":{},"@/services/difficultyService":{},"@/services/attemptService":{MAX_CLUES:5},
   "@/services/guessTransaction":{submitGuess:()=>{touched++;throw Error("award forbidden");}},
   "@/services/prismaAttemptStore":{},"@/services/requestValidation":validation,
  }).POST;
  const r=await post(new Request("http://localhost/api/guess",{method:"POST",body:JSON.stringify({puzzle_id:"p",guest_id:"guest123",guess:"answer"})}));
  assert.equal(r.status,404);assert.equal(r.headers.get("cache-control"),"private, no-store");assert.equal(touched,0);
 }
});
test("publish refuses malformed content before update and permits canonical UTC date",async()=>{
 for(const valid of [false,true]) {
  let updates=0;
  const f=route("admin/publish",{
   "@/lib/adminAuth":{verifyAdminRequest:()=>true},
   "@/lib/db":{db:{$transaction:async(fn:any)=>fn({puzzle:{findUnique:async()=>({answer:"answer",clues:Array.from({length:valid?5:2},(_,i)=>({clueOrder:i+1,clueText:"clue"}))}),update:async({data}:any)=>{updates++;assert.equal(data.publishedDate.getUTCHours(),0);return data;}}})}},
  });
  const r=await f.POST(new Request("http://localhost/api/admin/publish",{method:"POST",body:JSON.stringify({puzzle_id:"p",publish_date:"2026-11-07T18:30:00Z"})}));
  assert.equal(r.status,valid?200:400);assert.equal(updates,valid?1:0);
 }
});
test("all public read boundaries reject malformed published content without history queries",async()=>{
 const bad={id:"p",status:"published",answer:"answer",clues:[{clueOrder:1,clueText:"one"},{clueOrder:2,clueText:"two"}]};
 const never=()=>{throw Error("history/award query forbidden");};
 const mocks={"@/lib/db":{db:{puzzle:{findUnique:async()=>bad,findMany:async()=>[bad]},guess:{findFirst:never},clue:{findFirst:never}}},"@/auth":{auth:async()=>null},"@/services/scoringService":{},"@/services/progressService.ts":{buildProgress:never},"@/services/prismaAttemptStore":{prismaHistory:never},"@/services/requestValidation":validation,"@/services/puzzleService":{getDailyPuzzle:async()=>bad}};
 const request=new Request("http://localhost/api/progress",{method:"POST",body:JSON.stringify({puzzle_id:"p",guest_id:"guest123",requested_clue_order:1})});
 assert.equal((await route("progress",mocks).POST(request.clone())).status,404);
 assert.equal((await route("clue",mocks).POST(request.clone())).status,404);
 assert.equal((await route("daily",mocks).GET()).status,404);
 assert.equal((await route("archive/[id]",mocks).GET(request,{params:Promise.resolve({id:"p"})})).status,404);
 assert.deepEqual((await (await route("archive",mocks).GET()).json()).puzzles,[]);
});

function clueRoute(history: any[] = [], userId: string | null = null) {
 const calls = { puzzle: 0, history: 0, key: "" };
 const f = route("clue", {
  "@/lib/db": { db: { puzzle: { findUnique: async () => { calls.puzzle++; return { id: "p", status: "published", answer: "answer", clues: Array.from({length:5},(_,i)=>({clueOrder:i+1,clueText:`clue${i+1}`})) }; } } } },
  "@/auth": { auth: async () => userId ? {user:{id:userId}} : null },
  "@/services/requestValidation": validation,
  "@/services/progressService.ts": { buildProgress },
  "@/services/prismaAttemptStore": { prismaHistory: () => async (_p: string,key: string) => { calls.history++;calls.key=key;return history; } },
  "@/services/scoringService": { calculateScore: (n:number) => 120 - 20*n },
 });
 return { calls, post: f.POST, send: (body:unknown) => f.POST(new Request("http://localhost/api/clue",{method:"POST",body:JSON.stringify(body)})) };
}
test("clue rejects malformed JSON, nonobjects, fractions and invalid ids before DB",async()=>{
 const f=clueRoute();
 for(const body of [null,[],42,{puzzle_id:[],requested_clue_order:1},{puzzle_id:"p",requested_clue_order:1.5},{puzzle_id:"p",requested_clue_order:0},{puzzle_id:"p",requested_clue_order:6}]) {
  const r=await f.send(body);assert.equal(r.status,400);assert.equal(r.headers.get("cache-control"),"private, no-store");
 }
 assert.equal((await f.post(new Request("http://localhost/api/clue",{method:"POST",body:"{"}))).status,400);
 assert.equal(f.calls.puzzle,0);
});
test("clue1 stays public but later clues require a valid guest and authoritative unlock",async()=>{
 const f=clueRoute();
 assert.equal((await f.send({puzzle_id:"p",requested_clue_order:1})).status,200);
 assert.equal((await f.send({puzzle_id:"p",requested_clue_order:2})).status,400);
 assert.equal(f.calls.history,0);
 const r=await f.send({puzzle_id:"p",requested_clue_order:2,guest_id:"guest123"});
 assert.equal(r.status,403);assert.equal(f.calls.key,"g:guest123");
 assert.equal(r.headers.get("cache-control"),"private, no-store");
});
test("clue cannot reveal beyond a solved clue, even when a guess row exists there",async()=>{
 const solved=clueRoute([{clueNumber:1,isCorrect:true,guessText:"answer",scoreAwarded:100}]);
 assert.equal((await solved.send({puzzle_id:"p",requested_clue_order:2,guest_id:"guest123"})).status,403);
 const wrong=clueRoute([{clueNumber:1,isCorrect:false,guessText:"wrong",scoreAwarded:0}]);
 const r=await wrong.send({puzzle_id:"p",requested_clue_order:2,guest_id:"guest123"});
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{order:2,text:"clue2"});
});
test("clue authenticated player identity takes precedence over supplied guest identity",async()=>{
 const f=clueRoute([{clueNumber:1,isCorrect:false,guessText:"wrong",scoreAwarded:0}],"user123");
 assert.equal((await f.send({puzzle_id:"p",requested_clue_order:2,guest_id:"otherguest"})).status,200);
 assert.equal(f.calls.key,"u:user123");
});

test("API failure logs do not disclose exception payloads or private player history",async()=>{
 const marker="synthetic-private-password-and-guest-history";
 const calls: unknown[][]=[];const original=console.error;console.error=(...args:unknown[])=>{calls.push(args);};
 try {
  const f=route("progress", {
   "@/lib/db": {db:{puzzle:{findUnique:async()=>{throw new Error(marker);}}}},
   "@/auth": {auth:async()=>null},
   "@/services/scoringService": {calculateScore:()=>100},
   "@/services/progressService.ts": {buildProgress},
   "@/services/prismaAttemptStore": {prismaHistory:()=>{throw new Error("history must not run");}},
   "@/services/requestValidation":validation,
  });
  const r=await f.POST(new Request("http://localhost/api/progress",{method:"POST",body:JSON.stringify({puzzle_id:"p",guest_id:"guest123"})}));
  assert.equal(r.status,500);assert.equal(r.headers.get("cache-control"),"private, no-store");
  assert.deepEqual(calls,[["Failed to load progress"]]);assert(!JSON.stringify(calls).includes(marker));assert(!(await r.text()).includes(marker));
 } finally {console.error=original;}
});
test("API route console errors use constant operation text, not exception objects/messages",()=>{
 for(const name of ["guess","progress","clue","daily","leaderboard","archive","archive/[id]","admin/publish","admin/puzzles","admin/generate-ai"]) {
  const source=readFileSync(new URL(`../../app/api/${name}/route.ts`,import.meta.url),"utf8");
  const ast=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true);
  let count=0;
  function visit(node:ts.Node) {
   if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.expression.getText(ast)==="console"&&node.expression.name.text==="error") {
    count++;assert.equal(node.arguments.length,1,name+" error log argument count");assert(ts.isStringLiteral(node.arguments[0]),name+" constant error log required");
   }
   ts.forEachChild(node,visit);
  }
  visit(ast);assert(count>0,name+" error-log scan covered");
 }
});
