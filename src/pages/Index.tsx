import { useState, useCallback } from 'react';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useHandTracking } from '@/hooks/useHandTracking';
import { AudioUnlockOverlay } from '@/components/AudioUnlockOverlay';
import { WaveformDisplay } from '@/components/WaveformDisplay';
import { PadGrid } from '@/components/PadGrid';
import { TransportControls } from '@/components/TransportControls';
import { EffectsRack } from '@/components/EffectsRack';
import { CameraOverlay } from '@/components/CameraOverlay';

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
    setFilterType,
    setBitcrushMix,
    setDelayTime,
    setDelayFeedback,
    setQuantize,
    setTimeMultiplier,
    setShiftHeld,
    setSpaceHeld,
  } = useAudioEngine();

  // Gesture trigger uses the same quantized triggerSlice path
  const handleGestureTrigger = useCallback((sliceIndex: number) => {
    triggerSlice(sliceIndex);
  }, [triggerSlice]);

  const {
    handState,
    initHandTracking,
    toggleCameraMode,
    setShowLandmarks,
    setPinchThreshold,
  } = useHandTracking(handleGestureTrigger);

  const handleUnlock = async () => {
    await initAudio();
    setAudioUnlocked(true);
  };

  const handleVideoReady = useCallback((video: HTMLVideoElement) => {
    initHandTracking(video);
  }, [initHandTracking]);

  const handleToggleCamera = useCallback(() => {
    toggleCameraMode();
  }, [toggleCameraMode]);

  if (!audioUnlocked) {
    return <AudioUnlockOverlay onUnlock={handleUnlock} error={state.error} />;
  }

  return (
    <div className="min-h-screen bg-background p-3 md:p-6">
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
          <div className={`w-2 h-2 rounded-full ${state.isLoaded ? 'bg-[hsl(var(--led-green))] led-glow-green' : 'bg-[hsl(var(--led-red))] animate-pulse'}`} />
          <span className="text-[10px] text-muted-foreground font-mono">
            {state.isLoaded ? 'READY' : 'LOADING'}
          </span>
        </div>
      </header>

      <div className="hardware-panel rounded-xl p-4 md:p-6 relative">
        <div className="screw absolute top-2.5 left-2.5" />
        <div className="screw absolute top-2.5 right-2.5" />
        <div className="screw absolute bottom-2.5 left-2.5" />
        <div className="screw absolute bottom-2.5 right-2.5" />

        <div className="mb-4 md:mb-6">
          <WaveformDisplay
            waveformData={state.waveformData}
            activeSlice={state.activeSlice}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 md:gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {handState.isCameraMode ? 'Gesture Pads (8-Slice)' : 'Trigger Pads'}
              </span>
              <span className="text-[9px] text-muted-foreground/50 font-mono ml-auto">
                {handState.isCameraMode ? 'Pinch to trigger' : 'SHIFT=reverse • SPACE=stutter'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-4">
              <PadGrid
                activeSlice={state.activeSlice}
                gesturePendingSlice={handState.pendingSlice}
                onTrigger={triggerSlice}
                isLoaded={state.isLoaded}
                onShiftChange={setShiftHeld}
                onSpaceChange={setSpaceHeld}
                cameraMode={handState.isCameraMode}
              />
              <TransportControls
                isPlaying={state.isPlaying}
                isAutoMode={state.isAutoMode}
                bpm={state.bpm}
                chaos={state.chaos}
                quantize={state.quantize}
                timeMultiplier={state.timeMultiplier}
                isShiftHeld={state.isShiftHeld}
                isSpaceHeld={state.isSpaceHeld}
                onToggleAuto={toggleAutoGen}
                onBpmChange={setBpm}
                onChaosChange={setChaos}
                onQuantizeChange={setQuantize}
                onTimeMultiplierChange={setTimeMultiplier}
              />
            </div>
          </div>

          <div className="space-y-4">
            <EffectsRack
              filterFreq={state.filterFreq}
              filterQ={state.filterQ}
              filterType={state.filterType}
              bitcrushMix={state.bitcrushMix}
              delayTime={state.delayTime}
              delayFeedback={state.delayFeedback}
              onFilterFreq={setFilterFreq}
              onFilterQ={setFilterQ}
              onFilterType={setFilterType}
              onBitcrushMix={setBitcrushMix}
              onDelayTime={setDelayTime}
              onDelayFeedback={setDelayFeedback}
            />

            <CameraOverlay
              handState={handState}
              onVideoReady={handleVideoReady}
              onToggleCamera={handleToggleCamera}
              onToggleLandmarks={() => setShowLandmarks(!handState.showLandmarks)}
              onThresholdChange={setPinchThreshold}
            />
          </div>
        </div>
      </div>

      <footer className="mt-4 text-center">
        <p className="text-[10px] text-muted-foreground/40 font-mono">
          AMEN BREAK GENERATOR v2.0 — The Winstons "Amen, Brother" (1969) — Quantized Engine + CV
        </p>
      </footer>
    </div>
  );
};

export default Index;
