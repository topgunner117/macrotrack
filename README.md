# MacroTrack

A simple personal food + macro tracker. One self-contained `index.html` — no build step, no framework, all data stored locally in your browser.

## Features
- **Daily rings** for Calories / Protein / Carbs / Fat vs your targets (defaults: **1800 kcal · 130g P · 195g C · 55g F**).
- **Scan a nutrition label** with a photo → Gemini Flash-Lite reads it into structured numbers (you can fix any before saving).
- **Search foods without a label** (chicken, rice, banana…) via the free USDA FoodData Central database (per 100 g).
- **Manual entry** for anything.
- **History** — every past day with an "On track / Off target" badge (on track = calories at/under target **and** protein at/over target).
- Navigate days with the ‹ › arrows; tap the date to jump back to Today.

## Setup (one time)
1. Get a **free Gemini API key** at https://aistudio.google.com/apikey
2. Open the app → **Settings** → paste the key → **Save**.
3. (Optional) Get a free USDA key at https://fdc.nal.usda.gov/api-key-signup and paste it too. Without one it uses `DEMO_KEY`, which works but is rate-limited.

The Gemini free tier covers a personal amount of scanning at **$0**.

## Run it
**Easiest:** just double-click `index.html` — it opens in your browser and works.

**As a local server** (needed only if a browser blocks the camera on `file://`):
```
node server.js
```
then open http://localhost:4321

## Put it on your phone
Host the folder for free (GitHub Pages, Netlify drop, or Vercel) and open the URL on your phone. On iPhone/Android use **Add to Home Screen** to get an app icon. Enter your Gemini key once in Settings on the phone.

## Notes
- All food logs + your key live only in this browser (localStorage). Clearing site data erases them. Keep the app to yourself since the key is stored client-side.
- Model defaults to `gemini-2.5-flash-lite`; you can change it in Settings if Google renames it.
