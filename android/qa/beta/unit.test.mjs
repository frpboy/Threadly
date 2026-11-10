import test from 'node:test'; import assert from 'node:assert/strict';
import {boundedJson,BodyLimit} from '../../../apps/web/services/nativeBeta/body.ts';
import {proxy} from '../../../apps/web/proxy.ts';
function request(path,method='GET'){return {nextUrl:{pathname:path},method};}
test('body reads exact max and rejects chunked overflow',async()=>{
 const valid=new Request('http://localhost',{method:'POST',body:'{"a":1}'});assert.deepEqual(await boundedJson(valid,7),{a:1});
 let cancelled=false;
 const stream=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('12345'));c.enqueue(new TextEncoder().encode('67890'));},cancel(){cancelled=true;}});
 await assert.rejects(boundedJson(new Request('http://localhost',{method:'POST',body:stream,duplex:'half'}),8),BodyLimit);assert(cancelled);
});
test('beta deny-by-default gate closes alternate paths and wrong methods',()=>{
 process.env.THREADLY_NATIVE_BETA='isolated-synthetic-only';
 for(const path of ['/','/api/clue','/api/admin','/api/auth/session','/api/archive','/api/leaderboard','/api/users','/api/beta/enroll/','/_next/static/chunk.js'])assert.equal(proxy(request(path)).status,404,path);
 for(const [path,method] of [['/api/beta/enroll','POST'],['/api/daily','GET'],['/api/progress','POST'],['/api/guess','POST']]){assert.equal(proxy(request(path,method)).headers.get('x-middleware-next'),'1');assert.equal(proxy(request(path,method==='GET'?'POST':'GET')).status,404);}
 process.env.THREADLY_NATIVE_BETA='invalid';assert.equal(proxy(request('/api/admin')).status,404);
 delete process.env.THREADLY_NATIVE_BETA;assert.equal(proxy(request('/')).headers.get('x-middleware-next'),'1');
});
