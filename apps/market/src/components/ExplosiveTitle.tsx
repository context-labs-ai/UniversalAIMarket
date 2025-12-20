"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

// Prevent animation replay on React StrictMode remount
let animationInstanceId = 0;

// Premium audio synthesis - Apple-inspired minimal design
class AudioSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private isInitialized = false;

  async init() {
    if (this.isInitialized) return true;
    try {
      this.ctx = new AudioContext();

      // Auto-resume if suspended
      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.8; // Comfortable volume

      // Create warm, spacious reverb - like a wood-paneled room
      this.convolver = this.ctx.createConvolver();
      const reverbLength = this.ctx.sampleRate * 2.2; // Longer tail
      const reverbBuffer = this.ctx.createBuffer(2, reverbLength, this.ctx.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = reverbBuffer.getChannelData(channel);
        for (let i = 0; i < reverbLength; i++) {
          // Slower decay for warmer, more enveloping reverb
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.6));
        }
      }
      this.convolver.buffer = reverbBuffer;

      // More wet mix for spaciousness
      const dryGain = this.ctx.createGain();
      const wetGain = this.ctx.createGain();
      dryGain.gain.value = 0.6;
      wetGain.gain.value = 0.4;

      this.masterGain.connect(dryGain);
      this.masterGain.connect(this.convolver);
      this.convolver.connect(wetGain);
      dryGain.connect(this.ctx.destination);
      wetGain.connect(this.ctx.destination);

      this.isInitialized = true;
      return true;
    } catch {
      return false;
    }
  }

  mute() {
    if (this.masterGain) {
      this.masterGain.gain.value = 0;
    }
  }

  unmute() {
    if (this.masterGain) {
      this.masterGain.gain.value = 0.8;
    }
  }

  // Warm wooden tick - like a soft mallet on rosewood
  playTick(pitch = 1) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Layered tones for warmth - fundamental + harmonics
    const frequencies = [280 * pitch, 560 * pitch, 840 * pitch];
    const volumes = [0.06, 0.025, 0.01];

    frequencies.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();

      // Triangle wave for softer, warmer tone
      osc.type = "triangle";
      osc.frequency.value = freq;

      // Low-pass filter for warmth
      filter.type = "lowpass";
      filter.frequency.value = 600;
      filter.Q.value = 1;

      // Soft attack, natural decay
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volumes[i], now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + 0.4);
    });
  }

  // Warm amber pad - rich, enveloping drone
  playPad(duration: number) {
    if (!this.ctx || !this.masterGain) return;
    if (duration < 0.5) return; // Too short to play
    const now = this.ctx.currentTime;

    // D major chord - warm and luxurious (D2, A2, D3, F#3)
    const frequencies = [73.42, 110.00, 146.83, 185.00];
    const volumes = [0.035, 0.025, 0.02, 0.015];

    // Adaptive envelope times based on duration
    const fadeIn = Math.min(1.5, duration * 0.3);
    const fadeOut = Math.min(1.5, duration * 0.3);
    const sustainEnd = Math.max(fadeIn + 0.1, duration - fadeOut);

    frequencies.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();

      // Triangle for warmth, slight detune for richness
      osc.type = "triangle";
      osc.frequency.value = freq;
      osc.detune.value = (i - 1.5) * 4;

      // Warm low-pass
      filter.type = "lowpass";
      filter.frequency.value = 400;
      filter.Q.value = 0.7;

      // Slow, gentle envelope with safe timing
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volumes[i], now + fadeIn);
      gain.gain.setValueAtTime(volumes[i], now + sustainEnd);
      gain.gain.linearRampToValueAtTime(0, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + duration + 0.1);
    });
  }

  // Completion tone - warm, resonant chime like a grandfather clock
  playComplete() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // D major arpeggio - warm and resolved (D4, F#4, A4)
    const frequencies = [293.66, 369.99, 440.00];
    const delays = [0, 0.08, 0.16];
    const volumes = [0.07, 0.05, 0.04];

    frequencies.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();

      // Triangle wave for bell-like warmth
      osc.type = "triangle";
      osc.frequency.value = freq;

      // Gentle low-pass for smoothness
      filter.type = "lowpass";
      filter.frequency.value = 1200;
      filter.Q.value = 0.5;

      // Staggered entry, long natural decay
      const startTime = now + delays[i];
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volumes[i], startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 2.5);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(startTime);
      osc.stop(startTime + 3);
    });
  }

  dispose() {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
      this.convolver = null;
      this.isInitialized = false;
    }
  }
}

