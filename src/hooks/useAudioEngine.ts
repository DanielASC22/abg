import { useRef, useState, useCallback, useEffect } from 'react';

const NUM_SLICES = 16;
const AMEN_URL = `${import.meta.env.BASE_URL}audio/amen-break.mp3`;
const LOOK_AHEAD = 0.05; // 50ms lookahead
const SCHEDULE_INTERVAL = 25; // ms

export type QuantizeMode = '1/16' | '1/8';

// Sequence step: slice index, null = rest, -1 = hold
export type SequenceStep = number | null;

interface AudioEngineState {
  isLoaded: boolean;
  isPlaying: boolean;
  isAutoMode: boolean;
  isSequenceMode: boolean;
  sequencePosition: number;
  sequenceLength: number;
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
  timeMultiplier: number;
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
  const currentGainRef = useRef<GainNode | null>(null);
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

  // Sequence refs
  const sequenceRef = useRef<SequenceStep[]>([]);
  const sequenceStepRef = useRef(0);
  const isSequenceModeRef = useRef(false);
  const mountedRef = useRef(true);

  const [state, setState] = useState<AudioEngineState>({
    isLoaded: false,
    isPlaying: false,
    isAutoMode: false,
    isSequenceMode: false,
    sequencePosition: 0,
    sequenceLength: 0,
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

  const safeSetState = useCallback((updater: (s: AudioEngineState) => AudioEngineState) => {
    if (mountedRef.current) setState(updater);
  }, []);

  const stateRef = useRef(state);
  stateRef.current = state;

  const getBeatDuration = useCallback(() => {
    const buffer = bufferRef.current;
    if (!buffer) return 0.1;
    // Each slice's real-time duration is the source of truth
    const sliceDuration = buffer.duration / NUM_SLICES;
    const { bpm, timeMultiplier } = stateRef.current;
    const originalBpm = 140;
    const effectiveBpm = bpm * timeMultiplier;
    const rate = effectiveBpm / originalBpm;
    // Base duration is one slice; quantize subdivision can halve it
    const baseDuration = sliceDuration / rate;
    const { quantize } = stateRef.current;
    // 1/16 = one slice per beat, 1/8 = two slices per beat (skip every other)
    return quantize === '1/8' ? baseDuration * 2 : baseDuration;
  }, []);

  const playSliceAtTime = useCallback((sliceIndex: number, time: number, reverse: boolean, stutter: boolean) => {
    const ctx = ctxRef.current;
    const buffer = reverse ? reversedBufferRef.current : bufferRef.current;
    if (!ctx || !buffer) return;

    const FADE_TIME = 0.005; // 5ms crossfade to eliminate clicks

    // Crossfade out the previous source instead of hard-stopping
    if (currentSourceRef.current && currentGainRef.current) {
      const prevGain = currentGainRef.current;
      prevGain.gain.setValueAtTime(prevGain.gain.value, time);
      prevGain.gain.linearRampToValueAtTime(0, time + FADE_TIME);
      const prevSource = currentSourceRef.current;
      try { prevSource.stop(time + FADE_TIME + 0.01); } catch {}
    }

    const sliceDuration = buffer.duration / NUM_SLICES;
    let offset: number;

    if (reverse) {
      offset = (NUM_SLICES - 1 - sliceIndex) * sliceDuration;
    } else {
      offset = sliceIndex * sliceDuration;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const originalBpm = 140;
    const effectiveBpm = stateRef.current.bpm * stateRef.current.timeMultiplier;
    source.playbackRate.value = effectiveBpm / originalBpm;

    const playDuration = stutter ? sliceDuration / 2 : sliceDuration;

    // Per-voice gain node for crossfading
    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(0, time);
    voiceGain.gain.linearRampToValueAtTime(1, time + FADE_TIME);

    source.connect(voiceGain);
    voiceGain.connect(filterRef.current!);
    // Add a tiny overlap to prevent micro-gaps
    source.start(time, offset, playDuration + FADE_TIME * 2);
    currentSourceRef.current = source;
    currentGainRef.current = voiceGain;
    lastPlayedSliceRef.current = sliceIndex;

    safeSetState(s => ({ ...s, activeSlice: sliceIndex }));

    const adjustedDuration = (playDuration / (effectiveBpm / originalBpm)) * 1000;
    setTimeout(() => {
      safeSetState(s => s.activeSlice === sliceIndex ? { ...s, activeSlice: null } : s);
    }, adjustedDuration);
  }, []);

  const schedulerTick = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    while (nextBeatTimeRef.current < ctx.currentTime + LOOK_AHEAD) {
      const { chaos, isAutoMode } = stateRef.current;
      const isReverse = stateRef.current.isShiftHeld;
      const isStutter = stutterActiveRef.current;

      // Sequence mode
      if (isSequenceModeRef.current) {
        const seq = sequenceRef.current;
        if (seq.length === 0) {
          nextBeatTimeRef.current += getBeatDuration();
          continue;
        }
        const step = sequenceStepRef.current % seq.length;
        const val = seq[step];

        // Update position for visual tracking
        safeSetState(s => ({ ...s, sequencePosition: step }));

        if (val === null) {
          // Rest — silence, stop current source
          if (currentSourceRef.current) {
            try { currentSourceRef.current.stop(); } catch {}
          }
          safeSetState(s => ({ ...s, activeSlice: null }));
        } else if (val === -1) {
          // Hold — do nothing, let previous slice continue
        } else {
          playSliceAtTime(val, nextBeatTimeRef.current, isReverse, false);
        }

        sequenceStepRef.current = step + 1;
        nextBeatTimeRef.current += getBeatDuration();
        continue;
      }

      let sliceToPlay: number;

      if (queuedSliceRef.current !== null) {
        sliceToPlay = queuedSliceRef.current;
        queuedSliceRef.current = null;
        autoStepRef.current = sliceToPlay;
      } else if (isStutter) {
        sliceToPlay = lastPlayedSliceRef.current;
      } else if (isAutoMode) {
        if (Math.random() < chaos) {
          sliceToPlay = Math.random() < 0.3
            ? autoStepRef.current % NUM_SLICES
            : Math.floor(Math.random() * NUM_SLICES);
        } else {
          sliceToPlay = autoStepRef.current % NUM_SLICES;
        }
      } else {
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
    safeSetState(s => ({ ...s, isPlaying: true }));
  }, [schedulerTick]);

  const stopScheduler = useCallback(() => {
    if (schedulerRef.current) {
      clearTimeout(schedulerRef.current);
      schedulerRef.current = null;
    }
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch {}
    }
    isSequenceModeRef.current = false;
    sequenceStepRef.current = 0;
    safeSetState(s => ({ ...s, isPlaying: false, isAutoMode: false, isSequenceMode: false, sequencePosition: 0, activeSlice: null }));
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
      limiter.threshold.value = -1;
      limiter.knee.value = 6;
      limiter.ratio.value = 4;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.1;
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

      // Load default sample
      await loadSampleFromUrl(AMEN_URL, ctx);

      setState(s => ({ ...s, error: null }));
    } catch (err) {
      setState(s => ({ ...s, error: (err as Error).message }));
    }
  }, []);

  const loadSampleFromUrl = useCallback(async (url: string, ctx?: AudioContext) => {
    const audioCtx = ctx || ctxRef.current;
    if (!audioCtx) return;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to load sample');
    const arrayBuffer = await response.arrayBuffer();
    await loadSampleFromArrayBuffer(arrayBuffer, audioCtx);
  }, []);

  const loadSampleFromArrayBuffer = useCallback(async (arrayBuffer: ArrayBuffer, ctx?: AudioContext) => {
    const audioCtx = ctx || ctxRef.current;
    if (!audioCtx) return;

    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    bufferRef.current = audioBuffer;

    // Create reversed buffer
    const reversed = audioCtx.createBuffer(
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

    setState(s => ({ ...s, isLoaded: true, waveformData: Array.from(waveform) }));
  }, []);

  const loadUserSample = useCallback(async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      await loadSampleFromArrayBuffer(arrayBuffer);
    } catch (err) {
      setState(s => ({ ...s, error: (err as Error).message }));
    }
  }, [loadSampleFromArrayBuffer]);

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

