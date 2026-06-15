# 🧠 State Management Strategy

We use **Zustand** for client-side state control.

### Store: `usePuzzleStore`
Tracks current session details:
- `puzzleId`: `string`
- `cluesRevealedCount`: `number`
- `isCorrect`: `boolean`
- `guessHistory`: `string[]`
- `actions`:
  - `revealNextClue()`
  - `addGuess(guess)`
