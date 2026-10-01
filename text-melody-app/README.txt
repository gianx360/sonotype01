SONOTYPE — Gianx Labs

Lightweight static text-to-music experiment.

FILES
- index.html
- style.css
- app.js

DEPLOY TO NETLIFY
1. Unzip the project.
2. In Netlify, use Add new project > Deploy manually.
3. Drag the entire unzipped sonotype folder into the deploy area.
4. No build command, npm install, framework or environment variables are required.

FEATURES
- Any Unicode text / numbers / symbols
- Deterministic melody generation
- Major and natural minor keys
- Background chord progression
- Separate lightweight synthesized instrument presets for melody and chords
- Tempo control
- Browser-native live playback
- MIDI download with separate melody/chord MIDI channels and program changes
- WAV download

NOTE
The current parser supports all Unicode using the deterministic prototype mapping. The custom A–G / R language rules discussed during development can be added later without changing the interface/audio architecture.
