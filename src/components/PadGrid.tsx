import { useCallback } from 'react';

interface PadGridProps {
  activeSlice: number | null;
  onTrigger: (slice: number) => void;
  isLoaded: boolean;
}

const PAD_LABELS = [
  '1', '2', '3', '4',
  '5', '6', '7', '8',
  '9', '10', '11', '12',
  '13', '14', '15', '16',
];

export function PadGrid({ activeSlice, onTrigger, isLoaded }: PadGridProps) {
  const handlePadClick = useCallback((index: number) => {
    if (!isLoaded) return;
    onTrigger(index);
  }, [isLoaded, onTrigger]);

  return (
    <div className="grid grid-cols-4 gap-2">
      {PAD_LABELS.map((label, i) => {
        const isActive = activeSlice === i;
        return (
          <button
            key={i}
            onPointerDown={() => handlePadClick(i)}
            disabled={!isLoaded}
            className={`
              relative aspect-square rounded-md
              flex items-center justify-center
              font-display text-xs font-bold
              transition-all duration-75 select-none
              ${isActive
                ? 'pad-active text-primary-foreground scale-95'
                : 'surface-raised text-muted-foreground hover:brightness-125 active:scale-95'
              }
              ${!isLoaded ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span className="relative z-10">{label}</span>
            {/* LED indicator */}
            <div className={`
              absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full
              transition-all duration-75
              ${isActive
                ? 'bg-primary led-glow'
                : 'bg-muted-foreground/30'
              }
            `} />
          </button>
        );
      })}
    </div>
  );
}
