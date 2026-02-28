import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("kukuy_master.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS game_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    coins INTEGER DEFAULT 1000,
    internet_level INTEGER DEFAULT 1,
    food_level INTEGER DEFAULT 1,
    collection_slots INTEGER DEFAULT 8,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT,
    tier TEXT,
    drafting INTEGER,
    mechanics INTEGER,
    mental_strength INTEGER,
    leadership INTEGER,
    trashtalk INTEGER,
    energy INTEGER DEFAULT 100,
    is_roster INTEGER DEFAULT 0,
    is_streaming INTEGER DEFAULT 0,
    image_url TEXT
  );

  INSERT OR IGNORE INTO game_state (id, coins) VALUES (1, 1000);
`);

// Migration: add image_url if missing (e.g. existing DBs)
try {
  const cols = db.prepare("PRAGMA table_info(players)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "image_url")) {
    db.exec("ALTER TABLE players ADD COLUMN image_url TEXT");
  }
} catch (_) {}
try {
  const stateCols = db.prepare("PRAGMA table_info(game_state)").all() as { name: string }[];
  if (!stateCols.some((c) => c.name === "collection_slots")) {
    db.exec("ALTER TABLE game_state ADD COLUMN collection_slots INTEGER DEFAULT 8");
    const count = (db.prepare("SELECT COUNT(*) as c FROM players").get() as any).c;
    const initialSlots = Math.max(8, count);
    db.prepare("UPDATE game_state SET collection_slots = ? WHERE id = 1").run(initialSlots);
  }
} catch (_) {}

// One-time: reset collection_slots to new rule (8 base, +1 per 10k). Keep at least 8 or current player count.
try {
  const row = db.prepare("SELECT collection_slots FROM game_state WHERE id = 1").get() as { collection_slots: number } | undefined;
  const count = (db.prepare("SELECT COUNT(*) as c FROM players").get() as { c: number }).c;
  if (row && row.collection_slots > 8) {
    const newSlots = Math.max(8, count);
    db.prepare("UPDATE game_state SET collection_slots = ? WHERE id = 1").run(newSlots);
  }
} catch (_) {}
try {
  const cols = db.prepare("PRAGMA table_info(players)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "team")) {
    db.exec("ALTER TABLE players ADD COLUMN team TEXT");
  }
} catch (_) {}
try {
  const cols = db.prepare("PRAGMA table_info(players)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "grinding_until")) {
    db.exec("ALTER TABLE players ADD COLUMN grinding_until INTEGER");
  }
} catch (_) {}
try {
  const cols = db.prepare("PRAGMA table_info(players)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "sleeping_until")) {
    db.exec("ALTER TABLE players ADD COLUMN sleeping_until INTEGER");
  }
} catch (_) {}
try {
  const cols = db.prepare("PRAGMA table_info(players)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "role")) {
    db.exec("ALTER TABLE players ADD COLUMN role TEXT");
  }
} catch (_) {}

const DOTA2_ROLES = ["Carry", "Mid", "Offlane", "Soft Support", "Hard Support"] as const;

// Backfill role for existing players
try {
  const needsRole = db.prepare("SELECT id FROM players WHERE role IS NULL OR role = ''").all() as { id: string }[];
  const stmt = db.prepare("UPDATE players SET role = ? WHERE id = ?");
  for (const p of needsRole) {
    stmt.run(DOTA2_ROLES[Math.floor(Math.random() * DOTA2_ROLES.length)], p.id);
  }
} catch (_) {}

const GRIND_DURATION_MS = 5 * 60 * 1000; // 5 minutes, cannot interrupt
const SLEEP_DURATION_MS = 5 * 60 * 1000; // 5 minutes, cannot interrupt
const SLEEP_ENERGY_GAIN = 20;

function resolveExpiredGrinds(): void {
  const now = Date.now();
  const grinding = db.prepare("SELECT id, grinding_until, mechanics, mental_strength, tier FROM players WHERE grinding_until IS NOT NULL AND grinding_until <= ?").all(now) as { id: string; grinding_until: number; mechanics: number; mental_strength: number; tier: string }[];
  for (const p of grinding) {
    const caps = TIER_STAT_CAPS[p.tier] ?? TIER_STAT_CAPS.Common;
    const gain = Math.random() < 0.5; // 50% +2/+1, 50% -2/-1
    const newMechanics = gain
      ? Math.min((p.mechanics ?? 0) + 2, caps.mechanics)
      : Math.max(0, (p.mechanics ?? 0) - 2);
    const newMental = gain
      ? Math.min((p.mental_strength ?? 0) + 1, caps.mental)
      : Math.max(0, (p.mental_strength ?? 0) - 1);
    db.prepare("UPDATE players SET mechanics = ?, mental_strength = ?, grinding_until = NULL WHERE id = ?").run(newMechanics, newMental, p.id);
  }
}

function resolveExpiredSleeps(): void {
  const now = Date.now();
  const sleeping = db.prepare("SELECT id, energy FROM players WHERE sleeping_until IS NOT NULL AND sleeping_until <= ?").all(now) as { id: string; energy: number }[];
  for (const p of sleeping) {
    const newEnergy = Math.min(100, (p.energy ?? 0) + SLEEP_ENERGY_GAIN);
    db.prepare("UPDATE players SET energy = ?, sleeping_until = NULL WHERE id = ?").run(newEnergy, p.id);
  }
}

const LIQUIPEDIA_API = "https://liquipedia.net/dota2/api.php";
const imageCache = new Map<string, { url: string; expiry: number }>();
const teamCache = new Map<string, { team: string; expiry: number }>();
const roleCache = new Map<string, { role: string; expiry: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Liquipedia MediaWiki API: max 1 req/2s general, 1 req/30s for action=parse. See https://liquipedia.net/api-terms-of-use
const LIQUIPEDIA_RATE_MS = 2100;
const LIQUIPEDIA_PARSE_RATE_MS = 31000;
const LIQUIPEDIA_USER_AGENT = "KukuysMaster/1.0 (Dota 2 Manager; https://github.com/hancesooome/kukuys-master)";
let lastLiquipediaCall = 0;
let lastLiquipediaParseCall = 0;

async function waitLiquipediaRateLimit(isParse: boolean): Promise<void> {
  const now = Date.now();
  if (isParse) {
    const wait = Math.max(0, lastLiquipediaParseCall + LIQUIPEDIA_PARSE_RATE_MS - now);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastLiquipediaParseCall = Date.now();
  } else {
    const wait = Math.max(0, lastLiquipediaCall + LIQUIPEDIA_RATE_MS - now);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastLiquipediaCall = Date.now();
  }
}

async function fetchLiquipedia(url: string, isParse = false): Promise<Response> {
  await waitLiquipediaRateLimit(isParse);
  return fetch(url, {
    headers: {
      "User-Agent": LIQUIPEDIA_USER_AGENT,
      "Accept": "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
  });
}

/** Rate-limited Liquipedia API fetch; returns parsed JSON or null. */
async function fetchLiquipediaJson(url: string, isParse = false): Promise<unknown> {
  const res = await fetchLiquipedia(url, isParse);
  const text = await res.text();
  const trimmed = text.trim();
  if (!res.ok || !trimmed || trimmed.startsWith("<")) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Fetch URL and parse as JSON; if server returns HTML (e.g. error/captcha page), return null to avoid parse errors. */
async function fetchJson(url: string, opts?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...opts,
    headers: { "User-Agent": LIQUIPEDIA_USER_AGENT, "Accept-Encoding": "gzip, deflate", ...opts?.headers as Record<string, string> },
  });
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith("<")) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function getLiquipediaPlayerImage(name: string): Promise<string | null> {
  const cached = imageCache.get(name);
  if (cached && cached.expiry > Date.now()) return cached.url;

  try {
    const title = encodeURIComponent(name.replace(/ /g, "_"));
    const playerPrefix = `File:${name} `;
    const playerPrefixAlt = `File:${name}_`;
    const matches = (img: { title: string }) =>
      img.title.startsWith(playerPrefix) ||
      img.title.startsWith(playerPrefixAlt) ||
      img.title === `File:${name}.png` ||
      img.title === `File:${name}.jpg`;

    let portrait: { title: string } | null = null;
    let imcontinue: string | undefined;
    let continueParam: string | undefined;
    do {
      const q = new URLSearchParams();
      q.set("action", "query");
      q.set("titles", name.replace(/ /g, "_"));
      q.set("prop", "images");
      q.set("format", "json");
      q.set("origin", "*");
      q.set("imlimit", "50");
      if (imcontinue) q.set("imcontinue", imcontinue);
      if (continueParam) q.set("continue", continueParam);
      const listData = await fetchLiquipediaJson(`${LIQUIPEDIA_API}?${q.toString()}`, false) as any;
      if (!listData?.query?.pages) break;
      const page = Object.values(listData.query.pages)[0] as { images?: { title: string }[] };
      const images = page?.images ?? [];
      portrait = images.find(matches) ?? null;
      const cont = listData?.continue;
      imcontinue = cont?.imcontinue;
      continueParam = cont?.continue;
    } while (!portrait && imcontinue);

    if (!portrait) return null;

    const fileTitle = encodeURIComponent(portrait.title);
    const infoData = await fetchLiquipediaJson(
      `${LIQUIPEDIA_API}?action=query&titles=${fileTitle}&prop=imageinfo&iiprop=url&format=json&origin=*`,
      false
    ) as unknown;
    const infoPages = (infoData as any)?.query?.pages;
    if (!infoPages) return null;
    const infoPage = Object.values(infoPages)[0] as { imageinfo?: { url: string }[] };
    const url = infoPage?.imageinfo?.[0]?.url ?? null;
    if (url) {
      imageCache.set(name, { url, expiry: Date.now() + CACHE_TTL_MS });
    }
    return url;
  } catch (e) {
    console.warn("Liquipedia image fetch failed for", name, (e instanceof Error ? e.message : String(e)));
    return null;
  }
}

async function getLiquipediaPlayerTeam(name: string): Promise<string | null> {
  const cached = teamCache.get(name);
  if (cached && cached.expiry > Date.now()) return cached.team;

  const pageTitle = name.replace(/ /g, "_");

  const resolveRedirect = async (title: string): Promise<string> => {
    try {
      const d = await fetchLiquipediaJson(
        `${LIQUIPEDIA_API}?action=query&titles=${encodeURIComponent(title)}&redirects=1&format=json&origin=*`,
        false
      ) as { query?: { redirects?: { to: string }[]; pages?: Record<string, { title?: string }> } } | null;
      if (!d?.query) return title;
      const redirects = d.query.redirects;
      if (redirects?.[0]?.to) return redirects[0].to.replace(/ /g, "_");
      const pages = d.query.pages;
      if (pages) {
        const p = Object.values(pages)[0] as { title?: string };
        if (p?.title) return p.title.replace(/ /g, "_");
      }
    } catch (_) {}
    return title;
  };

  const tryParseForTeam = async (title: string): Promise<string | null> => {
    try {
      const parseData = await fetchLiquipediaJson(
        `${LIQUIPEDIA_API}?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json&origin=*`,
        true
      ) as { error?: { code: string }; parse?: { text?: { "*"?: string } } } | null;
      if (!parseData || parseData?.error?.code === "missingtitle") return null;
      let html = parseData?.parse?.text?.["*"];
      if (!html || typeof html !== "string") return null;
      html = html.replace(/&#160;|&nbsp;/g, " ");
      // "Team: OG" or "Team: PlayTime" etc. — stop at next known label or end of line
      const teamMatch = html.match(/Team:\s*([A-Za-z0-9_\s\.\-]+?)(?=\s+Alternate|\s+Approx|\s+Years|<\/|\n\n|$)/i);
      if (teamMatch && teamMatch[1]) {
        const team = teamMatch[1].trim();
        if (team.length > 0 && team.length < 80) return team;
      }
      // "Present  OG" or "Present  Execration" in history
      const presentMatch = html.match(/Present\s+([A-Za-z0-9_\s\.\-]+?)(?=\s+Recent|\s+Upcoming|\s+\d{4}|$)/i);
      if (presentMatch && presentMatch[1]) {
        const team = presentMatch[1].trim();
        if (team.length > 0 && team.length < 80 && !/^\d/.test(team)) return team;
      }
    } catch (_) {}
    return null;
  };

  try {
    const data = await fetchLiquipediaJson(
      `${LIQUIPEDIA_API}?action=query&titles=${encodeURIComponent(pageTitle)}&prop=revisions&rvprop=content&rvslots=main&format=json&origin=*&redirects=1`,
      false
    ) as { query?: { pages?: Record<string, { revisions?: { slots?: { main?: { "*"?: string } } }[] }> } } | null;
    if (data?.query?.pages) {
      const pages = data.query.pages;
      if (pages && typeof pages === "object") {
        const page = Object.values(pages)[0] as { revisions?: { slots?: { main?: { "*"?: string } } }[] };
        const wikitext = page?.revisions?.[0]?.slots?.main?.["*"];
        if (wikitext && typeof wikitext === "string") {
          const linked = wikitext.match(/\|team\s*=\s*\[\[([^\]|]+)/i);
          if (linked && linked[1] && !linked[1].startsWith("{{")) {
            const team = linked[1].trim();
            if (team.length > 0 && team.length < 120) {
              teamCache.set(name, { team, expiry: Date.now() + CACHE_TTL_MS });
              return team;
            }
          }
          const plain = wikitext.match(/\|team\s*=\s*([^\n|\[]+)/i);
          if (plain && plain[1]) {
            const t = plain[1].trim();
            if (t.length > 0 && !t.includes("{{") && t.length < 120) {
              teamCache.set(name, { team: t, expiry: Date.now() + CACHE_TTL_MS });
              return t;
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn("Liquipedia team fetch failed for", name, (e instanceof Error ? e.message : String(e)));
  }

  const resolvedTitle = await resolveRedirect(pageTitle);
  let team = await tryParseForTeam(resolvedTitle);
  if (team) {
    teamCache.set(name, { team, expiry: Date.now() + CACHE_TTL_MS });
    return team;
  }
  if (resolvedTitle !== pageTitle) team = await tryParseForTeam(pageTitle);
  if (team) {
    teamCache.set(name, { team, expiry: Date.now() + CACHE_TTL_MS });
    return team;
  }
  const fallback = KNOWN_PLAYER_TEAMS[name];
  if (fallback) {
    teamCache.set(name, { team: fallback, expiry: Date.now() + CACHE_TTL_MS });
    return fallback;
  }
  teamCache.set(name, { team: "Kukuys", expiry: Date.now() + CACHE_TTL_MS });
  return "Kukuys";
}

/** Map Liquipedia role string to our DOTA2_ROLES. Returns null if not mappable (e.g. Coach). Check order matters: offlane before support. */
function mapLiquipediaRoleToOurs(raw: string): string | null {
  let s = raw.toLowerCase().replace(/[\[\]{}]/g, "").trim();
  // {{RoleIcon|Offlaner}} → take part after last |
  if (s.includes("|")) s = s.split("|").pop()?.trim() ?? s;
  if (/^coach$/i.test(s)) return null;
  // Offlane/Offlaner before generic "support" (e.g. "Offlaner/Carry" must map to Offlane)
  if (/\bofflane|\bofflaner|position\s*3|pos\s*3|pos3/i.test(s)) return "Offlane";
  if (/\bcarry|position\s*1|pos\s*1|pos1|hard\s*carry/i.test(s)) return "Carry";
  if (/\bmid|\bmiddle|position\s*2|pos\s*2|pos2/i.test(s)) return "Mid";
  if (/soft\s*support|position\s*4|pos\s*4|pos4/i.test(s)) return "Soft Support";
  if (/hard\s*support|position\s*5|pos\s*5|pos5|\bsupport\b/i.test(s)) return "Hard Support";
  return null;
}

async function getLiquipediaPlayerRole(name: string): Promise<string | null> {
  const cached = roleCache.get(name);
  if (cached && cached.expiry > Date.now()) return cached.role;

  const pageTitle = name.replace(/ /g, "_");

  try {
    const data = await fetchLiquipediaJson(
      `${LIQUIPEDIA_API}?action=query&titles=${encodeURIComponent(pageTitle)}&prop=revisions&rvprop=content&rvslots=main&format=json&origin=*&redirects=1`,
      false
    ) as { query?: { pages?: Record<string, { revisions?: { slots?: { main?: { "*"?: string } } }[] }> } } | null;
    if (data?.query?.pages) {
      const pages = data.query.pages;
      const page = Object.values(pages)[0] as { revisions?: { slots?: { main?: { "*"?: string } } }[] };
      const wikitext = page?.revisions?.[0]?.slots?.main?.["*"];
      if (wikitext && typeof wikitext === "string") {
        // |role= or |roles= — [[Offlaner]]/[[Carry]], [[Offlaner]] [[Carry]], or plain text
        const roleLine = wikitext.match(/\|roles?\s*=\s*(.+?)(?:\n\||$)/is);
        if (roleLine && roleLine[1]) {
          const raw = roleLine[1].trim();
          // Extract first role from [[Offlaner]]/[[Carry]] or [[Offlaner]] [[Carry]] or [[Offlaner]]
          const firstLink = raw.match(/\[\[([^\]|]+)\]\]/);
          const firstRole = firstLink ? firstLink[1] : raw.split(/[\/\[\]]/)[0]?.trim() || raw;
          const mapped = mapLiquipediaRoleToOurs(firstRole);
          if (mapped) {
            roleCache.set(name, { role: mapped, expiry: Date.now() + CACHE_TTL_MS });
            return mapped;
          }
        }
      }
    }
  } catch (e) {
    console.warn("Liquipedia role fetch failed for", name, (e instanceof Error ? e.message : String(e)));
  }

  return null;
}

process.on("uncaughtException", (err) => console.error("UNCAUGHT:", err));
process.on("unhandledRejection", (err) => console.error("UNHANDLED:", err));

const app = express();
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`→ ${req.method} ${req.url}`);
  next();
});

// CORS: allow Vercel frontend to call this API when deployed separately
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

let backfillRunning = false;
async function backfillPlayerPhotos() {
  if (backfillRunning) return;
  const needPhoto = db.prepare("SELECT id, name FROM players WHERE image_url IS NULL OR image_url = ''").all() as { id: string; name: string }[];
  if (needPhoto.length === 0) return;
  backfillRunning = true;
  for (const p of needPhoto) {
    try {
      const url = await getLiquipediaPlayerImage(p.name);
      if (url) {
        db.prepare("UPDATE players SET image_url = ? WHERE id = ?").run(url, p.id);
        console.log("Backfill photo:", p.name);
      }
    } catch (_) {}
  }
  backfillRunning = false;
}

async function backfillPlayerTeams() {
  const needTeam = db.prepare("SELECT id, name FROM players WHERE team IS NULL OR team = ''").all() as { id: string; name: string }[];
  for (const p of needTeam) {
    try {
      const team = await getLiquipediaPlayerTeam(p.name);
      if (team) {
        db.prepare("UPDATE players SET team = ? WHERE id = ?").run(team, p.id);
        console.log("Backfill team:", p.name, "->", team);
      }
    } catch (_) {}
  }
}

// API Routes
app.get("/api/state", (req, res) => {
  resolveExpiredGrinds();
  resolveExpiredSleeps();
  const state = db.prepare("SELECT * FROM game_state WHERE id = 1").get();
  const players = db.prepare("SELECT * FROM players").all();
  res.json({ state, players });
  // Do not run backfill here — it triggers many Liquipedia requests and can get the IP blocked. Use LOAD PHOTOS / REFRESH TEAMS or wait for scheduled backfill.
});

function addTestCoins(req: any, res: any) {
  const amount = 10000;
  db.prepare("UPDATE game_state SET coins = coins + ? WHERE id = 1").run(amount);
  const state = db.prepare("SELECT * FROM game_state WHERE id = 1").get();
  res.json({ success: true, state, added: amount });
}
app.post("/api/add-test-coins", addTestCoins);
app.get("/api/add-test-coins", addTestCoins);

app.get("/api/refresh-player-image", async (req, res) => {
  const playerId = req.query.playerId as string;
  if (!playerId?.trim()) return res.status(400).json({ error: "Missing playerId" });
  const player = db.prepare("SELECT id, name, image_url FROM players WHERE id = ?").get(playerId) as any;
  if (!player) return res.status(404).json({ error: "Player not found" });
  const imageUrl = await getLiquipediaPlayerImage(player.name);
  if (imageUrl) {
    db.prepare("UPDATE players SET image_url = ? WHERE id = ?").run(imageUrl, playerId);
  }
  const updated = db.prepare("SELECT * FROM players WHERE id = ?").get(playerId);
  res.json({ success: true, player: updated, image_url: imageUrl || player.image_url });
});

app.get("/api/refresh-player-team", async (req, res) => {
  const playerId = req.query.playerId as string;
  if (!playerId?.trim()) return res.status(400).json({ error: "Missing playerId" });
  const player = db.prepare("SELECT id, name, team FROM players WHERE id = ?").get(playerId) as any;
  if (!player) return res.status(404).json({ error: "Player not found" });
  const team = await getLiquipediaPlayerTeam(player.name);
  if (team != null) {
    db.prepare("UPDATE players SET team = ? WHERE id = ?").run(team, playerId);
  }
  const updated = db.prepare("SELECT * FROM players WHERE id = ?").get(playerId);
  res.json({ success: true, player: updated, team: team ?? updated.team });
});

app.post("/api/backfill-teams", async (req, res) => {
  await backfillPlayerTeams();
  const players = db.prepare("SELECT * FROM players").all();
  res.json({ success: true, players });
});

app.get("/api/image-proxy", async (req, res) => {
  let url = (req.query.url as string)?.trim();
  if (!url) return res.status(400).send("Missing url");
  if (!url.startsWith("http")) {
    try {
      url = decodeURIComponent(url);
    } catch (_) {}
  }
  if (!url.startsWith("https://liquipedia.net/") && !url.startsWith("http://liquipedia.net/")) {
    return res.status(400).send("Invalid url");
  }
  try {
    const imgRes = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/*",
        "Referer": "https://liquipedia.net/",
      },
    });
    if (!imgRes.ok) return res.status(imgRes.status).send("Upstream error");
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    res.setHeader("content-type", contentType);
    res.setHeader("cache-control", "public, max-age=86400");
    const buf = await imgRes.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (e) {
    console.warn("Image proxy error", url.slice(0, 50), e);
    res.status(502).send("Proxy error");
  }
});

app.post("/api/backfill-photos", async (req, res) => {
  const needPhoto = db.prepare("SELECT id, name FROM players WHERE image_url IS NULL OR image_url = ''").all() as { id: string; name: string }[];
  const results: { name: string; ok: boolean }[] = [];
  for (const p of needPhoto) {
    try {
      const url = await getLiquipediaPlayerImage(p.name);
      if (url) {
        db.prepare("UPDATE players SET image_url = ? WHERE id = ?").run(url, p.id);
        results.push({ name: p.name, ok: true });
        console.log("Photo loaded:", p.name);
      } else {
        results.push({ name: p.name, ok: false });
      }
    } catch (e) {
      results.push({ name: p.name, ok: false });
    }
  }
  const players = db.prepare("SELECT * FROM players").all();
  res.json({ success: true, players, results });
});

app.post("/api/recruit", async (req, res) => {
  const state = db.prepare("SELECT coins, collection_slots FROM game_state WHERE id = 1").get() as any;
  if (state.coins < 200) return res.status(400).json({ error: "Not enough coins" });
  const playerCount = (db.prepare("SELECT COUNT(*) as c FROM players").get() as any).c;
  const slots = state.collection_slots ?? 8;
  if (playerCount >= slots) return res.status(400).json({ error: "Collection full. Buy more slots in Shop (10,000)." });

  // Gacha: use RECRUIT_RATES and RECRUIT_POOL (same as Rates tab)
  const rand = Math.random() * 100;
  let cumulative = 0;
  let tier = RECRUIT_RATES[0].tier;
  for (const { tier: t, rate } of RECRUIT_RATES) {
    cumulative += rate;
    if (rand < cumulative) {
      tier = t;
      break;
    }
  }

  const nameList = RECRUIT_POOL[tier] ?? RECRUIT_POOL.Common;
  const name = nameList[Math.floor(Math.random() * nameList.length)];
  const id = `${name}_${Date.now()}`;

  const base = tier === "Mythic" ? 45 : tier === "Legendary" ? 38 : tier === "Epic" ? 28 : tier === "Rare" ? 15 : 5;
  const stats = {
    drafting: Math.floor(Math.random() * 25) + base,
    mechanics: Math.floor(Math.random() * 25) + base,
    mental_strength: Math.floor(Math.random() * 25) + base,
    leadership: Math.floor(Math.random() * 25) + base,
    trashtalk: Math.floor(Math.random() * 100),
  };

  const role = DOTA2_ROLES[Math.floor(Math.random() * DOTA2_ROLES.length)];

  db.prepare(`
    INSERT INTO players (id, name, tier, role, drafting, mechanics, mental_strength, leadership, trashtalk, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, tier, role, stats.drafting, stats.mechanics, stats.mental_strength, stats.leadership, stats.trashtalk, null);

  db.prepare("UPDATE game_state SET coins = coins - 200 WHERE id = 1").run();

  const playerRow = db.prepare("SELECT * FROM players WHERE id = ?").get(id) as any;
  res.json({ player: playerRow ? { ...playerRow, energy: 100 } : { id, name, tier, role, ...stats, energy: 100 } });

  // Liquipedia fetches in background — no blocking; client refreshes via fetchData
  (async () => {
    try {
      const [liquipediaRole, imageUrl, team] = await Promise.all([
        getLiquipediaPlayerRole(name),
        getLiquipediaPlayerImage(name),
        getLiquipediaPlayerTeam(name),
      ]);
      if (liquipediaRole) db.prepare("UPDATE players SET role = ? WHERE id = ?").run(liquipediaRole, id);
      if (imageUrl) db.prepare("UPDATE players SET image_url = ? WHERE id = ?").run(imageUrl, id);
      if (team != null) db.prepare("UPDATE players SET team = ? WHERE id = ?").run(team, id);
    } catch (_) {}
  })();
});

