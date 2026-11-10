import test from 'node:test';
import assert from 'node:assert/strict';
import {authenticate,enroll,digest,bearer,allowedConfig} from './deviceAccess.mjs';
const now=1800000000000;
const config={enabled:true,syntheticOnly:true,targetId:'threadly-native-beta-local',expiresAt:now+86400000};
const code='A'.repeat(43);
function fixture(){const devices=new Map();let consumed=false;return {devices,store:{async findDevice(h){return devices.get(h)},async consumeInvitationAndCreateDevice(x){if(consumed||x.invitationHash!==digest(code))return false;consumed=true;devices.set(x.tokenHash,{...x,revoked:false});return true}}}}
test('enrollment creates separate device identity, stores hashes only',async()=>{let f=fixture();let r=await enroll(code,{...f,config,now});assert(r);assert.notEqual(r.token,code);assert.equal(r.token.length,43);let p=await authenticate('Bearer '+r.token,{...f,config,now});assert(p.guestId.startsWith('beta-'));assert(!JSON.stringify([...f.devices]).includes(r.token));assert(!JSON.stringify([...f.devices]).includes(code))});
test('one-time invitation is atomic under concurrent redemption',async()=>{let f=fixture();let results=await Promise.all(Array.from({length:20},()=>enroll(code,{...f,config,now})));assert.equal(results.filter(Boolean).length,1);assert.equal(f.devices.size,1)});
test('self-asserted guest IDs and other tokens have no authority',async()=>{let f=fixture();assert.equal(await authenticate('Bearer '+'g'.repeat(43),{...f,config,now}),null);assert.equal(bearer('Bearer beta-user'),null);assert.equal(bearer('bearer '+code),null);assert.equal(await enroll('1234',{...f,config,now}),null)});
test('expired/revoked/other target credentials denied',async()=>{for(const change of [{revoked:true},{expiresAt:now},{targetId:'other'}]){let f=fixture();let r=await enroll(code,{...f,config,now});Object.assign(f.devices.get(digest(r.token)),change);assert.equal(await authenticate('Bearer '+r.token,{...f,config,now}),null)}});
test('config disabled, production target, data copy, or invalid expiry fails closed',async()=>{for(const change of [{enabled:false},{syntheticOnly:false},{targetId:'production'},{expiresAt:now},{expiresAt:now+8*86400000}]){let c={...config,...change};assert.equal(allowedConfig(c,now),false);let f=fixture();assert.equal(await enroll(code,{...f,config:c,now}),null);assert.equal(await authenticate('Bearer '+code,{...f,config:c,now}),null)}});
test('wrong enrollment code does not create a device',async()=>{let f=fixture();assert.equal(await enroll('B'.repeat(43),{...f,config,now}),null);assert.equal(f.devices.size,0)});
