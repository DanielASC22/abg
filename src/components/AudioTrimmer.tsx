import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { encodeWAV } from '@/lib/wavEncoder';
import { SampleCalculator } from '@/components/SampleCalculator';

export function AudioTrimmer() {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [fileName, setFileName] = useState('');
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [waveformData, setWaveformData] = useState<number[] | null>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const durationSec = useMemo(() => {
    if (!audioBuffer) return 0;
    return audioBuffer.duration;
  }, [audioBuffer]);

  const formatTime = (sec: number) => {
    const min = Math.floor(sec / 60);
    const remSec = sec % 60;
    return `${min}:${remSec.toFixed(3).padStart(6, '0')}`;
  };

  const trimDurationSec = useMemo(() => {
    return Math.max(0, endSec - startSec);
  }, [startSec, endSec]);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }

    const arrayBuffer = await file.arrayBuffer();
    const decoded = await audioCtxRef.current.decodeAudioData(arrayBuffer);
    setAudioBuffer(decoded);
    setFileName(file.name);
    setStartSec(0);
    setEndSec(decoded.duration);

    const channel = decoded.getChannelData(0);
    const points = 400;
    const blockSize = Math.floor(channel.length / points);
    const data: number[] = [];
    for (let i = 0; i < points; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(channel[i * blockSize + j]);
      }
      data.push(sum / blockSize);
    }
    setWaveformData(data);
    e.target.value = '';
  }, []);

  // Drag logic
  const getSecFromMouseEvent = useCallback((e: MouseEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !durationSec) return null;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    return (x / rect.width) * durationSec;
  }, [durationSec]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (!durationSec) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;

    const startX = (startSec / durationSec) * w;
    const endX = (endSec / durationSec) * w;
    const threshold = 10; // px

    if (Math.abs(x - startX) < threshold) {
      setDragging('start');
    } else if (Math.abs(x - endX) < threshold) {
      setDragging('end');
    }
  }, [durationSec, startSec, endSec]);

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const sec = getSecFromMouseEvent(e);
      if (sec === null) return;
      const rounded = Math.round(sec * 1000) / 1000;
      if (dragging === 'start') {
        setStartSec(Math.min(rounded, endSec));
      } else {
        setEndSec(Math.max(rounded, startSec));
      }
    };

    const handleMouseUp = () => setDragging(null);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, getSecFromMouseEvent, startSec, endSec]);

  // Draw waveform
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

    ctx.fillStyle = 'hsl(0, 0%, 8%)';
    ctx.fillRect(0, 0, w, h);

    if (!waveformData || !audioBuffer) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.font = '12px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('UPLOAD AN AUDIO FILE', w / 2, h / 2);
      return;
    }

    const maxAmp = Math.max(...waveformData) || 1;
    const centerY = h / 2;

    const startFrac = startSec / durationSec;
    const endFrac = endSec / durationSec;
    const startX = startFrac * w;
    const endX = endFrac * w;

    // Dim outside trim
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, startX, h);
    ctx.fillRect(endX, 0, w - endX, h);

    // Trim region
    ctx.fillStyle = 'rgba(255, 102, 0, 0.08)';
    ctx.fillRect(startX, 0, endX - startX, h);

    // Waveform
    ctx.beginPath();
    ctx.strokeStyle = 'hsl(24, 100%, 50%)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < waveformData.length; i++) {
      const x = (i / waveformData.length) * w;
      const amp = (waveformData[i] / maxAmp) * (h * 0.4);
      if (i === 0) ctx.moveTo(x, centerY - amp);
      else ctx.lineTo(x, centerY - amp);
    }
    ctx.stroke();

    // Mirror
    ctx.beginPath();
    ctx.strokeStyle = 'hsl(24, 100%, 40%)';
    ctx.lineWidth = 1;
    for (let i = 0; i < waveformData.length; i++) {
      const x = (i / waveformData.length) * w;
      const amp = (waveformData[i] / maxAmp) * (h * 0.35);
      if (i === 0) ctx.moveTo(x, centerY + amp);
      else ctx.lineTo(x, centerY + amp);
    }
    ctx.stroke();

    // Center line
    ctx.strokeStyle = 'rgba(255, 102, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(w, centerY);
    ctx.stroke();

    // Drag handles
    const drawHandle = (x: number) => {
      ctx.strokeStyle = 'hsl(24, 100%, 50%)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();

      // Handle grip
      ctx.fillStyle = 'hsl(24, 100%, 50%)';
      ctx.beginPath();
      ctx.roundRect(x - 5, h / 2 - 14, 10, 28, 3);
      ctx.fill();

      // Grip lines
      ctx.strokeStyle = 'hsl(0, 0%, 8%)';
      ctx.lineWidth = 1;
      for (let dy = -6; dy <= 6; dy += 4) {
        ctx.beginPath();
        ctx.moveTo(x - 3, h / 2 + dy);
        ctx.lineTo(x + 3, h / 2 + dy);
        ctx.stroke();
      }
    };

    drawHandle(startX);
    drawHandle(endX);
  }, [waveformData, audioBuffer, startSec, endSec, durationSec]);

  const handlePreview = useCallback(() => {
    if (!audioBuffer || !audioCtxRef.current) return;

    if (isPlaying && sourceRef.current) {
      sourceRef.current.stop();
      setIsPlaying(false);
      return;
    }

    const ctx = audioCtxRef.current;
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start(0, startSec, trimDurationSec);
    sourceRef.current = source;
    setIsPlaying(true);

    source.onended = () => {
      setIsPlaying(false);
      sourceRef.current = null;
    };
  }, [audioBuffer, startSec, trimDurationSec, isPlaying]);

  const handleDownload = useCallback(() => {
    if (!audioBuffer) return;

    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(startSec * sampleRate);
    const endSample = Math.floor(endSec * sampleRate);
    const length = endSample - startSample;

    if (length <= 0) return;

    const trimmedBuffer = new AudioContext().createBuffer(
      audioBuffer.numberOfChannels,
      length,
      sampleRate
    );

    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const src = audioBuffer.getChannelData(ch);
      const dst = trimmedBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        dst[i] = src[startSample + i];
      }
    }

    const blob = encodeWAV(trimmedBuffer);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = fileName.replace(/\.[^.]+$/, '');
    a.download = `${baseName}_trimmed.wav`;
    a.click();
    URL.revokeObjectURL(url);
  }, [audioBuffer, startSec, endSec, fileName]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
        <span className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Audio Trimmer
        </span>
      </div>

      {/* Upload */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="surface-raised px-4 py-2 rounded text-xs font-display uppercase tracking-wider text-muted-foreground hover:text-foreground hover:brightness-125 transition-all"
        >
          ↑ Upload Audio
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFile}
          className="hidden"
        />
        {fileName && (
          <span className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-[200px]">
            {fileName}
          </span>
        )}
      </div>

      {/* Waveform with drag handles */}
      <div className="hardware-panel rounded-md p-1">
        <canvas
          ref={canvasRef}
          className="w-full rounded-sm"
          style={{ height: '140px', cursor: dragging ? 'grabbing' : 'default' }}
          onMouseDown={handleCanvasMouseDown}
        />
      </div>

      {audioBuffer && (
        <>
          {/* Trim controls in seconds */}
          <div className="flex flex-wrap items-end gap-4 [&_input]:appearance-none [&_input::-webkit-inner-spin-button]:appearance-none [&_input::-webkit-outer-spin-button]:appearance-none [&_input]:[-moz-appearance:textfield]">
            <div className="flex flex-col gap-1">
              <label className="font-display text-[9px] uppercase tracking-wider text-muted-foreground">
                Start (sec)
              </label>
              <input
                type="number"
                step="0.001"
                value={parseFloat(startSec.toFixed(3))}
                onChange={(e) => setStartSec(Number(e.target.value) || 0)}
                className="w-24 h-7 rounded bg-[hsl(var(--surface-inset))] border border-border text-center font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-[9px] text-muted-foreground/50 font-mono">
                {formatTime(startSec)}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-display text-[9px] uppercase tracking-wider text-muted-foreground">
                End (sec)
              </label>
              <input
                type="number"
                step="0.001"
                value={parseFloat(endSec.toFixed(3))}
                onChange={(e) => setEndSec(Number(e.target.value) || 0)}
                className="w-24 h-7 rounded bg-[hsl(var(--surface-inset))] border border-border text-center font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-[9px] text-muted-foreground/50 font-mono">
                {formatTime(endSec)}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-display text-[9px] uppercase tracking-wider text-muted-foreground">
                Total Duration
              </label>
              <div className="h-7 flex items-center">
                <span className="font-mono text-xs text-primary">
                  {durationSec.toFixed(3)}s
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground/50 font-mono">
                {formatTime(durationSec)}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-display text-[9px] uppercase tracking-wider text-muted-foreground">
                Trim Length
              </label>
              <div className="h-7 flex items-center">
                <span className="font-mono text-xs text-primary">
                  {trimDurationSec.toFixed(3)}s
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground/50 font-mono">
                {formatTime(trimDurationSec)}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handlePreview}
              className="surface-raised px-4 py-2 rounded text-xs font-display uppercase tracking-wider text-muted-foreground hover:text-foreground hover:brightness-125 transition-all"
            >
              {isPlaying ? '■ Stop' : '▶ Preview'}
            </button>
            <button
              onClick={handleDownload}
              disabled={trimDurationSec <= 0}
              className="surface-raised px-4 py-2 rounded text-xs font-display uppercase tracking-wider text-primary hover:brightness-125 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ↓ Download WAV
            </button>
          </div>
        </>
      )}

      {/* Sample Calculator */}
      <div className="mt-4">
        <SampleCalculator />
      </div>
    </div>
  );
}
