"use client";

import { useEffect, useState } from "react";

export type ReplyReveal = { id: number; onComplete: (id: number) => void };

export function useReplyReveal(text: string, reveal?: ReplyReveal) {
  const id = reveal?.id;
  const onComplete = reveal?.onComplete;
  const [progress, setProgress] = useState<{ id: number; text: string }>();

  useEffect(() => {
    if (id === undefined || !onComplete) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onComplete(id);
      return;
    }

    const segments = typeof Intl.Segmenter === "function"
      ? Array.from(new Intl.Segmenter("th", { granularity: "grapheme" }).segment(text), ({ segment }) => segment)
      : Array.from(text);
    const duration = Math.min(1_150, Math.max(250, segments.length * 14));
    const start = performance.now();
    let lastCount = 0;
    let frame = requestAnimationFrame(tick);

    function tick(time: number) {
      if (id === undefined || !onComplete) return;
      if (time - start >= duration) {
        onComplete(id);
        return;
      }

      const count = Math.min(segments.length, Math.floor((time - start) / duration * segments.length) + 1);
      if (count > lastCount) {
        lastCount = count;
        setProgress({ id, text: segments.slice(0, count).join("") });
      }
      frame = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(frame);
  }, [id, onComplete, text]);

  return id === undefined
    ? { text, revealing: false }
    : { text: progress && progress.id === id ? progress.text : "", revealing: true };
}
