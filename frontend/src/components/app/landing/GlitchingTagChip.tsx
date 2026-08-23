import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export default function GlitchingTagChip({ original, redacted, delay = 0, cls = "" }) {
  const [displayText, setDisplayText] = useState(original);
  const [isRedacted, setIsRedacted] = useState(false);
  const [isGlitching, setIsGlitching] = useState(false);
  const isRedactedRef = useRef(false);

  useEffect(() => {
    const chars = "!@#$%^&*()_+-=[]{}|;:,.<>?/0123456789█▓▒░#_";
    let timer;
    let scrambleInterval;

    const triggerGlitch = () => {
      setIsGlitching(true);
      const nextRedacted = !isRedactedRef.current;
      const targetText = nextRedacted ? redacted : original;
      let frame = 0;
      const totalFrames = 10;

      scrambleInterval = setInterval(() => {
        frame++;
        if (frame < totalFrames) {
          const len = Math.max(original.length, redacted.length);
          const scrambled = Array.from({ length: len }, (_, i) => {
            if (Math.random() < 0.25) return targetText[i] || chars[Math.floor(Math.random() * chars.length)];
            return chars[Math.floor(Math.random() * chars.length)];
          }).join("");
          setDisplayText(scrambled.slice(0, len));
        } else {
          clearInterval(scrambleInterval);
          setIsGlitching(false);
          isRedactedRef.current = nextRedacted;
          setIsRedacted(nextRedacted);
          setDisplayText(targetText);
        }
      }, 40);
    };

    const initialTimeout = setTimeout(() => {
      triggerGlitch();
      timer = setInterval(triggerGlitch, 4200);
    }, delay * 1000 + 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(timer);
      clearInterval(scrambleInterval);
    };
  }, [original, redacted, delay]);

  // Reset when props change (e.g. mode switch)
  useEffect(() => {
    isRedactedRef.current = false;
    setIsRedacted(false);
    setIsGlitching(false);
    setDisplayText(original);
  }, [original, redacted]);

  return (
    <motion.div
      className={`pointer-events-none absolute hidden md:inline-flex items-center gap-1.5 font-mono text-[11px] select-none rounded-lg px-2.5 py-1 border transition-all duration-300 z-0 ${cls} ${
        isGlitching
          ? "bg-amber-500/[0.12] text-amber-600/90 dark:text-amber-400/90 border-amber-500/35 shadow-[0_0_12px_rgba(245,158,11,0.25)] -skew-x-2 scale-105 opacity-90"
          : isRedacted
          ? "bg-emerald-500/[0.08] text-emerald-600/80 dark:text-emerald-400/80 border-emerald-500/25 shadow-sm opacity-70 backdrop-blur-[2px]"
          : "bg-red-500/[0.06] text-red-600/75 dark:text-red-400/75 border-red-500/20 shadow-sm opacity-65 backdrop-blur-[2px]"
      }`}
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 5 + delay, repeat: Infinity, ease: "easeInOut", delay }}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
          isGlitching
            ? "bg-amber-500 animate-ping"
            : isRedacted
            ? "bg-emerald-500/80 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.5)]"
            : "bg-red-500/70 shadow-[0_0_5px_rgba(239,68,68,0.4)]"
        }`}
      />
      <span className={isGlitching ? "font-bold tracking-wider" : isRedacted ? "font-medium" : "font-normal"}>
        {displayText}
      </span>
    </motion.div>
  );
}

// --- CONTRACT RISK REVIEW SIMULATION CARD ---
