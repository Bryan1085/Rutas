import React, { useEffect, useRef } from 'react';

interface ConfettiBurstProps {
  triggerKey: number;
  milestone: number | null;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  shape: 'rect' | 'circle' | 'ribbon';
  opacity: number;
  drag: number;
  gravity: number;
  tiltAngle: number;
  tiltSpeed: number;
}

const CONFETTI_COLORS = [
  '#10b981', // emerald
  '#34d399', // light emerald
  '#f59e0b', // amber/gold
  '#fbbf24', // yellow gold
  '#0ea5e9', // sky blue
  '#f97316', // orange
  '#ec4899', // pink
  '#ffffff', // crisp white highlight
];

export const ConfettiBurst: React.FC<ConfettiBurstProps> = ({ triggerKey, milestone }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (triggerKey === 0) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const isFinale = milestone === 100;
    const countPerSide = isFinale ? 65 : 42;
    const particles: Particle[] = [];

    const spawnBurst = (originX: number, originY: number, angleMin: number, angleMax: number, count: number, speedScale = 1) => {
      const shapes: Particle['shape'][] = ['rect', 'ribbon', 'circle'];
      for (let i = 0; i < count; i++) {
        const angle = angleMin + Math.random() * (angleMax - angleMin);
        const speed = (6 + Math.random() * 11) * speedScale;
        particles.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 5 + Math.random() * 6,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          rotation: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.24,
          shape: shapes[Math.floor(Math.random() * shapes.length)],
          opacity: 1,
          drag: 0.985,
          gravity: 0.28 + Math.random() * 0.12,
          tiltAngle: Math.random() * Math.PI,
          tiltSpeed: 0.08 + Math.random() * 0.1,
        });
      }
    };

    // Left & right celebratory cannons from upper-mid viewport
    const cannonY = Math.min(height * 0.36, 300);
    spawnBurst(width * 0.06, cannonY, -Math.PI * 0.42, -Math.PI * 0.08, countPerSide, 1.05);
    spawnBurst(width * 0.94, cannonY, -Math.PI * 0.92, -Math.PI * 0.58, countPerSide, 1.05);

    // Center top shower
    spawnBurst(width * 0.5, Math.min(height * 0.18, 120), Math.PI * 0.15, Math.PI * 0.85, isFinale ? 55 : 26, 0.75);

    let secondVolleyTimer: ReturnType<typeof setTimeout> | null = null;
    if (isFinale) {
      secondVolleyTimer = setTimeout(() => {
        spawnBurst(width * 0.25, Math.min(height * 0.28, 220), -Math.PI * 0.65, -Math.PI * 0.2, 36, 1.0);
        spawnBurst(width * 0.75, Math.min(height * 0.28, 220), -Math.PI * 0.8, -Math.PI * 0.35, 36, 1.0);
      }, 360);
    }

    const startTime = performance.now();
    const maxDurationMs = isFinale ? 4200 : 3200;

    const render = (now: number) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, width, height);

      let aliveCount = 0;
      for (const p of particles) {
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vRot;
        p.tiltAngle += p.tiltSpeed;

        if (elapsed > maxDurationMs - 800) {
          p.opacity = Math.max(0, p.opacity - 0.035);
        }

        if (p.y < height + 40 && p.opacity > 0.02) {
          aliveCount++;
          ctx.save();
          ctx.globalAlpha = p.opacity;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          const tiltScale = Math.cos(p.tiltAngle);
          ctx.scale(1, Math.max(0.25, Math.abs(tiltScale)));
          ctx.fillStyle = p.color;

          if (p.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, p.size * 0.48, 0, Math.PI * 2);
            ctx.fill();
          } else if (p.shape === 'ribbon') {
            ctx.fillRect(-p.size * 0.7, -p.size * 0.22, p.size * 1.4, p.size * 0.44);
          } else {
            ctx.fillRect(-p.size * 0.45, -p.size * 0.45, p.size * 0.9, p.size * 0.9);
          }
          ctx.restore();
        }
      }

      if (aliveCount > 0 && elapsed < maxDurationMs) {
        animIdRef.current = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, width, height);
        animIdRef.current = null;
      }
    };

    if (animIdRef.current !== null) {
      cancelAnimationFrame(animIdRef.current);
    }
    animIdRef.current = requestAnimationFrame(render);

    return () => {
      if (secondVolleyTimer) clearTimeout(secondVolleyTimer);
      if (animIdRef.current !== null) {
        cancelAnimationFrame(animIdRef.current);
        animIdRef.current = null;
      }
      ctx.clearRect(0, 0, width, height);
    };
  }, [triggerKey, milestone]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-[1600]"
    />
  );
};
