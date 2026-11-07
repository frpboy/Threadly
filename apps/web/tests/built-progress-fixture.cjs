// Test-only preload, used ONLY by built-progress-smoke.mjs's local child process.
// The actual production route and buildProgress module are untouched. No database/network access.
const Module = require('node:module');
const original = Module._load;
class FixturePrisma {
  constructor() {
    this.puzzle = { findUnique: async ({ where }) => where.id === 'fixture-published' ? {
      id: 'fixture-published', status: 'published', answer: 'fixture answer',
      clues: Array.from({length:5}, (_,i) => ({clueOrder:i+1,clueText:`Fixture clue ${i+1}`})),
    } : null };
  }
  async $queryRawUnsafe(sql, puzzle, key) {
    if (!sql.includes('FROM guesses') || puzzle !== 'fixture-published') throw Error('Unexpected fixture query');
    if (key === 'g:fixture-open') return [{clueNumber:1,isCorrect:false,guessText:'wrong'}];
    if (key === 'g:fixture-solved') return [{clueNumber:1,isCorrect:false,guessText:'wrong'},{clueNumber:2,isCorrect:true,guessText:'fixture answer'}];
    throw Error('Unexpected fixture identity');
  }
}
Module._load = function(id,parent,isMain) {
  const value = original.apply(this,arguments);
  if (id === '@prisma/client' || id === '@prisma/client/default' || /\.prisma\/client\/default/.test(id)) {
    return {...value,PrismaClient:FixturePrisma};
  }
  return value;
};
// Do not allow Sentry or another dependency to send fixture activity off the machine.
const https=require('node:https');https.request=()=>{throw Error('External HTTPS blocked by fixture');};
const originalFetch=globalThis.fetch;
globalThis.fetch=(url,init)=>{
  const u=new URL(typeof url==='string'?url:url.url||url);
  if(!['localhost','127.0.0.1'].includes(u.hostname))throw Error('External fetch blocked by fixture');
  return originalFetch(url,init);
};
