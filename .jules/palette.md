# Palette's Journal - Critical UX/Accessibility Learnings

## 2026-11-06 - Neumorphic Controls Need Explicit Focus Visible Rings
**Learning:** Neumorphic UI design relying solely on subtle surface shadows (`shadow-neumorphic-button` and `shadow-neumorphic-inset`) makes it difficult for keyboard navigation users to identify active focus states.
**Action:** Always provide explicit two-tone focus indicators (`focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black`) that remain visible against both dark and light surfaces and preserve keyboard focus in forced-colors mode and descriptive `aria-label`s on icon-only buttons (theme toggle, help, archive navigation) to maintain both tactile aesthetics and WCAG keyboard accessibility.
