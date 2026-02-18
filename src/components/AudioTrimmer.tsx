import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { encodeWAV } from '@/lib/wavEncoder';

export function AudioTrimmer() {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [fileName, setFileName] = useState('');
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [waveformData, setWaveformData] = useState<number[] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const durationMs = useMemo(() => {
    if (!audioBuffer) return 0;
    return Math.round(audioBuffer.duration * 1000);
  }, [audioBuffer]);

  const formatTime = (ms: number) => {
    const totalSec = ms / 1000;
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toFixed(3).padStart(6, '0')}`;
  };

  const trimDurationMs = useMemo(() => {
    return Math.max(0, endMs - startMs);
  }, [startMs, endMs]);

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
    setStartMs(0);
    setEndMs(Math.round(decoded.duration * 1000));

    // Generate waveform
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

    // Background
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

    // Trim region highlight
    const startFrac = startMs / durationMs;
    const endFrac = endMs / durationMs;
    const startX = startFrac * w;
    const endX = endFrac * w;

    // Dim outside trim
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, startX, h);
    ctx.fillRect(endX, 0, w - endX, h);

    // Trim region
    ctx.fillStyle = 'rgba(255, 102, 0, 0.08)';
    ctx.fillRect(startX, 0, endX - startX, h);

    // Trim borders
    ctx.strokeStyle = 'hsl(24, 100%, 50%)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, h);
    ctx.stroke();

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
  }, [waveformData, audioBuffer, startMs, endMs, durationMs]);

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

    const startSec = startMs / 1000;
    const durSec = trimDurationMs / 1000;
    source.start(0, startSec, durSec);
    sourceRef.current = source;
    setIsPlaying(true);

    source.onended = () => {
      setIsPlaying(false);
      sourceRef.current = null;
    };
  }, [audioBuffer, startMs, trimDurationMs, isPlaying]);

  const handleDownload = useCallback(() => {
    if (!audioBuffer) return;

    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor((startMs / 1000) * sampleRate);
    const endSample = Math.floor((endMs / 1000) * sampleRate);
    const length = endSample - startSample;

    if (length <= 0) return;

    const offlineCtx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      length,
      sampleRate
    );

    const trimmedBuffer = offlineCtx.createBuffer(
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
  }, [audioBuffer, startMs, endMs, fileName]);

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

      {/* Waveform */}
      <div className="hardware-panel rounded-md p-1">
        <canvas
          ref={canvasRef}
          className="w-full rounded-sm"
          style={{ height: '140px' }}
        />
      </div>

      {audioBuffer && (
        <>
          {/* Trim controls */}
          <div className="flex flex-wrap items-end gap-4 [&_input]:appearance-none [&_input::-webkit-inner-spin-button]:appearance-none [&_input::-webkit-outer-spin-button]:appearance-none [&_input]:[-moz-appearance:textfield]">
            <div className="flex flex-col gap-1">
              <label className="font-display text-[9px] uppercase tracking-wider text-muted-foreground">
                Start (ms)
              </label>
              <input
                type="number"
                value={startMs}
                onChange={(e) => setStartMs(Number(e.target.value) || 0)}
                className="w-24 h-7 rounded bg-[hsl(var(--surface-inset))] border border-border text-center font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-[9px] text-muted-foreground/50 font-mono">
                {formatTime(startMs)}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-display text-[9px] uppercase tracking-wider text-muted-foreground">
                End (ms)
              </label>
              <input
                type="number"
                value={endMs}
                onChange={(e) => setEndMs(Number(e.target.value) || 0)}
                className="w-24 h-7 rounded bg-[hsl(var(--surface-inset))] border border-border text-center font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-[9px] text-muted-foreground/50 font-mono">
                {formatTime(endMs)}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-display text-[9px] uppercase tracking-wider text-muted-foreground">
                Total Duration
              </label>
              <div className="h-7 flex items-center">
                <span className="font-mono text-xs text-primary">
                  {formatTime(durationMs)}
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground/50 font-mono">
                {durationMs} ms
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-display text-[9px] uppercase tracking-wider text-muted-foreground">
                Trim Length
              </label>
              <div className="h-7 flex items-center">
                <span className="font-mono text-xs text-primary">
                  {formatTime(trimDurationMs)}
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground/50 font-mono">
                {trimDurationMs} ms
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
              disabled={trimDurationMs <= 0}
              className="surface-raised px-4 py-2 rounded text-xs font-display uppercase tracking-wider text-primary hover:brightness-125 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ↓ Download WAV
            </button>
          </div>
        </>
      )}
    </div>
  );
}