const audioSynth = new AudioSynth();

interface Particle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  colorIndex: number;
  size: number;
  coreRadius: number;
  // For orbital floating
  orbitAngle: number;
  orbitRadius: number;
  orbitSpeed: number;
  orbitCenterX: number;
  orbitCenterY: number;
  // For quantum jump
  hasJumped: boolean;
  jumpDelay: number;
  jumpProgress: number;
  preJumpX: number;
  preJumpY: number;
}

interface ExplosiveTitleProps {
  title?: string;
  onComplete?: () => void;
  skip?: boolean;
}

export interface ExplosiveTitleHandle {
  disperse: () => void;
  reset: () => void;
  enableAudio: () => Promise<boolean>;
  setMuted: (muted: boolean) => void;
}

// Warm luxury palette: Amber + Cream + Pale Gold + rare hint of lime
const COLORS = [
  "#d4a574", // Amber - warm honey tone
  "#d4a574", // Amber (duplicate)
  "#f5efe4", // Cream white - soft ivory
  "#f5efe4", // Cream white (duplicate)
  "#c9956c", // Deep amber - burnished bronze
  "#e8d5a3", // Pale gold - champagne
  "#e8d5a3", // Pale gold (duplicate)
  "#c8d86a", // Soft lime - rare fluorescent green
];

