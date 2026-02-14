import { useRef, useState, useCallback, useEffect } from 'react';

const NUM_SLICES = 16;
const AMEN_URL = '/audio/amen-break.mp3';
const LOOK_AHEAD = 0.05; // 50ms lookahead
const SCHEDULE_INTERVAL = 25; // ms

export type QuantizeMode = '1/16' | '1/8';

interface AudioEngineState {
  isLoaded: boolean;
  isPlaying: boolean;
  isAutoMode: boolean;
  activeSlice: number | null;
  bpm: number;
  chaos: number;
  filterFreq: number;
  filterQ: number;
  filterType: 'highpass' | 'lowpass';
  bitcrushMix: number;
  delayTime: number;
  delayFeedback: number;
  error: string | null;
  waveformData: number[] | null;
  quantize: QuantizeMode;
  timeMultiplier: number; // 0.5 = half, 1 = normal, 2 = double
  isShiftHeld: boolean;
  isSpaceHeld: boolean;
}

// Bitcrusher via sample-rate reduction
function createBitcrusher(ctx: AudioContext): { input: GainNode; output: GainNode; setMix: (v: number) => void } {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  dry.gain.value = 1;
  const wet = ctx.createGain();
  wet.gain.value = 0;

  // Use a waveshaper for bit-reduction effect
  const crusher = ctx.createWaveShaper();
  const steps = 8; // quantization steps
  const samples = 44100;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = Math.round(x * steps) / steps;
  }
  crusher.curve = curve;
  crusher.oversample = 'none';

  input.connect(dry);
  input.connect(crusher);
  crusher.connect(wet);
  dry.connect(output);
  wet.connect(output);

  return {
    input,
    output,
    setMix(v: number) {
      dry.gain.value = 1 - v;
      wet.gain.value = v;
    },
  };
}

