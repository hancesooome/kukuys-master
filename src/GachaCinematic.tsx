import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate, type MotionValue } from 'motion/react';
import { Sparkles, ChevronRight, Recycle } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Player {
  id: string;
  name: string;
  tier: string;
  drafting: number;
  mechanics: number;
  mental_strength: number;
  leadership: number;
  trashtalk: number;
  energy: number;
  is_roster: number;
  is_streaming: number;
  image_url?: string | null;
  team?: string | null;
  role?: string | null;
  grinding_until?: number | null;
  sleeping_until?: number | null;
}

export interface TierCardStyle {
  border: string;
  glow: string;
  badge: string;
  borderGradient: string;
  cardBg: string;
  bandBg: string;
  bandLabel: string;
  bandText: string;
  statsPanel: string;
  accentStat: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_ORDER = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'] as const;
// Only Rare→Mythic for flip glow (no Common – more intense)
const TIER_GLOW_ORDER = ['Rare', 'Epic', 'Legendary', 'Mythic'] as const;
const TIER_FLASH_COLORS: Record<string, { glow: string; bg: string; glowStrong: string }> = {
  Common: { glow: 'rgba(161,161,170,0.6)', bg: 'rgba(161,161,170,0.15)', glowStrong: 'rgba(161,161,170,0.5)' },
  Rare: { glow: 'rgba(59,130,246,0.85)', bg: 'rgba(59,130,246,0.25)', glowStrong: 'rgba(59,130,246,0.7)' },
  Epic: { glow: 'rgba(168,85,247,0.9)', bg: 'rgba(168,85,247,0.3)', glowStrong: 'rgba(168,85,247,0.75)' },
  Legendary: { glow: 'rgba(251,191,36,0.95)', bg: 'rgba(251,191,36,0.35)', glowStrong: 'rgba(251,191,36,0.85)' },
  Mythic: { glow: 'rgba(251,113,133,1)', bg: 'rgba(251,113,133,0.4)', glowStrong: 'rgba(251,113,133,0.95)' },
};

/** Color flare burst by tier: Epic purple, Legendary gold, Mythic amethyst-red */
const COLOR_FLARE_BURST: Record<string, { inner: string; outer: string; lensGradient: string }> = {
  Epic: { inner: 'rgba(200,150,255,0.95)', outer: 'rgba(168,85,247,0.75)', lensGradient: 'linear-gradient(to bottom right, rgba(255,255,255,0.9), rgba(196,181,253,0.4), rgba(255,255,255,0.9))' },
  Legendary: { inner: 'rgba(255,220,100,0.95)', outer: 'rgba(251,191,36,0.75)', lensGradient: 'linear-gradient(to bottom right, rgba(255,255,255,0.9), rgba(254,243,199,0.4), rgba(255,255,255,0.9))' },
  Mythic: { inner: 'rgba(255,120,140,0.95)', outer: 'rgba(251,113,133,0.8)', lensGradient: 'linear-gradient(to bottom right, rgba(255,255,255,0.9), rgba(254,205,211,0.5), rgba(255,255,255,0.9))' },
};

// Sound hooks (placeholder – integrate with your audio system)
const useGachaSound = () => ({
  playFlash: () => {},
  playLand: () => {},
  playMythicReveal: () => {},
  playReveal: () => {},
});

// ─── Sub-components ───────────────────────────────────────────────────────────

function CinematicBackground({ variant }: { variant?: 'anticipation' | 'portal' }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Premium dark fantasy gradient – deep reds & purples */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a0a0f] via-[#0f0508] to-black" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(185,28,28,0.2)_0%,rgba(120,53,180,0.08)_40%,transparent_60%)]" />
      {/* Vertical charged beam (anticipation) – rose/red */}
      {variant === 'anticipation' && (
        <>
          <motion.div
            className="absolute left-1/2 top-0 w-[3px] h-full -translate-x-1/2 bg-gradient-to-b from-transparent via-rose-500/60 to-transparent origin-top"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute left-1/2 top-0 w-[1px] h-full -translate-x-1/2 bg-gradient-to-b from-transparent via-rose-300/40 to-transparent origin-top blur-[1px]"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      )}
      {/* Premium god rays – rose/red (reduced for mobile perf) */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-[2px] h-full bg-gradient-to-b from-rose-500/12 via-rose-400/6 to-transparent origin-top"
          style={{
            left: `${15 + i * 14}%`,
            transform: `rotate(${-18 + i * 6}deg)`,
            filter: 'blur(1px)',
          }}
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      {/* Bokeh / ambient orbs – reddish (reduced blur for mobile) */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={`bokeh-${i}`}
          className="absolute rounded-full"
          style={{
            width: 80 + i * 40,
            height: 80 + i * 40,
            left: `${(i * 30) % 70}%`,
            top: `${25 + (i * 20) % 40}%`,
            background: `radial-gradient(circle, rgba(225,29,72,0.1)_0%, rgba(185,28,28,0.05)_40%, transparent_70%)`,
            filter: 'blur(12px)',
          }}
          animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.2, 1] }}
          transition={{ duration: 5 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
        />
      ))}
      {/* Smoke / depth – rose tones (reduced for mobile) */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-gradient-to-br from-rose-900/15 to-red-950/10"
          style={{
            width: 80 + i * 60,
            height: 50 + i * 30,
            left: `${(i * 35) % 60}%`,
            top: `${30 + (i % 2) * 25}%`,
            filter: 'blur(16px)',
          }}
          animate={{
            opacity: [0.08, 0.2, 0.08],
            scale: [1, 1.4, 1],
            x: [0, 40, 0],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 8 + i,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.4,
          }}
        />
      ))}
    </div>
  );
}

