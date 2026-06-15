# 🎨 UI/UX Design Specification (Neo-Skeuomorphism Edition)

## 🎨 Reddit-Inspired Dark Neumorphic Palette
The interface adopts a premium dark mode layout utilizing tactile, extruded elements, soft gradients, and physical lighting models.

| Token | Hex Value | CSS Neumorphic Role |
| --- | --- | --- |
| **Primary Accent** | `#FF4500` | Reddit Orange. Brand highlights, active glowing icons. |
| **Background** | `#0E1113` | Base canvas color. Flat surface color for all shadow calculations. |
| **Shadow Light** | `#1B2024` | Top-left highlights for outset extruded components. |
| **Shadow Dark** | `#040506` | Bottom-right shadows for depth and extrusion. |
| **Tactile Surfaces** | `#0E1113` | Soft convex/concave gradient fills matching the background. |
| **Body Text** | `#D7DADC` | Soft white body copy with letter-press indent styling. |
| **Success Glow** | `#46D160` | Tactile green led indicator for correct answers. |
| **Error Glow** | `#FF5C5C` | Tactile red led indicator for incorrect guesses. |

---

## 📐 Tactile Layout & Component Specs
- **Background Matching:** To achieve the neo-skeuomorphic effect, card background colors must match the parent container background (`#0E1113`) exactly, creating the illusion of shapes being extruded out of or recessed into the surface.
- **Outset Elements (Buttons, Cards):**
  - Background: `#0E1113`
  - Box Shadow: `8px 8px 16px #040506, -8px -8px 16px #1B2024`
  - Border: `1px solid rgba(255, 69, 0, 0.1)` (subtle orange rim on key elements)
- **Recessed Elements (Guess Inputs, Pressed States):**
  - Background: `#0E1113`
  - Box Shadow: `inset 6px 6px 12px #040506, inset -6px -6px 12px #1B2024`
- **Typography:** Capped at max-width `768px` using `Inter` with subtle text-shadow offsets for a letter-press look on headings.

---

## ⚙️ Micro-Interactions & Physical State Transitions
- **Button Press Action:** When a user clicks a button, transition it from **Outset** to **Recessed** (`transition: all 0.15s cubic-bezier(0.25, 0.8, 0.25, 1)`):
  - Active State Shadow: `inset 4px 4px 8px #040506, inset -4px -4px 8px #1B2024`
- **LED Indicators:** Correct/incorrect responses trigger a glowing physical LED lens on the cards:
  - Success LED: `box-shadow: 0 0 10px #46D160, inset 0 0 5px #46D160`
  - Error LED: `box-shadow: 0 0 10px #FF5C5C, inset 0 0 5px #FF5C5C`
- **Streak Flame Indicator:** Features a heat-pulsing outer glow mapping the Reddit-orange theme color.

