# 🧪 Testing Strategy

## 🔺 Testing Pyramid Focus

### 1. Unit Tests (70%)
- Core score calculation functions.
- Streak calculations.
- Similarity matchers (Levenshtein distance).

### 2. Integration Tests (20%)
- Route handlers (`POST /guess` and `GET /daily`).
- Neon database CRUD operations.

### 3. End-to-End Tests (10%)
- Full user session flow from homepage to daily puzzle solving and result sharing.
