import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Zap, 
  Gamepad2, 
  TrendingUp, 
  Coffee, 
  Wifi, 
  ShoppingBag, 
  Trophy,
  Play,
  X,
  Dices,
  MessageSquare,
  User,
  Percent,
  Recycle
} from 'lucide-react';

interface Player {
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

interface GameState {
  coins: number;
  internet_level: number;
  food_level: number;
  collection_slots: number;
}

interface BracketMatch {
  team1: string;
  team2: string;
  winner: string;
  team1Odds?: number;
  team2Odds?: number;
  mapResults?: string[];
}

interface TournamentResult {
  tournamentName: string;
  rounds: { round: string; matches: BracketMatch[] }[];
  champion: string;
  coinsAwarded: number;
  state: GameState;
}

const SLOT_H = 88;
const SLOT_GAP = 12;
const SLOT_STEP = SLOT_H + SLOT_GAP;

function BracketConnector({ prevCount, nextCount, colHeight }: { prevCount: number; nextCount: number; colHeight: number }) {
  const w = 32;
  const slotsPerGroup = prevCount / nextCount;
  const paths: string[] = [];
  for (let p = 0; p < nextCount; p++) {
    const i0 = p * slotsPerGroup;
    const i1 = i0 + slotsPerGroup - 1;
    const c0 = i0 * SLOT_STEP + SLOT_H / 2;
    const c1 = i1 * SLOT_STEP + SLOT_H / 2;
    const mergeY = (c0 + c1) / 2;
    const nextCenter = (p + 0.5) * (colHeight / nextCount);
    if (slotsPerGroup === 1) {
      paths.push(`M 0 ${c0} L ${w} ${nextCenter}`);
    } else {
      paths.push(`M 0 ${c0} L ${w / 2} ${c0}`);
      paths.push(`M 0 ${c1} L ${w / 2} ${c1}`);
      paths.push(`M ${w / 2} ${c0} L ${w / 2} ${c1}`);
      paths.push(`M ${w / 2} ${mergeY} L ${w} ${nextCenter}`);
    }
  }
  return (
    <svg width={w} height={colHeight} className="flex-shrink-0 text-zinc-600" aria-hidden>
      <g stroke="currentColor" strokeWidth="1" fill="none">
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}

function BracketMatchCard({
  m,
  isRevealed,
  isSimulating,
  isKukuysMatch,
  kukuysMatchStarted,
  onStartGame,
  commentaryLines,
  commentaryRevealIndex,
  commentaryScrollRef,
}: {
  m: BracketMatch;
  isRevealed: boolean;
  isSimulating: boolean;
  isKukuysMatch: boolean;
  kukuysMatchStarted: boolean;
  onStartGame: () => void;
  commentaryLines: string[];
  commentaryRevealIndex: number;
  commentaryScrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const isKukuys = m.team1 === 'Kukuys' || m.team2 === 'Kukuys';
  return (
    <>
      <motion.div
        initial={isSimulating ? { opacity: 0.6, scale: 0.98 } : { opacity: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className={`relative flex flex-col gap-1.5 py-2 px-3 rounded-xl border border-zinc-700/50 ${
          isSimulating ? 'bg-amber-500/10 border-amber-500/40' : 'bg-zinc-800/80'
        }`}
      >
        {isSimulating && (
          <>
            {isKukuysMatch && !kukuysMatchStarted ? (
              <span className="text-[10px] text-amber-400 uppercase font-bold">Click to start</span>
            ) : (
              <span className="text-[10px] text-amber-400 uppercase font-bold animate-pulse">Simulating...</span>
            )}
          </>
        )}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className={
            isRevealed && m.winner === m.team1
              ? (m.team1 === 'Kukuys' ? 'text-emerald-400 font-bold text-sm' : 'text-amber-400 font-bold text-sm')
              : (m.team1 === 'Kukuys' ? 'text-emerald-400 font-bold text-sm' : 'text-zinc-300 text-sm')
          }>{m.team1}</span>
          {isRevealed && m.mapResults && m.mapResults.length > 0 ? (
            <span className="text-[10px] text-zinc-500 font-mono px-1.5 py-0.5 rounded bg-zinc-700/80">
              {m.mapResults.filter((w) => w === m.team1).length}
            </span>
          ) : m.team1Odds != null ? (
            <span className="text-[10px] text-zinc-500 font-mono px-1.5 py-0.5 rounded bg-zinc-700/80">{m.team1Odds}%</span>
          ) : null}
        </div>
        <div className="border-t border-zinc-600/60 my-0.5" />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className={
            isRevealed && m.winner === m.team2
              ? (m.team2 === 'Kukuys' ? 'text-emerald-400 font-bold text-sm' : 'text-amber-400 font-bold text-sm')
              : (m.team2 === 'Kukuys' ? 'text-emerald-400 font-bold text-sm' : 'text-zinc-300 text-sm')
          }>{m.team2}</span>
          {isRevealed && m.mapResults && m.mapResults.length > 0 ? (
            <span className="text-[10px] text-zinc-500 font-mono px-1.5 py-0.5 rounded bg-zinc-700/80">
              {m.mapResults.filter((w) => w === m.team2).length}
            </span>
          ) : m.team2Odds != null ? (
            <span className="text-[10px] text-zinc-500 font-mono px-1.5 py-0.5 rounded bg-zinc-700/80">{m.team2Odds}%</span>
          ) : null}
        </div>
        {isRevealed && m.team1Odds != null && m.team2Odds != null && (
          <>
            <div className="border-t border-zinc-600/60 my-0.5" />
            <span className="text-[10px] text-zinc-500 font-mono">
              {m.team1Odds}% vs {m.team2Odds}%
            </span>
          </>
        )}
      </motion.div>
      {isSimulating && isKukuysMatch && isKukuys && (
        <>
          {!kukuysMatchStarted ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={onStartGame}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-xs uppercase tracking-wider"
              >
                Start game
              </button>
            </div>
          ) : (
            <div className="rounded-xl bg-black/60 border border-amber-500/30 p-2 font-mono text-xs">
              <p className="text-amber-400/90 uppercase tracking-wider mb-1 text-[10px]">Commentary</p>
              <div ref={commentaryScrollRef} className="space-y-1 max-h-28 overflow-y-auto">
                {commentaryLines.slice(0, commentaryRevealIndex).map((line, idx) => (
                  <motion.div key={idx} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex gap-2">
                    <span className="text-emerald-500 shrink-0">[COMMENTARY]</span>
                    <span className="text-zinc-300">{line}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

const TIER_COLORS: Record<string, string> = {
  Common: 'text-zinc-400',
  Rare: 'text-blue-400',
  Epic: 'text-purple-400',
  Legendary: 'text-orange-400',
  Mythic: 'text-rose-400',
  'Ultra Rare': 'text-purple-400', // legacy
};

const TIER_CARD_STYLES: Record<string, { border: string; glow: string; gradient: string; badge: string; shine: string; corner: string; statsPanel: string; accentBorder: string; accentButton: string; accentStat: string; cardBg: string; borderGradient: string; bandBg: string; bandBorder: string; bandLabel: string; bandText: string }> = {
  Common: {
    border: 'border-zinc-500/80',
    glow: 'shadow-[0_0_20px_rgba(161,161,170,0.15)]',
    gradient: 'from-zinc-900/90 via-transparent to-zinc-950/95',
    badge: 'bg-zinc-600 text-zinc-200 border-zinc-500/50',
    shine: 'from-zinc-400/0 via-zinc-400/10 to-zinc-400/0',
    corner: 'border-zinc-500',
    statsPanel: 'bg-zinc-800/95',
    accentBorder: 'border-zinc-500/40',
    accentButton: 'bg-zinc-500 hover:bg-zinc-400 text-white',
    accentStat: 'text-zinc-300',
    cardBg: 'bg-zinc-950',
    borderGradient: 'from-zinc-400 via-zinc-500 to-zinc-600',
    bandBg: 'bg-zinc-950',
    bandBorder: 'border-zinc-700/50',
    bandLabel: 'text-zinc-400',
    bandText: 'text-zinc-100',
  },
  Rare: {
    border: 'border-blue-500/70',
    glow: 'shadow-[0_0_24px_rgba(59,130,246,0.25)]',
    gradient: 'from-blue-950/80 via-transparent to-zinc-950/95',
    badge: 'bg-blue-600/90 text-white border-blue-400/50',
    shine: 'from-blue-300/0 via-blue-300/20 to-blue-300/0',
    corner: 'border-blue-400',
    statsPanel: 'bg-blue-950/95',
    accentBorder: 'border-blue-500/40',
    accentButton: 'bg-blue-500 hover:bg-blue-400 text-white',
    accentStat: 'text-blue-300',
    cardBg: 'bg-blue-950/80',
    borderGradient: 'from-blue-400 via-blue-500 to-blue-600',
    bandBg: 'bg-blue-950',
    bandBorder: 'border-blue-800/60',
    bandLabel: 'text-blue-300/90',
    bandText: 'text-blue-50',
  },
  Epic: {
    border: 'border-purple-500/80',
    glow: 'shadow-[0_0_28px_rgba(168,85,247,0.35)]',
    gradient: 'from-purple-950/80 via-transparent to-zinc-950/95',
    badge: 'bg-purple-600/90 text-white border-purple-400/50',
    shine: 'from-purple-300/0 via-purple-300/25 to-purple-300/0',
    corner: 'border-purple-400',
    statsPanel: 'bg-purple-950/95',
    accentBorder: 'border-purple-500/40',
    accentButton: 'bg-purple-500 hover:bg-purple-400 text-white',
    accentStat: 'text-purple-300',
    cardBg: 'bg-purple-950/80',
    borderGradient: 'from-purple-400 via-purple-500 to-purple-600',
    bandBg: 'bg-purple-950',
    bandBorder: 'border-purple-800/60',
    bandLabel: 'text-purple-300/90',
    bandText: 'text-purple-50',
  },
  Legendary: {
    border: 'border-amber-400/90',
    glow: 'shadow-[0_0_32px_rgba(251,191,36,0.4)]',
    gradient: 'from-amber-950/70 via-transparent to-zinc-950/95',
    badge: 'bg-amber-500/90 text-black border-amber-400 font-bold',
    shine: 'from-amber-200/0 via-amber-200/30 to-amber-200/0',
    corner: 'border-amber-400',
    statsPanel: 'bg-amber-950/90',
    accentBorder: 'border-amber-500/40',
    accentButton: 'bg-amber-500 hover:bg-amber-400 text-black',
    accentStat: 'text-amber-300',
    cardBg: 'bg-amber-950/80',
    borderGradient: 'from-amber-400 via-amber-500 to-amber-600',
    bandBg: 'bg-amber-950',
    bandBorder: 'border-amber-800/50',
    bandLabel: 'text-amber-300/90',
    bandText: 'text-amber-50',
  },
  Mythic: {
    border: 'border-rose-400/90',
    glow: 'shadow-[0_0_36px_rgba(251,113,133,0.45)]',
    gradient: 'from-rose-950/70 via-transparent to-zinc-950/95',
    badge: 'bg-rose-500 text-white border-rose-400 font-bold',
    shine: 'from-rose-200/0 via-rose-200/35 to-rose-200/0',
    corner: 'border-rose-400',
    statsPanel: 'bg-rose-950/95',
    accentBorder: 'border-rose-500/40',
    accentButton: 'bg-rose-500 hover:bg-rose-400 text-white',
    accentStat: 'text-rose-300',
    cardBg: 'bg-rose-950/80',
    borderGradient: 'from-rose-400 via-rose-500 to-rose-600',
    bandBg: 'bg-rose-950',
    bandBorder: 'border-rose-800/60',
    bandLabel: 'text-rose-300/90',
    bandText: 'text-rose-50',
  },
  'Ultra Rare': {
    border: 'border-purple-500/80',
    glow: 'shadow-[0_0_28px_rgba(168,85,247,0.35)]',
    gradient: 'from-purple-950/80 via-transparent to-zinc-950/95',
    badge: 'bg-purple-600/90 text-white border-purple-400/50',
    shine: 'from-purple-300/0 via-purple-300/25 to-purple-300/0',
    corner: 'border-purple-400',
    statsPanel: 'bg-purple-950/95',
    accentBorder: 'border-purple-500/40',
    accentButton: 'bg-purple-500 hover:bg-purple-400 text-white',
    accentStat: 'text-purple-300',
    cardBg: 'bg-purple-950/80',
    borderGradient: 'from-purple-400 via-purple-500 to-purple-600',
    bandBg: 'bg-purple-950',
    bandBorder: 'border-purple-800/60',
    bandLabel: 'text-purple-300/90',
    bandText: 'text-purple-50',
  },
};

const RECRUIT_RATES = [
  { tier: 'Common', rate: 45, color: 'zinc' },
  { tier: 'Rare', rate: 28, color: 'blue' },
  { tier: 'Epic', rate: 14, color: 'purple' },
  { tier: 'Legendary', rate: 10, color: 'amber' },
  { tier: 'Mythic', rate: 3, color: 'rose' },
] as const;

const TIER_STAT_CAPS: Record<string, { mechanics: number; mental: number }> = {
  Common: { mechanics: 40, mental: 40 },
  Rare: { mechanics: 55, mental: 55 },
  Epic: { mechanics: 70, mental: 70 },
  Legendary: { mechanics: 85, mental: 85 },
  Mythic: { mechanics: 99, mental: 99 },
  'Ultra Rare': { mechanics: 70, mental: 70 },
};

const RECRUIT_POOL: Record<string, string[]> = {
  Common: ['Hubris', 'Lashsegway', 'Sunshine', 'Chupaeng', 'Alo', 'Badong', 'SirCherry'],
  Rare: ['Nevertheless', 'Joevy', 'JTZ', 'Sep', 'Mepweet', 'Jabolero'],
  Epic: ['Kokz', 'Yowe', 'JG', 'Jwl', 'Jing', 'Abat'],
  Legendary: ['Gabbi', 'Armel', 'Palos', 'Karl', 'Tino', 'Natsumi', 'Skem', 'Nikko'],
  Mythic: ['Kuku', 'DJ', 'Tims'],
};

// Recruit config from server (single source of truth); fallback to above if not loaded
interface RecruitRate { tier: string; rate: number }
function getDefaultRates(): RecruitRate[] {
  return RECRUIT_RATES.map(({ tier, rate }) => ({ tier, rate }));
}

function proxyImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('https://liquipedia.net/') || url.startsWith('http://liquipedia.net/')) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function UnknownPlaceholder({ className = '', size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const iconSize = size === 'sm' ? 20 : size === 'md' ? 28 : 40;
  const textClass = size === 'sm' ? 'text-[8px]' : size === 'md' ? 'text-[9px]' : 'text-[10px]';
  return (
    <div className={`bg-gradient-to-b from-zinc-700 to-zinc-800 flex flex-col items-center justify-center text-zinc-500 ${className}`}>
      <User size={iconSize} strokeWidth={1.5} className="opacity-60" />
      <span className={`${textClass} uppercase tracking-widest font-bold mt-0.5 opacity-80`}>Unknown</span>
    </div>
  );
}

function PlayerAvatar({ player, size = 'md' }: { player: Player; size?: 'sm' | 'md' | 'lg' }) {
  const [imgError, setImgError] = useState(false);
  const sizeClass = size === 'sm' ? 'w-12 h-12' : size === 'md' ? 'w-16 h-16' : 'w-24 h-24';
  if (player.image_url && !imgError) {
    return (
      <div className={`${sizeClass} rounded-xl overflow-hidden bg-zinc-800 shrink-0 border border-zinc-600 ring-1 ring-white/5`}>
        <img src={proxyImageUrl(player.image_url) ?? ''} alt={player.name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
      </div>
    );
  }
  return (
    <div className={`${sizeClass} rounded-xl overflow-hidden shrink-0 border border-zinc-700`}>
      <UnknownPlaceholder className="w-full h-full" size={size} />
    </div>
  );
}

function CollectionCardPhoto({ player }: { player: Player }) {
  const [imgError, setImgError] = useState(false);
  if (player.image_url && !imgError) {
    return (
      <img src={proxyImageUrl(player.image_url) ?? ''} alt={player.name} className="w-full h-full object-cover object-top" onError={() => setImgError(true)} />
    );
  }
  return <UnknownPlaceholder className="w-full h-full" size="lg" />;
}

// 4-axis radar chart for M, D, Ms, T (normalized 0–100); fill/stroke match tier
const RADAR_COLORS: Record<string, { fill: string; stroke: string }> = {
  Common: { fill: 'rgba(161,161,170,0.35)', stroke: 'rgb(161,161,170)' },
  Rare: { fill: 'rgba(59,130,246,0.35)', stroke: 'rgb(59,130,246)' },
  Epic: { fill: 'rgba(168,85,247,0.35)', stroke: 'rgb(168,85,247)' },
  Legendary: { fill: 'rgba(251,191,36,0.35)', stroke: 'rgb(251,191,36)' },
  Mythic: { fill: 'rgba(251,113,133,0.35)', stroke: 'rgb(251,113,133)' },
  'Ultra Rare': { fill: 'rgba(168,85,247,0.35)', stroke: 'rgb(168,85,247)' },
};

function StatRadar({ mechanics, drafting, mental_strength, trashtalk, tier }: { mechanics: number; drafting: number; mental_strength: number; trashtalk: number; tier?: string }) {
  const size = 80;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const max = 70;
  const n = (v: number) => Math.min(100, (v / max) * 100);
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const pt = (angleDeg: number, value: number) => {
    const v = (n(value) / 100) * r;
    return `${cx + v * Math.sin(rad(angleDeg))},${cy - v * Math.cos(rad(angleDeg))}`;
  };
  const points = [
    pt(0, mechanics),
    pt(90, drafting),
    pt(180, mental_strength),
    pt(270, trashtalk),
  ].join(' ');
  const axisLabels = [
    { a: 0, label: 'M', x: cx, y: 6, anchor: 'middle' as const },
    { a: 90, label: 'D', x: size - 4, y: cy, anchor: 'end' as const },
    { a: 180, label: 'Ms', x: cx, y: size - 4, anchor: 'middle' as const },
    { a: 270, label: 'T', x: 4, y: cy, anchor: 'end' as const },
  ];
  const colors = RADAR_COLORS[tier ?? 'Common'] ?? RADAR_COLORS.Common;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full min-w-[72px] min-h-[72px]" preserveAspectRatio="xMidYMid meet">
      <polygon
        points={points}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth="1.5"
        className="transition-all duration-500"
      />
      {[0, 90, 180, 270].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x2 = cx + r * Math.sin(rad);
        const y2 = cy - r * Math.cos(rad);
        return (
          <line key={deg} x1={cx} y1={cy} x2={x2} y2={y2} stroke="rgba(161,161,170,0.4)" strokeWidth="0.5" />
        );
      })}
      {axisLabels.map(({ label, x, y, anchor }) => (
        <text key={label} x={x} y={y} textAnchor={anchor} className="fill-zinc-400 text-[9px] font-semibold font-mono" dominantBaseline="middle">{label}</text>
      ))}
    </svg>
  );
}

export default function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [activeTab, setActiveTab] = useState<'bootcamp' | 'roster' | 'shop' | 'match' | 'rates'>('bootcamp');
  const [matchLog, setMatchLog] = useState<string[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<string | null>(null);
  const [bracketResult, setBracketResult] = useState<TournamentResult | null>(null);
  const [bracketRevealIndex, setBracketRevealIndex] = useState(0);
  const [commentaryLines, setCommentaryLines] = useState<string[]>([]);
  const [commentaryRevealIndex, setCommentaryRevealIndex] = useState(0);
  const [kukuysMatchStarted, setKukuysMatchStarted] = useState(false);
  const [currentTournament, setCurrentTournament] = useState<string>("Predator League Qualifiers");
  const [recruitConfig, setRecruitConfig] = useState<{ rates: RecruitRate[]; pool: Record<string, string[]> } | null>(null);
  const [testCoinsAdded, setTestCoinsAdded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const commentaryScrollRef = useRef<HTMLDivElement>(null);
  const matchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshedIdsRef = useRef<Set<string>>(new Set());
  const [grindTick, setGrindTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setGrindTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const hasExpiredGrind = players.some(p => p.grinding_until != null && p.grinding_until <= Date.now());
    const hasExpiredSleep = players.some(p => p.sleeping_until != null && p.sleeping_until <= Date.now());
    if (hasExpiredGrind || hasExpiredSleep) fetchData();
  }, [grindTick]);

  // Reveal bracket one game at a time; for Kukuys matches show commentator lines then BO3 result
  const allBracketMatches = bracketResult ? bracketResult.rounds.flatMap((r) => r.matches) : [];
  const totalBracketMatches = allBracketMatches.length;
  const currentBracketMatch = allBracketMatches[bracketRevealIndex];
  const isKukuysMatch = currentBracketMatch && (currentBracketMatch.team1 === 'Kukuys' || currentBracketMatch.team2 === 'Kukuys');
  const roster = players.filter((p) => p.is_roster === 1);

  useEffect(() => {
    if (!bracketResult || bracketRevealIndex >= totalBracketMatches) return;
    const flat = bracketResult.rounds.flatMap((r) => r.matches);
    const match = flat[bracketRevealIndex];
    const kukuysIn = match && (match.team1 === 'Kukuys' || match.team2 === 'Kukuys');
    const mapResults = match?.mapResults ?? [];
    const roster = players.filter((p) => p.is_roster === 1);

    if (kukuysIn && !kukuysMatchStarted) return;

    if (kukuysIn && mapResults.length > 0 && commentaryLines.length === 0) {
      const pick = (arr: string[]) => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : '');
      const rosterNames = roster.map((p) => p.name);
      const highMech = roster.reduce((a, b) => (b.mechanics > (roster[a]?.mechanics ?? 0) ? roster.indexOf(b) : a), 0);
      const starName = roster[highMech]?.name ?? rosterNames[0];
      const highTrash = roster.reduce((a, b) => (b.trashtalk > (roster[a]?.trashtalk ?? 0) ? roster.indexOf(b) : a), 0);
      const trashtalker = roster[highTrash]?.name ?? rosterNames[0];
      const opponent = match.team1 === 'Kukuys' ? match.team2 : match.team1;
      const lines: string[] = [];
      const phases = [
        ['Drafting phase started... Team Kukuys looking for a greedy lineup.', 'Captains are in. First pick phase—banning meta heroes.', 'Draft is live. Opponent showing their hand early.'],
        [`${pick(rosterNames)} is making space. Mental strength is high.`, `Early rotations from ${pick(rosterNames)}. Map control secured.`, 'Laning phase: Team Kukuys trading evenly. No major throws.'],
        ['Mid game: Trashtalking in all-chat. Opponent is tilted!', `${trashtalker} types in all chat. Enemy team losing focus.`, 'Objective trading. Roshan timer ticking.'],
        ['Teamfight at Rosh! Mechanics checking...', `Big teamfight! ${starName} is in the thick of it.`, 'Smoke into the jungle. Pickoff—fight erupts.'],
        [`${pick(rosterNames)} is diving the fountain! 'Lakad Matataaaag!'`, 'Megas are down. GG call incoming.', 'Throne exposed. One more fight decides it.'],
      ];
      for (let mapNum = 0; mapNum < mapResults.length; mapNum++) {
        phases.forEach((phase) => lines.push(phase[Math.floor(Math.random() * phase.length)]));
        const mapWinner = mapResults[mapNum];
        lines.push(`Map ${mapNum + 1}: ${mapWinner} wins.`);
      }
      const kukuysWins = mapResults.filter((w) => w === 'Kukuys').length;
      const oppWins = mapResults.length - kukuysWins;
      lines.push(`Series: Kukuys ${kukuysWins} – ${oppWins} ${opponent}.`);
      setCommentaryLines(lines);
      setCommentaryRevealIndex(0);
      return;
    }

    if (kukuysIn && commentaryLines.length > 0) {
      if (commentaryRevealIndex < commentaryLines.length) {
        const t = setTimeout(() => setCommentaryRevealIndex((i) => i + 1), 520);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => {
        setBracketRevealIndex((i) => i + 1);
        setCommentaryLines([]);
        setCommentaryRevealIndex(0);
      }, 1200);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => setBracketRevealIndex((i) => i + 1), 1600);
    return () => clearTimeout(t);
  }, [bracketResult, bracketRevealIndex, totalBracketMatches, commentaryLines.length, commentaryRevealIndex, players, kukuysMatchStarted]);

  useEffect(() => {
    commentaryScrollRef.current && (commentaryScrollRef.current.scrollTop = commentaryScrollRef.current.scrollHeight);
  }, [commentaryRevealIndex]);

  useEffect(() => {
    setKukuysMatchStarted(false);
  }, [bracketRevealIndex, bracketResult]);

  useEffect(() => {
    if (bracketRevealIndex < totalBracketMatches && !isKukuysMatch) {
      setCommentaryLines([]);
      setCommentaryRevealIndex(0);
    }
  }, [bracketRevealIndex, totalBracketMatches, isKukuysMatch]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      if (data.state != null) setState(data.state);
      if (Array.isArray(data.players)) setPlayers(data.players);
    } catch (err) {
      console.error('Failed to fetch state', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch('/api/recruit-config')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.rates) && d.pool && typeof d.pool === 'object') setRecruitConfig({ rates: d.rates, pool: d.pool });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/tournaments')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.tournaments) && d.tournaments.length > 0) {
          setCurrentTournament(d.tournaments[Math.floor(Math.random() * d.tournaments.length)]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [matchLog]);

  useEffect(() => {
    return () => {
      if (matchIntervalRef.current) clearInterval(matchIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    const withoutPhoto = players.filter((p) => !p.image_url && !refreshedIdsRef.current.has(p.id));
    if (withoutPhoto.length === 0) return;
    const next = withoutPhoto[0];
    fetch(`/api/refresh-player-image?playerId=${encodeURIComponent(next.id)}`)
      .then((r) => r.json())
      .then((data) => {
        refreshedIdsRef.current.add(next.id);
        const newUrl = data.image_url ?? data.player?.image_url ?? null;
        setPlayers((prev) => prev.map((p) => (p.id === next.id ? { ...p, image_url: newUrl } : p)));
      })
      .catch(() => {
        refreshedIdsRef.current.add(next.id);
      });
  }, [players]);

  const handleAction = async (playerId: string, action: string) => {
    const res = await fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, action }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || `Action failed (${res.status})`);
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (data.state != null) setState(data.state);
    if (Array.isArray(data.players)) setPlayers(data.players);
    if (data.players == null) fetchData();
  };

  const handleRecruit = async () => {
    const res = await fetch('/api/recruit', { method: 'POST' });
    if (res.ok) {
      fetchData();
    } else {
      const data = await res.json();
      alert(data.error);
    }
  };

  const handleResetCollection = async () => {
    if (!confirm('Remove ALL players and reset coins/slots? You will only be able to recruit from the Player pool (per tier) above.')) return;
    const res = await fetch('/api/reset-collection', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      if (data.state != null) setState(data.state);
      if (Array.isArray(data.players)) setPlayers(data.players);
    } else {
      const data = await res.json();
      alert(data.error || 'Reset failed');
    }
  };

  const handleExpandCollection = async () => {
    const res = await fetch('/api/expand-collection', { method: 'POST' });
    if (res.ok) {
      fetchData();
    } else {
      const data = await res.json();
      alert(data.error);
    }
  };

  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const handleLoadPhotos = async () => {
    setLoadingPhotos(true);
    try {
      const res = await fetch('/api/backfill-photos', { method: 'POST' });
      const data = await res.json();
      if (data.success && Array.isArray(data.players)) {
        setPlayers(data.players);
        const loaded = (data.results || []).filter((r: { ok: boolean }) => r.ok).length;
        if (loaded > 0) alert(`Loaded ${loaded} player photo(s).`);
      }
    } catch (_) {}
    setLoadingPhotos(false);
  };

  const [loadingTeams, setLoadingTeams] = useState(false);
  const handleRefreshTeams = async () => {
    setLoadingTeams(true);
    try {
      const res = await fetch('/api/backfill-teams', { method: 'POST' });
      const data = await res.json();
      if (data.success && Array.isArray(data.players)) {
        setPlayers(data.players);
        alert('Teams refreshed from Liquipedia.');
      }
    } catch (_) {}
    setLoadingTeams(false);
  };

  const handleRecycle = async (playerId: string, playerName: string) => {
    if (!confirm(`Recycle ${playerName}? You'll get 10 coins and remove them from your collection.`)) return;
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, action: 'recycle' }),
      });
      const text = await res.text();
      let data: { success?: boolean; state?: GameState; players?: Player[]; error?: string };
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        alert(`Recycle failed: server returned invalid response (${res.status})`);
        fetchData();
        return;
      }
      if (res.ok && data.success) {
        if (data.state != null) setState(data.state);
        if (Array.isArray(data.players)) setPlayers(data.players);
      } else {
        alert(data.error || `Recycle failed (${res.status})`);
      }
    } catch (err) {
      console.error(err);
      alert('Recycle failed: ' + (err instanceof Error ? err.message : 'network error'));
    }
    fetchData();
  };

  const startMatch = async () => {
    const roster = players.filter(p => p.is_roster === 1);
    if (roster.length < 5) {
      alert("You need 5 players in your roster to start a match!");
      return;
    }
    const someoneGrinding = roster.some(p => (p.grinding_until ?? 0) > Date.now());
    if (someoneGrinding) {
      alert("Someone is still grinding. Wait until all grind sessions finish before entering a tournament.");
      return;
    }
    setIsMatching(true);
    setBracketResult(null);
    setMatchResult(null);
    setMatchLog([]);
    try {
      const res = await fetch('/api/tournament-run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to run tournament');
        setIsMatching(false);
        return;
      }
      if (data.state) setState(data.state);
      setCurrentTournament(data.tournamentName || currentTournament);
      setBracketResult(data);
      setBracketRevealIndex(0);
      setCommentaryLines([]);
      setCommentaryRevealIndex(0);
      fetchData();
    } catch (e) {
      alert('Tournament failed: ' + (e instanceof Error ? e.message : 'network error'));
    }
    setIsMatching(false);
  };

  if (!state) return <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center font-mono">Loading Bootcamp...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800 p-4 sticky top-0 bg-[#050505]/80 backdrop-blur-md z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center text-black font-bold text-xl">K</div>
            <div>
              <h1 className="text-white font-bold tracking-tighter text-lg uppercase">Kukuys Master</h1>
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Dota Manager Tycoon v1.0</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-zinc-500 uppercase font-bold">Kukuy Coins</span>
              <span className="text-emerald-400 font-mono text-xl font-bold">{state.coins.toLocaleString()}</span>
            </div>
            <button
              type="button"
              onClick={async () => {
                setTestCoinsAdded(false);
                const url = `${window.location.origin}/api/add-test-coins`;
                try {
                  const res = await fetch(url, { method: 'POST', credentials: 'same-origin' });
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    console.error('Add test coins failed:', res.status, err);
                    await fetchData();
                    return;
                  }
                  const data = await res.json();
                  if (data?.state) setState(data.state);
                  else await fetchData();
                  setTestCoinsAdded(true);
                  setTimeout(() => setTestCoinsAdded(false), 1500);
                } catch (e) {
                  console.error('Add test coins error:', e);
                  await fetchData();
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 text-xs font-bold uppercase tracking-wider border border-amber-500/40 active:scale-95 transition-transform disabled:opacity-70"
              title="Add 10,000 coins for testing"
            >
              {testCoinsAdded ? 'Added!' : '+10k'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Navigation */}
        <nav className="lg:col-span-2 flex lg:flex-col gap-2 overflow-x-auto pb-4 lg:pb-0">
          {[
            { id: 'bootcamp', icon: Gamepad2, label: 'Bootcamp' },
            { id: 'roster', icon: Users, label: 'Roster' },
            { id: 'match', icon: Trophy, label: 'Tournament' },
            { id: 'rates', icon: Percent, label: 'Rates' },
            { id: 'shop', icon: ShoppingBag, label: 'Upgrades' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-emerald-500 text-black font-bold shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
                  : 'hover:bg-zinc-800 text-zinc-400'
              }`}
            >
              <tab.icon size={18} />
              <span className="text-sm uppercase tracking-tight">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Content Area */}
        <div className="lg:col-span-10">
          <AnimatePresence mode="wait">
            {activeTab === 'bootcamp' && (
              <motion.div 
                key="bootcamp"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <p className="text-zinc-400 text-sm">
                  <strong className="text-zinc-300">Grind</strong> — Costs 20 Energy. 5 min, cannot interrupt. After: 50% +2/+1 or −2/−1 (tier capped). <strong className="text-zinc-300">Sleep</strong> — 5 min uninterrupted, then +20 Energy (cannot interrupt).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {players.filter(p => p.is_roster === 1).map(player => {
                    const grindUntil = player.grinding_until ?? 0;
                    const sleepUntil = player.sleeping_until ?? 0;
                    const grinding = grindUntil > Date.now();
                    const sleeping = sleepUntil > Date.now();
                    const busy = grinding || sleeping;
                    const remainingMs = grinding ? Math.max(0, grindUntil - Date.now()) : sleeping ? Math.max(0, sleepUntil - Date.now()) : 0;
                    const mins = Math.floor(remainingMs / 60000);
                    const secs = Math.floor((remainingMs % 60000) / 1000);
                    return (
                    <div
                      key={player.id}
                      className={`rounded-2xl overflow-hidden transition-all ${
                        busy
                          ? grinding
                            ? 'bg-zinc-900/80 border border-amber-500/50 opacity-90'
                            : 'bg-zinc-900/80 border border-blue-500/50 opacity-90'
                          : 'bg-zinc-900/50 border border-zinc-800 hover:border-emerald-500/50 group'
                      }`}
                    >
                      {grinding && (
                        <div className="bg-amber-500/20 border-b border-amber-500/40 px-4 py-2.5 flex items-center justify-center gap-2">
                          <Zap size={16} className="text-amber-400 shrink-0" />
                          <span className="text-amber-200 font-bold text-sm uppercase tracking-wider">
                            Grinding — {mins}:{secs.toString().padStart(2, '0')} remaining (cannot interrupt)
                          </span>
                        </div>
                      )}
                      {sleeping && !grinding && (
                        <div className="bg-blue-500/20 border-b border-blue-500/40 px-4 py-2.5 flex items-center justify-center gap-2">
                          <Coffee size={16} className="text-blue-400 shrink-0" />
                          <span className="text-blue-200 font-bold text-sm uppercase tracking-wider">
                            Sleeping — {mins}:{secs.toString().padStart(2, '0')} remaining (+20 Energy when done)
                          </span>
                        </div>
                      )}
                      <div className={busy ? 'pointer-events-none select-none opacity-75' : ''}>
                      <div className="flex justify-between items-start p-5 pb-0">
                        <div className="flex items-center gap-4">
                          <PlayerAvatar player={player} size="lg" />
                          <div>
                            <h3 className={`font-bold text-lg ${TIER_COLORS[player.tier]}`}>{player.name}</h3>
                            <span className="text-[10px] uppercase font-mono text-zinc-500">{player.tier}</span>
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded text-[10px] font-bold ${player.is_streaming ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                          {player.is_streaming ? 'LIVE' : 'OFF'}
                        </div>
                      </div>

                      <div className="p-5 space-y-3">
                        <div>
                          <div className="flex justify-between text-[10px] uppercase mb-1">
                            <span>Energy</span>
                            <span className={player.energy < 30 ? 'text-red-400' : 'text-emerald-400'}>{player.energy}%</span>
                          </div>
                          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${player.energy}%` }}
                              className={`h-full ${player.energy < 30 ? 'bg-red-500' : 'bg-emerald-500'}`}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2">
                          {(() => {
                            const caps = TIER_STAT_CAPS[player.tier] ?? TIER_STAT_CAPS.Common;
                            const atCap = (player.mechanics ?? 0) >= caps.mechanics && (player.mental_strength ?? 0) >= caps.mental;
                            const canGrind = player.energy >= 20 && !atCap && !grinding && !sleeping;
                            return (
                          <>
                          <button 
                            onClick={() => handleAction(player.id, 'train')}
                            disabled={!canGrind}
                            title={grinding ? 'Cannot interrupt.' : sleeping ? 'Player is sleeping.' : atCap ? 'At max for this tier' : 'Costs 20 Energy. 5 min grind: 50% +2/+1, 50% −2/−1. Cannot interrupt.'}
                            className="flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-emerald-500 hover:text-black disabled:opacity-50 disabled:hover:bg-zinc-800 disabled:hover:text-zinc-400 rounded-lg text-xs font-bold transition-all"
                          >
                            <Zap size={14} /> {grinding ? `… ${mins}:${secs.toString().padStart(2, '0')}` : atCap ? 'MAXED' : 'GRIND'}
                          </button>
                          <button 
                            onClick={() => handleAction(player.id, 'sleep')}
                            disabled={busy}
                            title={sleeping ? 'Cannot interrupt.' : grinding ? 'Finish grinding first.' : '5 min uninterrupted, then +20 Energy.'}
                            className="flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-blue-500 hover:text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                          >
                            <Coffee size={14} /> {sleeping ? `… ${mins}:${secs.toString().padStart(2, '0')}` : 'SLEEP'}
                          </button>
                          <button 
                            onClick={() => handleAction(player.id, 'toggle_stream')}
                            disabled={busy}
                            className={`col-span-2 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ${
                              player.is_streaming ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            }`}
                          >
                            <TrendingUp size={14} /> {player.is_streaming ? 'STOP STREAM' : 'START STREAM'}
                          </button>
                          </>
                            );
                          })()}
                        </div>
                      </div>
                      </div>
                    </div>
                    );
                  })}
                  {players.filter(p => p.is_roster === 1).length === 0 && (
                    <div className="col-span-full py-20 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center text-zinc-500">
                      <Users size={48} className="mb-4 opacity-20" />
                      <p className="uppercase tracking-widest text-sm">No players in roster</p>
                      <button onClick={() => setActiveTab('roster')} className="mt-4 text-emerald-400 hover:underline text-xs font-bold">GO TO ROSTER</button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'roster' && (
              <motion.div 
                key="roster"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-white uppercase tracking-tight">Your Collection</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 text-sm font-mono">
                      {players.length}/{state?.collection_slots ?? 8}
                    </span>
                    <button 
                      onClick={handleLoadPhotos}
                      disabled={loadingPhotos || players.length === 0}
                      className="flex items-center gap-2 px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-xl text-sm font-bold disabled:opacity-50"
                    >
                      {loadingPhotos ? 'Loading…' : 'LOAD PHOTOS'}
                    </button>
                    <button 
                      onClick={handleRefreshTeams}
                      disabled={loadingTeams || players.length === 0}
                      className="flex items-center gap-2 px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-xl text-sm font-bold disabled:opacity-50"
                    >
                      {loadingTeams ? 'Loading…' : 'REFRESH TEAMS'}
                    </button>
                    <button 
                      onClick={handleRecruit}
                      disabled={!state || players.length >= (state.collection_slots ?? 8)}
                      className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:scale-105 transition-transform shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                    >
                      <Dices size={18} /> RECRUIT (200)
                    </button>
                  </div>
                </div>
                {state && players.length >= (state.collection_slots ?? 8) && (
                  <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl">
                    <p className="text-zinc-400 text-sm">Collection full. Buy +1 slot (10,000 coins) to recruit more players.</p>
                    <button 
                      onClick={handleExpandCollection}
                      disabled={state.coins < 10000}
                      className="px-5 py-2.5 bg-amber-500 text-black font-bold rounded-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                    >
                      EXPAND SLOTS (10,000)
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {players.map(player => {
                    const style = TIER_CARD_STYLES[player.tier] ?? TIER_CARD_STYLES.Common;
                    return (
                      <motion.div
                        key={player.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        whileHover={{ y: -6, scale: 1.02 }}
                        className="flex justify-center"
                      >
                        <div className={`w-full max-w-[400px] rounded-2xl p-[4px] overflow-hidden bg-gradient-to-br ${style.borderGradient} ${style.glow}`}>
                        <div
                          className={`relative w-full max-w-[400px] rounded-[14px] overflow-hidden ${style.cardBg} group cursor-pointer outline-none`}
                          style={{ aspectRatio: '3/4', minHeight: '520px' }}
                        >
                          {/* Photo: ~42% — smaller so text has more room */}
                          <div className="absolute top-0 left-0 right-0 h-[42%] overflow-hidden bg-zinc-500/20">
                            <div className="absolute inset-2 overflow-hidden rounded-t-lg">
                              <CollectionCardPhoto player={player} />
                            </div>
                            <div className={`absolute top-2 right-2 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${style.badge} z-10`}>
                              {player.tier}
                            </div>
                          </div>

                          {/* Tier-colored dark band: PLAYER | TEAM — team from Liquipedia or KUKUYS */}
                          <div className={`absolute left-0 right-0 top-[42%] h-6 flex justify-between items-center px-4 ${style.bandBg}`}>
                            <span className={`text-[10px] uppercase tracking-widest ${style.bandLabel}`}>Player</span>
                            <span className={`text-[10px] uppercase tracking-widest ${style.bandLabel}`}>Team</span>
                          </div>
                          <div className={`absolute left-0 right-0 top-[calc(42%+24px)] h-9 px-4 flex justify-between items-center gap-2 ${style.bandBg}`}>
                            <span className={`font-bold text-base truncate min-w-0 ${style.bandText}`}>{player.name}</span>
                            <span className={`font-bold text-sm truncate shrink-0 ${style.bandText}`}>{player.team || 'KUKUYS'}</span>
                          </div>

                          {/* Middle: Dota 2 role + radar */}
                          <div className={`absolute left-0 right-0 top-[calc(42%+60px)] bottom-[26%] ${style.statsPanel} px-3 py-2.5 flex items-center gap-3`}>
                            <div className="shrink-0">
                              <p className="text-[10px] uppercase tracking-widest text-zinc-400 mb-1">Role</p>
                              <p className="font-bold text-sm text-white uppercase leading-tight">{player.role || player.tier}</p>
                            </div>
                            <div className="ml-auto w-20 h-20 shrink-0 flex items-center justify-center pr-0">
                              <StatRadar mechanics={player.mechanics} drafting={player.drafting} mental_strength={player.mental_strength} trashtalk={player.trashtalk} tier={player.tier} />
                            </div>
                          </div>

                          {/* Bottom: CARD STATS + buttons — no separator line */}
                          <div className={`absolute left-0 right-0 bottom-0 top-[74%] ${style.statsPanel} px-3 pt-3 pb-3 flex flex-col`}>
                            <p className="text-[10px] uppercase tracking-widest text-zinc-400 mb-2">Card stats</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-zinc-200 mb-3">
                              <div className="flex justify-between gap-2"><span className="truncate">Mechanics</span><span className={`font-mono font-bold shrink-0 ${style.accentStat}`}>{player.mechanics}</span></div>
                              <div className="flex justify-between gap-2"><span className="truncate">Drafting</span><span className={`font-mono font-bold shrink-0 ${style.accentStat}`}>{player.drafting}</span></div>
                              <div className="flex justify-between gap-2"><span className="truncate">Mental</span><span className={`font-mono font-bold shrink-0 ${style.accentStat}`}>{player.mental_strength}</span></div>
                              <div className="flex justify-between gap-2"><span className="truncate">Trashtalk</span><span className={`font-mono font-bold shrink-0 ${style.accentStat}`}>{player.trashtalk}</span></div>
                            </div>
                            <div className="flex gap-2">
                              {(() => {
                                const sameNameInRoster = players.some(p => p.is_roster === 1 && p.name === player.name && p.id !== player.id);
                                const canAddToRoster = !player.is_roster && !sameNameInRoster;
                                return (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleAction(player.id, 'toggle_roster'); }}
                                disabled={!player.is_roster && sameNameInRoster}
                                title={sameNameInRoster ? 'Already in roster (one copy per player)' : undefined}
                                className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase transition-all ${style.accentButton} ${!canAddToRoster && !player.is_roster ? 'opacity-60 cursor-not-allowed' : ''}`}
                              >
                                {player.is_roster ? '✓ Roster' : sameNameInRoster ? 'In roster' : 'Add to roster'}
                              </button>
                                );
                              })()}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRecycle(player.id, player.name); }}
                                type="button"
                                className="flex items-center justify-center gap-1 py-2 px-3 rounded-lg text-xs font-bold uppercase text-zinc-400 hover:bg-white/10 hover:text-zinc-200 transition-all"
                                title="Recycle for 10 coins"
                              >
                                <Recycle className="w-3.5 h-3.5 shrink-0" />
                                +10
                              </button>
                            </div>
                          </div>
                        </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                {players.length === 0 && (
                  <div className="text-center py-16 text-zinc-500">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm font-medium">No players yet</p>
                    <p className="text-xs mt-1">Recruit to add players to your collection.</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'match' && (
              <motion.div 
                key="match"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-4xl mx-auto space-y-6"
              >
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
                  <Trophy size={48} className="mx-auto mb-4 text-emerald-500" />
                  <h2 className="text-2xl font-bold text-white uppercase mb-2 text-center">{currentTournament}</h2>
                  <p className="text-zinc-500 text-sm mb-8 text-center">Double-elimination bracket. Each match is BO3. Become champion to earn Kukuys coins.</p>
                  
                  {!bracketResult && !isMatching && (
                    (() => {
                      const roster = players.filter(p => p.is_roster === 1);
                      const rosterGrinding = roster.some(p => (p.grinding_until ?? 0) > Date.now());
                      const canEnter = roster.length >= 5 && !rosterGrinding;
                      return (
                    <div className="text-center">
                      <button 
                        onClick={startMatch}
                        disabled={!canEnter}
                        title={roster.length < 5 ? 'Need 5 players in roster' : rosterGrinding ? 'Someone is grinding — wait until all grind sessions finish' : undefined}
                        className="px-12 py-4 bg-emerald-500 text-black font-bold rounded-2xl text-lg hover:scale-105 transition-transform shadow-xl shadow-emerald-500/20 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                      >
                        {rosterGrinding ? 'GRINDING… WAIT' : 'ENTER TOURNAMENT'}
                      </button>
                    </div>
                      );
                    })()
                  )}

                  {isMatching && (
                    <div className="text-center py-8 text-zinc-400 font-bold uppercase tracking-wider">Running bracket…</div>
                  )}

                  {bracketResult && (
                    <div className="space-y-6">
                    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                      <div className="flex-1 flex flex-col gap-8 min-w-0">
                        <div>
                          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Upper Bracket</h3>
                          <div className="flex items-stretch gap-1 overflow-x-auto pb-2">
                            {[0, 1, 5].map((roundIdx, colIdx) => {
                              const r = bracketResult.rounds[roundIdx];
                              if (!r) return null;
                              const roundStartIndex = bracketResult.rounds.slice(0, roundIdx).reduce((acc, x) => acc + x.matches.length, 0);
                              const prevCount = colIdx === 0 ? 4 : colIdx === 1 ? 2 : 1;
                              const nextCount = colIdx === 0 ? 2 : colIdx === 1 ? 1 : 0;
                              const colHeight = 4 * SLOT_STEP - SLOT_GAP;
                              return (
                                <React.Fragment key={roundIdx}>
                                  {colIdx > 0 && nextCount > 0 && (
                                    <BracketConnector prevCount={prevCount} nextCount={nextCount} colHeight={colHeight} />
                                  )}
                                  <div className="flex flex-col gap-3 min-w-[200px] flex-shrink-0" style={{ minHeight: colHeight }}>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{r.round.replace('Upper Bracket — ', '')}</p>
                                    <div className="flex flex-col gap-3 justify-around flex-1" style={{ minHeight: r.matches.length * SLOT_STEP - SLOT_GAP }}>
                                      {r.matches.map((m, matchIdx) => {
                                        const matchIndex = roundStartIndex + matchIdx;
                                        const isRevealed = matchIndex < bracketRevealIndex;
                                        const isSimulating = matchIndex === bracketRevealIndex;
                                        if (!isRevealed && !isSimulating) return <div key={matchIdx} className="rounded-xl border border-zinc-800 bg-zinc-900/50 flex-shrink-0" style={{ minHeight: SLOT_H }} />;
                                        return (
                                          <div key={matchIdx} className="flex-shrink-0" style={{ minHeight: SLOT_H }}>
                                            <BracketMatchCard
                                              m={m}
                                              isRevealed={isRevealed}
                                              isSimulating={isSimulating}
                                              isKukuysMatch={isKukuysMatch}
                                              kukuysMatchStarted={kukuysMatchStarted}
                                              onStartGame={() => setKukuysMatchStarted(true)}
                                              commentaryLines={commentaryLines}
                                              commentaryRevealIndex={commentaryRevealIndex}
                                              commentaryScrollRef={commentaryScrollRef}
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Lower Bracket</h3>
                          <div className="flex items-stretch gap-1 overflow-x-auto pb-2">
                            {[2, 3, 4, 6].map((roundIdx, colIdx) => {
                              const r = bracketResult.rounds[roundIdx];
                              if (!r) return null;
                              const roundStartIndex = bracketResult.rounds.slice(0, roundIdx).reduce((acc, x) => acc + x.matches.length, 0);
                              const prevCount = colIdx === 0 ? 2 : colIdx === 1 ? 2 : colIdx === 2 ? 1 : 1;
                              const nextCount = colIdx === 0 ? 2 : colIdx === 1 ? 1 : colIdx === 2 ? 1 : 0;
                              const colHeight = 2 * SLOT_STEP - SLOT_GAP;
                              return (
                                <React.Fragment key={roundIdx}>
                                  {colIdx > 0 && nextCount > 0 && (
                                    <BracketConnector prevCount={prevCount} nextCount={nextCount} colHeight={colHeight} />
                                  )}
                                  <div className="flex flex-col gap-3 min-w-[200px] flex-shrink-0" style={{ minHeight: colHeight }}>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{r.round.replace('Lower Bracket — ', '')}</p>
                                    <div className="flex flex-col gap-3 justify-around flex-1" style={{ minHeight: r.matches.length * SLOT_STEP - SLOT_GAP }}>
                                      {r.matches.map((m, matchIdx) => {
                                        const matchIndex = roundStartIndex + matchIdx;
                                        const isRevealed = matchIndex < bracketRevealIndex;
                                        const isSimulating = matchIndex === bracketRevealIndex;
                                        if (!isRevealed && !isSimulating) return <div key={matchIdx} className="rounded-xl border border-zinc-800 bg-zinc-900/50 flex-shrink-0" style={{ minHeight: SLOT_H }} />;
                                        return (
                                          <div key={matchIdx} className="flex-shrink-0" style={{ minHeight: SLOT_H }}>
                                            <BracketMatchCard
                                              m={m}
                                              isRevealed={isRevealed}
                                              isSimulating={isSimulating}
                                              isKukuysMatch={isKukuysMatch}
                                              kukuysMatchStarted={kukuysMatchStarted}
                                              onStartGame={() => setKukuysMatchStarted(true)}
                                              commentaryLines={commentaryLines}
                                              commentaryRevealIndex={commentaryRevealIndex}
                                              commentaryScrollRef={commentaryScrollRef}
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      {bracketResult.rounds[7] && (
                        <div className="lg:flex-shrink-0 lg:w-[220px] lg:flex lg:flex-col lg:justify-center">
                          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Grand Final</h3>
                          <div className="flex flex-col gap-3 min-w-[200px]">
                            {bracketResult.rounds[7].matches.map((m, matchIdx) => {
                                  const roundStartIndex = bracketResult.rounds.slice(0, 7).reduce((acc, x) => acc + x.matches.length, 0);
                                  const matchIndex = roundStartIndex + matchIdx;
                                  const isRevealed = matchIndex < bracketRevealIndex;
                                  const isSimulating = matchIndex === bracketRevealIndex;
                                  if (!isRevealed && !isSimulating) return <div key={matchIdx} className="rounded-xl border border-zinc-800 bg-zinc-900/50 h-16" />;
                                  return (
                                    <BracketMatchCard
                                      key={matchIdx}
                                      m={m}
                                      isRevealed={isRevealed}
                                      isSimulating={isSimulating}
                                      isKukuysMatch={isKukuysMatch}
                                      kukuysMatchStarted={kukuysMatchStarted}
                                      onStartGame={() => setKukuysMatchStarted(true)}
                                      commentaryLines={commentaryLines}
                                      commentaryRevealIndex={commentaryRevealIndex}
                                      commentaryScrollRef={commentaryScrollRef}
                                    />
                                  );
                                })}
                          </div>
                        </div>
                      )}
                    </div>
                    {bracketRevealIndex >= totalBracketMatches && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="pt-6 border-t border-zinc-700"
                        >
                          <p className="text-center text-zinc-500 text-sm uppercase tracking-widest mb-1">Champion</p>
                          <p className={`text-center text-2xl font-black ${bracketResult.champion === 'Kukuys' ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {bracketResult.champion}
                          </p>
                          {bracketResult.coinsAwarded > 0 && (
                            <p className="text-center text-emerald-400 font-bold mt-2">
                              +{bracketResult.coinsAwarded.toLocaleString()} Kukuys coins
                            </p>
                          )}
                        </motion.div>
                      )}
                      {bracketRevealIndex >= totalBracketMatches && (
                        <div className="flex justify-center gap-4 pt-4">
                          <button 
                            onClick={() => { setBracketResult(null); setBracketRevealIndex(0); }}
                            className="px-8 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-bold rounded-xl text-sm uppercase tracking-wider"
                          >
                            Close
                          </button>
                          <button 
                            onClick={() => { setBracketResult(null); setBracketRevealIndex(0); startMatch(); }}
                            className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-sm uppercase tracking-wider"
                          >
                            Enter another
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'rates' && (
              <motion.div
                key="rates"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 max-w-2xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
                    <Percent className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-tight">Recruit rates</h2>
                    <p className="text-zinc-500 text-sm">Chance to get each tier when you recruit (200 coins per pull).</p>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Drop rate by tier</h3>
                  {(recruitConfig?.rates ?? getDefaultRates()).map(({ tier, rate }) => (
                    <div key={tier} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className={`font-bold ${TIER_COLORS[tier]}`}>{tier}</span>
                        <span className="text-zinc-300 font-mono font-bold">{rate}%</span>
                      </div>
                          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${rate}%` }}
                          transition={{ duration: 0.6 }}
                          className={`h-full rounded-full ${
                            tier === 'Mythic' ? 'bg-rose-500' :
                            tier === 'Legendary' ? 'bg-amber-500' :
                            tier === 'Epic' ? 'bg-purple-500' :
                            tier === 'Rare' ? 'bg-blue-500' : 'bg-zinc-500'
                          }`}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Player pool (per tier)</h3>
                  <p className="text-zinc-500 text-xs">One random player from the tier’s list is chosen when you hit that tier.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(recruitConfig?.rates ?? getDefaultRates()).map(({ tier }) => (
                      <div key={tier} className={`p-4 rounded-xl border ${TIER_CARD_STYLES[tier]?.border ?? 'border-zinc-700'} bg-zinc-800/30`}>
                        <div className={`text-xs font-black uppercase tracking-wider mb-2 ${TIER_COLORS[tier]}`}>{tier}</div>
                        <ul className="text-sm text-zinc-300 space-y-1">
                          {(recruitConfig?.pool?.[tier] ?? RECRUIT_POOL[tier] ?? []).map((name) => (
                            <li key={name} className="font-mono">{name}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-400 text-xs">
                  <strong className="text-zinc-300">Summary:</strong> Each recruit costs 200 coins. The game rolls 0–100 using the rates above. One name is then chosen at random from that tier’s list.
                </div>

                <div className="p-4 rounded-xl border border-amber-500/50 bg-amber-500/10">
                  <p className="text-amber-200/90 text-xs mb-3">Only the names in the Player pool above can be recruited. To remove all current players and start fresh (reset coins to 1000, 8 slots), use the button below.</p>
                  <button
                    onClick={handleResetCollection}
                    className="px-4 py-2 rounded-lg bg-amber-500/80 hover:bg-amber-500 text-black text-xs font-bold uppercase"
                  >
                    Reset collection (remove all players)
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'shop' && (
              <motion.div 
                key="shop"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex items-center gap-6">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400">
                    <Wifi size={32} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-bold uppercase">Upgrade Internet</h3>
                    <p className="text-xs text-zinc-500 mb-4">Reduces chance of DC during matches and increases streaming revenue.</p>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono text-zinc-400">LVL {state.internet_level}</span>
                      <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold text-zinc-300">UPGRADE (5000)</button>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex items-center gap-6">
                  <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-400">
                    <Coffee size={32} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-bold uppercase">Lechon / Pares</h3>
                    <p className="text-xs text-zinc-500 mb-4">Temporary boost to Mental Strength and faster energy recovery.</p>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono text-zinc-400">LVL {state.food_level}</span>
                      <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold text-zinc-300">BUY (1000)</button>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex items-center gap-6">
                  <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-400">
                    <Users size={32} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-bold uppercase">Collection Slots</h3>
                    <p className="text-xs text-zinc-500 mb-4">+1 player slot per 10,000 coins. Current: {state.collection_slots ?? 8}.</p>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono text-zinc-400">{players.length} / {state.collection_slots ?? 8} used</span>
                      <button 
                        onClick={handleExpandCollection}
                        disabled={state.coins < 10000}
                        className="px-4 py-2 bg-amber-500 text-black hover:bg-amber-400 rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        EXPAND (10,000)
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer / Soundboard teaser */}
      <footer className="max-w-7xl mx-auto p-8 border-t border-zinc-900 mt-12 flex flex-col md:flex-row justify-between items-center gap-4 text-zinc-600">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} />
          <span className="text-[10px] uppercase tracking-widest font-bold">Soundboard coming soon</span>
        </div>
        <p className="text-[10px] uppercase tracking-widest font-bold">© 2026 KUKUYS MASTER ENTERTAINMENT</p>
      </footer>
    </div>
  );
}
