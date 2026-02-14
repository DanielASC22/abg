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
  const [activeTab, setActiveTab] = useState<'sampler' | 'camera'>('sampler');
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

      {/* Tab Navigation */}
      <div className="flex gap-0 mb-4 md:mb-6">
        <button
          onClick={() => setActiveTab('sampler')}
          className={`
            px-5 py-2 rounded-t-lg font-display text-xs uppercase tracking-widest
            transition-all duration-150 border border-b-0
            ${activeTab === 'sampler'
              ? 'bg-card text-foreground border-border'
              : 'bg-transparent text-muted-foreground hover:text-foreground border-transparent'
            }
          `}
        >
          Sampler
        </button>
        <button
          onClick={() => setActiveTab('camera')}
          className={`
            px-5 py-2 rounded-t-lg font-display text-xs uppercase tracking-widest
            transition-all duration-150 border border-b-0 flex items-center gap-2
            ${activeTab === 'camera'
              ? 'bg-card text-foreground border-border'
              : 'bg-transparent text-muted-foreground hover:text-foreground border-transparent'
            }
          `}
        >
          <span>Camera</span>
          {handState.isCameraMode && (
            <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--led-green))] led-glow-green" />
          )}
        </button>
      </div>

      <div className="hardware-panel rounded-xl p-4 md:p-6 relative">
        <div className="screw absolute top-2.5 left-2.5" />
        <div className="screw absolute top-2.5 right-2.5" />
        <div className="screw absolute bottom-2.5 left-2.5" />
        <div className="screw absolute bottom-2.5 right-2.5" />

        {activeTab === 'sampler' ? (
          <>
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
                    Trigger Pads
                  </span>
                  <span className="text-[9px] text-muted-foreground/50 font-mono ml-auto">
                    SHIFT=reverse • SPACE=stutter
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-4">
                  <PadGrid
                    activeSlice={state.activeSlice}
                    onTrigger={triggerSlice}
                    isLoaded={state.isLoaded}
                    onShiftChange={setShiftHeld}
                    onSpaceChange={setSpaceHeld}
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
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 md:mb-6">
              <WaveformDisplay
                waveformData={state.waveformData}
                activeSlice={state.activeSlice}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 md:gap-6">
              <div className="space-y-4">
                <CameraOverlay
                  handState={handState}
                  onVideoReady={handleVideoReady}
                  onToggleCamera={handleToggleCamera}
                  onToggleLandmarks={() => setShowLandmarks(!handState.showLandmarks)}
                  onThresholdChange={setPinchThreshold}
                />

                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Gesture Pads (8-Slice)
                  </span>
                  <span className="text-[9px] text-muted-foreground/50 font-mono ml-auto">
                    Pinch to trigger
                  </span>
                </div>

                <PadGrid
                  activeSlice={state.activeSlice}
                  gesturePendingSlice={handState.pendingSlice}
                  onTrigger={triggerSlice}
                  isLoaded={state.isLoaded}
                  onShiftChange={setShiftHeld}
                  onSpaceChange={setSpaceHeld}
                  cameraMode
                />
              </div>

              <div className="space-y-4">
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
              </div>
            </div>
          </>
        )}
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