  // Sequence mode: parse string to steps and play
  const CHAR_TO_SLICE: Record<string, number> = {
    '1': 0, '2': 1, '3': 2, '4': 3,
    'q': 4, 'w': 5, 'e': 6, 'r': 7,
    'a': 8, 's': 9, 'd': 10, 'f': 11,
    'z': 12, 'x': 13, 'c': 14, 'v': 15,
  };

  const playSequence = useCallback((input: string) => {
    if (!bufferRef.current) return;
    // Stop any current playback
    stopScheduler();

    const steps: SequenceStep[] = input.toLowerCase().split('').map(ch => {
      if (ch === '.' || ch === ' ') return null; // rest
      if (ch === '-') return -1; // hold
      const slice = CHAR_TO_SLICE[ch];
      return slice !== undefined ? slice : null;
    });

    sequenceRef.current = steps;
    sequenceStepRef.current = 0;
    isSequenceModeRef.current = true;
    setState(s => ({ ...s, isSequenceMode: true, sequenceLength: steps.length, sequencePosition: 0 }));
    startScheduler();
  }, [startScheduler, stopScheduler]);

  const stopSequence = useCallback(() => {
    stopScheduler();
  }, [stopScheduler]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
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
    loadUserSample,
    playSequence,
    stopSequence,
  };
}