const SLOT_EXPAND_COST = 10000;
const SLOT_EXPAND_AMOUNT = 1;

app.post("/api/expand-collection", (req, res) => {
  const state = db.prepare("SELECT coins, collection_slots FROM game_state WHERE id = 1").get() as any;
  if (!state) return res.status(500).json({ error: "No game state" });
  if (state.coins < SLOT_EXPAND_COST) return res.status(400).json({ error: "Not enough coins. Need 10,000." });
  db.prepare("UPDATE game_state SET coins = coins - ?, collection_slots = collection_slots + ? WHERE id = 1").run(SLOT_EXPAND_COST, SLOT_EXPAND_AMOUNT);
  const newState = db.prepare("SELECT * FROM game_state WHERE id = 1").get();
  res.json({ success: true, state: newState });
});

const RECYCLE_COINS = 10;

// Grind can improve stats up to these caps per tier — so a Common can't outgrow a Mythic
const TIER_STAT_CAPS: Record<string, { mechanics: number; mental: number }> = {
  Common: { mechanics: 40, mental: 40 },
  Rare: { mechanics: 55, mental: 55 },
  Epic: { mechanics: 70, mental: 70 },
  Legendary: { mechanics: 85, mental: 85 },
  Mythic: { mechanics: 99, mental: 99 },
  "Ultra Rare": { mechanics: 70, mental: 70 },
};

