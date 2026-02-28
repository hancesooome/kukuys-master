/**
 * sync-players.ts
 *
 * Run manually or via cron (once per day) to populate Supabase player_cache
 * with Liquipedia data (image, team, role) and upload photos to player-photos bucket.
 *
 * Usage:  npx tsx sync-players.ts
 *
 * Env:    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env)
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const LIQUIPEDIA_API = "https://liquipedia.net/dota2/api.php";
const UA = "KukuysMaster/1.0 (Dota 2 Manager; https://github.com/hancesooome/kukuys-master)";
const RATE_MS = 2200;
const PARSE_RATE_MS = 31000;
let lastCall = 0;
let lastParse = 0;

async function rateWait(isParse: boolean) {
  const now = Date.now();
  const wait = isParse
    ? Math.max(0, lastParse + PARSE_RATE_MS - now)
    : Math.max(0, lastCall + RATE_MS - now);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  if (isParse) lastParse = Date.now(); else lastCall = Date.now();
}

async function lpJson(url: string, isParse = false): Promise<any> {
  await rateWait(isParse);
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  const text = await res.text();
  if (!res.ok || text.trim().startsWith("<")) return null;
  try { return JSON.parse(text); } catch { return null; }
}

// Alternate Liquipedia page titles
const LP_TITLES: Record<string, string> = {
  Natsumi: "Natsumi-",
  Tims: "TIMS",
  Nikko: "Force_(Filipino_player)",
};

function lpTitle(name: string): string {
  return (LP_TITLES[name] ?? name).replace(/ /g, "_");
}

async function resolveFileUrl(fileTitle: string): Promise<string | null> {
  const d = await lpJson(`${LIQUIPEDIA_API}?action=query&titles=${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url&format=json&origin=*`);
  const pages = d?.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0] as any;
  return page?.imageinfo?.[0]?.url ?? null;
}

/** Fetch wikitext + image list in ONE call, extract image, team, role */
async function getPlayerData(name: string): Promise<{ imageUrl: string | null; team: string | null; role: string | null }> {
  const title = lpTitle(name);
  const result = { imageUrl: null as string | null, team: null as string | null, role: null as string | null };

  // Single API call: get wikitext AND images list together
  const d = await lpJson(`${LIQUIPEDIA_API}?action=query&titles=${encodeURIComponent(title)}&prop=revisions|images&rvprop=content&rvslots=main&imlimit=50&format=json&origin=*&redirects=1`);
  if (!d?.query?.pages) { console.warn(`  No page found for "${title}"`); return result; }

  const page = Object.values(d.query.pages)[0] as any;
  if (page.missing !== undefined) { console.warn(`  Page "${title}" does not exist`); return result; }

  const wikitext: string | undefined = page?.revisions?.[0]?.slots?.main?.["*"];
  const images: { title: string }[] = page?.images ?? [];

  // ── Extract team from wikitext ──
  if (wikitext) {
    const linked = wikitext.match(/\|team\s*=\s*\[\[([^\]|]+)/i);
    if (linked?.[1]?.trim()) {
      result.team = linked[1].trim();
    } else {
      const plain = wikitext.match(/\|team\s*=\s*([^\n|]+)/i);
      if (plain?.[1]?.trim() && !plain[1].includes("{{")) result.team = plain[1].trim();
    }

    // ── Extract role from wikitext ──
    const roleLine = wikitext.match(/\|roles?\s*=\s*(.+?)(?:\n\||$)/is);
    if (roleLine?.[1]) {
      const raw = roleLine[1].trim();
      const firstLink = raw.match(/\[\[([^\]|]+)\]\]/);
      const firstRole = firstLink ? firstLink[1] : raw.split(/[\/\[\]]/)[0]?.trim() || raw;
      result.role = mapRole(firstRole);
    }

    // ── Extract image: try |image= first ──
    const imageMatch = wikitext.match(/\|image\s*=\s*(.+?)(?:\n\||$)/i);
    if (imageMatch?.[1]) {
      let filename = imageMatch[1].trim();
      if (filename && !filename.startsWith("{{") && !filename.startsWith("<!--")) {
        if (!filename.startsWith("File:")) filename = `File:${filename}`;
        const url = await resolveFileUrl(filename);
        if (url) { result.imageUrl = url; return result; }
      }
    }
  }

  // ── Fallback: search page images for player portrait ──
  const displayName = LP_TITLES[name] ?? name;
  const matches = (img: { title: string }) =>
    img.title.startsWith(`File:${name} `) || img.title.startsWith(`File:${name}_`) ||
    img.title.startsWith(`File:${displayName} `) || img.title.startsWith(`File:${displayName}_`) ||
    img.title === `File:${name}.png` || img.title === `File:${name}.jpg` ||
    img.title === `File:${displayName}.png` || img.title === `File:${displayName}.jpg`;

  let portrait = images.find(matches) ?? null;

  // If not found and there are more images (continuation), fetch more
  if (!portrait && d?.continue?.imcontinue) {
    let imcontinue = d.continue.imcontinue;
    let cont = d.continue?.continue;
    while (!portrait && imcontinue) {
      const q = new URLSearchParams({ action: "query", titles: title, prop: "images", format: "json", origin: "*", imlimit: "50", redirects: "1" });
      q.set("imcontinue", imcontinue);
      if (cont) q.set("continue", cont);
      const ld = await lpJson(`${LIQUIPEDIA_API}?${q}`);
      if (!ld?.query?.pages) break;
      const pg = Object.values(ld.query.pages)[0] as any;
      portrait = pg?.images?.find(matches) ?? null;
      imcontinue = ld?.continue?.imcontinue;
      cont = ld?.continue?.continue;
    }
  }

  if (portrait) {
    const url = await resolveFileUrl(portrait.title);
    if (url) result.imageUrl = url;
  }

  return result;
}

