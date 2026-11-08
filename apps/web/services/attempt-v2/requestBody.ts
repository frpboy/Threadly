export class AttemptBodyError extends Error {
 readonly status:number;
 constructor(status:number){super("Invalid bounded request");this.status=status;}
}
/** One five-second total read budget, strict UTF-8 and at most4096 bytes retained. */
export async function readAttemptJson(req:Request):Promise<unknown>{
 if(req.headers.get("Content-Type")?.split(";",1)[0].trim().toLowerCase()!=="application/json")throw new AttemptBodyError(415);
 const reader=req.body?.getReader();if(!reader)throw new AttemptBodyError(400);
 let timer:ReturnType<typeof setTimeout>|undefined;
 const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(new AttemptBodyError(408));void reader.cancel().catch(()=>{});},5000);});
 const chunks:Uint8Array[]=[];let size=0;
 try{
  for(;;){const part=await Promise.race([reader.read(),timeout]);if(part.done)break;size+=part.value.byteLength;
   if(size>4096){void reader.cancel().catch(()=>{});throw new AttemptBodyError(413);}chunks.push(part.value);}
  try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(chunks)));}catch{throw new AttemptBodyError(400);}
 }finally{clearTimeout(timer);try{reader.releaseLock();}catch{/* A timed-out pending read has already been cancelled. */}}
}