// Recruit gacha: single source of truth for rates and pool (must match Rates tab)
const RECRUIT_RATES = [
  { tier: "Common", rate: 45 },
  { tier: "Rare", rate: 28 },
  { tier: "Epic", rate: 14 },
  { tier: "Legendary", rate: 10 },
  { tier: "Mythic", rate: 3 },
] as const;

const RECRUIT_POOL: Record<string, string[]> = {
  Common: ["Hubris", "Lashsegway", "Sunshine", "Chupaeng", "Alo", "Badong", "SirCherry"],
  Rare: ["Nevertheless", "Joevy", "JTZ", "Sep", "Mepweet", "Jabolero"],
  Epic: ["Kokz", "Yowe", "JG", "Jwl", "Jing", "Abat"],
  Legendary: ["Gabbi", "Armel", "Palos", "Karl", "Tino", "Natsumi", "Skem", "Nikko"],
  Mythic: ["Kuku", "DJ", "Tims"],
};

// Fallback when Liquipedia API returns HTML or fails — keeps teams correct for known players
const KNOWN_PLAYER_TEAMS: Record<string, string> = {
  Tims: "OG",
  Palos: "Execration",
  DJ: "PlayTime",
  Kuku: "Kukuys",
  Gabbi: "Execration",
  Armel: "Blacklist International",
  Karl: "T1",
  Tino: "Team Secret",
  Natsumi: "Talon Esports",
  Skem: "Bleed Esports",
  Nikko: "BOOM Esports",
  Kokz: "Omega Gaming",
  Yowe: "Motivate.Trust",
  JG: "Omega Gaming",
  Jwl: "Team Zero",
  Jing: "Neon Esports",
  Abat: "Talon Esports",
  Nevertheless: "Kukuys",
  Joevy: "Kukuys",
  JTZ: "Kukuys",
  Sep: "Kukuys",
  Mepweet: "Kukuys",
  Jabolero: "Kukuys",
  Hubris: "Kukuys",
  Lashsegway: "Kukuys",
  Sunshine: "Kukuys",
  Chupaeng: "Kukuys",
  Alo: "Kukuys",
  Badong: "Kukuys",
  SirCherry: "Kukuys",
};

