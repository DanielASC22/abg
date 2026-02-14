import { useRef, useEffect } from 'react';

interface WaveformDisplayProps {
  waveformData: number[] | null;
  activeSlice: number | null;
  numSlices?: number;
}

export function WaveformDisplay({ waveformData, activeSlice, numSlices = 16 }: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Background
    ctx.fillStyle = 'hsl(0, 0%, 8%)';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < numSlices; i++) {
      const x = (i / numSlices) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Active slice highlight
    if (activeSlice !== null) {
      const sliceW = w / numSlices;
      ctx.fillStyle = 'rgba(255, 102, 0, 0.15)';
      ctx.fillRect(activeSlice * sliceW, 0, sliceW, h);

      // Highlight border
      ctx.strokeStyle = 'rgba(255, 102, 0, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(activeSlice * sliceW, 0, sliceW, h);
    }

    // Waveform
    if (waveformData) {
      const centerY = h / 2;
      const maxAmp = Math.max(...Array.from(waveformData)) || 1;

      ctx.beginPath();
      ctx.strokeStyle = 'hsl(24, 100%, 50%)';
      ctx.lineWidth = 1.5;

      for (let i = 0; i < waveformData.length; i++) {
        const x = (i / waveformData.length) * w;
        const amp = (waveformData[i] / maxAmp) * (h * 0.4);
        if (i === 0) {
          ctx.moveTo(x, centerY - amp);
        } else {
          ctx.lineTo(x, centerY - amp);
        }
      }
      ctx.stroke();

      // Mirror
      ctx.beginPath();
      ctx.strokeStyle = 'hsl(24, 100%, 40%)';
      ctx.lineWidth = 1;
      for (let i = 0; i < waveformData.length; i++) {
        const x = (i / waveformData.length) * w;
        const amp = (waveformData[i] / maxAmp) * (h * 0.35);
        if (i === 0) {
          ctx.moveTo(x, centerY + amp);
        } else {
          ctx.lineTo(x, centerY + amp);
        }
      }
      ctx.stroke();

      // Center line
      ctx.strokeStyle = 'rgba(255, 102, 0, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(w, centerY);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.font = '12px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('NO SAMPLE LOADED', w / 2, h / 2);
    }

    // Slice numbers at bottom
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.font = '9px "JetBrains Mono"';
    ctx.textAlign = 'center';
    for (let i = 0; i < numSlices; i++) {
      const sliceW = w / numSlices;
      const x = i * sliceW + sliceW / 2;
      ctx.fillText(`${i + 1}`, x, h - 4);
    }
  }, [waveformData, activeSlice, numSlices]);

  return (
    <div className="hardware-panel rounded-md p-1">
      <canvas
        ref={canvasRef}
        className="w-full rounded-sm"
        style={{ height: '120px' }}
      />
    </div>
  );
}
