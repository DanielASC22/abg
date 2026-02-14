import { useRef, useState, useCallback, useEffect } from 'react';

const NUM_SLICES = 16;
const AMEN_URL = '/audio/amen-break.wav';

interface AudioEngineState {
  isLoaded: boolean;
  isPlaying: boolean;
  isAutoMode: boolean;
  activeSlice: number | null;
  bpm: number;
  chaos: number;
  filterFreq: number;
  filterQ: number;
  distortion: number;
  delayTime: number;
  delayFeedback: number;
  error: string | null;
  waveformData: number[] | null;
}

function makeDistortionCurve(amount: number) {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + amount * 100) * x * 20 * deg) / (Math.PI + amount * 100 * Math.abs(x));
  }
  return curve;
}

export function useAudioEngine() {
  const ctxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const autoIntervalRef = useRef<number | null>(null);
  const autoStepRef = useRef(0);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const distortionRef = useRef<WaveShaperNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const delayFeedbackRef = useRef<GainNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);

  const [state, setState] = useState<AudioEngineState>({
    isLoaded: false,
    isPlaying: false,
    isAutoMode: false,
    activeSlice: null,
    bpm: 140,
    chaos: 0.2,
    filterFreq: 20000,
    filterQ: 1,
    distortion: 0,
    delayTime: 0.3,
    delayFeedback: 0.3,
    error: null,
    waveformData: null,
  });

  // Store latest state in ref for scheduler access
  const stateRef = useRef(state);
  stateRef.current = state;

  const initAudio = useCallback(async () => {
    try {
      const ctx = new AudioContext();
      ctxRef.current = ctx;

      // Build effects chain: source -> filter -> distortion -> dry/wet delay -> destination
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 20;
      filter.Q.value = 1;
      filterRef.current = filter;

      const dist = ctx.createWaveShaper();
      dist.curve = makeDistortionCurve(0);
      dist.oversample = '4x';
      distortionRef.current = dist;

      const delayNode = ctx.createDelay(2);
      delayNode.delayTime.value = 0.3;
      delayNodeRef.current = delayNode;

      const feedbackGain = ctx.createGain();
      feedbackGain.gain.value = 0.3;
      delayFeedbackRef.current = feedbackGain;

      const dryGain = ctx.createGain();
      dryGain.gain.value = 1;
      dryGainRef.current = dryGain;

      const wetGain = ctx.createGain();
      wetGain.gain.value = 0.3;
      wetGainRef.current = wetGain;

      // Chain
      filter.connect(dist);
      dist.connect(dryGain);
      dryGain.connect(ctx.destination);

      dist.connect(delayNode);
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

  const triggerSlice = useCallback((sliceIndex: number) => {
    const ctx = ctxRef.current;
    const buffer = bufferRef.current;
    if (!ctx || !buffer) return;

    // Stop previous source
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch {}
    }

    const sliceDuration = buffer.duration / NUM_SLICES;
    const offset = sliceIndex * sliceDuration;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Adjust playback rate for BPM (original amen is ~137 BPM)
    const originalBpm = 137;
    source.playbackRate.value = stateRef.current.bpm / originalBpm;

    source.connect(filterRef.current!);
    source.start(ctx.currentTime, offset, sliceDuration);
    currentSourceRef.current = source;

    setState(s => ({ ...s, activeSlice: sliceIndex }));

    const adjustedDuration = (sliceDuration / (stateRef.current.bpm / originalBpm)) * 1000;
    setTimeout(() => {
      setState(s => s.activeSlice === sliceIndex ? { ...s, activeSlice: null } : s);
    }, adjustedDuration);
  }, []);

  const startAutoGen = useCallback(() => {
    if (autoIntervalRef.current) return;
    autoStepRef.current = 0;

    const scheduleNext = () => {
      const { bpm, chaos } = stateRef.current;
      const originalBpm = 137;
      const stepDuration = (60 / bpm / 4) * 1000; // 16th notes

      let nextSlice: number;
      if (Math.random() < chaos) {
        // Random or stutter
        if (Math.random() < 0.3) {
          nextSlice = autoStepRef.current; // stutter
        } else {
          nextSlice = Math.floor(Math.random() * NUM_SLICES);
        }
      } else {
        nextSlice = autoStepRef.current % NUM_SLICES;
      }

      triggerSlice(nextSlice);
      autoStepRef.current = (autoStepRef.current + 1) % NUM_SLICES;

      autoIntervalRef.current = window.setTimeout(scheduleNext, stepDuration);
    };

    setState(s => ({ ...s, isAutoMode: true, isPlaying: true }));
    scheduleNext();
  }, [triggerSlice]);

  const stopAutoGen = useCallback(() => {
    if (autoIntervalRef.current) {
      clearTimeout(autoIntervalRef.current);
      autoIntervalRef.current = null;
    }
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch {}
    }
    setState(s => ({ ...s, isAutoMode: false, isPlaying: false, activeSlice: null }));
  }, []);

  const toggleAutoGen = useCallback(() => {
    if (stateRef.current.isAutoMode) {
      stopAutoGen();
    } else {
      startAutoGen();
    }
  }, [startAutoGen, stopAutoGen]);

  const setBpm = useCallback((bpm: number) => {
    setState(s => ({ ...s, bpm }));
  }, []);

  const setChaos = useCallback((chaos: number) => {
    setState(s => ({ ...s, chaos }));
  }, []);

  const setFilterFreq = useCallback((freq: number) => {
    if (filterRef.current) filterRef.current.frequency.value = freq;
    setState(s => ({ ...s, filterFreq: freq }));
  }, []);

  const setFilterQ = useCallback((q: number) => {
    if (filterRef.current) filterRef.current.Q.value = q;
    setState(s => ({ ...s, filterQ: q }));
  }, []);

  const setDistortion = useCallback((amount: number) => {
    if (distortionRef.current) {
      distortionRef.current.curve = amount > 0 ? makeDistortionCurve(amount) : null;
    }
    setState(s => ({ ...s, distortion: amount }));
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

  useEffect(() => {
    return () => {
      if (autoIntervalRef.current) clearTimeout(autoIntervalRef.current);
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
    setDistortion,
    setDelayTime,
    setDelayFeedback,
  };
}
