import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve as resolvePath} from 'node:path';
const root=fileURLToPath(new URL('../../../',import.meta.url));
export async function resolve(specifier,context,next){
 if(specifier==='@/auth')return {url:new URL('./route-auth-stub.mjs',import.meta.url).href,shortCircuit:true};
 if(specifier==='next/server')return next('next/server.js',context);
 if(specifier==='@/lib/db')return {url:new URL('./db.mjs',import.meta.url).href,shortCircuit:true};
 if(specifier.startsWith('@/'))return {url:pathToFileURL(resolvePath(root,'apps/web',specifier.slice(2)+(specifier.endsWith('.ts')?'':'.ts'))).href,shortCircuit:true};
 if(specifier.startsWith('.')&&!/\.[a-z]+$/.test(specifier)){try{return await next(specifier+'.ts',context);}catch{}}
 return next(specifier,context);
}
