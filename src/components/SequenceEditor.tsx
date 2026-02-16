import { useState, useRef, useEffect, useCallback } from 'react';

interface SequenceEditorProps {
  isPlaying: boolean;
  isSequenceMode: boolean;
  sequencePosition: number;
  sequenceLength: number;
  isLoaded: boolean;
  onPlaySequence: (sequence: string) => void;
  onStopSequence: () => void;
  onExportWAV: (input: string) => Promise<Blob>;
}

const VALID_CHARS = new Set('1234qwerasdfzxcvQWERASDFZXCV .-[]');

export function SequenceEditor({
  isPlaying,
  isSequenceMode,
  sequencePosition,
  sequenceLength,
  isLoaded,
  onPlaySequence,
  onStopSequence,
  onExportWAV,
}: SequenceEditorProps) {
  const [input, setInput] = useState('1234 qwer asdf zxcv');
  const [isExporting, setIsExporting] = useState(false);
  const displayRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to keep cursor visible
  useEffect(() => {
    if (!isSequenceMode || !displayRef.current) return;
    const container = displayRef.current;
    const charEls = container.querySelectorAll('[data-seq-char]');
    const activeEl = charEls[sequencePosition] as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [sequencePosition, isSequenceMode]);

  const handlePlay = useCallback(() => {
    if (!isLoaded) return;
    if (isSequenceMode) {
      onStopSequence();
    } else {
      onPlaySequence(input);
    }
  }, [isLoaded, isSequenceMode, input, onPlaySequence, onStopSequence]);

  const handleExport = useCallback(async () => {
    if (!isLoaded || isExporting || input.trim().length === 0) return;
    setIsExporting(true);
    try {
      const blob = await onExportWAV(input);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sequence-${Date.now()}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, [isLoaded, isExporting, input, onExportWAV]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const filtered = raw.split('').filter(c => VALID_CHARS.has(c)).join('');
    setInput(filtered);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ') {
      e.stopPropagation();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePlay();
    }
  };

  return (
    <div className="hardware-panel rounded-lg p-4 space-y-3">
      <h3 className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${isSequenceMode ? 'bg-[hsl(var(--led-green))] led-glow-green' : 'bg-muted-foreground/30'}`} />
        Sequence Queue
      </h3>

      {/* Legend */}
      <div className="flex gap-3 flex-wrap text-[9px] font-mono text-muted-foreground/60">
        <span>1-4 Q-R A-F Z-V = slices</span>
        <span>. = rest</span>
        <span>- = hold</span>
        <span>[...] = reverse</span>
      </div>

      {/* Input */}
      <input
        type="text"
        value={input}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        disabled={isSequenceMode}
        placeholder="Type sequence: 11qw..asdf--zxcv"
        className="w-full bg-[hsl(var(--surface-inset))] border border-border rounded-md px-3 py-2.5
          font-mono text-sm text-primary tracking-[0.15em] uppercase
          placeholder:text-muted-foreground/30 placeholder:normal-case placeholder:tracking-normal
          focus:outline-none focus:ring-1 focus:ring-primary/50
          disabled:opacity-60 disabled:cursor-not-allowed"
      />

      {/* Visual Tracker */}
      {isSequenceMode && (
        <div
          ref={displayRef}
          className="surface-inset rounded-md px-3 py-2.5 overflow-x-auto whitespace-nowrap scrollbar-hide"
        >
          {input.split('').map((char, i) => (
            <span
              key={i}
              data-seq-char
              className={`
                inline-block font-mono text-sm uppercase w-[1.1em] text-center
                transition-colors duration-75
                ${i === sequencePosition
                  ? 'bg-primary text-primary-foreground rounded-sm'
                  : i < sequencePosition
                    ? 'text-muted-foreground/40'
                    : 'text-muted-foreground'
                }
              `}
            >
              {char === ' ' ? '·' : char}
            </span>
          ))}
        </div>
      )}

      {/* Play/Stop + Export */}
      <div className="flex gap-2">
        <button
          onClick={handlePlay}
          disabled={!isLoaded || input.trim().length === 0}
          className={`
            flex-1 py-2.5 rounded-md font-display text-xs uppercase tracking-widest
            transition-all duration-150
            ${isSequenceMode
              ? 'bg-[hsl(var(--led-red))] text-primary-foreground'
              : 'surface-raised text-muted-foreground hover:text-foreground hover:brightness-125'
            }
            disabled:opacity-40 disabled:cursor-not-allowed
          `}
        >
          {isSequenceMode ? '■ Stop' : '▶ Play'}
        </button>
        <button
          onClick={handleExport}
          disabled={!isLoaded || isExporting || isSequenceMode || input.trim().length === 0}
          className="surface-raised px-4 py-2.5 rounded-md font-display text-xs uppercase tracking-widest
            text-muted-foreground hover:text-foreground hover:brightness-125
            transition-all duration-150
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isExporting ? '⏳ Rendering…' : '↓ WAV'}
        </button>
      </div>

      {/* Position display */}
      {isSequenceMode && (
        <div className="flex justify-between text-[9px] font-mono text-muted-foreground/50">
          <span>Step {sequencePosition + 1} / {sequenceLength}</span>
          <span>Loop</span>
        </div>
      )}
    </div>
  );
}
