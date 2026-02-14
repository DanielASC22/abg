import { useState } from 'react';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { AudioUnlockOverlay } from '@/components/AudioUnlockOverlay';
import { WaveformDisplay } from '@/components/WaveformDisplay';
import { PadGrid } from '@/components/PadGrid';
import { TransportControls } from '@/components/TransportControls';
import { EffectsRack } from '@/components/EffectsRack';

const Index = () => {
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const {
    state,
    initAudio,
    triggerSlice,
    toggleAutoGen,
    setBpm,
    setChaos,
    setFilterFreq,
    setFilterQ,
    setDistortion,
    setDelayTime,
    setDelayFeedback,
  } = useAudioEngine();

  const handleUnlock = async () => {
    await initAudio();
    setAudioUnlocked(true);
  };

  if (!audioUnlocked) {
    return <AudioUnlockOverlay onUnlock={handleUnlock} error={state.error} />;
  }

  return (
    <div className="min-h-screen bg-background p-3 md:p-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-lg md:text-xl font-bold text-primary tracking-wider">
            AMEN
          </h1>
          <span className="font-display text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
            Break Generator
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${state.isLoaded ? 'bg-led-green led-glow-green' : 'bg-led-red animate-pulse-glow'}`} />
          <span className="text-[10px] text-muted-foreground font-mono">
            {state.isLoaded ? 'READY' : 'LOADING'}
          </span>
        </div>
      </header>

      {/* Decorative screws */}
      <div className="hardware-panel rounded-xl p-4 md:p-6 relative">
        <div className="screw absolute top-2.5 left-2.5" />
        <div className="screw absolute top-2.5 right-2.5" />
        <div className="screw absolute bottom-2.5 left-2.5" />
        <div className="screw absolute bottom-2.5 right-2.5" />

        {/* Waveform */}
        <div className="mb-4 md:mb-6">
          <WaveformDisplay
            waveformData={state.waveformData}
            activeSlice={state.activeSlice}
          />
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 md:gap-6">
          {/* Left: Pads + Transport */}
          <div className="space-y-4">
            {/* Pad section label */}
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Trigger Pads
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-4">
              <PadGrid
                activeSlice={state.activeSlice}
                onTrigger={triggerSlice}
                isLoaded={state.isLoaded}
              />
              <TransportControls
                isPlaying={state.isPlaying}
                isAutoMode={state.isAutoMode}
                bpm={state.bpm}
                chaos={state.chaos}
                onToggleAuto={toggleAutoGen}
                onBpmChange={setBpm}
                onChaosChange={setChaos}
              />
            </div>
          </div>

          {/* Right: Effects */}
          <EffectsRack
            filterFreq={state.filterFreq}
            filterQ={state.filterQ}
            distortion={state.distortion}
            delayTime={state.delayTime}
            delayFeedback={state.delayFeedback}
            onFilterFreq={setFilterFreq}
            onFilterQ={setFilterQ}
            onDistortion={setDistortion}
            onDelayTime={setDelayTime}
            onDelayFeedback={setDelayFeedback}
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-4 text-center">
        <p className="text-[10px] text-muted-foreground/40 font-mono">
          AMEN BREAK GENERATOR v1.0 — The Winstons "Amen, Brother" (1969)
        </p>
      </footer>
    </div>
  );
};

export default Index;
