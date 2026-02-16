

## Add WAV Export for Sequences

### What it does
Adds an "Export WAV" button to the Sequence Editor that renders the current sequence (with all active effects -- filter, bitcrusher, delay) to a downloadable `.wav` file. Everything runs client-side using the Web Audio API, so no server or paid service is needed.

### How it works
1. An `OfflineAudioContext` replays each step of the sequence through the same DSP chain (filter, bitcrusher, limiter, delay) at the current BPM and time settings.
2. The resulting audio buffer is encoded as a 16-bit PCM WAV file using a small built-in utility function.
3. The browser downloads the file automatically.

### Technical Details

**1. New utility: `src/lib/wavEncoder.ts`**
- A pure function `encodeWAV(buffer: AudioBuffer): Blob` that converts an `AudioBuffer` to a 16-bit PCM WAV `Blob`.
- ~30 lines, no dependencies.

**2. New export function in `src/hooks/useAudioEngine.ts`**
- Add an `exportSequenceWAV(input: string): Promise<Blob>` function that:
  - Parses the sequence string into steps (reuses existing `CHAR_TO_SLICE` mapping).
  - Calculates total duration from step count, BPM, time multiplier, and quantize mode.
  - Creates an `OfflineAudioContext` with matching sample rate and duration.
  - Rebuilds the DSP chain (filter, bitcrusher, limiter, delay) using current state values inside the offline context.
  - Schedules each slice at the correct time (same logic as `playSliceAtTime` but targeting the offline context).
  - Calls `offlineCtx.startRendering()` to get the rendered `AudioBuffer`.
  - Returns the WAV blob via `encodeWAV()`.
- Expose `exportSequenceWAV` from the hook's return object.

**3. UI update: `src/components/SequenceEditor.tsx`**
- Accept a new prop `onExportWAV: (input: string) => Promise<Blob>`.
- Add an "Export WAV" button next to the Play/Stop button (disabled while playing or if sequence is empty).
- On click, calls `onExportWAV(input)`, creates a download link, and triggers the download.
- Shows a brief loading state ("Rendering...") while the offline render runs.

**4. Wire it up in `src/pages/Index.tsx`**
- Pass the new `exportSequenceWAV` function from the hook to `SequenceEditor` as `onExportWAV`.

### Cost
Zero -- this is entirely client-side using built-in browser APIs.

