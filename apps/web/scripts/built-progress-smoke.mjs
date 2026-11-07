import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const require=createRequire(import.meta.url);
const preload=fileURLToPath(new URL("../tests/built-progress-fixture.cjs",import.meta.url));
const port=3197;
let log="";
const server=spawn(process.execPath,["--require",preload,require.resolve("next/dist/bin/next"),"start","-H","127.0.0.1","-p",String(port)],{
  cwd:fileURLToPath(new URL("..",import.meta.url)),stdio:["ignore","pipe","pipe"],
  env:{...process.env,DATABASE_URL:"postgresql://fixture:fixture@127.0.0.1:1/never_reached",AUTH_SECRET:"local-fixture-only",AUTH_TRUST_HOST:"true",NEXT_TELEMETRY_DISABLED:"1"},
});
server.stdout.on("data",b=>{log+=b.toString();});server.stderr.on("data",b=>{log+=b.toString();});
try{
 let ready=false;
 for(let i=0;i<100;i++){
  if(server.exitCode!==null)break;
  try{const r=await fetch(`http://127.0.0.1:${port}`);if(r.ok){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,100));
 }
 assert.equal(ready,true,"built production server must start");
 for(const [guest,state,score,count] of [["fixture-open","open",0,2],["fixture-solved","solved",80,2]]){
  const r=await fetch(`http://127.0.0.1:${port}/api/progress`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({puzzle_id:"fixture-published",guest_id:guest})});
  assert.equal(r.status,200,`valid built /api/progress for ${state}`);
  assert.equal(r.headers.get("cache-control"),"private, no-store");
  const p=await r.json();assert.equal(p.state,state);assert.equal(p.clue_number,2);assert.equal(p.clues.length,count);assert.equal(p.score_awarded,score);
  if(state==="open")assert.equal("answer" in p,false);else assert.equal(p.answer,"fixture answer");
  console.log(`PASS built valid /api/progress: ${state}, clue2, score${score}, answer boundary and private,no-store`);
 }
 for(const puzzle_id of ['fixture-short','fixture-duplicate','fixture-gap']) {
  for(const path of ['progress','guess']) {
   const r=await fetch(`http://127.0.0.1:${port}/api/${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({puzzle_id,guest_id:'fixture-open',guess:'fixture answer'}),signal:AbortSignal.timeout(5000)});
   assert.equal(r.status,404,`malformed ${puzzle_id} ${path} must fail before history/awards`);
   assert.equal(r.headers.get('cache-control'),'private, no-store');
  }
 }
 console.log('PASS built malformed short/duplicate/gap: six private404 responses, no history/award access');
 console.log("Actual production bundle module binding verified with test-only Prisma fixture. No live database/OIDC/gameplay claim.");
}catch(e){console.error(log);throw e;}
finally{server.kill("SIGTERM");if(server.exitCode===null)await new Promise(r=>server.once("exit",r));}