app.get("/api/recruit-config", (req, res) => {
  res.json({ rates: RECRUIT_RATES, pool: RECRUIT_POOL });
});

// Remove all players and reset game state so only gacha (Player pool per tier) can be recruited
app.post("/api/reset-collection", (req, res) => {
  try {
    db.prepare("DELETE FROM players").run();
    db.prepare(`
      UPDATE game_state SET coins = 1000, collection_slots = 8, internet_level = 1, food_level = 1, last_updated = CURRENT_TIMESTAMP WHERE id = 1
    `).run();
    const state = db.prepare("SELECT * FROM game_state WHERE id = 1").get();
    const players = db.prepare("SELECT * FROM players").all();
    return res.json({ success: true, state, players });
  } catch (e) {
    console.error("Reset collection error:", e);
    return res.status(500).json({ error: "Reset failed: " + (e instanceof Error ? e.message : String(e)) });
  }
});

app.post("/api/recycle-player", (req, res) => {
  try {
    const playerId = req.body?.playerId;
    if (playerId == null || String(playerId).trim() === "") {
      return res.status(400).json({ error: "Missing player ID" });
    }
    const player = db.prepare("SELECT * FROM players WHERE id = ?").get(playerId) as any;
    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }
    db.prepare("DELETE FROM players WHERE id = ?").run(playerId);
    db.prepare("UPDATE game_state SET coins = coins + ? WHERE id = 1").run(RECYCLE_COINS);
    const state = db.prepare("SELECT * FROM game_state WHERE id = 1").get();
    const players = db.prepare("SELECT * FROM players").all();
    return res.json({ success: true, state, players });
  } catch (e) {
    console.error("Recycle error:", e);
    return res.status(500).json({ error: "Recycle failed: " + (e instanceof Error ? e.message : String(e)) });
  }
});

