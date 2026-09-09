# Neon Snake

A lightweight Snake game that runs entirely in the browser. It has no ads, no analytics, no external assets, and no network requests.

## Run During Development

```bash
npm install
npm run dev
```

Open the local address shown by Vite. The development server is only needed while developing the game.

## Build For Offline Use

```bash
npm run build
```

The build creates `dist/index.html`. The Vite single-file plugin inlines the JavaScript and CSS, so the file can be copied to another computer and opened directly in a modern browser without internet access or a server.

## Controls

- Arrow keys or W/A/S/D: steer the snake
- Swipe inside the board: steer on touch screens
- Spacebar or Escape: pause and resume
- Sound button: mute or unmute generated sound effects

Scores are saved in the browser's local storage under `neon-snake-high-score`. Sound preference is saved under `neon-snake-sound`. No game data leaves the device.