function mapRole(raw: string): string | null {
  let s = raw.toLowerCase().replace(/[\[\]{}]/g, "").trim();
  if (s.includes("|")) s = s.split("|").pop()?.trim() ?? s;
  if (/^coach$/i.test(s)) return null;
  if (/\bofflane|\bofflaner|position\s*3|pos\s*3|pos3/i.test(s)) return "Offlaner";
  if (/\bcarry|position\s*1|pos\s*1|pos1|hard\s*carry/i.test(s)) return "Carry";
  if (/\bmid|\bmiddle|position\s*2|pos\s*2|pos2/i.test(s)) return "Midlaner";
  if (/soft\s*support|position\s*4|pos\s*4|pos4/i.test(s)) return "Support";
  if (/hard\s*support|position\s*5|pos\s*5|pos5|\bsupport\b/i.test(s)) return "Support";
  return null;
}

// ── Upload photo to Supabase Storage ──

function safeName(name: string) {
  return name.replace(/\s+/g, "_").replace(/[/\\?*:|"<>]/g, "").trim();
}

async function uploadPhoto(name: string, imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = imageUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[1] ?? "jpg";
    const filePath = `${safeName(name)}.${ext}`;
    const ct = res.headers.get("content-type") || "image/jpeg";

    const { error } = await supabase.storage
      .from("player-photos")
      .upload(filePath, buffer, { contentType: ct, upsert: true });

    if (error) {
      console.warn(`  Upload failed for ${name}:`, error.message);
      return null;
    }

    const { data } = supabase.storage.from("player-photos").getPublicUrl(filePath);
    return data.publicUrl;
  } catch (e) {
    console.warn(`  Upload error for ${name}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

// ── Main sync ──

const ALL_PLAYERS = [
  "Kuku", "DJ", "Tims",
  "Gabbi", "Armel", "Palos", "Karl", "Tino", "Natsumi", "Skem", "Nikko",
  "Kokz", "Yowe", "JG", "Jwl", "Jing", "Abat",
  "Nevertheless", "Joevy", "JTZ", "Sep", "Mepweet", "Jabolero",
  "Hubris", "Lashsegway", "Sunshine", "Chupaeng", "Alo", "Badong", "SirCherry",
];

const KICK_AVATARS: Record<string, string> = {
  Hubris: "https://files.kick.com/images/user/31622458/profile_image/conversion/163ddea4-45dd-4dbf-9070-8f70083a361e-fullsize.webp",
  Lashsegway: "https://files.kick.com/images/user/39293879/profile_image/conversion/fdd25c0f-88f8-4be9-bdd3-7c3d3b53d8d7-fullsize.webp",
  Sunshine: "https://files.kick.com/images/user/42196955/profile_image/conversion/d4d2bc18-08b2-4339-b8d3-2b4f0d1a3473-fullsize.webp",
  Chupaeng: "https://files.kick.com/images/user/42705215/profile_image/conversion/4cb4d173-effe-4e0e-bc0f-02334811b8de-fullsize.webp",
  Alo: "https://files.kick.com/images/user/31435000/profile_image/conversion/643beb3a-4ee0-41fe-99a1-3a02cc117edc-fullsize.webp",
  Nevertheless: "https://files.kick.com/images/user/808058/profile_image/conversion/ddbd7842-70c6-447e-94d4-31605c0ed9c3-fullsize.webp",
  Joevy: "https://files.kick.com/images/user/38764576/profile_image/conversion/72942de7-c40f-4ffa-8463-eac8f1c38c72-fullsize.webp",
  JTZ: "https://files.kick.com/images/user/31428137/profile_image/conversion/eb476e73-7c20-4288-8280-c6f9b17c7623-fullsize.webp",
  Sep: "https://files.kick.com/images/user/2955589/profile_image/conversion/d588c140-5d08-484b-9b09-d930de70a09f-fullsize.webp",
  Mepweet: "https://files.kick.com/images/user/32119916/profile_image/conversion/aa7c2560-d98f-4528-a7fb-7a63761aa280-fullsize.webp",
  Jabolero: "https://files.kick.com/images/user/32684619/profile_image/conversion/54fd96fc-5b7d-4c16-97ec-e94d9686d971-fullsize.webp",
  Kokz: "https://files.kick.com/images/user/40692339/profile_image/conversion/18789ab6-1b28-4504-968c-ab435a56065d-fullsize.webp",
  Yowe: "https://files.kick.com/images/user/31278642/profile_image/conversion/0cba5622-657b-45dc-8b8f-3241e62f44ea-fullsize.webp",
  Jwl: "https://files.kick.com/images/user/32438658/profile_image/conversion/fada7dee-36c9-4a1c-af80-1c705f86b400-fullsize.webp",
  Jing: "https://files.kick.com/images/user/33263190/profile_image/conversion/36db0278-5f94-4fe7-b666-20e8f9c3b522-fullsize.webp",
  Abat: "https://files.kick.com/images/user/32045620/profile_image/conversion/60df3b7a-cfbb-4e5a-a716-4652c5fb016a-fullsize.webp",
};

const FALLBACK_TEAMS: Record<string, string> = {
  Tims: "OG", Palos: "Execration", DJ: "PlayTime", Kuku: "PlayTime",
  Gabbi: "Execration", Armel: "Blacklist International", Karl: "T1",
  Tino: "Execration", Natsumi: "OG", Skem: "Shopify Rebellion",
  Nikko: "OG", Kokz: "Omega Gaming", Yowe: "Motivate.Trust",
  JG: "Omega Gaming", Jwl: "Team Zero", Jing: "Neon Esports", Abat: "Talon Esports",
};

async function main() {
  // Migrate old role values in Supabase player_cache
  const OLD_ROLES: { newRole: string; oldRoles: string[] }[] = [
    { newRole: "Offlaner", oldRoles: ["Offlane", "OFFLANE", "offlane"] },
    { newRole: "Midlaner", oldRoles: ["Mid", "MID", "mid"] },
    { newRole: "Support", oldRoles: ["Hard Support", "Soft Support", "HARD SUPPORT", "SOFT SUPPORT", "hard support", "soft support"] },
  ];
  for (const { newRole, oldRoles } of OLD_ROLES) {
    const { data, error } = await supabase
      .from("player_cache")
      .update({ role: newRole })
      .in("role", oldRoles)
      .select("name");
    if (error) console.warn(`Migration ${newRole}:`, error.message);
    else if (data?.length) console.log(`Migrated ${data.length} players: ${oldRoles.join("/")} → ${newRole}`);
  }

  console.log(`\nSyncing ${ALL_PLAYERS.length} players to Supabase...\n`);

  for (const name of ALL_PLAYERS) {
    console.log(`[${name}]`);

    let imageUrl: string | null = null;
    let team: string | null = null;
    let role: string | null = null;

    try {
      const data = await getPlayerData(name);
      imageUrl = data.imageUrl;
      team = data.team;
      role = data.role;
      console.log(`  image: ${imageUrl ? "OK" : "not found"}`);
      console.log(`  team: ${team || "not found"}`);
      console.log(`  role: ${role || "not found"}`);
    } catch (e) { console.warn(`  fetch error:`, e); }

    // Fallback team
    if (!team) team = FALLBACK_TEAMS[name] ?? "Kukuys";

    // Use Kick avatar as fallback if Liquipedia has no image
    if (!imageUrl && KICK_AVATARS[name]) {
      imageUrl = KICK_AVATARS[name];
      console.log(`  using Kick avatar`);
    }

    // Upload photo to Storage
    let storageUrl: string | null = null;
    if (imageUrl) {
      storageUrl = await uploadPhoto(name, imageUrl);
      console.log(`  storage: ${storageUrl ? "uploaded" : "failed"}`);
    }

    // Upsert into player_cache
    const { error } = await supabase
      .from("player_cache")
      .upsert({ name, image_url: storageUrl ?? imageUrl, team, role, updated_at: new Date().toISOString() }, { onConflict: "name" });

    if (error) {
      console.error(`  DB upsert failed:`, error.message);
    } else {
      console.log(`  ✓ saved\n`);
    }
  }

  console.log("Done!");
}

main().catch((e) => { console.error(e); process.exit(1); });
