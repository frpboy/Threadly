# Palette's Journal - Critical UX/Accessibility Learnings

## 2026-11-02 - Neumorphic input and icon button accessibility
**Learning:** Neumorphic UI designs tend to replace semantic inputs and icon-only buttons with stylized divs or unlabelled buttons with subtle borders that lack visible focus states and accessible labels for screen readers. In addition, action buttons (like submit or toggle) need explicit `disabled` states and keyboard focus rings that contrast with the dark/light neumorphic backgrounds.
**Action:** When working with the neumorphic styling on Threadly, always provide `focus-visible:ring-2`, semantic `<label>` elements with `sr-only` or `aria-label`, and ensure disabled states reflect empty inputs so users receive immediate interaction feedback.
