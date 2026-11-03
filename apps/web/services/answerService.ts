// Answer Service for Threadly

/**
 * Computes Levenshtein edit distance between two strings.
 *
 * Performance optimizations:
 * 1. Early returns for reference/identical equality or empty strings O(1).
 * 2. Space optimization: Uses a single contiguous Int32Array of size O(min(m, n))
 *    rather than dynamic arrays, eliminating garbage collection churn.
 * 3. Compares character codes via charCodeAt instead of creating charAt substring objects.
 * 4. Inlined minimum computation to avoid nested Math.min function call overhead.
 */
export function editDistance(s1: string, s2: string): number {
  if (s1 === s2) return 0;

  const s1_lower = s1.toLowerCase();
  const s2_lower = s2.toLowerCase();
  if (s1_lower === s2_lower) return 0;

  const len1 = s1_lower.length;
  const len2 = s2_lower.length;

  if (len1 === 0) return len2;
  if (len2 === 0) return len1;

  // Orient strings so str2 is the shorter string, keeping DP buffer size at min(len1, len2) + 1
  let str1 = s1_lower;
  let str2 = s2_lower;
  let m = len1;
  let n = len2;
  if (m < n) {
    str1 = s2_lower;
    str2 = s1_lower;
    m = len2;
    n = len1;
  }

  const dp = new Int32Array(n + 1);
  for (let j = 0; j <= n; j++) {
    dp[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    let prevDiag = dp[0];
    dp[0] = i;
    const code1 = str1.charCodeAt(i - 1);

    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      if (code1 === str2.charCodeAt(j - 1)) {
        dp[j] = prevDiag;
      } else {
        const insertion = dp[j];
        const deletion = dp[j - 1];
        let min = prevDiag < insertion ? prevDiag : insertion;
        if (deletion < min) min = deletion;
        dp[j] = min + 1;
      }
      prevDiag = temp;
    }
  }

  return dp[n];
}

export function getSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;

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

  // Fast-path: Exact match skips expensive Levenshtein distance calculation completely
  if (normalizedGuess === normalizedCorrect) {
    return {
      isCorrect: true,
      similarity: 1.0
    };
  }

  const similarity = getSimilarity(normalizedGuess, normalizedCorrect);

  // Deem guess correct if similarity score >= 0.85 or substring match (> 5 chars)
  const isCorrect = similarity >= 0.85 || (normalizedCorrect.includes(normalizedGuess) && normalizedGuess.length > 5);

  return {
    isCorrect,
    similarity
  };
}
