// Isolated test target, not the production db module.
import {PrismaClient} from '@prisma/client';
const url=new URL(process.env.DATABASE_URL??'');
if(url.protocol!=='postgresql:'||url.hostname!=='localhost'||url.port!==''||url.pathname!=='/threadly_integration_owned'||url.searchParams.getAll('host').length!==1||url.searchParams.get('host')!=='/work')throw Error('Exact owned Unix socket DB required');
export const db=new PrismaClient({datasources:{db:{url:url.toString()}}});