export function useAudioEngine() {
  const ctxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const reversedBufferRef = useRef<AudioBuffer | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const bitcrusherRef = useRef<ReturnType<typeof createBitcrusher> | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const delayFeedbackRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const limiterRef = useRef<DynamicsCompressorNode | null>(null);

  // Scheduler refs
  const schedulerRef = useRef<number | null>(null);
  const nextBeatTimeRef = useRef(0);
  const autoStepRef = useRef(0);
  const queuedSliceRef = useRef<number | null>(null);
  const queuedReverseRef = useRef(false);
  const stutterActiveRef = useRef(false);
  const lastPlayedSliceRef = useRef(0);

  const [state, setState] = useState<AudioEngineState>({
    isLoaded: false,
    isPlaying: false,
    isAutoMode: false,
    activeSlice: null,
    bpm: 140,
    chaos: 0,
    filterFreq: 20000,
    filterQ: 1,
    filterType: 'highpass',
    bitcrushMix: 0,
    delayTime: 0.3,
    delayFeedback: 0,
    error: null,
    waveformData: null,
    quantize: '1/16',
    timeMultiplier: 1,
    isShiftHeld: false,
    isSpaceHeld: false,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const getBeatDuration = useCallback(() => {
    const { bpm, quantize, timeMultiplier } = stateRef.current;
    const effectiveBpm = bpm * timeMultiplier;
    const sixteenthDuration = 60 / effectiveBpm / 4;
    return quantize === '1/8' ? sixteenthDuration * 2 : sixteenthDuration;
  }, []);

  const playSliceAtTime = useCallback((sliceIndex: number, time: number, reverse: boolean, stutter: boolean) => {
    const ctx = ctxRef.current;
    const buffer = reverse ? reversedBufferRef.current : bufferRef.current;
    if (!ctx || !buffer) return;

    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch {}
    }

    const sliceDuration = buffer.duration / NUM_SLICES;
    let offset: number;

    if (reverse) {
      // For reversed buffer, slices are mirrored
      offset = (NUM_SLICES - 1 - sliceIndex) * sliceDuration;
    } else {
      offset = sliceIndex * sliceDuration;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Adjust playback rate
    const originalBpm = 140;
    const effectiveBpm = stateRef.current.bpm * stateRef.current.timeMultiplier;
    source.playbackRate.value = effectiveBpm / originalBpm;

    // Stutter: play only 1/32 of the slice repeatedly
    const playDuration = stutter ? sliceDuration / 2 : sliceDuration;

    source.connect(filterRef.current!);
    source.start(time, offset, playDuration);
    currentSourceRef.current = source;
    lastPlayedSliceRef.current = sliceIndex;

    setState(s => ({ ...s, activeSlice: sliceIndex }));

    const adjustedDuration = (playDuration / (effectiveBpm / originalBpm)) * 1000;
    setTimeout(() => {
      setState(s => s.activeSlice === sliceIndex ? { ...s, activeSlice: null } : s);
    }, adjustedDuration);
  }, []);

  const schedulerTick = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    while (nextBeatTimeRef.current < ctx.currentTime + LOOK_AHEAD) {
      const { chaos, isAutoMode } = stateRef.current;
      const isReverse = stateRef.current.isShiftHeld;
      const isStutter = stutterActiveRef.current;

      let sliceToPlay: number;

      if (queuedSliceRef.current !== null) {
        // Manual trigger takes priority
        sliceToPlay = queuedSliceRef.current;
        queuedSliceRef.current = null;
        autoStepRef.current = sliceToPlay; // sync auto-gen position
      } else if (isStutter) {
        // Stutter repeats the last played slice
        sliceToPlay = lastPlayedSliceRef.current;
      } else if (isAutoMode) {
        if (Math.random() < chaos) {
          sliceToPlay = Math.random() < 0.3
            ? autoStepRef.current % NUM_SLICES // stutter
            : Math.floor(Math.random() * NUM_SLICES); // random
        } else {
          sliceToPlay = autoStepRef.current % NUM_SLICES;
        }
      } else {
        // Not in auto mode and no queued slice — don't play
        nextBeatTimeRef.current += getBeatDuration();
        continue;
      }

      playSliceAtTime(sliceToPlay, nextBeatTimeRef.current, isReverse, isStutter);
      autoStepRef.current = (autoStepRef.current + 1) % NUM_SLICES;
      nextBeatTimeRef.current += getBeatDuration();
    }
  }, [getBeatDuration, playSliceAtTime]);

  const startScheduler = useCallback(() => {
    if (schedulerRef.current) return;
    const ctx = ctxRef.current;
    if (!ctx) return;

    nextBeatTimeRef.current = ctx.currentTime;
    autoStepRef.current = 0;

    const tick = () => {
      schedulerTick();
      schedulerRef.current = window.setTimeout(tick, SCHEDULE_INTERVAL);
    };
    tick();
    setState(s => ({ ...s, isPlaying: true }));
  }, [schedulerTick]);

  const stopScheduler = useCallback(() => {
    if (schedulerRef.current) {
      clearTimeout(schedulerRef.current);
      schedulerRef.current = null;
    }
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch {}
    }
    setState(s => ({ ...s, isPlaying: false, isAutoMode: false, activeSlice: null }));
  }, []);

  const initAudio = useCallback(async () => {
    try {
      const ctx = new AudioContext();
      ctxRef.current = ctx;

      // Build DSP chain: source -> filter -> bitcrusher -> limiter -> dry/wet delay -> destination
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 20;
      filter.Q.value = 1;
      filterRef.current = filter;

      const bitcrusher = createBitcrusher(ctx);
      bitcrusherRef.current = bitcrusher;

      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.05;
      limiterRef.current = limiter;

      const delayNode = ctx.createDelay(2);
      delayNode.delayTime.value = 0.3;
      delayNodeRef.current = delayNode;

      const feedbackGain = ctx.createGain();
      feedbackGain.gain.value = 0;
      delayFeedbackRef.current = feedbackGain;

      const dryGain = ctx.createGain();
      dryGain.gain.value = 1;

      const wetGain = ctx.createGain();
      wetGain.gain.value = 0;
      wetGainRef.current = wetGain;

      // Chain
      filter.connect(bitcrusher.input);
      bitcrusher.output.connect(limiter);
      limiter.connect(dryGain);
      dryGain.connect(ctx.destination);

      limiter.connect(delayNode);
      delayNode.connect(feedbackGain);
      feedbackGain.connect(delayNode);
      delayNode.connect(wetGain);
      wetGain.connect(ctx.destination);

      // Load sample
      const response = await fetch(AMEN_URL);
      if (!response.ok) throw new Error('Failed to load sample');
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      bufferRef.current = audioBuffer;

      // Create reversed buffer
      const reversed = ctx.createBuffer(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const src = audioBuffer.getChannelData(ch);
        const dst = reversed.getChannelData(ch);
        for (let i = 0; i < src.length; i++) {
          dst[i] = src[src.length - 1 - i];
        }
      }
      reversedBufferRef.current = reversed;

      // Extract waveform data
      const channelData = audioBuffer.getChannelData(0);
      const waveform = new Float32Array(800);
      const step = Math.floor(channelData.length / 800);
      for (let i = 0; i < 800; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += Math.abs(channelData[i * step + j] || 0);
        }
        waveform[i] = sum / step;
      }

      setState(s => ({ ...s, isLoaded: true, waveformData: Array.from(waveform), error: null }));
    } catch (err) {
      setState(s => ({ ...s, error: (err as Error).message }));
    }
  }, []);

  // Queue a slice for quantized playback
  const triggerSlice = useCallback((sliceIndex: number) => {
    if (!bufferRef.current) return;
    queuedSliceRef.current = sliceIndex;
    queuedReverseRef.current = stateRef.current.isShiftHeld;

    // Provide immediate visual feedback even before audio triggers
    setState(s => ({ ...s, activeSlice: sliceIndex }));

    // Start scheduler if not running
    if (!schedulerRef.current) {
      startScheduler();
    }
  }, [startScheduler]);

  const toggleAutoGen = useCallback(() => {
    if (stateRef.current.isAutoMode) {
      stopScheduler();
    } else {
      setState(s => ({ ...s, isAutoMode: true }));
      startScheduler();
    }
  }, [startScheduler, stopScheduler]);

  const setBpm = useCallback((bpm: number) => setState(s => ({ ...s, bpm })), []);
  const setChaos = useCallback((chaos: number) => setState(s => ({ ...s, chaos })), []);

  const setFilterFreq = useCallback((freq: number) => {
    if (filterRef.current) filterRef.current.frequency.value = freq;
    setState(s => ({ ...s, filterFreq: freq }));
  }, []);

  const setFilterQ = useCallback((q: number) => {
    if (filterRef.current) filterRef.current.Q.value = q;
    setState(s => ({ ...s, filterQ: q }));
  }, []);

  const setFilterType = useCallback((type: 'highpass' | 'lowpass') => {
    if (filterRef.current) filterRef.current.type = type;
    setState(s => ({ ...s, filterType: type }));
  }, []);

  const setBitcrushMix = useCallback((mix: number) => {
    bitcrusherRef.current?.setMix(mix);
    setState(s => ({ ...s, bitcrushMix: mix }));
  }, []);

  const setDelayTime = useCallback((time: number) => {
    if (delayNodeRef.current) delayNodeRef.current.delayTime.value = time;
    setState(s => ({ ...s, delayTime: time }));
  }, []);

  const setDelayFeedback = useCallback((fb: number) => {
    if (delayFeedbackRef.current) delayFeedbackRef.current.gain.value = fb;
    if (wetGainRef.current) wetGainRef.current.gain.value = fb;
    setState(s => ({ ...s, delayFeedback: fb }));
  }, []);

  const setQuantize = useCallback((q: QuantizeMode) => setState(s => ({ ...s, quantize: q })), []);

  const setTimeMultiplier = useCallback((m: number) => setState(s => ({ ...s, timeMultiplier: m })), []);

  const setShiftHeld = useCallback((held: boolean) => setState(s => ({ ...s, isShiftHeld: held })), []);

  const setSpaceHeld = useCallback((held: boolean) => {
    stutterActiveRef.current = held;
    setState(s => ({ ...s, isSpaceHeld: held }));
  }, []);

  useEffect(() => {
    return () => {
      if (schedulerRef.current) clearTimeout(schedulerRef.current);
      ctxRef.current?.close();
    };
  }, []);

  return {
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
  };
}