app.post("/api/action", (req, res) => {
  const { playerId, action } = req.body;
  const player = db.prepare("SELECT * FROM players WHERE id = ?").get(playerId) as any;
  if (!player) return res.status(404).json({ error: "Player not found" });

  if (action === "recycle") {
    db.prepare("DELETE FROM players WHERE id = ?").run(playerId);
    db.prepare("UPDATE game_state SET coins = coins + ? WHERE id = 1").run(RECYCLE_COINS);
    const state = db.prepare("SELECT * FROM game_state WHERE id = 1").get();
    const players = db.prepare("SELECT * FROM players").all();
    return res.json({ success: true, state, players });
  }

  if (action === "train") {
    if (player.energy < 20) return res.status(400).json({ error: "Too tired" });
    const now = Date.now();
    if (player.grinding_until != null && player.grinding_until > now) {
      return res.status(400).json({ error: "Grinding in progress. Cannot interrupt — wait until it finishes." });
    }
    if (player.sleeping_until != null && player.sleeping_until > now) {
      return res.status(400).json({ error: "Player is sleeping. Cannot interrupt — wait until they wake." });
    }
    const caps = TIER_STAT_CAPS[player.tier] ?? TIER_STAT_CAPS.Common;
    const atCap = (player.mechanics ?? 0) >= caps.mechanics && (player.mental_strength ?? 0) >= caps.mental;
    if (atCap) return res.status(400).json({ error: "Already at max for this tier. No room to improve." });
    db.prepare(`
      UPDATE players 
      SET energy = MAX(0, energy - 20),
          grinding_until = ?
      WHERE id = ?
    `).run(now + GRIND_DURATION_MS, playerId);
  } else if (action === "sleep") {
    const now = Date.now();
    if (player.grinding_until != null && player.grinding_until > now) {
      return res.status(400).json({ error: "Grinding in progress. Wait until it finishes before sleeping." });
    }
    if (player.sleeping_until != null && player.sleeping_until > now) {
      return res.status(400).json({ error: "Already sleeping. Cannot interrupt — wait until they wake." });
    }
    db.prepare("UPDATE players SET sleeping_until = ? WHERE id = ?").run(now + SLEEP_DURATION_MS, playerId);
  } else if (action === "toggle_stream") {
    db.prepare("UPDATE players SET is_streaming = 1 - is_streaming WHERE id = ?").run(playerId);
  } else if (action === "toggle_roster") {
    const rosterCount = db.prepare("SELECT COUNT(*) as count FROM players WHERE is_roster = 1").get() as any;
    if (player.is_roster === 0 && rosterCount.count >= 5) {
      return res.status(400).json({ error: "Roster full (max 5)" });
    }
    if (player.is_roster === 0) {
      const sameNameInRoster = db.prepare("SELECT id FROM players WHERE is_roster = 1 AND name = ? AND id != ?").get(player.name, playerId) as { id: string } | undefined;
      if (sameNameInRoster) {
        return res.status(400).json({ error: "That player is already in your roster (one copy per player)." });
      }
    }
    db.prepare("UPDATE players SET is_roster = 1 - is_roster WHERE id = ?").run(playerId);
  }

  resolveExpiredGrinds();
  resolveExpiredSleeps();
  const state = db.prepare("SELECT * FROM game_state WHERE id = 1").get();
  const players = db.prepare("SELECT * FROM players").all();
  res.json({ success: true, state, players });
});