// Pre-render glow sprites
function createGlowSprites(size: number): HTMLCanvasElement[] {
  return COLORS.map((color) => {
    const sprite = document.createElement("canvas");
    const spriteSize = size * 2;
    sprite.width = spriteSize;
    sprite.height = spriteSize;
    const sCtx = sprite.getContext("2d");
    if (sCtx) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      const grad = sCtx.createRadialGradient(size, size, 0, size, size, size);
      grad.addColorStop(0, `rgba(${r},${g},${b},0.9)`);
      grad.addColorStop(0.15, `rgba(${r},${g},${b},0.4)`);
      grad.addColorStop(0.4, `rgba(${r},${g},${b},0.1)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, spriteSize, spriteSize);
    }
    return sprite;
  });
}

// Easing functions
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export const ExplosiveTitle = forwardRef<ExplosiveTitleHandle, ExplosiveTitleProps>(
  ({ title = "Universal AI Market", onComplete, skip = false }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const onCompleteRef = useRef(onComplete);
    const disperseRef = useRef<() => void>(() => {});
    const resetRef = useRef<() => void>(() => {});
    const enableAudioRef = useRef<() => Promise<boolean>>(async () => false);
    const setMutedRef = useRef<(muted: boolean) => void>(() => {});
    const instanceIdRef = useRef<number>(0);

    useEffect(() => {
      onCompleteRef.current = onComplete;
    }, [onComplete]);

    useImperativeHandle(
      ref,
      () => ({
        disperse: () => disperseRef.current(),
        reset: () => resetRef.current(),
        enableAudio: () => enableAudioRef.current(),
        setMuted: (muted: boolean) => setMutedRef.current(muted),
      }),
      []
    );

    useEffect(() => {
      if (skip) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const currentInstanceId = ++animationInstanceId;
      instanceIdRef.current = currentInstanceId;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let particles: Particle[] = [];
      let animationFrameId: number;
      let startTime = performance.now();
      let centerX = 0;
      let centerY = 0;
      let currentPhase: "float" | "jump" | "settled" | "disperse" = "float";
      let notifiedComplete = false;
      let jumpStartedAt: number | null = null;
      let disperseStartedAt: number | null = null;
      const pointer = { x: 0, y: 0, active: false };

      // Timing
      const floatDuration = 1500;
      const jumpDuration = 2000;
      const totalDuration = floatDuration + jumpDuration;
      const settledFadeDuration = 600;
      const disperseDuration = 1200;
      const hoverRadius = 90;
      const hoverRadiusSq = hoverRadius * hoverRadius;

      // Pre-rendered glow sprites
      const glowSize = 24;
      const glowSprites = createGlowSprites(glowSize);

      // Ripple effects during jump phase
      const ripples: { x: number; y: number; startTime: number; color: string }[] = [];

      const offCanvas = document.createElement("canvas");
      const offCtx = offCanvas.getContext("2d");

      const createParticles = () => {
        if (!offCtx) return;

        offCanvas.width = canvas.width;
        offCanvas.height = canvas.height;

        const baseSize = Math.min(canvas.width * 0.13, canvas.height * 0.17);
        const fontSize = Math.max(56, Math.min(baseSize, 170));
        const textX = canvas.width / 2;
        const textY = canvas.height / 2;
        centerX = textX;
        centerY = textY;

        offCtx.font = `900 ${fontSize}px "Space Grotesk", sans-serif`;
        offCtx.textAlign = "center";
        offCtx.textBaseline = "middle";
        offCtx.fillStyle = "white";
        offCtx.fillText(title, textX, textY);

        const imageData = offCtx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const minSide = Math.min(canvas.width, canvas.height);
        const step = Math.min(8, Math.max(4, Math.round(minSide / 120)));

        particles = [];
        ripples.length = 0;

        for (let y = 0; y < canvas.height; y += step) {
          for (let x = 0; x < canvas.width; x += step) {
            const index = (y * canvas.width + x) * 4;
            if (data[index + 3] > 128) {
              // Calculate distance from center for staggered jump
              const dx = x - centerX;
              const dy = y - centerY;
              const distFromCenter = Math.hypot(dx, dy);
              const maxDist = Math.hypot(canvas.width / 2, canvas.height / 2);

              // Random orbital starting position
              const angle = Math.random() * Math.PI * 2;
              const orbitRadius = 80 + Math.random() * 200;
              const orbitCenterX = centerX + (Math.random() - 0.5) * 300;
              const orbitCenterY = centerY + (Math.random() - 0.5) * 200;

              const size = Math.random() * 2 + 1;

              particles.push({
                x: orbitCenterX + Math.cos(angle) * orbitRadius,
                y: orbitCenterY + Math.sin(angle) * orbitRadius,
                targetX: x,
                targetY: y,
                vx: 0,
                vy: 0,
                colorIndex: Math.floor(Math.random() * COLORS.length),
                size,
                coreRadius: Math.max(0.75, size * 0.6),
                orbitAngle: angle,
                orbitRadius,
                orbitSpeed: 0.0008 + Math.random() * 0.0012,
                orbitCenterX,
                orbitCenterY,
                hasJumped: false,
                // Wave-like jump: center particles jump first, then ripple outward
                jumpDelay: (distFromCenter / maxDist) * 0.7 + Math.random() * 0.15,
                jumpProgress: 0,
                preJumpX: 0,
                preJumpY: 0,
              });
            }
          }
        }
      };

      // Audio state (declared before resetAnimation so they can be reset)
      let audioReady = false;
      let padPlayed = false;
      let completePlayed = false;
      let tickCount = 0;
      const maxTicks = 8; // Sparse, elegant ticks

      const resetAnimation = () => {
        createParticles();
        startTime = performance.now();
        currentPhase = "float";
        notifiedComplete = false;
        jumpStartedAt = null;
        disperseStartedAt = null;

        // Reset audio state for replay
        padPlayed = false;
        completePlayed = false;
        tickCount = 0;

        // Play ambient pad if audio is ready
        if (audioReady) {
          padPlayed = true;
          audioSynth.playPad((floatDuration + jumpDuration) / 1000 + 1);
        }
      };

      const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        resetAnimation();
      };

      const handlePointerMove = (event: PointerEvent) => {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        pointer.active = true;
      };

      const handlePointerLeave = () => {
        pointer.active = false;
      };

      resize();
      window.addEventListener("resize", resize);
      window.addEventListener("pointermove", handlePointerMove, { passive: true });
      window.addEventListener("pointerleave", handlePointerLeave);
      window.addEventListener("blur", handlePointerLeave);

      // Enable audio - called from external toggle button
      const enableAudio = async (): Promise<boolean> => {
        if (audioReady) return true;
        const success = await audioSynth.init();
        if (success) {
          audioReady = true;
          // Start ambient pad if still in float/jump phase
          if (!padPlayed && (currentPhase === "float" || currentPhase === "jump")) {
            padPlayed = true;
            const remainingTime = Math.max(1, (totalDuration - (performance.now() - startTime)) / 1000 + 0.5);
            audioSynth.playPad(remainingTime);
          }
          return true;
        }
        return false;
      };

      // Expose methods to parent via ref
      enableAudioRef.current = enableAudio;
      setMutedRef.current = (muted: boolean) => {
        if (muted) {
          audioSynth.mute();
        } else {
          audioSynth.unmute();
        }
      };

      const triggerDisperse = () => {
        if (currentPhase !== "settled") return;
        currentPhase = "disperse";
        disperseStartedAt = performance.now();

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          // Calculate angle from center for spiral effect
          const dx = p.x - centerX;
          const dy = p.y - centerY;
          const distFromCenter = Math.hypot(dx, dy);
          const angleFromCenter = Math.atan2(dy, dx);

          // Spiral outward: add perpendicular velocity component
          const spiralAngle = angleFromCenter + Math.PI * 0.3; // 30° offset for spiral
          const speed = 1.5 + Math.random() * 2 + distFromCenter * 0.008;

          p.vx = Math.cos(spiralAngle) * speed;
          p.vy = Math.sin(spiralAngle) * speed;

          // Store original size for shrinking effect
          (p as Particle & { disperseSize?: number }).disperseSize = p.coreRadius;
        }
      };

      disperseRef.current = triggerDisperse;
      resetRef.current = resetAnimation;

      const animate = (frameTime: number) => {
        if (instanceIdRef.current !== currentInstanceId) return;

        const now = frameTime;
        const elapsed = now - startTime;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = "lighter";

        const floatProgress = Math.min(1, elapsed / floatDuration);
        let jumpProgress = 0;
        let settledFadeProgress = 0;

        // Phase transitions
        if (currentPhase !== "disperse") {
          if (elapsed < floatDuration) {
            currentPhase = "float";
          } else if (elapsed < totalDuration) {
            if (currentPhase !== "jump") {
              currentPhase = "jump";
              jumpStartedAt = now;
              // Store pre-jump positions
              for (const p of particles) {
                p.preJumpX = p.x;
                p.preJumpY = p.y;
              }
            }
            jumpProgress = (elapsed - floatDuration) / jumpDuration;
          } else {
            currentPhase = "settled";
            if (!notifiedComplete) {
              notifiedComplete = true;
              // Play completion tone
              if (!completePlayed && audioReady) {
                completePlayed = true;
                audioSynth.playComplete();
              }
              onCompleteRef.current?.();
            }
            settledFadeProgress = Math.min(1, (elapsed - totalDuration) / settledFadeDuration);
          }
        } else if (disperseStartedAt) {
          settledFadeProgress = Math.min(1, (now - disperseStartedAt) / disperseDuration);
        }

        // Calculate phase alpha
        let phaseAlpha: number;
        if (currentPhase === "disperse") {
          phaseAlpha = 1 - settledFadeProgress;
        } else if (currentPhase === "float") {
          phaseAlpha = 0.6 + 0.3 * floatProgress;
        } else if (currentPhase === "jump") {
          phaseAlpha = 0.9 + 0.1 * jumpProgress;
        } else {
          // Subtle breathing effect when settled
          const breathe = Math.sin(now * 0.002) * 0.05;
          phaseAlpha = 0.85 + breathe - 0.1 * settledFadeProgress;
        }

        // Draw and update ripples
        for (let i = ripples.length - 1; i >= 0; i--) {
          const ripple = ripples[i];
          const rippleAge = now - ripple.startTime;
          const rippleDuration = 400;

          if (rippleAge > rippleDuration) {
            ripples.splice(i, 1);
            continue;
          }

          const t = rippleAge / rippleDuration;
          const radius = t * 25;
          const alpha = (1 - t) * 0.3;

          ctx.globalAlpha = alpha;
          ctx.strokeStyle = ripple.color;
          ctx.lineWidth = 1.5 * (1 - t);
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Pre-calculate common values
        const isFloat = currentPhase === "float";
        const isJump = currentPhase === "jump";
        const isSettled = currentPhase === "settled";
        const isDisperse = currentPhase === "disperse";
        const hoverActive = isSettled && pointer.active;

        ctx.globalAlpha = phaseAlpha;

        // Update and draw particles
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          if (isFloat) {
            // Gentle orbital motion - nebula-like floating
            p.orbitAngle += p.orbitSpeed * 16;

            // Slowly drift orbit center toward canvas center
            p.orbitCenterX += (centerX - p.orbitCenterX) * 0.0003;
            p.orbitCenterY += (centerY - p.orbitCenterY) * 0.0003;

            // Slowly shrink orbit radius
            p.orbitRadius *= 0.9997;

            p.x = p.orbitCenterX + Math.cos(p.orbitAngle) * p.orbitRadius;
            p.y = p.orbitCenterY + Math.sin(p.orbitAngle) * p.orbitRadius;

            // Add subtle noise for organic feel
            p.x += Math.sin(now * 0.001 + i) * 0.5;
            p.y += Math.cos(now * 0.0012 + i * 1.3) * 0.5;

          } else if (isJump) {
            // Quantum jump with wave propagation
            if (!p.hasJumped && jumpProgress >= p.jumpDelay) {
              // Calculate individual particle jump progress (longer duration = smoother)
              const particleJumpProgress = Math.min(1, (jumpProgress - p.jumpDelay) / 0.4);
              p.jumpProgress = easeOutBack(particleJumpProgress);

              // Interpolate position
              p.x = p.preJumpX + (p.targetX - p.preJumpX) * p.jumpProgress;
              p.y = p.preJumpY + (p.targetY - p.preJumpY) * p.jumpProgress;

              // Mark as jumped and create ripple when complete
              if (particleJumpProgress >= 1) {
                p.hasJumped = true;
                // Add ripple effect and sound
                if (Math.random() < 0.12) {
                  ripples.push({
                    x: p.targetX,
                    y: p.targetY,
                    startTime: now,
                    color: COLORS[p.colorIndex],
                  });
                  // Play crystalline tick (sparse, elegant)
                  if (tickCount < maxTicks && audioReady) {
                    tickCount++;
                    const pitch = 0.9 + Math.random() * 0.2;
                    audioSynth.playTick(pitch);
                  }
                }
              }
            } else if (!p.hasJumped) {
              // Still floating while waiting to jump
              p.orbitAngle += p.orbitSpeed * 16;
              p.x = p.orbitCenterX + Math.cos(p.orbitAngle) * p.orbitRadius;
              p.y = p.orbitCenterY + Math.sin(p.orbitAngle) * p.orbitRadius;
            }

          } else if (isDisperse) {
            // Spiral acceleration with rotation
            const dx = p.x - centerX;
            const dy = p.y - centerY;
            const dist = Math.hypot(dx, dy);

            // Add rotational velocity (spiral effect)
            if (dist > 1) {
              const perpX = -dy / dist;
              const perpY = dx / dist;
              p.vx += perpX * 0.15;
              p.vy += perpY * 0.15;
            }

            // Gentle acceleration outward
            p.vx *= 1.015;
            p.vy *= 1.015;

            // Add subtle gravity
            p.vy += 0.03;

            p.x += p.vx;
            p.y += p.vy;

            // Shrink particle over time
            const disperseProgress = disperseStartedAt ? (now - disperseStartedAt) / disperseDuration : 0;
            const shrinkFactor = Math.max(0.1, 1 - disperseProgress * 0.8);
            p.coreRadius = ((p as Particle & { disperseSize?: number }).disperseSize || 1) * shrinkFactor;

          } else {
            // Settled - subtle drift toward target
            const dx = p.targetX - p.x;
            const dy = p.targetY - p.y;
            p.x += dx * 0.08;
            p.y += dy * 0.08;

            // Hover interaction
            if (hoverActive) {
              const mx = p.x - pointer.x;
              const my = p.y - pointer.y;
              const distSq = mx * mx + my * my;
              if (distSq > 0 && distSq < hoverRadiusSq) {
                const dist = Math.sqrt(distSq);
                const force = (1 - dist / hoverRadius) * 2;
                p.x += (mx / dist) * force;
                p.y += (my / dist) * force;
              }
            }
          }

          // Draw trail for disperse phase
          if (isDisperse) {
            const speed = Math.hypot(p.vx, p.vy);
            if (speed > 0.5) {
              const tailLen = Math.min(50, speed * 3);
              const nx = p.vx / speed;
              const ny = p.vy / speed;

              // Gradient trail
              const gradient = ctx.createLinearGradient(
                p.x - nx * tailLen, p.y - ny * tailLen,
                p.x, p.y
              );
              gradient.addColorStop(0, "rgba(255,255,255,0)");
              gradient.addColorStop(1, COLORS[p.colorIndex]);

              ctx.globalAlpha = phaseAlpha * 0.4;
              ctx.strokeStyle = gradient;
              ctx.lineWidth = p.coreRadius * 1.5;
              ctx.lineCap = "round";
              ctx.beginPath();
              ctx.moveTo(p.x - nx * tailLen, p.y - ny * tailLen);
              ctx.lineTo(p.x, p.y);
              ctx.stroke();
            }
          }

          // Draw glow
          const sprite = glowSprites[p.colorIndex];
          const glowScale = isJump && !p.hasJumped && jumpProgress >= p.jumpDelay
            ? 1 + p.jumpProgress * 0.5  // Glow intensifies during jump
            : isDisperse ? 0.6 : 1; // Smaller glow when dispersing
          const drawSize = p.coreRadius * 6 * glowScale;

          ctx.globalAlpha = phaseAlpha * (isFloat ? 0.7 : 1);
          ctx.drawImage(
            sprite,
            p.x - drawSize,
            p.y - drawSize,
            drawSize * 2,
            drawSize * 2
          );

          // Draw core
          ctx.globalAlpha = phaseAlpha;
          ctx.fillStyle = COLORS[p.colorIndex];
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.coreRadius, 0, Math.PI * 2);
          ctx.fill();
        }

        animationFrameId = requestAnimationFrame(animate);
      };

      animationFrameId = requestAnimationFrame(animate);

      return () => {
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerleave", handlePointerLeave);
        window.removeEventListener("blur", handlePointerLeave);
        cancelAnimationFrame(animationFrameId);
      };
    }, [title, skip]);

    return (
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0 h-full w-full pointer-events-none"
        style={{ opacity: skip ? 0 : 1 }}
      />
    );
  }
);

ExplosiveTitle.displayName = "ExplosiveTitle";

