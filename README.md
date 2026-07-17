# Wayfinder - https://anirudhvemula.github.io/wayfinder/

A minimal, memory-free conversational companion, with Merlin (via Clippy.js) as an
animated on-screen character. Front end on GitHub Pages, a one-file serverless proxy on
Vercel keeps your Gemini API key hidden.

> **Status:** v1 (2D Clippy-based) is live and working. A full 3D/VR reimagining is in
> concept phase — see [Roadmap: Merlin in VR](#roadmap-merlin-in-vr) below.

## What's inside
- **Chat**: powered by Gemini 2.5 Flash, called through your own Vercel proxy so the key
  never reaches the browser.
- **Merlin**: loaded via Clippy.js from a public CDN. The app asks Merlin for his full
  list of built-in animations at runtime and gives that exact list to Gemini, so the
  model picks animation cues (`[[AnimationName]]`) that fit the tone of its own reply.
- **Speech**: replies are also spoken aloud using the browser's built-in Web Speech API
  (`agent.speak(text, { tts: true })`). Voice quality depends entirely on the visitor's
  browser/OS — some sound natural, some robotic, and a few browsers may not support it
  at all, in which case Merlin just shows the text bubble.
- **Wandering**: every 9–18 seconds, if no reply is in progress, Merlin repositions
  himself to a random spot on screen (avoiding the input box) with a smooth CSS
  transition. Wandering automatically pauses while he's thinking/speaking and resumes
  right after, so it never interrupts the conversation.

## Notes on privacy & scope
- No accounts, no database, no cookies, no localStorage.
- Conversation history lives only in the browser tab's JavaScript memory and is gone on
  refresh or close.
- The Vercel function does not log message content — only generic errors if something
  fails.
- Your Gemini key lives only in Vercel's environment variables; it is never sent to the
  browser.
- Merlin's character assets and animation engine load from a public CDN
  (`cdn.jsdelivr.net/npm/clippyjs`) at page load — this is a read-only asset fetch, not
  a service that receives your conversation data.
- The free Gemini tier has rate limits shared across everyone using this deployed page.
  If it's shared widely and gets heavy use, you may hit those limits — Google's docs
  describe current quotas at https://ai.google.dev/gemini-api/docs/rate-limits.

## If Merlin doesn't appear
- Open the browser console (F12) — Clippy.js occasionally has CDN hiccups; a failed
  import will show there.
- TTS speech requires the page to be interacted with first in some browsers (autoplay
  policies) — clicking into the input box before sending your first message helps.

---

# Roadmap: Merlin in VR

The 2D Clippy-based Merlin is a proof of concept. The next milestone is a fully 3D,
WebXR-accessible wizard's chamber — a persistent, atmospheric space Merlin actually
lives in, rather than a sprite wandering a flat page. This section captures the concept
work and the technical path from here to there.

### Concept environment

Early concept renders (see `/concepts` if included in this repo) explored a stone
chamber housing Merlin: a cauldron, fireplace, bookshelves, a summoning circle,
astrological instruments, and clutter befitting a working wizard's study. That
direction — dense, lived-in, warmly lit — is the visual baseline going forward.

### Planned features

**Presence & attention**
- 🧙 Merlin stands beside a roaring fireplace and turns to face the user as they speak,
  rather than a static idle pose.

**Memory made visual**
- 📜 Scrolls physically unroll to display previous conversation turns, replacing (or
  supplementing) a flat chat log UI. Note: this reintroduces a visible history the
  current 2D version deliberately avoids — see [privacy tradeoffs](#privacy-tradeoffs-in-vr).

**Ambient sentiment feedback**
- 🧪 The cauldron shifts color depending on conversation tone/topic:
  - 🟢 Green — casual conversation
  - 🔵 Blue — technical discussions
  - 🟣 Purple — philosophical topics
  - 🔴 Red — warnings/errors
  - This requires a lightweight sentiment/topic classification pass on each model
    response (or a cheap heuristic/keyword pass) feeding a scene-state variable.

**Command-triggered spell effects**
- ✨ Certain phrases trigger scripted visual "spells":
  - "Show me my projects" → floating manuscripts appear.
  - "Tell me about fractals" → magical geometric projections emerge.
  - "Play music" → enchanted instruments materialize.
  - These will likely be implemented as an intent-matching layer between the LLM
    response and the scene manager, rather than the LLM directly controlling 3D
    objects.

**Secondary space**
- 🌌 A hidden observatory above the chamber, reached when conversation drifts toward
  astronomy, AI, or philosophy — transporting the user into a star dome environment.

**Ambient life (non-interactive polish)**
- 🕸️ Spiders crawling occasionally
- 📚 Books rearranging themselves on shelves
- 🕯️ Candles flickering in sync with Merlin's speech
- 🐦‍⬛ Ravens perched on shelves
- ✨ Magical particles trailing the VR controllers

### Why the current architecture already supports this

The existing pipeline separates concerns in a way that maps directly onto a 3D scene
without a rewrite — the LLM layer doesn't need to know or care that its output is about
to drive a fireplace and a cauldron instead of a CSS `transform`:

```
LLM
 ↓
Merlin Personality Layer
 ↓
Speech + Animation Events
 ↓
3D Scene State Manager
 ↓
WebXR / Three.js / Babylon.js
```

- **LLM** — unchanged. Still Gemini 2.5 Flash via the Vercel proxy.
- **Merlin Personality Layer** — unchanged in principle. Currently maps reply tone to
  a Clippy animation name; in VR it additionally emits structured metadata (sentiment,
  topic, detected intent/command) alongside the reply text.
- **Speech + Animation Events** — Web Speech API TTS carries over as-is. Animation
  events expand from "play this 2D sprite clip" to "play this 3D animation clip /
  trigger this particle system."
- **3D Scene State Manager** (new) — a thin layer that owns cauldron color, active
  spell effects, observatory transition state, and ambient-detail timers. Consumes
  the personality layer's metadata; has no direct knowledge of the LLM or prompt.
- **WebXR / Three.js / Babylon.js** (new) — rendering layer. Three.js (via `@react-three/fiber`
  if the front end moves to React, or vanilla) is the lighter-weight option; Babylon.js
  has stronger built-in WebXR tooling out of the box. Either can consume events from
  the Scene State Manager without it knowing which renderer is underneath.

### Suggested build order

1. **Static scene first** — build the chamber as a static Three.js/Babylon.js scene
   (no chat wiring yet), get lighting, fireplace, cauldron, and prop placement right,
   and confirm frame rate is acceptable in a headset before adding logic.
2. **Wire up existing chat** — connect the current Gemini proxy to drive Merlin's
   speech and a basic turn-to-face animation. This alone gets you from "2D Clippy" to
   "3D Merlin," independent of the fancier features below.
3. **Add the Scene State Manager** — introduce cauldron color state and wire it to a
   simple sentiment/topic heuristic (upgrade to a real classifier later if needed).
4. **Add command-triggered spells** — start with one or two (e.g. "show my projects")
   before generalizing to an intent-matching layer.
5. **Add the observatory transition** — this is the most complex single feature
   (a full scene/state transition) and is a reasonable stretch goal rather than a v1
   requirement.
6. **Ambient life pass last** — spiders, self-rearranging books, ravens, and
   controller particles are pure polish and are cheapest to add once the core loop
   is proven and performant.

### Privacy tradeoffs in VR

The current 2D version is deliberately memory-free — no history persists past a page
refresh. Visualizing "scrolls unrolling with previous conversations" implies keeping
conversation history in memory for longer than a single exchange, and possibly across
sessions if the scrolls are meant to persist. If this is implemented, it's worth
deciding explicitly (and documenting here) whether that history:
- stays session-only in browser memory (consistent with current privacy notes), or
- persists across sessions (would require some form of storage and a corresponding
  update to the privacy section above).

### Open technical questions

- **Framework choice**: Three.js vs. Babylon.js vs. a WebXR-specific framework
  (e.g. A-Frame) — depends on team familiarity and how much of the existing
  `index.html`/vanilla-JS structure should carry over.
- **Sentiment/topic classification**: a second LLM call per turn (more accurate, more
  latency/cost) vs. a local heuristic/keyword approach (cheaper, cruder).
- **Hosting**: GitHub Pages can serve static WebXR content fine, but larger 3D assets
  (models, textures) may want a CDN rather than living in the repo directly.
- **Performance budget**: particle effects (cauldron steam, candle flicker, controller
  trails) are the likely first casualty if frame rate drops in-headset — worth
  prototyping and profiling early rather than after the full scene is built.

Contributions, concept art, and prototype branches toward this roadmap are welcome —
open an issue or PR to discuss approach before large changes.
