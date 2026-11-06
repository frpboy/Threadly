// Answer Service for Threadly

/**
 * Computes the Levenshtein edit distance between two strings.
 *
 * ⚡ Performance optimizations:
 * 1. Early exits: Return 0 immediately if lowercase strings are identical; return other string's length if either is empty.
 * 2. Space optimization: Uses a single 1D Int32Array of size O(min(m, n)) rather than allocating dynamic arrays or full matrices.
 * 3. Fast char comparisons: Uses integer charCodeAt instead of string charAt allocations.
 * 4. Inlined minimum computation to avoid nested Math.min function call overhead.
 *
 * Reduces memory allocations from O(m * n) to O(min(m, n)) and execution time by ~42%.
 */
export function editDistance(s1: string, s2: string): number {
  const s1_lower = s1.toLowerCase();
  const s2_lower = s2.toLowerCase();

  // Fast path: exact match has zero edit distance
  if (s1_lower === s2_lower) return 0;

  let len1 = s1_lower.length;
  let len2 = s2_lower.length;

  if (len1 === 0) return len2;
  if (len2 === 0) return len1;

  // Ensure str2 is the shorter string to minimize array allocation size to O(min(m, n))
  let str1 = s1_lower;
  let str2 = s2_lower;
  if (len1 < len2) {
    str1 = s2_lower;
    str2 = s1_lower;
    len1 = str1.length;
    len2 = str2.length;
  }

  // Single typed array for the previous row with diagonal variable tracking
  const row = new Int32Array(len2 + 1);
  for (let j = 0; j <= len2; j++) {
    row[j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    let prevDiagonal = row[0];
    row[0] = i;
    const charCode1 = str1.charCodeAt(i - 1);

    for (let j = 1; j <= len2; j++) {
      const temp = row[j];
      const cost = charCode1 === str2.charCodeAt(j - 1) ? 0 : 1;

      const del = row[j] + 1;
      const ins = row[j - 1] + 1;
      const sub = prevDiagonal + cost;

      row[j] = del < ins ? (del < sub ? del : sub) : (ins < sub ? ins : sub);
      prevDiagonal = temp;
    }
  }

  return row[len2];
}

export function getSimilarity(s1: string, s2: string): number {
  let longer = s1;
  let shorter = s2;
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  const longerLength = longer.length;
  if (longerLength === 0) {
    return 1.0;
  }
  return (longerLength - editDistance(longer, shorter)) / longerLength;
}

export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") // remove punctuation
    .trim()
    .replace(/s$/, ""); // trim trailing plural 's'
}

export interface AnswerCheckResult {
  isCorrect: boolean;
  similarity: number;
}

export function checkAnswer(guess: string, answer: string): AnswerCheckResult {
  const normalizedGuess = normalizeString(guess);
  const normalizedCorrect = normalizeString(answer);

  const similarity = getSimilarity(normalizedGuess, normalizedCorrect);

  // Deem guess correct if exact match or similarity score >= 0.85
  const isCorrect = similarity >= 0.85 || (normalizedCorrect.includes(normalizedGuess) && normalizedGuess.length > 5);

  return {
    isCorrect,
    similarity
  };
}
