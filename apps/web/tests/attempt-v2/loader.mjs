// Explicit qualification loader only. Never use to start the application or serve real users.
import {pathToFileURL} from 'node:url';
const web=new URL('../../',import.meta.url);
export async function resolve(specifier,context,next){
 if(specifier==='next/server')return {url:pathToFileURL('/modules/next/server.js').href,shortCircuit:true};
 if(specifier==='@prisma/client')return {url:pathToFileURL('/work/generated-client/index.js').href,shortCircuit:true};
 if(specifier==='@/auth')return {url:new URL('./auth-fixture.mjs',import.meta.url).href,shortCircuit:true};
 if(specifier==='@/lib/db')return {url:new URL('./owned-db.mjs',import.meta.url).href,shortCircuit:true};
 if(specifier.startsWith('@/services/')){const name=specifier.slice('@/services/'.length);return {url:new URL('services/'+name+(/\.(?:ts|mjs)$/.test(name)?'':'.ts'),web).href,shortCircuit:true};}
 return next(specifier,context);
}
