import { useRef, useEffect, useCallback } from 'react';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { HandTrackingState } from '@/hooks/useHandTracking';

interface CameraOverlayProps {
  handState: HandTrackingState;
  onVideoReady: (video: HTMLVideoElement) => void;
  onToggleCamera: () => void;
  onToggleLandmarks: () => void;
  onThresholdChange: (v: number) => void;
}

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

const PAD_LABELS_8 = [
  'L-Pinky', 'L-Ring', 'L-Mid', 'L-Idx',
  'R-Idx', 'R-Mid', 'R-Ring', 'R-Pinky',
];

export function CameraOverlay({
  handState,
  onVideoReady,
  onToggleCamera,
  onToggleLandmarks,
  onThresholdChange,
}: CameraOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => {
          videoRef.current!.play();
          onVideoReady(videoRef.current!);
        };
      }
    } catch (err) {
      console.error('Camera access denied:', err);
    }
  }, [onVideoReady]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (handState.isCameraMode) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [handState.isCameraMode, startCamera, stopCamera]);

  // Draw landmarks on canvas
  useEffect(() => {
    if (!handState.showLandmarks || !handState.landmarks || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    handState.landmarks.forEach((hand: NormalizedLandmark[]) => {
      // Draw connections
      ctx.strokeStyle = 'hsl(24, 100%, 50%)';
      ctx.lineWidth = 1.5;
      HAND_CONNECTIONS.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.moveTo(hand[a].x * canvas.width, hand[a].y * canvas.height);
        ctx.lineTo(hand[b].x * canvas.width, hand[b].y * canvas.height);
        ctx.stroke();
      });

      // Draw points
      hand.forEach((lm, i) => {
        const isFingerTip = [4, 8, 12, 16, 20].includes(i);
        ctx.beginPath();
        ctx.arc(lm.x * canvas.width, lm.y * canvas.height, isFingerTip ? 3 : 1.5, 0, Math.PI * 2);
        ctx.fillStyle = isFingerTip ? 'hsl(24, 100%, 60%)' : 'hsl(0, 0%, 70%)';
        ctx.fill();
      });
    });
  }, [handState.landmarks, handState.showLandmarks]);

  return (
    <div className="space-y-2">
      {/* Camera Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Camera Mode
          </span>
        </div>
        <button
          onClick={onToggleCamera}
          className={`
            px-3 py-1 rounded text-[10px] font-display uppercase tracking-wider
            transition-all duration-150
            ${handState.isCameraMode
              ? 'bg-primary text-primary-foreground led-glow'
              : 'surface-raised text-muted-foreground hover:brightness-125'
            }
          `}
        >
          {handState.isLoading ? 'Loading…' : handState.isCameraMode ? 'ON' : 'OFF'}
        </button>
      </div>

      {handState.isCameraMode && (
        <>
          {/* Video Feed + Landmark Canvas */}
          <div className="relative w-full aspect-[4/3] rounded-md overflow-hidden surface-inset">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover opacity-50"
              style={{ transform: 'scaleX(-1)' }}
              playsInline
              muted
            />
            {handState.showLandmarks && (
              <canvas
                ref={canvasRef}
                width={320}
                height={240}
                className="absolute inset-0 w-full h-full"
                style={{ transform: 'scaleX(-1)' }}
              />
            )}
            {/* Status indicator */}
            <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${handState.landmarks ? 'bg-[hsl(var(--led-green))] led-glow-green' : 'bg-[hsl(var(--led-red))] animate-pulse'}`} />
              <span className="text-[8px] font-mono text-foreground/60">
                {handState.landmarks ? `${handState.landmarks.length} hand${handState.landmarks.length > 1 ? 's' : ''}` : 'No hands'}
              </span>
            </div>
          </div>

          {/* 8-Pad Mapping Reference */}
          <div className="grid grid-cols-4 gap-1">
            {PAD_LABELS_8.map((label, i) => (
              <div
                key={i}
                className={`
                  text-center py-1 rounded text-[7px] font-mono
                  transition-all duration-75
                  ${handState.pendingSlice === i
                    ? 'pad-active text-primary-foreground'
                    : 'surface-raised text-muted-foreground'
                  }
                `}
              >
                <div className="font-display text-[9px]">{i + 1}</div>
                <div>{label}</div>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleLandmarks}
              className={`
                px-2 py-0.5 rounded text-[9px] font-mono
                ${handState.showLandmarks
                  ? 'bg-secondary text-foreground'
                  : 'surface-raised text-muted-foreground'
                }
              `}
            >
              Skeleton {handState.showLandmarks ? 'ON' : 'OFF'}
            </button>

            <div className="flex items-center gap-1.5 flex-1">
              <span className="text-[8px] font-mono text-muted-foreground whitespace-nowrap">Sensitivity</span>
              <input
                type="range"
                min={0.02}
                max={0.12}
                step={0.005}
                value={handState.pinchThreshold}
                onChange={e => onThresholdChange(parseFloat(e.target.value))}
                className="flex-1 h-1 accent-primary"
              />
            </div>
          </div>

          {handState.error && (
            <p className="text-[9px] text-destructive font-mono">{handState.error}</p>
          )}
        </>
      )}
    </div>
  );
}
