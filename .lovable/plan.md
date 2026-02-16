

## Add Reverse Notation to Sequences

### What it does
Lets users mark any slice(s) in a sequence as reversed by wrapping them in square brackets. For example:
- `[1]` -- plays slice 1 in reverse
- `[1wer]` -- plays slices 1, w, e, r all in reverse
- `1234 [qwer] asdf` -- only the middle group is reversed

### How it works
Instead of parsing the sequence as a flat character list, a pre-processing step scans for `[...]` blocks and tags each step with a `reverse` flag. The rest of the pipeline (playback and WAV export) already supports reverse -- it just needs to receive that flag per step.

### Technical Details

**1. Update sequence step type (`src/hooks/useAudioEngine.ts`)**
- Change `SequenceStep` from `number | null` to `{ slice: number; reverse: boolean } | null` (where `null` = rest, `-1` slice = hold).
- Add a `parseSequence(input: string)` helper that:
  - Tracks an `inBracket` boolean as it scans characters.
  - When it encounters `[`, sets `inBracket = true`; on `]`, sets it back to `false`.
  - For each valid character, produces `{ slice, reverse: inBracket }`.
  - Rests (`. `) and holds (`-`) pass through unchanged.

**2. Update `playSequence` scheduling (`src/hooks/useAudioEngine.ts`)**
- In the scheduler tick where sequence steps are consumed, pass the step's `reverse` flag to the existing `playSliceAtTime(slice, time, reverse, stutter)` call (currently hardcoded to `false` for sequences).

**3. Update `exportSequenceWAV` (`src/hooks/useAudioEngine.ts`)**
- Use the same `parseSequence()` function.
- When a step has `reverse: true`, use `reversedBufferRef.current` and mirror the offset (same math as `playSliceAtTime`).

**4. Update valid characters (`src/components/SequenceEditor.tsx`)**
- Add `[` and `]` to the `VALID_CHARS` set.
- The visual tracker already renders each character, so brackets will appear naturally in the step display (but won't count as playable steps).

**5. Update legend (`src/components/SequenceEditor.tsx`)**
- Add `[...] = reverse` to the legend line.

### Example sequences
| Input | Behavior |
|---|---|
| `1234` | Normal playback |
| `[1234]` | All four slices reversed |
| `12[34]` | Slices 1,2 normal; 3,4 reversed |
| `[1]w[e]r` | Slices 1,e reversed; w,r normal |

