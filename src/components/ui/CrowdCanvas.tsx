import React, { useEffect, useRef } from 'react';

interface CrowdCanvasProps {
  /** Sprite-sheet URL. The default is the Skiper UI / Open Peeps sprite sheet. */
  src?: string;
  /** Number of sprite columns in the source image. */
  rows?: number;
  /** Number of sprite rows in the source image. */
  cols?: number;
  className?: string;
}

type Walker = {
  frame: number;
  x: number;
  y: number;
  scale: number;
  direction: 1 | -1;
  speed: number;
  phase: number;
};

const DEFAULT_SPRITE_URL = 'https://skiper-ui.com/images/peeps/all-peeps.png';

/**
 * Lightweight canvas adaptation of Skiper UI #39 (Crowd Canvas).
 * Illustration: Open Peeps by Pablo Stanley. Animation inspired by Zadvorsky.
 * Skiper UI attribution: https://skiper-ui.com/v1/skiper39
 */
export const CrowdCanvas: React.FC<CrowdCanvasProps> = ({
  src = DEFAULT_SPRITE_URL,
  rows = 15,
  cols = 7,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const image = new Image();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationFrame = 0;
    let lastTime = 0;
    let stageWidth = 0;
    let stageHeight = 0;
    let walkers: Walker[] = [];
    let disposed = false;

    const random = (min: number, max: number) => min + Math.random() * (max - min);

    const resize = () => {
      if (disposed) return;
      const bounds = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      stageWidth = Math.max(1, bounds.width);
      stageHeight = Math.max(1, bounds.height);
      canvas.width = Math.round(stageWidth * dpr);
      canvas.height = Math.round(stageHeight * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (image.complete && image.naturalWidth) {
        createWalkers();
        draw(0);
      }
    };

    const createWalkers = () => {
      const cellWidth = image.naturalWidth / rows;
      const cellHeight = image.naturalHeight / cols;
      const count = Math.max(14, Math.min(34, Math.round(stageWidth / 32)));

      walkers = Array.from({ length: count }, () => {
        const scale = random(0.34, 0.72);
        const direction: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
        return {
          frame: Math.floor(Math.random() * rows * cols),
          x: random(-stageWidth * 0.15, stageWidth * 1.15),
          y: stageHeight - cellHeight * scale + random(-12, 48),
          scale,
          direction,
          speed: random(12, 36),
          phase: random(0, Math.PI * 2),
        };
      });
      walkers.sort((a, b) => a.y - b.y);
    };

    const draw = (deltaSeconds: number) => {
      if (disposed || !image.naturalWidth) return;
      const cellWidth = image.naturalWidth / rows;
      const cellHeight = image.naturalHeight / cols;
      context.clearRect(0, 0, stageWidth, stageHeight);

      walkers.forEach((walker) => {
        if (!reducedMotion) {
          walker.x += walker.speed * deltaSeconds * walker.direction;
          if (walker.direction === 1 && walker.x > stageWidth + cellWidth * walker.scale) {
            walker.x = -cellWidth * walker.scale;
          } else if (walker.direction === -1 && walker.x < -cellWidth * walker.scale) {
            walker.x = stageWidth + cellWidth * walker.scale;
          }
        }

        const bob = reducedMotion ? 0 : Math.sin(performance.now() / 240 + walker.phase) * 2.5;
        const sx = (walker.frame % rows) * cellWidth;
        const sy = Math.floor(walker.frame / rows) * cellHeight;
        const width = cellWidth * walker.scale;
        const height = cellHeight * walker.scale;

        context.save();
        context.translate(walker.x, walker.y + bob);
        context.scale(walker.direction === 1 ? 1 : -1, 1);
        context.drawImage(image, sx, sy, cellWidth, cellHeight, 0, 0, width, height);
        context.restore();
      });
    };

    const tick = (time: number) => {
      if (disposed) return;
      const deltaSeconds = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
      lastTime = time;
      draw(deltaSeconds);
      if (!reducedMotion) animationFrame = window.requestAnimationFrame(tick);
    };

    image.onload = () => {
      if (disposed) return;
      resize();
      if (!reducedMotion) animationFrame = window.requestAnimationFrame(tick);
    };
    image.onerror = () => {
      // Keep the page usable if the optional illustration host is unavailable.
    };
    image.src = src;

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(resize)
      : null;
    observer?.observe(canvas);
    window.addEventListener('resize', resize);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      image.onload = null;
      image.onerror = null;
    };
  }, [src, rows, cols]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
    />
  );
};
