# Amen Break Generator (Web)

A high-performance, algorithmic drum machine built with **React** and the **Web Audio API**. This application reimagines the iconic 1969 "Amen Break" as a real-time remixing tool, featuring manual keyboard triggering, automated algorithmic "Chaos," and experimental Computer Vision hand tracking.

## Key Features

### Manual & Ergonomic Playback

Designed for live performance, the 16-pad grid is mapped to your keyboard to minimize hand strain:

* **Row 1:** `1` `2` `3` `4`
* **Row 2:** `Q` `W` `E` `R`
* **Row 3:** `A` `S` `D` `F` (Home Row)
* **Row 4:** `Z` `X` `C` `V`
* **Quantization:** All triggers are sample-accurate and queued to the next th note.

### Sequence Queue Mode

Type directly into the sequence buffer to program complex rhythms.

* **Example String:** `12erascv1212zxcv`
* **Logic:** Each character triggers a corresponding th note slice.

### Computer Vision (CV) Mode

Utilizes **MediaPipe Hands** to allow for 8-slice "air-drumming":

* **Gestures:** Connect your thumb to any finger (Pinch) to trigger a pad.
* **Mapping:** 4 triggers for the left hand, 4 triggers for the right hand.

### The Generator Algorithm

* **Chaos Control:** A probability-based engine that decides whether to play the next sequential slice or jump to a random one, creating infinite, non-repeating breakbeats.

## Technical Stack

* **Framework:** React + Vite
* **Audio Engine:** Web Audio API (with custom scheduler for quantization)
* **Tracking:** MediaPipe Hands / TensorFlow.js
* **Styling:** Tailwind CSS (Industrial Steampunk Aesthetic)