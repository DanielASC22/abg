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
  const [focusedInput, setFocusedInput] = useState<'start' | 'end' | null>(null);
  const [mode, setMode] = useState<'keep' | 'remove'>('keep');
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [tapBpm, setTapBpm] = useState<number | null>(null);
  const [semitones, setSemitones] = useState(0);
  const [hzDetune, setHzDetune] = useState(0);
  const [speedPercent, setSpeedPercent] = useState(100);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const wasPlayingRef = useRef(false);
  const lastChangeRef = useRef<'start' | 'end' | null>(null);
  const playbackStartTimeRef = useRef(0);
  const playbackOffsetRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);
  const playheadCanvasRef = useRef<HTMLCanvasElement>(null);

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

  // Stop current playback
  const stopPlayback = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    // Clear playhead overlay
    const pCanvas = playheadCanvasRef.current;
    if (pCanvas) {
      const pCtx = pCanvas.getContext('2d');
      if (pCtx) pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
    }
    setIsPlaying(false);
  }, []);

  // Cleanup on unmount — stop audio and animation
  useEffect(() => {
    return () => {
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch {}
        sourceRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  // Start playback from a given offset
  // Convert Hz detune to cents using 440Hz reference
  const hzToCents = useCallback((hz: number) => {
    if (hz === 0) return 0;
    return 1200 * Math.log2((440 + hz) / 440);
  }, []);

  const drawPlayhead = useCallback(() => {
    const pCanvas = playheadCanvasRef.current;
    if (!pCanvas || !audioCtxRef.current || !durationSec) return;

    const pCtx = pCanvas.getContext('2d');
    if (!pCtx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = pCanvas.getBoundingClientRect();
    pCanvas.width = rect.width * dpr;
    pCanvas.height = rect.height * dpr;
    pCtx.scale(dpr, dpr);
    pCtx.clearRect(0, 0, rect.width, rect.height);

    const elapsed = (audioCtxRef.current.currentTime - playbackStartTimeRef.current) * (speedPercent / 100);
    const currentSec = playbackOffsetRef.current + elapsed;
    const x = (currentSec / durationSec) * rect.width;

    // Playhead line
    pCtx.strokeStyle = 'rgba(135, 206, 250, 0.8)';
    pCtx.lineWidth = 2;
    pCtx.beginPath();
    pCtx.moveTo(x, 0);
    pCtx.lineTo(x, rect.height);
    pCtx.stroke();

    // Glow
    pCtx.strokeStyle = 'rgba(135, 206, 250, 0.25)';
    pCtx.lineWidth = 6;
    pCtx.beginPath();
    pCtx.moveTo(x, 0);
    pCtx.lineTo(x, rect.height);
    pCtx.stroke();

    animFrameRef.current = requestAnimationFrame(drawPlayhead);
  }, [durationSec, speedPercent]);

  const startPlaybackFrom = useCallback((offset: number, duration: number) => {
    if (!audioBuffer || !audioCtxRef.current) return;
    stopPlayback();

    const ctx = audioCtxRef.current;
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = speedPercent / 100;
    source.detune.value = semitones * 100 + hzToCents(hzDetune);
    source.connect(ctx.destination);
    source.start(0, offset, duration);
    sourceRef.current = source;
    playbackStartTimeRef.current = ctx.currentTime;
    playbackOffsetRef.current = offset;
    setIsPlaying(true);

    // Start animation
    animFrameRef.current = requestAnimationFrame(drawPlayhead);

    source.onended = () => {
      setIsPlaying(false);
      sourceRef.current = null;
    };
  }, [audioBuffer, stopPlayback, speedPercent, semitones, hzDetune, hzToCents]);

  // Auto-restart playback when trim points change
  const updateStart = useCallback((val: number) => {
    setStartSec(val);
    lastChangeRef.current = 'start';
  }, []);

  const updateEnd = useCallback((val: number) => {
    setEndSec(val);
    lastChangeRef.current = 'end';
  }, []);

  // React to trim changes while playing
  useEffect(() => {
    if (!isPlaying || !audioBuffer || lastChangeRef.current === null) return;
    const change = lastChangeRef.current;
    lastChangeRef.current = null;

    const dur = Math.max(0, endSec - startSec);
    if (dur <= 0) { stopPlayback(); return; }

    if (change === 'start') {
      // Restart from beginning of selection
      startPlaybackFrom(startSec, dur);
    } else {
      // Play from ~2 seconds before the new end
      const previewStart = Math.max(startSec, endSec - 2);
      startPlaybackFrom(previewStart, endSec - previewStart);
    }
  }, [startSec, endSec]); // intentionally minimal deps to fire on value change

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

  // Arrow key adjustments
  const handleKeyDown = useCallback((e: React.KeyboardEvent, which: 'start' | 'end') => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const step = e.shiftKey ? 0.1 : 0.01; // shift = bigger step
    const delta = e.key === 'ArrowRight' ? step : -step;

    if (which === 'start') {
      updateStart(Math.max(0, Math.min(parseFloat((startSec + delta).toFixed(3)), endSec)));
    } else {
      updateEnd(Math.max(startSec, Math.min(parseFloat((endSec + delta).toFixed(3)), durationSec)));
    }
  }, [startSec, endSec, durationSec, updateStart, updateEnd]);

  // Tap tempo
  const handleTap = useCallback(() => {
    const now = performance.now();
    setTapTimes(prev => {
      const recent = prev.filter(t => now - t < 3000); // keep last 3 seconds
      const next = [...recent, now];
      if (next.length >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < next.length; i++) {
          intervals.push(next[i] - next[i - 1]);
        }
        const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        setTapBpm(Math.round((60000 / avgMs) * 10) / 10);
      }
      return next;
    });
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
    const threshold = 10;

    if (Math.abs(x - startX) < threshold) {
      setDragging('start');
      wasPlayingRef.current = isPlaying;
    } else if (Math.abs(x - endX) < threshold) {
      setDragging('end');
      wasPlayingRef.current = isPlaying;
    }
  }, [durationSec, startSec, endSec, isPlaying]);

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const sec = getSecFromMouseEvent(e);
      if (sec === null) return;
      const rounded = Math.round(sec * 1000) / 1000;
      if (dragging === 'start') {
        updateStart(Math.min(rounded, endSec));
      } else {
        updateEnd(Math.max(rounded, startSec));
      }
    };

    const handleMouseUp = () => setDragging(null);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, getSecFromMouseEvent, startSec, endSec, updateStart, updateEnd]);

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

    // Dim regions based on mode
    if (mode === 'keep') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, startX, h);
      ctx.fillRect(endX, 0, w - endX, h);
      ctx.fillStyle = 'rgba(255, 102, 0, 0.08)';
      ctx.fillRect(startX, 0, endX - startX, h);
    } else {
      ctx.fillStyle = 'rgba(255, 50, 50, 0.15)';
      ctx.fillRect(startX, 0, endX - startX, h);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(startX, 0, endX - startX, h);
    }

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

      ctx.fillStyle = 'hsl(24, 100%, 50%)';
      ctx.beginPath();
      ctx.roundRect(x - 5, h / 2 - 14, 10, 28, 3);
      ctx.fill();

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
  }, [waveformData, audioBuffer, startSec, endSec, durationSec, mode]);

  const handlePreview = useCallback(() => {
    if (!audioBuffer || !audioCtxRef.current) return;

    if (isPlaying) {
      stopPlayback();
      return;
    }

    startPlaybackFrom(startSec, trimDurationSec);
  }, [audioBuffer, startSec, trimDurationSec, isPlaying, stopPlayback, startPlaybackFrom]);

  const handleDownload = useCallback(() => {
    if (!audioBuffer) return;

    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(startSec * sampleRate);
    const endSample = Math.floor(endSec * sampleRate);

    if (mode === 'keep') {
      const length = endSample - startSample;
      if (length <= 0) return;

      const trimmedBuffer = new AudioContext().createBuffer(
        audioBuffer.numberOfChannels, length, sampleRate
      );
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const src = audioBuffer.getChannelData(ch);
        const dst = trimmedBuffer.getChannelData(ch);
        for (let i = 0; i < length; i++) dst[i] = src[startSample + i];
      }
      const blob = encodeWAV(trimmedBuffer);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName.replace(/\.[^.]+$/, '')}_trimmed.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Remove mode: keep everything outside the selection
      const totalSamples = audioBuffer.length;
      const keepLength = totalSamples - (endSample - startSample);
      if (keepLength <= 0) return;

      const trimmedBuffer = new AudioContext().createBuffer(
        audioBuffer.numberOfChannels, keepLength, sampleRate
      );
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const src = audioBuffer.getChannelData(ch);
        const dst = trimmedBuffer.getChannelData(ch);
        for (let i = 0; i < startSample; i++) dst[i] = src[i];
        for (let i = endSample; i < totalSamples; i++) dst[startSample + (i - endSample)] = src[i];
      }
      const blob = encodeWAV(trimmedBuffer);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName.replace(/\.[^.]+$/, '')}_trimmed.wav`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [audioBuffer, startSec, endSec, fileName, mode]);

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
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full rounded-sm"
            style={{ height: '140px', cursor: dragging ? 'grabbing' : 'default' }}
            onMouseDown={handleCanvasMouseDown}
          />
          <canvas
            ref={playheadCanvasRef}
            className="absolute inset-0 w-full rounded-sm pointer-events-none"
            style={{ height: '140px' }}
          />
        </div>
      </div>

      {audioBuffer && (
        <>
          {/* Mode toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMode(mode === 'keep' ? 'remove' : 'keep')}
              className={`surface-raised px-4 py-2 rounded text-xs font-display uppercase tracking-wider transition-all hover:brightness-125 ${
                mode === 'keep' ? 'text-primary' : 'text-destructive'
              }`}
            >
              {mode === 'keep' ? '✂ Keep Selection' : '✂ Remove Selection'}
            </button>
            <span className="text-[9px] text-muted-foreground/50 font-mono">
              {mode === 'keep' ? 'Audio between start & end will be kept' : 'Audio between start & end will be removed'}
            </span>
          </div>

          {/* Trim controls */}
          <div className="flex flex-wrap items-end gap-4 [&_input]:appearance-none [&_input::-webkit-inner-spin-button]:appearance-none [&_input::-webkit-outer-spin-button]:appearance-none [&_input]:[-moz-appearance:textfield]">
            <div className="flex flex-col gap-1">
              <label className="font-display text-[9px] uppercase tracking-wider text-muted-foreground">
                Start (sec) <span className="text-muted-foreground/40">← → adjust</span>
              </label>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateStart(Math.max(0, parseFloat((startSec - 0.01).toFixed(3))))}
                  className="surface-raised w-7 h-7 rounded text-xs font-mono text-muted-foreground hover:text-foreground hover:brightness-125 transition-all flex items-center justify-center"
                >−</button>
                <input
                  type="number"
                  step="0.001"
                  value={parseFloat(startSec.toFixed(3))}
                  onChange={(e) => updateStart(Number(e.target.value) || 0)}
                  onKeyDown={(e) => handleKeyDown(e, 'start')}
                  onFocus={() => setFocusedInput('start')}
                  onBlur={() => setFocusedInput(null)}
                  className={`w-24 h-7 rounded bg-[hsl(var(--surface-inset))] border text-center font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary ${
                    focusedInput === 'start' ? 'border-primary' : 'border-border'
                  }`}
                />
                <button
                  onClick={() => updateStart(Math.min(endSec, parseFloat((startSec + 0.01).toFixed(3))))}
                  className="surface-raised w-7 h-7 rounded text-xs font-mono text-muted-foreground hover:text-foreground hover:brightness-125 transition-all flex items-center justify-center"
                >+</button>
              </div>
              <span className="text-[9px] text-muted-foreground/50 font-mono">
                {formatTime(startSec)}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-display text-[9px] uppercase tracking-wider text-muted-foreground">
                End (sec) <span className="text-muted-foreground/40">← → adjust</span>
              </label>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateEnd(Math.max(startSec, parseFloat((endSec - 0.01).toFixed(3))))}
                  className="surface-raised w-7 h-7 rounded text-xs font-mono text-muted-foreground hover:text-foreground hover:brightness-125 transition-all flex items-center justify-center"
                >−</button>
                <input
                  type="number"
                  step="0.001"
                  value={parseFloat(endSec.toFixed(3))}
                  onChange={(e) => updateEnd(Number(e.target.value) || 0)}
                  onKeyDown={(e) => handleKeyDown(e, 'end')}
                  onFocus={() => setFocusedInput('end')}
                  onBlur={() => setFocusedInput(null)}
                  className={`w-24 h-7 rounded bg-[hsl(var(--surface-inset))] border text-center font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary ${
                    focusedInput === 'end' ? 'border-primary' : 'border-border'
                  }`}
                />
                <button
                  onClick={() => updateEnd(Math.min(durationSec, parseFloat((endSec + 0.01).toFixed(3))))}
                  className="surface-raised w-7 h-7 rounded text-xs font-mono text-muted-foreground hover:text-foreground hover:brightness-125 transition-all flex items-center justify-center"
                >+</button>
              </div>
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
                {mode === 'keep' ? 'Keep Length' : 'Remove Length'}
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

          {/* Pitch & Speed controls */}
          <div className="surface-raised rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Pitch & Speed
              </span>
            </div>

            <div className="flex flex-wrap items-end gap-4 [&_input]:appearance-none [&_input::-webkit-inner-spin-button]:appearance-none [&_input::-webkit-outer-spin-button]:appearance-none [&_input]:[-moz-appearance:textfield]">
              {/* Semitone */}
              <div className="flex flex-col gap-1">
                <label className="font-display text-[9px] uppercase tracking-wider text-muted-foreground">
                  Semitones
                </label>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSemitones(s => s - 1)}
                    className="surface-raised w-7 h-7 rounded text-xs font-mono text-muted-foreground hover:text-foreground hover:brightness-125 transition-all flex items-center justify-center"
                  >−</button>
                  <input
                    type="number"
                    step="1"
                    value={semitones}
                    onChange={(e) => setSemitones(parseInt(e.target.value) || 0)}
                    className="w-16 h-7 rounded bg-[hsl(var(--surface-inset))] border border-border text-center font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={() => setSemitones(s => s + 1)}
                    className="surface-raised w-7 h-7 rounded text-xs font-mono text-muted-foreground hover:text-foreground hover:brightness-125 transition-all flex items-center justify-center"
                  >+</button>
                </div>
                <span className="text-[9px] text-muted-foreground/50 font-mono">
                  {semitones > 0 ? '+' : ''}{semitones} st
                </span>
              </div>

              {/* Hz fine-tune */}
              <div className="flex flex-col gap-1">
                <label className="font-display text-[9px] uppercase tracking-wider text-muted-foreground">
                  Fine Tune (Hz)
                </label>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setHzDetune(h => parseFloat((h - 0.05).toFixed(2)))}
                    className="surface-raised w-7 h-7 rounded text-xs font-mono text-muted-foreground hover:text-foreground hover:brightness-125 transition-all flex items-center justify-center"
                  >−</button>
                  <input
                    type="number"
                    step="0.05"
                    value={parseFloat(hzDetune.toFixed(2))}
                    onChange={(e) => setHzDetune(parseFloat(e.target.value) || 0)}
                    className="w-20 h-7 rounded bg-[hsl(var(--surface-inset))] border border-border text-center font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={() => setHzDetune(h => parseFloat((h + 0.05).toFixed(2)))}
                    className="surface-raised w-7 h-7 rounded text-xs font-mono text-muted-foreground hover:text-foreground hover:brightness-125 transition-all flex items-center justify-center"
                  >+</button>
                </div>
                <span className="text-[9px] text-muted-foreground/50 font-mono">
                  {hzDetune >= 0 ? '+' : ''}{hzDetune.toFixed(2)} Hz
                </span>
              </div>

              {/* Speed % */}
              <div className="flex flex-col gap-1">
                <label className="font-display text-[9px] uppercase tracking-wider text-muted-foreground">
                  Speed (%)
                </label>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSpeedPercent(s => Math.max(1, parseFloat((s - 1).toFixed(1))))}
                    className="surface-raised w-7 h-7 rounded text-xs font-mono text-muted-foreground hover:text-foreground hover:brightness-125 transition-all flex items-center justify-center"
                  >−</button>
                  <input
                    type="number"
                    step="1"
                    value={parseFloat(speedPercent.toFixed(1))}
                    onChange={(e) => setSpeedPercent(Math.max(1, parseFloat(e.target.value) || 100))}
                    className="w-20 h-7 rounded bg-[hsl(var(--surface-inset))] border border-border text-center font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={() => setSpeedPercent(s => parseFloat((s + 1).toFixed(1)))}
                    className="surface-raised w-7 h-7 rounded text-xs font-mono text-muted-foreground hover:text-foreground hover:brightness-125 transition-all flex items-center justify-center"
                  >+</button>
                </div>
                <span className="text-[9px] text-muted-foreground/50 font-mono">
                  {speedPercent === 100 ? 'Original' : `${speedPercent.toFixed(1)}%`}
                </span>
              </div>

              {(semitones !== 0 || hzDetune !== 0 || speedPercent !== 100) && (
                <button
                  onClick={() => { setSemitones(0); setHzDetune(0); setSpeedPercent(100); }}
                  className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground font-mono self-center"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Tap Tempo */}
      <div className="mt-4 surface-raised rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Tap Tempo
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleTap}
            className="surface-raised px-6 py-3 rounded text-sm font-display uppercase tracking-wider text-muted-foreground hover:text-foreground hover:brightness-125 transition-all active:scale-95 select-none"
          >
            TAP
          </button>
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-lg text-primary">
              {tapBpm !== null ? `${tapBpm} BPM` : '— BPM'}
            </span>
            <span className="text-[9px] text-muted-foreground/50 font-mono">
              {tapBpm !== null
                ? `${(60 / tapBpm).toFixed(3)}s per beat`
                : 'Tap repeatedly to detect tempo'}
            </span>
          </div>
          {tapBpm !== null && (
            <button
              onClick={() => { setTapTimes([]); setTapBpm(null); }}
              className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground font-mono ml-auto"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Sample Calculator */}
      <div className="mt-4">
        <SampleCalculator />
      </div>
    </div>
  );
}
