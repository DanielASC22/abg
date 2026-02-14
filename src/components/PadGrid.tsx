import { useCallback, useEffect } from 'react';

interface PadGridProps {
  activeSlice: number | null;
  onTrigger: (slice: number) => void;
  isLoaded: boolean;
  onShiftChange: (held: boolean) => void;
  onSpaceChange: (held: boolean) => void;
}

const KEY_MAP: Record<string, number> = {
  '1': 0, '2': 1, '3': 2, '4': 3,
  'q': 4, 'w': 5, 'e': 6, 'r': 7,
  'a': 8, 's': 9, 'd': 10, 'f': 11,
  'z': 12, 'x': 13, 'c': 14, 'v': 15,
};

const PAD_KEYS = [
  '1', '2', '3', '4',
  'Q', 'W', 'E', 'R',
  'A', 'S', 'D', 'F',
  'Z', 'X', 'C', 'V',
];

export function PadGrid({ activeSlice, onTrigger, isLoaded, onShiftChange, onSpaceChange }: PadGridProps) {
  const handlePadClick = useCallback((index: number) => {
    if (!isLoaded) return;
    onTrigger(index);
  }, [isLoaded, onTrigger]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (!isLoaded) return;

      if (e.key === 'Shift') {
        onShiftChange(true);
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        onSpaceChange(true);
        return;
      }

      const slice = KEY_MAP[e.key.toLowerCase()];
      if (slice !== undefined) {
        e.preventDefault();
        onTrigger(slice);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        onShiftChange(false);
      }
      if (e.key === ' ') {
        onSpaceChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isLoaded, onTrigger, onShiftChange, onSpaceChange]);

  return (
    <div className="grid grid-cols-4 gap-2">
      {PAD_KEYS.map((key, i) => {
        const isActive = activeSlice === i;
        return (
          <button
            key={i}
            onPointerDown={() => handlePadClick(i)}
            disabled={!isLoaded}
            className={`
              relative aspect-square rounded-md
              flex flex-col items-center justify-center gap-0.5
              font-display text-xs font-bold
              transition-all duration-75 select-none
              ${isActive
                ? 'pad-active text-primary-foreground scale-95'
                : 'surface-raised text-muted-foreground hover:brightness-125 active:scale-95'
              }
              ${!isLoaded ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span className="relative z-10 text-[10px] opacity-70">{i + 1}</span>
            {/* Key label */}
            <span className="relative z-10 text-[11px] font-mono text-primary/80">{key}</span>
            {/* LED indicator */}
            <div className={`
              absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full
              transition-all duration-75
              ${isActive ? 'bg-primary led-glow' : 'bg-muted-foreground/30'}
            `} />
          </button>
        );
      })}
    </div>
  );
}
