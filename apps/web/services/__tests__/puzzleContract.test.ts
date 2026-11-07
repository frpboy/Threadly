import { test } from "node:test";
import assert from "node:assert/strict";
import { validPuzzleContent } from "../puzzleContract.ts";
import { buildProgress } from "../progressService.ts";
const valid = () => ({ answer: "answer", clues: Array.from({length:5},(_,i)=>({clueOrder:i+1,clueText:`clue${i+1}`})) });
test("canonical puzzle accepts exact orders in any storage order",()=>{const p=valid();p.clues.reverse();assert.equal(validPuzzleContent(p),true);});
test("short duplicate gap extra empty and missing content fail closed",()=>{
 const short=valid();short.clues=short.clues.slice(0,2);
 const duplicate=valid();duplicate.clues[4].clueOrder=4;
 const gap=valid();gap.clues[4].clueOrder=6;
 const extra=valid();extra.clues.push({clueOrder:6,clueText:"six"});
 const empty=valid();empty.clues[0].clueText=" ";
 for(const p of [short,duplicate,gap,extra,empty,{...valid(),answer:""},{answer:"x",clues:null},null])assert.equal(validPuzzleContent(p),false);
});
test("two-clue progress cannot report open clue3 total2",()=>{
 assert.throws(()=>buildProgress({answer:"answer",clues:[{order:1,text:"one"},{order:2,text:"two"}],history:[1,2].map(clueNumber=>({clueNumber,isCorrect:false,guessText:"wrong",scoreAwarded:0})),scoreFor:()=>0}),/Invalid published/);
});
