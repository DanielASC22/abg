import { ControlKnob } from './ControlKnob';

interface EffectsRackProps {
  filterFreq: number;
  filterQ: number;
  distortion: number;
  delayTime: number;
  delayFeedback: number;
  onFilterFreq: (v: number) => void;
  onFilterQ: (v: number) => void;
  onDistortion: (v: number) => void;
  onDelayTime: (v: number) => void;
  onDelayFeedback: (v: number) => void;
}

export function EffectsRack({
  filterFreq,
  filterQ,
  distortion,
  delayTime,
  delayFeedback,
  onFilterFreq,
  onFilterQ,
  onDistortion,
  onDelayTime,
  onDelayFeedback,
}: EffectsRackProps) {
  return (
    <div className="hardware-panel rounded-lg p-4 space-y-4">
      <h3 className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-led-amber led-glow-amber" />
        Effects Rack
      </h3>

      {/* Filter */}
      <div className="surface-inset rounded-md p-3 space-y-3">
        <span className="text-[9px] font-display uppercase tracking-widest text-muted-foreground">
          HP Filter
        </span>
        <div className="grid grid-cols-2 gap-3">
          <ControlKnob
            label="Freq"
            value={filterFreq}
            min={20}
            max={20000}
            step={10}
            onChange={onFilterFreq}
            displayValue={filterFreq >= 1000 ? `${(filterFreq / 1000).toFixed(1)}k` : `${Math.round(filterFreq)}`}
            unit="Hz"
          />
          <ControlKnob
            label="Reso"
            value={filterQ}
            min={0.1}
            max={20}
            step={0.1}
            onChange={onFilterQ}
          />
        </div>
      </div>

      {/* Distortion */}
      <div className="surface-inset rounded-md p-3 space-y-3">
        <span className="text-[9px] font-display uppercase tracking-widest text-muted-foreground">
          Degrader
        </span>
        <ControlKnob
          label="Drive"
          value={distortion}
          min={0}
          max={1}
          step={0.01}
          onChange={onDistortion}
        />
      </div>

      {/* Delay */}
      <div className="surface-inset rounded-md p-3 space-y-3">
        <span className="text-[9px] font-display uppercase tracking-widest text-muted-foreground">
          Dub Delay
        </span>
        <div className="grid grid-cols-2 gap-3">
          <ControlKnob
            label="Time"
            value={delayTime}
            min={0.05}
            max={1}
            step={0.01}
            onChange={onDelayTime}
            unit="s"
          />
          <ControlKnob
            label="Feedback"
            value={delayFeedback}
            min={0}
            max={0.9}
            step={0.01}
            onChange={onDelayFeedback}
          />
        </div>
      </div>
    </div>
  );
}