const REAL_TEAMS = [
  "Team Spirit", "Gaimin Gladiators", "Team Falcons", "Tundra Esports",
  "T1", "Talon Esports", "Team Secret", "OG", "Virtus.pro", "Natus Vincere",
  "Entity", "LGD Gaming", "Xtreme Gaming", "Azure Ray", "Team Liquid",
  "Evil Geniuses", "beastcoast", "Thunder Awaken", "PSG.Quest", "9Pandas",
];

const REAL_TOURNAMENTS = [
  "The International", "Riyadh Masters", "ESL One", "DreamLeague",
  "Bali Major", "Berlin Major", "BetBoom Dacha", "BB Dacha",
  "Predator League", "PGL Wallachia", "IEM Katowice",
];

app.get("/api/teams", (req, res) => {
  res.json({ teams: REAL_TEAMS });
});

app.get("/api/tournaments", (req, res) => {
  res.json({ tournaments: REAL_TOURNAMENTS });
});

const KUKUYS_TEAM = "Kukuys";
const CHAMPION_COINS = 1000;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Single map: P(A wins) = ratingA / (ratingA + ratingB). */
function simulateMap(t1: { name: string; rating: number }, t2: { name: string; rating: number }): string {
  const r1 = Math.max(1, t1.rating);
  const r2 = Math.max(1, t2.rating);
  return Math.random() < r1 / (r1 + r2) ? t1.name : t2.name;
}

