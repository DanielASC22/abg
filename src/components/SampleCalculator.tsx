import { useState, useEffect, useMemo } from 'react';

interface SampleCalculatorProps {
  currentBpm: number;
}

export const SampleCalculator = ({ currentBpm }: SampleCalculatorProps) => {
  const [bars, setBars] = useState(4);
  const [bpm, setBpm] = useState(currentBpm);

  useEffect(() => {
    setBpm(currentBpm);
  }, [currentBpm]);

  const duration = useMemo(() => {
    const secs = (bars * 4 * 60) / bpm;
    const mins = Math.floor(secs / 60);
    const remSecs = secs - mins * 60;
    return {
      seconds: secs.toFixed(3),
      formatted: `${mins}:${remSecs.toFixed(3).padStart(6, '0')}`,
    };
  }, [bars, bpm]);

  return (
    <div className="surface-raised rounded-lg px-4 py-3 flex flex-wrap items-center gap-4 [&_input]:appearance-none [&_input::-webkit-inner-spin-button]:appearance-none [&_input::-webkit-outer-spin-button]:appearance-none [&_input]:[-moz-appearance:textfield]">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
        <span className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Sample Length
        </span>
      </div>

      <div className="flex items-center gap-2">
        <label className="font-display text-[9px] uppercase tracking-wider text-muted-foreground">Bars</label>
        <input
          type="number"
          min={1}
          max={64}
          value={bars}
          onChange={(e) => setBars(Math.max(1, Math.min(64, Number(e.target.value) || 1)))}
          className="w-14 h-7 rounded bg-[hsl(var(--surface-inset))] border border-border text-center font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="font-display text-[9px] uppercase tracking-wider text-muted-foreground">BPM</label>
        <input
          type="number"
          min={20}
          max={300}
          value={bpm}
          onChange={(e) => setBpm(Math.max(20, Math.min(300, Number(e.target.value) || 20)))}
          className="w-16 h-7 rounded bg-[hsl(var(--surface-inset))] border border-border text-center font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <span className="font-mono text-sm text-primary font-semibold">{duration.seconds}s</span>
        <span className="font-mono text-[10px] text-muted-foreground">{duration.formatted}</span>
      </div>
    </div>
  );
};
