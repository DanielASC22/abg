

## Add a Sample Length Calculator

### What it does
Adds a small calculator panel to the Sampler tab where users can input the number of bars and BPM to instantly see the exact sample duration (in seconds and milliseconds) they should trim their audio to for perfect looping.

### Formula
```
duration = (bars * beatsPerBar * 60) / BPM
```
Using 4/4 time signature (4 beats per bar), so: `duration = (bars * 4 * 60) / BPM`

### Example outputs
| Bars | BPM | Duration |
|------|-----|----------|
| 1 | 120 | 2.000s |
| 2 | 170 | 2.824s |
| 4 | 140 | 6.857s |

### Technical Details

**1. New component: `src/components/SampleCalculator.tsx`**
- Two number inputs: Bars (1-64, default 4) and BPM (20-300, default from engine state).
- Displays computed duration in seconds (3 decimal places) and also as `minutes:seconds.ms`.
- Styled to match the existing hardware aesthetic (font-display labels, font-mono values, surface-raised styling).
- Compact layout -- a single row with inputs and result.

**2. Wire into `src/pages/Index.tsx`**
- Place the calculator below the waveform display in the Sampler tab, above the trigger pads section.
- Pass the current `state.bpm` as the default BPM value so it stays in sync.

No changes to the audio engine or any other existing components.

