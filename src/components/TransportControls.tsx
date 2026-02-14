import { ControlKnob } from './ControlKnob';

interface TransportControlsProps {
  isPlaying: boolean;
  isAutoMode: boolean;
  bpm: number;
  chaos: number;
  onToggleAuto: () => void;
  onBpmChange: (v: number) => void;
  onChaosChange: (v: number) => void;
}

export function TransportControls({
  isPlaying,
  isAutoMode,
  bpm,
  chaos,
  onToggleAuto,
  onBpmChange,
  onChaosChange,
}: TransportControlsProps) {
  return (
    <div className="hardware-panel rounded-lg p-4 space-y-4">
      <h3 className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-led-green led-glow-green' : 'bg-muted-foreground/30'}`} />
        Transport
      </h3>

      {/* Auto-Gen Toggle */}
      <button
        onClick={onToggleAuto}
        className={`
          w-full py-3 rounded-md font-display text-xs uppercase tracking-widest
          transition-all duration-150
          ${isAutoMode
            ? 'bg-primary text-primary-foreground led-glow'
            : 'surface-raised text-muted-foreground hover:text-foreground hover:brightness-125'
          }
        `}
      >
        {isAutoMode ? '■ Stop' : '▶ Auto-Gen'}
      </button>

      {/* BPM & Chaos */}
      <div className="surface-inset rounded-md p-3 space-y-3">
        <ControlKnob
          label="BPM"
          value={bpm}
          min={80}
          max={200}
          step={1}
          onChange={onBpmChange}
          displayValue={`${bpm}`}
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
