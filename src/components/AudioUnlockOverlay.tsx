interface AudioUnlockOverlayProps {
  onUnlock: () => void;
  error?: string | null;
}

export function AudioUnlockOverlay({ onUnlock, error }: AudioUnlockOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center">
      <div className="text-center space-y-6 max-w-md px-6">
        {/* Logo area */}
        <div className="space-y-2">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-primary tracking-wider">
            AMEN
          </h1>
          <h2 className="font-display text-sm md:text-base text-muted-foreground tracking-[0.3em] uppercase">
            Break Generator
          </h2>
        </div>

        <div className="w-16 h-px bg-primary/40 mx-auto" />

        <p className="text-sm text-muted-foreground leading-relaxed">
          Algorithmic remixer for the legendary 1969 drum break.
          <br />
          Requires audio permission to proceed.
        </p>

        {error && (
          <div className="surface-inset rounded-md p-3 text-destructive text-xs">
            Error: {error}
          </div>
        )}

        <button
          onClick={onUnlock}
          className="
            px-8 py-3 rounded-md font-display text-sm uppercase tracking-widest
            bg-primary text-primary-foreground
            led-glow
            hover:brightness-110 active:scale-95
            transition-all duration-150
          "
        >
          Initialize Audio
        </button>

        <p className="text-[10px] text-muted-foreground/60">
          Click to unlock AudioContext per browser security policy
        </p>
      </div>
    </div>
  );
}
