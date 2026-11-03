# Bolt's Performance Journal

## 2025-05-18 - String Similarity Levenshtein DP Optimization
**Learning:** In word/connection games where every guess hits `checkAnswer` and `editDistance`, exact string matches and case matches frequently occur. Computing a dynamic array Levenshtein matrix on every guess creates unnecessary memory allocations, GC pressure, and function call overhead (`Math.min`, `charAt`).
**Action:** Always short-circuit exact string equality before entering edit distance calculations, swap strings so the DP array is bounded by $O(\min(m, n))$, allocate a single typed `Int32Array`, compare characters using `charCodeAt`, and inline binary minimum logic.
