"use client";

import { useEffect, useRef } from "react";

export default function OrbitCanvas({ paused }: { paused: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let previous = 0;
    let time = 0;
    let visible = true;
    let size = 0;
    const points = Array.from({ length: 850 }, (_, i) => {
      const y = 1 - (i / 849) * 2;
      const r = Math.sqrt(1 - y * y);
      const angle = i * Math.PI * (3 - Math.sqrt(5));
      return [Math.cos(angle) * r, y, Math.sin(angle) * r];
    });

    const draw = () => {
      if (!size) return;
      const center = size / 2;
      const radius = size * 0.265;
      ctx.clearRect(0, 0, size, size);
      const glow = ctx.createRadialGradient(
        center,
        center,
        0,
        center,
        center,
        radius * 1.8,
      );
      glow.addColorStop(0, "rgba(156,210,92,0.13)");
      glow.addColorStop(0.6, "rgba(135,182,83,0.035)");
      glow.addColorStop(1, "rgba(135,182,83,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      // Tilted orbit paths, with a moving satellite on each path.
      for (let orbit = 0; orbit < 3; orbit++) {
        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(-0.5 + orbit * 0.78);
        const rx = radius * (1.48 + orbit * 0.07);
        const ry = radius * (0.53 + orbit * 0.14);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(195,245,123,${0.2 - orbit * 0.04})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        const angle = time * (0.14 + orbit * 0.06) + orbit * 2;
        ctx.beginPath();
        ctx.arc(
          Math.cos(angle) * rx,
          Math.sin(angle) * ry,
          2.6,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = "#dafbb6";
        ctx.shadowBlur = 16;
        ctx.shadowColor = "#c3f57b";
        ctx.fill();
        ctx.restore();
      }

      const rotation = time * 0.075;
      for (const [x, y, z] of points) {
        const rotatedX = x * Math.cos(rotation) + z * Math.sin(rotation);
        const depth = -x * Math.sin(rotation) + z * Math.cos(rotation);
        const tiltedY = y * 0.96 - depth * 0.28;
        const alpha = 0.14 + ((depth + 1) / 2) * 0.69;
        ctx.beginPath();
        ctx.arc(
          center + rotatedX * radius,
          center + tiltedY * radius,
          depth > 0.4 ? 1.25 : 0.8,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = `rgba(202,235,165,${alpha})`;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(195,245,123,0.12)";
      ctx.stroke();
    };

    const tick = (timestamp: number) => {
      frame = 0;
      if (paused || motion.matches || !visible || document.hidden) return;
      if (timestamp - previous > 32) {
        time += Math.min((timestamp - previous) / 1000, 0.05);
        previous = timestamp;
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    const restart = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = performance.now();
      draw();
      if (!paused && !motion.matches && visible && !document.hidden)
        frame = requestAnimationFrame(tick);
    };
    const resize = new ResizeObserver(([entry]) => {
      size = entry.contentRect.width;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      restart();
    });
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      restart();
    });
    resize.observe(canvas);
    intersection.observe(canvas);
    motion.addEventListener("change", restart);
    document.addEventListener("visibilitychange", restart);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      motion.removeEventListener("change", restart);
      document.removeEventListener("visibilitychange", restart);
    };
  }, [paused]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ width: "100%", aspectRatio: "1" }}
    />
  );
}
