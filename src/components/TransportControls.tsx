import { ControlKnob } from './ControlKnob';
import type { QuantizeMode } from '@/hooks/useAudioEngine';

interface TransportControlsProps {
  isPlaying: boolean;
  isAutoMode: boolean;
  bpm: number;
  chaos: number;
  quantize: QuantizeMode;
  timeMultiplier: number;
  isShiftHeld: boolean;
  isSpaceHeld: boolean;
  onToggleAuto: () => void;
  onBpmChange: (v: number) => void;
  onChaosChange: (v: number) => void;
  onQuantizeChange: (v: QuantizeMode) => void;
  onTimeMultiplierChange: (v: number) => void;
}

export function TransportControls({
  isPlaying,
  isAutoMode,
  bpm,
  chaos,
  quantize,
  timeMultiplier,
  isShiftHeld,
  isSpaceHeld,
  onToggleAuto,
  onBpmChange,
  onChaosChange,
  onQuantizeChange,
  onTimeMultiplierChange,
}: TransportControlsProps) {
  return (
    <div className="hardware-panel rounded-lg p-4 space-y-3">
      <h3 className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-led-green led-glow-green' : 'bg-muted-foreground/30'}`} />
        Transport
      </h3>

      {/* Auto-Gen Toggle */}
      <button
        onClick={onToggleAuto}
        className={`
          w-full py-2.5 rounded-md font-display text-xs uppercase tracking-widest
          transition-all duration-150
          ${isAutoMode
            ? 'bg-primary text-primary-foreground led-glow'
            : 'surface-raised text-muted-foreground hover:text-foreground hover:brightness-125'
          }
        `}
      >
        {isAutoMode ? '■ Stop' : '▶ Auto-Gen'}
      </button>

      {/* Quantize & Time toggles */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onQuantizeChange(quantize === '1/16' ? '1/8' : '1/16')}
          className="surface-inset rounded-md py-1.5 text-center"
        >
          <span className="text-[8px] font-display uppercase tracking-widest text-muted-foreground block">Quantize</span>
          <span className="text-[11px] font-mono text-primary">{quantize}</span>
        </button>
        <button
          onClick={() => {
            const next = timeMultiplier === 0.5 ? 1 : timeMultiplier === 1 ? 2 : 0.5;
            onTimeMultiplierChange(next);
          }}
          className="surface-inset rounded-md py-1.5 text-center"
        >
          <span className="text-[8px] font-display uppercase tracking-widest text-muted-foreground block">Time</span>
          <span className="text-[11px] font-mono text-primary">
            {timeMultiplier === 0.5 ? 'HALF' : timeMultiplier === 2 ? 'DBL' : 'NORM'}
          </span>
        </button>
      </div>

      {/* Modifier key indicators */}
      <div className="flex gap-2">
        <div className={`flex-1 rounded-md py-1 text-center text-[9px] font-display uppercase tracking-wider transition-colors ${isShiftHeld ? 'bg-primary/20 text-primary border border-primary/40' : 'surface-inset text-muted-foreground'}`}>
          ⇧ Rev
        </div>
        <div className={`flex-1 rounded-md py-1 text-center text-[9px] font-display uppercase tracking-wider transition-colors ${isSpaceHeld ? 'bg-primary/20 text-primary border border-primary/40' : 'surface-inset text-muted-foreground'}`}>
          ␣ Stut
        </div>
      </div>

      {/* BPM & Chaos */}
      <div className="surface-inset rounded-md p-3 space-y-3">
        <ControlKnob
          label="BPM"
          value={bpm}
          min={80}
          max={220}
          step={1}
          onChange={onBpmChange}
          displayValue={`${Math.round(bpm * timeMultiplier)}`}
        />
        <ControlKnob
          label="Chaos"
          value={chaos}
          min={0}
          max={1}
          step={0.01}
          onChange={onChaosChange}
          displayValue={`${Math.round(chaos * 100)}%`}
        />
      </div>
    </div>
  );
}
