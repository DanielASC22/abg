import { useRef, useState, useCallback, useEffect } from 'react';
import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';

const THUMB_TIP = 4;
const FINGER_TIPS = [8, 12, 16, 20]; // Index, Middle, Ring, Pinky
const DEFAULT_PINCH_THRESHOLD = 0.045;

export interface HandTrackingState {
  isCameraMode: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  showLandmarks: boolean;
  pinchThreshold: number;
  error: string | null;
  pendingSlice: number | null;
  /** Last detected landmarks for rendering */
  landmarks: NormalizedLandmark[][] | null;
}

export function useHandTracking(onGestureTrigger: (sliceIndex: number) => void) {
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTriggerTimeRef = useRef<number[]>(new Array(8).fill(0));
  const DEBOUNCE_MS = 150;

  const [state, setState] = useState<HandTrackingState>({
    isCameraMode: false,
    isInitialized: false,
    isLoading: false,
    showLandmarks: true,
    pinchThreshold: DEFAULT_PINCH_THRESHOLD,
    error: null,
    pendingSlice: null,
    landmarks: null,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const initHandTracking = useCallback(async (video: HTMLVideoElement) => {
    setState(s => ({ ...s, isLoading: true, error: null }));
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      const createLandmarker = async (delegate: 'GPU' | 'CPU') =>
        HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate,
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });

      let handLandmarker: HandLandmarker;
      try {
        handLandmarker = await createLandmarker('GPU');
      } catch {
        console.warn('GPU delegate failed, falling back to CPU');
        handLandmarker = await createLandmarker('CPU');
      }

      handLandmarkerRef.current = handLandmarker;
      videoRef.current = video;
      setState(s => ({ ...s, isInitialized: true, isLoading: false }));
    } catch (err) {
      setState(s => ({ ...s, isLoading: false, error: (err as Error).message }));
    }
  }, []);

  const detectPinch = useCallback((landmarks: NormalizedLandmark[][], timestamp: number) => {
    const threshold = stateRef.current.pinchThreshold;
    const now = performance.now();

    landmarks.forEach((hand, handIdx) => {
      const thumb = hand[THUMB_TIP];
      // Determine handedness by thumb x position (mirrored video)
      // Left hand appears on right side of mirrored feed (thumb.x < 0.5)
      // We'll use index: if first detected hand has thumb on right side of frame, treat as left
      const isLeftHand = thumb.x > 0.5; // mirrored

      FINGER_TIPS.forEach((fingerIdx, i) => {
        const finger = hand[fingerIdx];
        const distance = Math.hypot(thumb.x - finger.x, thumb.y - finger.y);

        if (distance < threshold) {
          const padIndex = isLeftHand ? (3 - i) : i + 4;
          // Debounce per-pad
          if (now - lastTriggerTimeRef.current[padIndex] > DEBOUNCE_MS) {
            lastTriggerTimeRef.current[padIndex] = now;
            onGestureTrigger(padIndex);
            // Visual feedback
            setState(s => ({ ...s, pendingSlice: padIndex }));
            setTimeout(() => {
              setState(s => s.pendingSlice === padIndex ? { ...s, pendingSlice: null } : s);
            }, 200);
          }
        }
      });
    });
  }, [onGestureTrigger]);

  const startDetectionLoop = useCallback(() => {
    const landmarker = handLandmarkerRef.current;
    const video = videoRef.current;
    if (!landmarker || !video) return;

    let lastTime = -1;
    const detect = () => {
      if (!stateRef.current.isCameraMode) return;

      if (video.readyState >= 2 && video.currentTime !== lastTime) {
        lastTime = video.currentTime;
        const results = landmarker.detectForVideo(video, performance.now());
        if (results.landmarks && results.landmarks.length > 0) {
          setState(s => ({ ...s, landmarks: results.landmarks }));
          detectPinch(results.landmarks, performance.now());
        } else {
          setState(s => s.landmarks ? { ...s, landmarks: null } : s);
        }
      }
      animFrameRef.current = requestAnimationFrame(detect);
    };
    detect();
  }, [detectPinch]);

  const toggleCameraMode = useCallback(() => {
    setState(s => {
      const next = !s.isCameraMode;
      return { ...s, isCameraMode: next };
    });
  }, []);

  const setShowLandmarks = useCallback((v: boolean) => {
    setState(s => ({ ...s, showLandmarks: v }));
  }, []);

  const setPinchThreshold = useCallback((v: number) => {
    setState(s => ({ ...s, pinchThreshold: v }));
  }, []);

  // Start/stop detection loop based on camera mode
  useEffect(() => {
    if (state.isCameraMode && state.isInitialized) {
      startDetectionLoop();
    } else {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [state.isCameraMode, state.isInitialized, startDetectionLoop]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      handLandmarkerRef.current?.close();
    };
  }, []);

  return {
    handState: state,
    initHandTracking,
    toggleCameraMode,
    setShowLandmarks,
    setPinchThreshold,
  };
}
