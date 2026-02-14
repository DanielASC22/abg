import { ControlKnob } from './ControlKnob';

interface EffectsRackProps {
  filterFreq: number;
  filterQ: number;
  filterType: 'highpass' | 'lowpass';
  bitcrushMix: number;
  delayTime: number;
  delayFeedback: number;
  onFilterFreq: (v: number) => void;
  onFilterQ: (v: number) => void;
  onFilterType: (v: 'highpass' | 'lowpass') => void;
  onBitcrushMix: (v: number) => void;
  onDelayTime: (v: number) => void;
  onDelayFeedback: (v: number) => void;
}

export function EffectsRack({
  filterFreq,
  filterQ,
  filterType,
  bitcrushMix,
  delayTime,
  delayFeedback,
  onFilterFreq,
  onFilterQ,
  onFilterType,
  onBitcrushMix,
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
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-display uppercase tracking-widest text-muted-foreground">
            Resonant Filter
          </span>
          <button
            onClick={() => onFilterType(filterType === 'highpass' ? 'lowpass' : 'highpass')}
            className="text-[9px] font-mono text-primary px-2 py-0.5 rounded surface-raised hover:brightness-125"
          >
            {filterType === 'highpass' ? 'HP' : 'LP'}
          </button>
        </div>
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

      {/* Bitcrusher */}
      <div className="surface-inset rounded-md p-3 space-y-3">
        <span className="text-[9px] font-display uppercase tracking-widest text-muted-foreground">
          Bitcrusher
        </span>
        <ControlKnob
          label="Crush"
          value={bitcrushMix}
          min={0}
          max={1}
          step={0.01}
          onChange={onBitcrushMix}
          displayValue={`${Math.round(bitcrushMix * 100)}%`}
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