function PortalPhase({ colorIndex }: { colorIndex: number }) {
  const colors = [
    'rgba(168,85,247,0.85)',
    'rgba(251,191,36,0.9)',
  ];
  const c = colors[colorIndex % 2];
  return (
    <motion.div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* No dark overlay – let modal backdrop show through */}
      {/* Jarvis-style radial rays (reduced for mobile perf) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px]">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={`ray-${i}`}
            className="absolute left-1/2 top-1/2 h-[1px] origin-left"
            style={{
              width: 300,
              background: `linear-gradient(90deg, ${c} 0%, transparent 80%)`,
              boxShadow: `0 0 8px ${c}`,
              transform: `rotate(${i * 30}deg)`,
            }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.03 }}
          />
        ))}
      </div>
      {/* Secondary ray layer */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px]">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={`ray2-${i}`}
            className="absolute left-1/2 top-1/2 h-[2px] origin-left"
            style={{
              width: 220,
              background: `linear-gradient(90deg, rgba(255,255,255,0.4) 0%, ${c} 40%, transparent 100%)`,
              transform: `rotate(${i * 30 + 7}deg)`,
            }}
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.05 }}
          />
        ))}
      </div>
      {/* Central core – small bright orb */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full"
        style={{
          background: `radial-gradient(circle, rgba(255,255,255,0.9) 0%, ${c} 40%, transparent 70%)`,
          boxShadow: `0 0 30px ${c}`,
        }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.9, 1, 0.9] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Rotating ring – thin Jarvis-style circle */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full"
        style={{
          border: `2px solid ${c}`,
          boxShadow: `0 0 20px ${c}, inset 0 0 20px ${c}`,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />
      {/* Outer ring – softer, slower */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] rounded-full"
        style={{
          border: `1px solid ${c}`,
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
      />
      {/* Scan line – horizontal sweep */}
      <motion.div
        className="absolute left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${c} 20%, rgba(255,255,255,0.6) 50%, ${c} 80%, transparent 100%)`,
          boxShadow: `0 0 16px ${c}`,
        }}
        animate={{ top: ['0%', '100%'] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
      />
      {/* Floating particles (reduced for mobile) */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={`particle-${i}`}
          className="absolute w-1 h-1 rounded-full"
          style={{
            left: `${20 + (i * 7) % 60}%`,
            top: `${15 + (i * 8) % 70}%`,
            background: c,
            boxShadow: `0 0 8px ${c}`,
          }}
          animate={{ opacity: [0.2, 0.9, 0.2], scale: [0.5, 1.2, 0.5] }}
          transition={{ duration: 2 + (i % 3) * 0.4, repeat: Infinity, delay: i * 0.1 }}
        />
      ))}
    </motion.div>
  );
}

function CardBack({
  glowColor,
  glowStrong,
  isDragging,
  className,
  waveBoxShadow,
  waveBorder,
  waveColorWashBg,
  waveInnerBorderColor,
  waveInnerBoxShadow,
  waveEmblemShadow,
}: {
  glowColor: string;
  glowStrong?: string;
  isDragging: boolean;
  className?: string;
  waveBoxShadow?: MotionValue<string>;
  waveBorder?: MotionValue<string>;
  waveColorWashBg?: MotionValue<string>;
  waveInnerBorderColor?: MotionValue<string>;
  waveInnerBoxShadow?: MotionValue<string>;
  waveEmblemShadow?: MotionValue<string>;
}) {
  const intense = isDragging && glowStrong;
  const useWave = intense && waveBoxShadow && waveBorder;
  return (
    <motion.div
      className={`relative rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing ${className ?? ''}`}
      style={
        useWave
          ? {
              aspectRatio: '3/4',
              minHeight: 380,
              maxWidth: 320,
              boxShadow: waveBoxShadow,
              border: waveBorder,
              background: 'linear-gradient(135deg, rgba(225,29,72,0.04) 0%, transparent 50%)',
            }
          : {
              aspectRatio: '3/4',
              minHeight: 380,
              maxWidth: 320,
              boxShadow: intense
                ? `0 0 50px ${glowStrong}, 0 0 100px ${glowColor}, 0 0 180px ${glowColor}50, inset 0 0 80px ${glowColor}25`
                : `0 0 80px rgba(225,29,72,0.15), 0 0 120px ${glowColor}30, inset 0 0 40px rgba(225,29,72,0.06)`,
              border: intense ? `3px solid ${glowStrong}` : '2px solid rgba(225,29,72,0.5)',
              background: 'linear-gradient(135deg, rgba(225,29,72,0.04) 0%, transparent 50%)',
            }
      }
      animate={{
        y: isDragging ? 0 : [0, -8, 0],
        scale: isDragging ? 1.02 : [1, 1.03, 1],
      }}
      transition={{
        y: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
        scale: { duration: isDragging ? 0.2 : 2.5, repeat: isDragging ? 0 : Infinity, ease: 'easeInOut' },
      }}
    >
      {/* Premium card face – rich red/dark gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a0a10] via-[#0d0508] to-black" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(185,28,28,0.15)_0%,rgba(120,53,180,0.08)_40%,transparent_60%)]" />
      {/* Shimmer sweep – very subtle, no solid bands */}
      <div
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          background: 'linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.03) 30%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 70%, transparent 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 5s ease-in-out infinite',
        }}
      />
      {/* Tier color wash when glowing – wave or static */}
      {intense &&
        (useWave && waveColorWashBg ? (
          <motion.div className="absolute inset-0 mix-blend-screen opacity-35" style={{ background: waveColorWashBg }} />
        ) : (
          <div
            className="absolute inset-0 mix-blend-screen opacity-35"
            style={{ background: `radial-gradient(ellipse at center, ${glowColor}50 0%, transparent 70%)` }}
          />
        ))}
      {/* Ornate inner frame – rose/crimson accent */}
      <motion.div
        className={`absolute inset-3 rounded-xl flex items-center justify-center pointer-events-none transition-all duration-100 ${
          intense ? 'border-2' : 'border'
        }`}
        style={
          useWave && waveInnerBorderColor && waveInnerBoxShadow
            ? { borderColor: waveInnerBorderColor, boxShadow: waveInnerBoxShadow }
            : {
                borderColor: intense ? `${glowColor}90` : 'rgba(225,29,72,0.4)',
                boxShadow: intense ? `inset 0 0 30px ${glowColor}30` : 'inset 0 0 20px rgba(225,29,72,0.08)',
              }
        }
      >
        {/* Corner flourishes – rose */}
        <div className="absolute top-2 left-2 w-6 h-6 border-l-2 border-t-2 rounded-tl-lg opacity-50" style={{ borderColor: 'rgba(225,29,72,0.6)' }} />
        <div className="absolute top-2 right-2 w-6 h-6 border-r-2 border-t-2 rounded-tr-lg opacity-50" style={{ borderColor: 'rgba(225,29,72,0.6)' }} />
        <div className="absolute bottom-2 left-2 w-6 h-6 border-l-2 border-b-2 rounded-bl-lg opacity-50" style={{ borderColor: 'rgba(225,29,72,0.6)' }} />
        <div className="absolute bottom-2 right-2 w-6 h-6 border-r-2 border-b-2 rounded-br-lg opacity-50" style={{ borderColor: 'rgba(225,29,72,0.6)' }} />
      </motion.div>
    </motion.div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface GachaCinematicProps {
  player: Player;
  style: TierCardStyle;
  onCollect: () => void;
  onRecycle?: () => void;
  CollectionCardPhoto: React.ComponentType<{ player: Player }>;
  StatRadar: React.ComponentType<{
    mechanics: number;
    drafting: number;
    mental_strength: number;
    trashtalk: number;
    tier?: string;
  }>;
}

type Phase = 'enter' | 'cardBack' | 'portal' | 'colorFlare' | 'flip' | 'revealed';

const DRAG_THRESHOLD = 140;
const PORTAL_DURATION = 4200; // vortex + orbs + color build-up (slower)
const COLOR_FLARE_DURATION = 1500; // Blue→Purple→Gold + explosion

export function GachaCinematic({
  player,
  style,
  onCollect,
  onRecycle,
  CollectionCardPhoto,
  StatRadar,
}: GachaCinematicProps) {
  const [phase, setPhase] = useState<Phase>('enter');
  const [isDragging, setIsDragging] = useState(false);
  const [portalColorIndex, setPortalColorIndex] = useState(0);
  const portalIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sound = useGachaSound();
  const isMythic = player.tier === 'Mythic';
  const dragX = useMotionValue(0);

  // Wave glow: continuous color flow Blue → Purple → Gold → Red (no Christmas lights)
  const waveProgress = useMotionValue(0);
  const waveGlow = useTransform(
    waveProgress,
    [0, 0.25, 0.5, 0.75, 1],
    [TIER_FLASH_COLORS.Rare.glow, TIER_FLASH_COLORS.Epic.glow, TIER_FLASH_COLORS.Legendary.glow, TIER_FLASH_COLORS.Mythic.glow, TIER_FLASH_COLORS.Rare.glow]
  );
  const waveBg = useTransform(
    waveProgress,
    [0, 0.25, 0.5, 0.75, 1],
    [TIER_FLASH_COLORS.Rare.bg, TIER_FLASH_COLORS.Epic.bg, TIER_FLASH_COLORS.Legendary.bg, TIER_FLASH_COLORS.Mythic.bg, TIER_FLASH_COLORS.Rare.bg]
  );
  const waveGlowStrong = useTransform(
    waveProgress,
    [0, 0.25, 0.5, 0.75, 1],
    [TIER_FLASH_COLORS.Rare.glowStrong, TIER_FLASH_COLORS.Epic.glowStrong, TIER_FLASH_COLORS.Legendary.glowStrong, TIER_FLASH_COLORS.Mythic.glowStrong, TIER_FLASH_COLORS.Rare.glowStrong]
  );
  const waveBoxShadow = useTransform(
    [waveGlow, waveGlowStrong],
    ([g, s]) => `0 0 50px ${s}, 0 0 100px ${g}, 0 0 180px ${g}50, inset 0 0 80px ${g}25`
  );
  const waveBorder = useTransform(waveGlowStrong, (s) => `3px solid ${s}`);
  const waveColorWashBg = useTransform(waveGlow, (g) => `radial-gradient(ellipse at center, ${g}50 0%, transparent 70%)`);
  const waveInnerBorderColor = useTransform(waveGlow, (g) => `${g}90`);
  const waveInnerBoxShadow = useTransform(waveGlow, (g) => `inset 0 0 30px ${g}30`);
  const waveEmblemShadow = useTransform(waveGlow, (g) => `0 0 30px ${g}60`);
  const waveAmbientBg = useTransform(waveBg, (b) => `radial-gradient(ellipse at center, ${b} 0%, ${b} 38%, transparent 72%)`);
  const waveAmbientBoxShadow = useTransform(waveGlow, (g) => `0 0 180px ${g}, 0 0 280px ${g}80`);

  // Phase: enter → cardBack (show card back quickly)
  useEffect(() => {
    if (phase !== 'enter') return;
    const t = setTimeout(() => setPhase('cardBack'), 200);
    return () => clearTimeout(t);
  }, [phase]);

  // Wave animation while dragging – smooth, relaxed flow
  useEffect(() => {
    if (!isDragging || phase !== 'cardBack') {
      waveProgress.set(0);
      return;
    }
    const controls = animate(waveProgress, 1, { repeat: Infinity, duration: 4.8, ease: 'linear' });
    return () => controls.stop();
  }, [isDragging, phase, waveProgress]);

  const handleDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number } }) => {
    dragX.set(info.offset.x);
  };

  const isHighTier = ['Epic', 'Legendary', 'Mythic'].includes(player.tier);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number }; velocity: { x: number } }) => {
    setIsDragging(false);
    const x = info.offset.x;
    const vx = info.velocity.x;
    if (x > DRAG_THRESHOLD || vx > 400) {
      sound.playReveal();
      // Epic/Legendary/Mythic: portal → colorFlare → flip. Common/Rare: skip straight to flip
      setPhase(isHighTier ? 'portal' : 'flip');
    } else {
      animate(dragX, 0, { type: 'spring', stiffness: 300, damping: 25 });
    }
  };

  const rotateY = useTransform(dragX, [0, DRAG_THRESHOLD], [0, 90]);

  // Phase: portal – floating orbs, swirling light (Blue→Purple→Gold)
  useEffect(() => {
    if (phase !== 'portal') return;
    setPortalColorIndex(0);
    portalIntervalRef.current = setInterval(() => {
      setPortalColorIndex((i) => (i + 1) % 2);
    }, 600);
    const t = setTimeout(() => {
      if (portalIntervalRef.current) clearInterval(portalIntervalRef.current);
      setPhase('colorFlare');
    }, PORTAL_DURATION);
    return () => {
      clearTimeout(t);
      if (portalIntervalRef.current) clearInterval(portalIntervalRef.current);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'colorFlare') return;
    if (isMythic) sound.playMythicReveal();
    const t = setTimeout(() => setPhase('flip'), COLOR_FLARE_DURATION);
    return () => clearTimeout(t);
  }, [phase, isMythic]);

  useEffect(() => {
    if (phase !== 'flip') return;
    sound.playReveal();
    const t = setTimeout(() => setPhase('revealed'), 1100);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
      className={`fixed inset-0 z-[110] flex items-center justify-center p-4 ${phase === 'revealed' ? 'cursor-pointer' : ''}`}
      onClick={phase === 'revealed' ? onCollect : undefined}
      role={phase === 'revealed' ? 'button' : undefined}
      tabIndex={phase === 'revealed' ? 0 : undefined}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/98 via-black/95 to-black/98" />
      <CinematicBackground variant={phase === 'cardBack' ? 'anticipation' : undefined} />

      {/* Portal phase – full-screen (vortex, orbs, swirling light) */}
      {phase === 'portal' && (
        <div className="fixed inset-0 z-[111] pointer-events-none">
          <PortalPhase colorIndex={portalColorIndex} />
        </div>
      )}

      {/* Color flare phase – tier-specific burst (Epic purple, Legendary gold, Mythic amethyst-red) */}
      {phase === 'colorFlare' && (() => {
        const burst = COLOR_FLARE_BURST[player.tier] ?? COLOR_FLARE_BURST.Legendary;
        const isMythicFlare = player.tier === 'Mythic';
        return (
          <motion.div
            className="fixed inset-0 z-[112] flex items-center justify-center pointer-events-none overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, x: [0, 6, -6, 6, 0] }}
            transition={{
              opacity: { duration: 0.2 },
              x: { duration: isMythicFlare ? 0.6 : 0.5, times: [0, 0.2, 0.4, 0.6, 0.8, 1] },
            }}
          >
            {/* Tier-colored explosion – purple/gold/amethyst-red */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              animate={{
                opacity: [0, 1, 0.9, 0.5],
                scale: [0.3, 1.2, isMythicFlare ? 2.2 : 1.8, 2.5],
              }}
              transition={{ duration: 1.2, times: [0, 0.2, 0.5, 1] }}
            >
              <div
                className="w-[600px] h-[600px] rounded-full"
                style={{
                  background: `radial-gradient(circle, ${burst.inner} 0%, ${burst.outer} 30%, transparent 70%)`,
                  filter: 'blur(12px)',
                }}
              />
              <div
                className="absolute w-[300px] h-[300px] rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 60%)',
                  filter: 'blur(8px)',
                }}
              />
              {/* Mythic special: extra radiating burst */}
              {isMythicFlare && (
                <motion.div
                  className="absolute w-[400px] h-[400px] rounded-full"
                  style={{
                    background: 'radial-gradient(circle, rgba(251,113,133,0.5) 0%, rgba(148,51,148,0.2) 40%, transparent 70%)',
                    filter: 'blur(16px)',
                  }}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: [0, 0.9, 0.4], scale: [0.5, 1.5, 2] }}
                  transition={{ duration: 1, times: [0, 0.3, 1] }}
                />
              )}
            </motion.div>
            {/* Lens flare – tier-tinted */}
            <motion.div
              className="absolute inset-0"
              style={{ background: burst.lensGradient }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.95, 0] }}
              transition={{ duration: 0.5, times: [0, 0.1, 0.2, 0.4] }}
            />
          </motion.div>
        );
      })()}

      <div className="relative z-10 flex flex-col items-center justify-center gap-8 w-full max-w-md">
        <AnimatePresence mode="wait">
          {phase === 'cardBack' && (
            <motion.div
              key="cardBack"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-6"
            >
              {/* Slide hint – premium typography (rose/red) */}
              <motion.p
                animate={{ opacity: isDragging ? 0.3 : [0.7, 1, 0.7] }}
                transition={isDragging ? { duration: 0.2 } : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="font-[Cinzel] text-rose-200/90 text-sm font-semibold uppercase tracking-[0.3em] flex items-center gap-3 drop-shadow-[0_0_20px_rgba(225,29,72,0.4)] whitespace-nowrap"
              >
                <ChevronRight size={20} className="text-rose-300 drop-shadow-[0_0_10px_rgba(225,29,72,0.5)]" />
                Check by dragging the card to the right
              </motion.p>

              {/* Ambient glow behind card while dragging – wave flow, solid disk, no hole */}
              {isDragging && (
                <motion.div
                  key="ambient"
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="rounded-full"
                    style={{
                      width: 560,
                      height: 640,
                      background: waveAmbientBg,
                      filter: 'blur(12px)',
                    }}
                  />
                  <motion.div
                    className="absolute rounded-full"
                    style={{
                      width: 560,
                      height: 640,
                      boxShadow: waveAmbientBoxShadow,
                      background: 'transparent',
                    }}
                  />
                </motion.div>
              )}

              <div className="flex justify-center" style={{ perspective: 1200, willChange: 'transform' }}>
                <motion.div
                  drag="x"
                  dragConstraints={{ left: 0, right: 400 }}
                  dragElastic={0.15}
                  onDragStart={() => setIsDragging(true)}
                  onDrag={handleDrag}
                  onDragEnd={handleDragEnd}
                  style={{
                    x: dragX,
                    rotateY,
                    transformOrigin: 'center center',
                    transformStyle: 'preserve-3d',
                    backfaceVisibility: 'hidden' as const,
                    WebkitBackfaceVisibility: 'hidden',
                  }}
                  className="touch-none select-none"
                  whileTap={{ scale: 1.02 }}
                >
                  <CardBack
                    glowColor={TIER_FLASH_COLORS.Common.glow}
                    glowStrong={TIER_FLASH_COLORS.Common.glowStrong}
                    isDragging={isDragging}
                    waveBoxShadow={isDragging ? waveBoxShadow : undefined}
                    waveBorder={isDragging ? waveBorder : undefined}
                    waveColorWashBg={isDragging ? waveColorWashBg : undefined}
                    waveInnerBorderColor={isDragging ? waveInnerBorderColor : undefined}
                    waveInnerBoxShadow={isDragging ? waveInnerBoxShadow : undefined}
                    waveEmblemShadow={isDragging ? waveEmblemShadow : undefined}
                  />
                </motion.div>
              </div>
            </motion.div>
          )}

          {(phase === 'flip' || phase === 'revealed') && (
            <motion.div
              key="cardFront"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative w-full flex flex-col items-center gap-6"
            >
              {/* Premium god rays / radial blur backdrop */}
              {phase === 'revealed' && (
                <motion.div
                  className="absolute -inset-40 pointer-events-none"
                  animate={{ opacity: [0.7, 1, 0.7], scale: [0.95, 1.08, 0.95] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <div
                    className="absolute inset-0 rounded-full blur-[32px]"
                    style={{
                      background: `radial-gradient(circle, ${TIER_FLASH_COLORS[player.tier]?.bg ?? 'rgba(251,191,36,0.25)'} 0%, rgba(120,53,180,0.1) 40%, transparent 65%)`,
                    }}
                  />
                  <div
                    className="absolute inset-0 rounded-full blur-[24px] opacity-60"
                    style={{
                      background: `radial-gradient(circle, rgba(251,191,36,0.15) 0%, transparent 50%)`,
                    }}
                  />
                </motion.div>
              )}

              {/* Mythic aura */}
              {isMythic && phase === 'revealed' && (
                <motion.div
                  className="absolute -inset-20 pointer-events-none"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="absolute inset-0 bg-rose-500/20 rounded-full blur-[28px]" />
                </motion.div>
              )}

              {/* Card with 3D flip + scale pop (GPU-accelerated) */}
              <div className="w-full" style={{ perspective: 1200, willChange: 'transform' }}>
                <motion.div
                  initial={{ rotateY: 180, scale: 0.95, z: -100 }}
                  animate={{
                    rotateY: 0,
                    scale: phase === 'revealed' ? [1, 1.1, 1] : 1,
                    z: 0,
                  }}
                  transition={{
                    duration: phase === 'revealed' ? 0.5 : 0.85,
                    scale: { duration: 0.5, times: [0, 0.4, 1] },
                    ease: [0.22, 0.61, 0.36, 1],
                  }}
                  style={{
                    transformStyle: 'preserve-3d',
                    transformOrigin: 'center center',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                  }}
                  className={`relative w-full rounded-2xl p-[4px] overflow-hidden bg-gradient-to-br ${style.borderGradient} ${style.glow}`}
                >
                  {/* Premium light sweep during flip */}
                  {phase === 'flip' && (
                    <motion.div
                      className="absolute inset-0 z-20 pointer-events-none overflow-hidden"
                      initial={{ x: '-100%' }}
                      animate={{ x: '100%' }}
                      transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
                    >
                      <div
                        className="w-2/3 h-full"
                        style={{
                          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 20%, rgba(251,191,36,0.25) 50%, rgba(255,255,255,0.15) 80%, transparent 100%)',
                          filter: 'blur(8px)',
                        }}
                      />
                    </motion.div>
                  )}

                  <div
                    className={`relative w-full rounded-[14px] overflow-hidden ${style.cardBg}`}
                    style={{ aspectRatio: '3/4', minHeight: 380 }}
                  >
                    <div className="absolute top-0 left-0 right-0 h-[42%] overflow-hidden bg-zinc-500/20">
                      <div className="absolute inset-2 overflow-hidden rounded-t-lg">
                        <CollectionCardPhoto player={player} />
                      </div>
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: phase === 'revealed' ? 0.4 : 0.3, type: 'spring', stiffness: 300 }}
                        className={`absolute top-2 right-2 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${style.badge} z-10`}
                      >
                        {player.tier}
                      </motion.div>
                    </div>
                    <div className={`absolute left-0 right-0 top-[42%] h-6 flex justify-between items-center px-4 ${style.bandBg}`}>
                      <span className={`text-[10px] uppercase tracking-widest ${style.bandLabel}`}>Player</span>
                      <span className={`text-[10px] uppercase tracking-widest ${style.bandLabel}`}>Team</span>
                    </div>
                    <div className={`absolute left-0 right-0 top-[calc(42%+24px)] h-9 px-4 flex justify-between items-center gap-2 ${style.bandBg}`}>
                      <span className={`font-bold text-base truncate min-w-0 ${style.bandText}`}>{player.name}</span>
                      <span className={`font-bold text-sm truncate shrink-0 ${style.bandText}`}>{player.team || 'KUKUYS'}</span>
                    </div>
                    <div className={`absolute left-0 right-0 top-[calc(42%+60px)] bottom-[30%] ${style.statsPanel} px-3 py-2.5 flex items-center gap-3`}>
                      <div className="shrink-0">
                        <p className="text-[10px] uppercase tracking-widest text-zinc-400 mb-1">Role</p>
                        <p className="font-bold text-sm text-white uppercase leading-tight">{player.role || player.tier}</p>
                      </div>
                      <div className="ml-auto w-16 h-16 shrink-0">
                        <StatRadar
                          mechanics={player.mechanics}
                          drafting={player.drafting}
                          mental_strength={player.mental_strength}
                          trashtalk={player.trashtalk}
                          tier={player.tier}
                        />
                      </div>
                    </div>
                    <div className={`absolute left-0 right-0 bottom-0 h-[28%] ${style.statsPanel} px-3 py-2 flex flex-col justify-center`}>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-200">
                        <div className="flex justify-between gap-2"><span>Skills</span><span className={`font-mono font-bold ${style.accentStat}`}>{player.mechanics}</span></div>
                        <div className="flex justify-between gap-2"><span>Drafting</span><span className={`font-mono font-bold ${style.accentStat}`}>{player.drafting}</span></div>
                        <div className="flex justify-between gap-2"><span>Mental</span><span className={`font-mono font-bold ${style.accentStat}`}>{player.mental_strength}</span></div>
                        <div className="flex justify-between gap-2"><span>Trashtalk</span><span className={`font-mono font-bold ${style.accentStat}`}>{player.trashtalk}</span></div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Premium particle burst – Epic/Legendary/Mythic only */}
              {isHighTier && phase === 'revealed' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {[...Array(24)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-2 h-2 rounded-full"
                      style={{
                        transform: `rotate(${i * 15}deg) translateY(-140px)`,
                        background: isMythic
                          ? 'radial-gradient(circle, rgba(251,113,133,0.9) 0%, rgba(251,191,36,0.5) 100%)'
                          : player.tier === 'Legendary'
                            ? 'radial-gradient(circle, rgba(251,191,36,0.9) 0%, rgba(255,215,0,0.4) 100%)'
                            : `radial-gradient(circle, ${TIER_FLASH_COLORS.Epic.glow} 0%, ${TIER_FLASH_COLORS.Epic.bg} 100%)`,
                        boxShadow: '0 0 10px rgba(251,191,36,0.6)',
                      }}
                      initial={{ scale: 0, opacity: 1 }}
                      animate={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 1, delay: 0.3 + i * 0.02 }}
                    />
                  ))}
                </div>
              )}

              {phase === 'revealed' && (
                <>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
                      onClick={(e) => { e.stopPropagation(); onCollect(); }}
                      className="relative overflow-hidden flex items-center justify-center gap-3 px-12 py-4 font-[Cinzel] font-bold text-lg uppercase tracking-[0.2em] rounded-xl hover:scale-105 active:scale-100 transition-transform"
                      style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                        color: 'white',
                        border: '1px solid rgba(251,191,36,0.4)',
                        boxShadow: '0 0 40px rgba(16,185,129,0.4), 0 0 80px rgba(251,191,36,0.2)',
                      }}
                    >
                      <Sparkles size={22} strokeWidth={2.5} className="drop-shadow-[0_0_6px_rgba(255,255,255,0.5)]" />
                      Add to Collection
                    </motion.button>
                    {onRecycle && (
                      <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.45, type: 'spring', stiffness: 200 }}
                        onClick={(e) => { e.stopPropagation(); onRecycle(); }}
                        title="Recycle for 10 coins"
                        className="flex items-center justify-center gap-2 px-6 py-4 font-[Cinzel] font-semibold text-sm uppercase tracking-[0.15em] rounded-xl border border-amber-500/50 bg-amber-950/60 text-amber-200 hover:bg-amber-900/50 hover:scale-105 active:scale-100 transition-all"
                      >
                        <Recycle className="w-5 h-5" />
                        Recycle
                      </motion.button>
                    )}
                  </div>
                  <motion.p
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    className="font-[Cinzel] text-amber-200/70 text-[11px] uppercase tracking-[0.35em] mt-3"
                  >
                    Tap anywhere to continue
                  </motion.p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
