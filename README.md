# AquaTrack

Smart aquarium startup hub built with React + Vite. Track water parameters, log maintenance, and keep a simple routine in one place.

## Features
- Water parameter dashboard with targets
- Maintenance checklist and reminders
- Logbook for routine tasks
- Gemini-powered guidance (optional)

## Local Development
**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set your Gemini key (optional):
   Create `.env.local` and add `GEMINI_API_KEY=your_key`
3. Start the dev server:
   `npm run dev`

## Build
```
npm run build
```

## Deploy to GitHub Pages
1. Set the Vite base to your repo path in `vite.config.ts`:
   `base: '/<repo>/'`
2. Add the GitHub Actions workflow from the setup guide.
3. Push to `main` and enable Pages (Settings → Pages → GitHub Actions).

## Notes
- `.env.local` is gitignored and should not be committed.

