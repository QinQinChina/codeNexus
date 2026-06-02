export type ConfettiOptions = {
  durationMs?: number;
  intervalMs?: number;
  particleCount?: number;
  startVelocity?: number;
  spread?: number;
  angle?: number;
  ticks?: number;
  zIndex?: number;
  origins?: ConfettiOrigin[];
};

type ConfettiAxis = number | [number, number];

export type ConfettiOrigin = {
  x: ConfettiAxis;
  y: ConfettiAxis;
  angle?: number;
  spread?: number;
  startVelocity?: number;
  particleCountScale?: number;
};

type ConfettiParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  r: number;
  vr: number;
  color: string;
  alpha: number;
  bornAt: number;
  lifeMs: number;
};

const CONFETTI_CANVAS_ID = "codex-confetti-canvas";
let activeCleanup: (() => void) | null = null;
const DEG_TO_RAD = Math.PI / 180;

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function prefersReducedMotion(): boolean {
  try {
    return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  } catch {
    return false;
  }
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function sampleOrigin(origin: ConfettiOrigin): { x: number; y: number } {
  const x = origin?.x;
  const y = origin?.y;
  if (Array.isArray(x) && x.length === 2 && Array.isArray(y) && y.length === 2) {
    return { x: rand(Number(x[0]), Number(x[1])), y: rand(Number(y[0]), Number(y[1])) };
  }
  return { x: Number(x), y: Number(y) };
}

export function fireConfetti(options?: ConfettiOptions): void {
  if (typeof window === "undefined") return;
  if (prefersReducedMotion()) return;

  const durationMs = clampInt(options?.durationMs, 1800, 900, 15_000);
  const intervalMs = clampInt(options?.intervalMs, 240, 60, 1000);
  // Base particles per burst (will be scaled down as the animation approaches the end).
  const baseParticleCount = clampInt(options?.particleCount, 50, 10, 220);
  const startVelocity = clampNumber(options?.startVelocity, 28, 6, 70);
  const spreadDeg = clampNumber(options?.spread, 85, 0, 360);
  // Angle definition (0 = right, 90 = up, 180 = left, 270 = down).
  const angleDeg = clampNumber(options?.angle, 90, 0, 360);
  const ticks = clampInt(options?.ticks, 80, 20, 240);
  const zIndex = clampInt(options?.zIndex, 2000, 0, 99_999);
  const origins = options?.origins && options.origins.length > 0 ? options.origins : [{ x: 0.5, y: 0.5 }];

  // Ensure only one confetti run is alive at a time (cancels rAF + listeners too).
  if (activeCleanup) {
    try {
      activeCleanup();
    } catch {}
    activeCleanup = null;
  }

  // Extra safety: hot-reload / unexpected states may leave a canvas behind.
  const existing = document.getElementById(CONFETTI_CANVAS_ID);
  if (existing) {
    try {
      existing.remove();
    } catch {}
  }

  const canvas = document.createElement("canvas");
  canvas.id = CONFETTI_CANVAS_ID;
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = String(zIndex);
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    try {
      canvas.remove();
    } catch {}
    return;
  }

  const colors = ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#0a84ff", "#af52de", "#ff2d55"] as const;

  let width = 1;
  let height = 1;
  let dpr = 1;

  const resize = () => {
    // In Electron/Windows some layouts can briefly report 0x0; prefer viewport metrics.
    width = Math.max(1, Math.round(window.innerWidth || document.documentElement.clientWidth || 1));
    height = Math.max(1, Math.round(window.innerHeight || document.documentElement.clientHeight || 1));
    dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  resize();
  window.addEventListener("resize", resize, { passive: true });

  const gravity = 0.44;
  const drag = 0.985;

  const particles: ConfettiParticle[] = [];

  const emit = (now: number, originValue: ConfettiOrigin, count: number) => {
    if (count <= 0) return;
    const sampled = sampleOrigin(originValue);
    // Allow negative origin (e.g. y=-0.2 like canvas-confetti) to emit from above the viewport.
    const originXNorm = clampNumber(sampled.x, 0.5, -0.5, 1.5);
    const originYNorm = clampNumber(sampled.y, 0.5, -0.5, 1.5);
    const ox = originXNorm * width;
    const oy = originYNorm * height;

    const originSpreadDeg = clampNumber(originValue.spread, spreadDeg, 0, 360);
    const originAngleDeg = clampNumber(originValue.angle, angleDeg, 0, 360);
    const originStartVelocity = clampNumber(originValue.startVelocity, startVelocity, 6, 70);
    const spreadHalf = (originSpreadDeg / 2) * DEG_TO_RAD;
    const angle = originAngleDeg * DEG_TO_RAD;
    const baseLifeMs = ticks * 16;

    for (let i = 0; i < count; i += 1) {
      const theta = angle + rand(-spreadHalf, spreadHalf);
      const speed = originStartVelocity * rand(0.72, 1.08);
      const w = rand(4, 9);
      const h = rand(7, 14);
      particles.push({
        x: ox + rand(-3, 3),
        y: oy + rand(-3, 3),
        vx: Math.cos(theta) * speed + rand(-0.4, 0.4),
        // Screen coords: +y is down, so "up" is negative.
        vy: -Math.sin(theta) * speed + rand(-0.4, 0.4),
        w,
        h,
        r: rand(0, Math.PI * 2),
        vr: rand(-0.22, 0.22),
        color: pick(colors),
        alpha: rand(0.88, 1),
        bornAt: now,
        lifeMs: baseLifeMs * rand(0.82, 1.18),
      });
    }
  };

  const start = performance.now();
  let rafId: number | null = null;
  let hardStopTimer: number | null = null;
  let intervalId: number | null = null;
  let lastNow = start;
  const animationEnd = start + durationMs;
  const maxParticleLifeMs = Math.round(ticks * 16 * 1.3);

  const emitWave = (now: number) => {
    const timeLeft = animationEnd - now;
    if (timeLeft <= 0) return false;
    const ratio = Math.max(0, Math.min(1, timeLeft / durationMs));
    for (const origin of origins) {
      const particleScale = clampNumber(origin.particleCountScale, 1, 0.1, 4);
      const particleCount = Math.max(0, Math.round(baseParticleCount * ratio * particleScale));
      if (particleCount <= 0) continue;
      emit(now, origin, particleCount);
    }
    return true;
  };

  const cleanup = () => {
    if (rafId != null) {
      try {
        cancelAnimationFrame(rafId);
      } catch {}
      rafId = null;
    }
    if (intervalId != null) {
      try {
        window.clearInterval(intervalId);
      } catch {}
      intervalId = null;
    }
    if (hardStopTimer != null) {
      try {
        window.clearTimeout(hardStopTimer);
      } catch {}
      hardStopTimer = null;
    }
    try {
      window.removeEventListener("resize", resize);
    } catch {}
    try {
      canvas.remove();
    } catch {}
    if (activeCleanup === cleanup) activeCleanup = null;
  };

  activeCleanup = cleanup;
  // If rAF is throttled (background/minimized), still ensure we cleanup after the last particles should have died.
  hardStopTimer = window.setTimeout(cleanup, durationMs + maxParticleLifeMs + 260);

  emitWave(start);
  intervalId = window.setInterval(() => {
    const now = performance.now();
    if (!emitWave(now)) {
      try {
        if (intervalId != null) window.clearInterval(intervalId);
      } catch {}
      intervalId = null;
      return;
    }
  }, intervalMs);

  const tick = (now: number) => {
    if (!canvas.isConnected) {
      cleanup();
      return;
    }
    const elapsed = now - start;

    // Normalize delta to ~60fps steps to keep motion stable across refresh rates.
    const dt = Math.min(2, Math.max(0.35, (now - lastNow) / 16.666));
    lastNow = now;

    ctx.clearRect(0, 0, width, height);
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i]!;
      const ageMs = now - p.bornAt;
      const lifeT = p.lifeMs > 0 ? ageMs / p.lifeMs : 1;
      if (lifeT >= 1) {
        particles.splice(i, 1);
        continue;
      }
      if (p.y > height + 80) {
        particles.splice(i, 1);
        continue;
      }

      p.vy += gravity * dt;
      p.vx *= Math.pow(drag, dt);
      p.vy *= Math.pow(drag, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r += p.vr * dt;

      // Simple wrap to avoid huge gaps near the edges.
      if (p.x < -60) p.x = width + 60;
      if (p.x > width + 60) p.x = -60;

      const fade = 1 - lifeT;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha * fade));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    // Wait for all particles to die out, but still cap with hardStopTimer.
    if (elapsed >= durationMs && particles.length === 0) {
      cleanup();
      return;
    }
    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);
}