/** BO3: first to 2 map wins. Returns winner and per-map results. */
function simulateBO3(
  t1: { name: string; rating: number },
  t2: { name: string; rating: number }
): { winner: string; winnerRating: number; team1Odds: number; team2Odds: number; mapResults: string[] } {
  const r1 = Math.max(1, t1.rating);
  const r2 = Math.max(1, t2.rating);
  const team1Odds = Math.round((r1 / (r1 + r2)) * 100);
  const team2Odds = 100 - team1Odds;
  const mapResults: string[] = [];
  let wins1 = 0, wins2 = 0;
  while (wins1 < 2 && wins2 < 2) {
    const mapWinner = simulateMap(t1, t2);
    mapResults.push(mapWinner);
    if (mapWinner === t1.name) wins1++; else wins2++;
  }
  const winner = wins1 >= 2 ? t1.name : t2.name;
  const winnerRating = winner === t1.name ? r1 : r2;
  return { winner, winnerRating, team1Odds, team2Odds, mapResults };
}

/** BO5: first to 3 map wins. Used for Grand Final only. */
function simulateBO5(
  t1: { name: string; rating: number },
  t2: { name: string; rating: number }
): { winner: string; winnerRating: number; team1Odds: number; team2Odds: number; mapResults: string[] } {
  const r1 = Math.max(1, t1.rating);
  const r2 = Math.max(1, t2.rating);
  const team1Odds = Math.round((r1 / (r1 + r2)) * 100);
  const team2Odds = 100 - team1Odds;
  const mapResults: string[] = [];
  let wins1 = 0, wins2 = 0;
  while (wins1 < 3 && wins2 < 3) {
    const mapWinner = simulateMap(t1, t2);
    mapResults.push(mapWinner);
    if (mapWinner === t1.name) wins1++; else wins2++;
  }
  const winner = wins1 >= 3 ? t1.name : t2.name;
  const winnerRating = winner === t1.name ? r1 : r2;
  return { winner, winnerRating, team1Odds, team2Odds, mapResults };
}

interface BracketMatchResult {
  team1: string;
  team2: string;
  winner: string;
  team1Odds: number;
  team2Odds: number;
  mapResults: string[];
}

