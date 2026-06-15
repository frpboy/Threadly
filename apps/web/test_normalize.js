const normalizeString = (str) => {
  return str
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .trim()
    .replace(/s$/, "");
};

function editDistance(s1, s2) {
  const s1_lower = s1.toLowerCase();
  const s2_lower = s2.toLowerCase();

  const costs = [];
  for (let i = 0; i <= s1_lower.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2_lower.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (s1_lower.charAt(i - 1) !== s2_lower.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) {
      costs[s2_lower.length] = lastValue;
    }
  }
  return costs[s2_lower.length];
}

function getSimilarity(s1, s2) {
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

const guess = "PROGRAMMING LANGUAGES";
const answer = "programming languages";

const normalizedGuess = normalizeString(guess);
const normalizedCorrect = normalizeString(answer);

console.log("normalizedGuess:", JSON.stringify(normalizedGuess));
console.log("normalizedCorrect:", JSON.stringify(normalizedCorrect));
console.log("exact match:", normalizedGuess === normalizedCorrect);

const similarity = getSimilarity(normalizedGuess, normalizedCorrect);
console.log("similarity:", similarity);
console.log("isCorrect condition:", similarity >= 0.85 || normalizedCorrect.includes(normalizedGuess) && normalizedGuess.length > 5);
