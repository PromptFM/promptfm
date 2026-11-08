# Accessibility Statement

PromptFM is dedicated to making autonomous 24/7 AI-generated radio accessible to all listeners, creators, and contributors, including individuals with visual, auditory, motor, or cognitive disabilities.

We continually improve our platform's accessibility by applying the [Web Content Accessibility Guidelines (WCAG) 2.1 Level AA](https://www.w3.org/TR/WCAG21/) standards.

---

## Conformance Status

PromptFM targets full conformance with **WCAG 2.1 Level AA**. Every user interface component, interactive control, and streaming audio workflow is designed to be accessible without requiring pointing devices or sight.

---

## Key Accessibility Features

### 1. Keyboard Navigation & Shortcuts
Listeners can fully operate the PromptFM radio player, switch channels, adjust audio parameters, and participate in community voting using only a keyboard:

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `Space` or `K` | **Play / Pause** | Toggles the active live radio stream. |
| `M` | **Mute / Unmute** | Toggles audio output without stopping stream reception. |
| `1` – `5` | **Switch Channels** | Jumps directly to channels (1: Synthwave, 2: Lofi Chill, 3: Cyberpunk, 4: Ambient, 5: Neural Jazz). |
| `ArrowUp` / `ArrowDown` | **Volume Control** | Increases or decreases volume by 5%. |
| `Tab` / `Shift + Tab` | **Element Navigation** | Moves forward and backward through interactive elements with high-visibility focus indicators (`ring-2 ring-emerald-500`). |
| `Escape` (`Esc`) | **Close Dialog** | Closes open modals, drawers, station menus, or settings overlays. |
| `Enter` or `Space` | **Activate Control** | Activates buttons, votes for songs, and submits prompt adjustments. |

### 2. Screen Reader & Assistive Technology Support
- **Dynamic Live Announcements (`aria-live="polite"`)**: Track transitions, artist metadata, DJ voice drop intros/outros, and voting results are announced dynamically to screen readers without interrupting audio playback.
- **Semantic HTML5 Landmarks**: The application layout uses explicit semantic regions (`<header>`, `<nav>`, `<main>`, `<aside>`, and `<footer>`) allowing screen reader users to jump directly to primary controls.
- **Rich ARIA Semantics**: Volume and seek sliders implement `role="slider"` with dynamic `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and descriptive `aria-valuetext`.
- **Descriptive Labels**: All icon-only buttons (such as play, pause, skip, and volume) include accessible labels (`aria-label`) and state toggles (`aria-pressed`).

### 3. Motion & Contrast Preferences
- **Reduced Motion (`prefers-reduced-motion: reduce`)**: When enabled in operating system preferences, all non-essential CSS transitions, spinning vinyl animations, and real-time audio canvas visualizer particles are disabled.
- **High Contrast Support (`prefers-contrast: more`)**: Ensures text-to-background contrast ratios exceed **4.5:1** for standard body text and **3:1** for large text and interactive icons.
- **Skip Navigation**: A "Skip to main content" link is positioned at the top of the page for quick keyboard traversal to the radio station controls.

---

## Supported Environments

PromptFM is tested and verified against the following browsers and assistive technologies:

| Environment | Supported Versions / Tools |
| :--- | :--- |
| **Desktop Browsers** | Chrome (latest 2 versions), Firefox (latest 2 versions), Safari (latest 2 versions), Edge (latest 2 versions) |
| **Mobile Browsers** | Safari on iOS, Chrome on Android |
| **Screen Readers** | VoiceOver (macOS / iOS), NVDA (Windows), JAWS (Windows), TalkBack (Android) |
| **Operating Systems** | macOS, Windows, Linux, iOS, Android |

---

## Known Limitations & Alternative Solutions

While we strive for comprehensive accessibility, certain features present technical challenges:

1. **Real-time Audio Visualizer Canvas**:
   - *Limitation*: The FFT spectrum frequency visualizer renders to an HTML5 `<canvas>` element which cannot be parsed directly by screen readers.
   - *Alternative*: All track information, BPM, key, and neural DJ voice drop descriptions are fully mirrored in text via standard DOM elements and `aria-live` announcer regions.
2. **Audio Buffering Latency**:
   - *Limitation*: Live Icecast stream reconnects may introduce buffering delays.
   - *Alternative*: Buffering status is accompanied by visual text indicators and ARIA live region updates informing users of stream connection progress.

---

## Reporting Accessibility Barriers

We welcome your feedback on the accessibility of PromptFM. If you encounter any barriers or have suggestions for improvements:

- **Email**: [a11y@promptfm.live](mailto:a11y@promptfm.live)
- **GitHub Issue**: [Open an Accessibility Issue](https://github.com/PromptFM/promptfm/issues/new?labels=accessibility&template=bug_report.md)
- **Maintainer Contact**: **@atrifan**

### Our Commitment:
We will acknowledge receipt of your accessibility feedback within **2 business days** and provide a proposed remediation plan within **7 business days**.

