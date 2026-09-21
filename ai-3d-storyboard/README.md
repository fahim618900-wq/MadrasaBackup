# AI 3D Storyboard & Video Generator

A full-stack, browser-first storyboard studio built with React, React Three Fiber, Three.js, Tailwind CSS, Lucide, and an Express integration API.

## Features

- Interactive 3D viewport with stylized low-poly primitive characters: Robot, Boy, Girl, Alien.
- Room, Park, and Sci-Fi Stage environments with lighting and orbit controls.
- Scene timeline with add/delete/select, duration, character, action, camera, and dialogue controls.
- Browser SpeechSynthesis preview for dialogue.
- AI Auto-Director integration endpoint at POST /api/parse-script.
- Local heuristic parser fallback when the API is unavailable.
- Real-time playback and camera direction presets.
- WebM export using MediaRecorder + canvas.captureStream().
- Production extension point for server TTS and audio/video muxing.

## Run locally

```bash
cd ai-3d-storyboard
npm install
npm run dev
```

Client: http://localhost:5173
API: http://localhost:8787

## Production notes

The Web Speech API is intentionally used for preview because browsers do not expose SpeechSynthesis output as a MediaStream that can reliably be muxed by MediaRecorder. Therefore the built-in exporter captures the WebGL canvas to WebM. For final audio-video production, replace the TTS preview with a server-side TTS provider that returns an audio file/stream, then mux it with the rendered frames using a server media pipeline such as FFmpeg.

The parser endpoint is intentionally provider-neutral. A production AI provider can be added inside server/index.js while keeping the frontend contract unchanged.

## Deployment

The React client can be deployed to any static host. The Express API needs a Node-capable host. Configure Vite's production API URL or reverse-proxy /api to the Express service.

## Project structure

- `src/App.jsx` — application state, timeline, viewer, controls, TTS preview, export.
- `src/index.css` — glassmorphic dark UI.
- `server/index.js` — parser API and health endpoint.
- `vite.config.js` — Vite + Tailwind + local API proxy.