app.post("/api/tournament-run", (req, res) => {
  resolveExpiredGrinds();
  resolveExpiredSleeps();
  const roster = db.prepare("SELECT mechanics, drafting FROM players WHERE is_roster = 1").all() as { mechanics: number; drafting: number }[];
  if (roster.length < 5) {
    return res.status(400).json({ error: "Need 5 players in roster to enter the tournament." });
  }
  const now = Date.now();
  const grinding = db.prepare("SELECT id FROM players WHERE is_roster = 1 AND grinding_until IS NOT NULL AND grinding_until > ?").get(now);
  if (grinding) {
    return res.status(400).json({ error: "Someone is still grinding. Wait until all grind sessions finish." });
  }

  const kukuysSum = roster.reduce((acc, p) => acc + (p.mechanics ?? 0) + (p.drafting ?? 0), 0);
  const kukuysRating = Math.min(100, Math.max(20, Math.round(kukuysSum / 5)));
  const otherTeamNames = shuffle(REAL_TEAMS).slice(0, 7);
  const otherTeams: { name: string; rating: number }[] = otherTeamNames.map((name) => ({
    name,
    rating: 35 + Math.floor(Math.random() * 55),
  }));
  const allTeams: { name: string; rating: number }[] = shuffle([
    { name: KUKUYS_TEAM, rating: kukuysRating },
    ...otherTeams,
  ]);

  const rounds: { round: string; matches: BracketMatchResult[] }[] = [];

  // Upper Bracket Quarter Finals (4 matches)
  const ubQf: BracketMatchResult[] = [];
  const ubQfWinners: { name: string; rating: number }[] = [];
  const ubQfLosers: { name: string; rating: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const t1 = allTeams[i * 2];
    const t2 = allTeams[i * 2 + 1];
    const result = simulateBO3(t1, t2);
    ubQf.push({ team1: t1.name, team2: t2.name, winner: result.winner, team1Odds: result.team1Odds, team2Odds: result.team2Odds, mapResults: result.mapResults });
    ubQfWinners.push({ name: result.winner, rating: result.winnerRating });
    const loser = result.winner === t1.name ? t2 : t1;
    ubQfLosers.push({ name: loser.name, rating: loser.rating });
  }
  rounds.push({ round: "Upper Bracket — Quarter Finals", matches: ubQf });

  // Upper Bracket Semi Finals (2 matches)
  const ubSf: BracketMatchResult[] = [];
  const ubSfWinners: { name: string; rating: number }[] = [];
  const ubSfLosers: { name: string; rating: number }[] = [];
  for (let i = 0; i < 2; i++) {
    const t1 = ubQfWinners[i * 2];
    const t2 = ubQfWinners[i * 2 + 1];
    const result = simulateBO3(t1, t2);
    ubSf.push({ team1: t1.name, team2: t2.name, winner: result.winner, team1Odds: result.team1Odds, team2Odds: result.team2Odds, mapResults: result.mapResults });
    ubSfWinners.push({ name: result.winner, rating: result.winnerRating });
    const loser = result.winner === t1.name ? t2 : t1;
    ubSfLosers.push({ name: loser.name, rating: loser.rating });
  }
  rounds.push({ round: "Upper Bracket — Semi Finals", matches: ubSf });

  // Lower Bracket Round 1 (2 matches: L1vsL2, L3vsL4)
  const lbR1: BracketMatchResult[] = [];
  const lbR1Winners: { name: string; rating: number }[] = [];
  for (let i = 0; i < 2; i++) {
    const t1 = ubQfLosers[i * 2];
    const t2 = ubQfLosers[i * 2 + 1];
    const result = simulateBO3(t1, t2);
    lbR1.push({ team1: t1.name, team2: t2.name, winner: result.winner, team1Odds: result.team1Odds, team2Odds: result.team2Odds, mapResults: result.mapResults });
    lbR1Winners.push({ name: result.winner, rating: result.winnerRating });
  }
  rounds.push({ round: "Lower Bracket — Round 1", matches: lbR1 });

  // Lower Bracket Round 2 (2 matches: LB R1 winners vs UB SF losers)
  const lbR2: BracketMatchResult[] = [];
  const lbR2Winners: { name: string; rating: number }[] = [];
  for (let i = 0; i < 2; i++) {
    const t1 = lbR1Winners[i];
    const t2 = ubSfLosers[1 - i];
    const result = simulateBO3(t1, t2);
    lbR2.push({ team1: t1.name, team2: t2.name, winner: result.winner, team1Odds: result.team1Odds, team2Odds: result.team2Odds, mapResults: result.mapResults });
    lbR2Winners.push({ name: result.winner, rating: result.winnerRating });
  }
  rounds.push({ round: "Lower Bracket — Quarterfinals", matches: lbR2 });

  // Lower Bracket Round 3 (1 match: LB final)
  const lbR3Result = simulateBO3(lbR2Winners[0], lbR2Winners[1]);
  const lbWinner = lbR3Result.winner === lbR2Winners[0].name ? lbR2Winners[0] : lbR2Winners[1];
  rounds.push({
    round: "Lower Bracket — Semi Finals",
    matches: [{ team1: lbR2Winners[0].name, team2: lbR2Winners[1].name, winner: lbR3Result.winner, team1Odds: lbR3Result.team1Odds, team2Odds: lbR3Result.team2Odds, mapResults: lbR3Result.mapResults }],
  });

  // Upper Bracket Final
  const ubFinalResult = simulateBO3(ubSfWinners[0], ubSfWinners[1]);
  const ubWinner = ubFinalResult.winner === ubSfWinners[0].name ? ubSfWinners[0] : ubSfWinners[1];
  const ubFinalLoser = ubFinalResult.winner === ubSfWinners[0].name ? ubSfWinners[1] : ubSfWinners[0];
  rounds.push({
    round: "Upper Bracket — Final",
    matches: [{ team1: ubSfWinners[0].name, team2: ubSfWinners[1].name, winner: ubFinalResult.winner, team1Odds: ubFinalResult.team1Odds, team2Odds: ubFinalResult.team2Odds, mapResults: ubFinalResult.mapResults }],
  });

  // UB Final loser vs LB Final winner — winner goes to Grand Final
  const gfQualifierResult = simulateBO3(ubFinalLoser, lbWinner);
  const gfOpponent = gfQualifierResult.winner === lbWinner.name ? lbWinner : { name: ubFinalLoser.name, rating: ubFinalLoser.rating };
  rounds.push({
    round: "Lower Bracket — Finals",
    matches: [{ team1: ubFinalLoser.name, team2: lbWinner.name, winner: gfQualifierResult.winner, team1Odds: gfQualifierResult.team1Odds, team2Odds: gfQualifierResult.team2Odds, mapResults: gfQualifierResult.mapResults }],
  });

  // Grand Final: UB winner vs winner of (UB Final loser vs LB winner). BO5, single match — loser loses.
  const gfResult = simulateBO5(ubWinner, gfOpponent);
  const champion = gfResult.winner;
  rounds.push({
    round: "Grand Final",
    matches: [{ team1: ubWinner.name, team2: gfOpponent.name, winner: champion, team1Odds: gfResult.team1Odds, team2Odds: gfResult.team2Odds, mapResults: gfResult.mapResults }],
  });

  let coinsAwarded = 0;
  if (champion === KUKUYS_TEAM) {
    db.prepare("UPDATE game_state SET coins = coins + ? WHERE id = 1").run(CHAMPION_COINS);
    coinsAwarded = CHAMPION_COINS;
  }
  const state = db.prepare("SELECT * FROM game_state WHERE id = 1").get();
  const tournamentName = REAL_TOURNAMENTS[Math.floor(Math.random() * REAL_TOURNAMENTS.length)];
  res.json({
    tournamentName,
    rounds,
    champion,
    coinsAwarded,
    state,
  });
});

// Passive Income (Simplified for MVP)
setInterval(() => {
  try {
    const streamingPlayers = db.prepare("SELECT COUNT(*) as count FROM players WHERE is_streaming = 1").get() as any;
    const income = streamingPlayers.count * 10;
    if (income > 0) {
      db.prepare("UPDATE game_state SET coins = coins + ? WHERE id = 1").run(income);
    }
    db.prepare("UPDATE players SET energy = MAX(0, energy - 2) WHERE is_streaming = 1").run();
  } catch (e) { console.error("Passive income error:", e); }
}, 10000);

app.get("/health", (_req, res) => res.json({ ok: true }));

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    const fs = await import("fs");
    if (fs.existsSync(path.join(distPath, "index.html"))) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`NODE_ENV=${process.env.NODE_ENV}, PORT=${PORT}`);
    // Backfill disabled on Railway to avoid crashes; use LOAD PHOTOS / REFRESH TEAMS buttons instead.
    // setTimeout(backfillPlayerPhotos, 5000);
    // setTimeout(backfillPlayerTeams, 60000);
  });
}

startServer();
