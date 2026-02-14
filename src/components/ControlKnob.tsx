interface ControlKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  unit?: string;
  displayValue?: string;
}

export function ControlKnob({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  unit = '',
  displayValue,
}: ControlKnobProps) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <label className="text-[10px] font-display uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 appearance-none rounded-full cursor-pointer
          bg-surface-inset
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-primary
          [&::-webkit-slider-thumb]:knob-shadow
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-4
          [&::-moz-range-thumb]:h-4
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-primary
          [&::-moz-range-thumb]:border-none
          [&::-moz-range-thumb]:cursor-pointer
        "
      />
      <span className="text-[10px] text-primary font-mono tabular-nums">
        {displayValue ?? `${typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(2)) : value}${unit}`}
      </span>
    </div>
  );
}
