

## Fix: Amen Break Not Loading on GitHub Pages

### Problem
The audio file is fetched using a hardcoded absolute path `/audio/amen-break.mp3`. On GitHub Pages, the app is deployed under the `/abg/` subpath, so the correct URL is `/abg/audio/amen-break.mp3`. The current code works in the Lovable preview (where base is `/`) but fails on the deployed site.

### Solution
Use Vite's `import.meta.env.BASE_URL` to dynamically prefix the audio path, so it resolves correctly in both environments.

### Technical Details

**File: `src/hooks/useAudioEngine.ts`**

Change line 4 from:
```
const AMEN_URL = '/audio/amen-break.mp3';
```
to:
```
const AMEN_URL = `${import.meta.env.BASE_URL}audio/amen-break.mp3`;
```

`import.meta.env.BASE_URL` returns `/` in development and `/abg/` in production (matching the `base` value in `vite.config.ts`), so the path will always resolve correctly.

This is a one-line fix. No other files need to change.

