/**
 * fetch-kick-avatars-puppeteer.ts
 *
 * Uses Puppeteer to fetch Kick.com profile pages with a real browser
 * to bypass anti-bot protection and extract avatar URLs
 *
 * Usage: npx tsx fetch-kick-avatars-puppeteer.ts
 */

import puppeteer from "puppeteer";

const KICK_PROFILES = [
  { username: "hubrisss", displayName: "Hubris" },
  { username: "lashsegway28", displayName: "Lashsegway" },
  { username: "sunshinemelodyyy", displayName: "Sunshine" },
  { username: "chupaeng", displayName: "Chupaeng" },
  { username: "alowxc", displayName: "Alo" },
  { username: "nevertheless", displayName: "Nevertheless" },
  { username: "joevydota2", displayName: "Joevy" },
  { username: "jtzcast", displayName: "JTZ" },
  { username: "sepdoto", displayName: "Sep" },
  { username: "meepwet", displayName: "Mepweet" },
  { username: "jabolerodota", displayName: "Jabolero" },
  { username: "kokzdota", displayName: "Kokz" },
  { username: "yowe", displayName: "Yowe" },
  { username: "jwldota", displayName: "Jwl" },
  { username: "jingdota", displayName: "Jing" },
  { username: "abatdota", displayName: "Abat" },
];

async function fetchKickAvatarWithBrowser(
  page: puppeteer.Page,
  username: string
): Promise<string | null> {
  try {
    const url = `https://kick.com/${username}`;
    console.log(`  Navigating to ${url}...`);

    // Navigate to the page
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait a bit for dynamic content to load
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Try to find the avatar image
    const avatarUrl = await page.evaluate(() => {
      // Try multiple strategies to find the avatar

      // Strategy 1: Look for meta og:image
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) {
        const content = ogImage.getAttribute("content");
        if (content && content.includes("files.kick.com")) {
          return content;
        }
      }

      // Strategy 2: Look for images with avatar-related classes
      const avatarSelectors = [
        'img[alt*="avatar" i]',
        'img[alt*="profile" i]',
        'img.avatar',
        'img[class*="avatar" i]',
        'img[class*="profile" i]',
        '[class*="avatar" i] img',
        '[class*="profile" i] img',
      ];

      for (const selector of avatarSelectors) {
        const img = document.querySelector(selector) as HTMLImageElement;
        if (img?.src && img.src.includes("files.kick.com")) {
          return img.src;
        }
      }

      // Strategy 3: Find all images from files.kick.com and pick the most likely avatar
      const allImages = Array.from(document.querySelectorAll("img")) as HTMLImageElement[];
      const kickImages = allImages.filter(
        (img) => img.src && img.src.includes("files.kick.com")
      );

      // Look for square-ish images (avatars are usually square)
      for (const img of kickImages) {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (width > 50 && height > 50 && Math.abs(width - height) < 100) {
          return img.src;
        }
      }

      // Return the first kick.com image if nothing else found
      if (kickImages.length > 0) {
        return kickImages[0].src;
      }

      return null;
    });

    if (avatarUrl) {
      console.log(`  ✓ Found: ${avatarUrl}`);
      return avatarUrl;
    } else {
      console.log(`  ✗ No avatar found`);
      return null;
    }
  } catch (error) {
    console.error(
      `  ✗ Error:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

async function main() {
  console.log("Launching browser...\n");

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  try {
    const page = await browser.newPage();

    // Set a realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Set extra headers to look more like a real browser
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    });

    console.log("Fetching Kick.com avatar URLs...\n");

    const results: Array<{
      displayName: string;
      username: string;
      avatarUrl: string | null;
    }> = [];

    for (const profile of KICK_PROFILES) {
      console.log(`[${profile.displayName}] (${profile.username})`);
      const avatarUrl = await fetchKickAvatarWithBrowser(page, profile.username);

      results.push({
        displayName: profile.displayName,
        username: profile.username,
        avatarUrl,
      });

      console.log("");

      // Wait between requests to be polite
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    console.log("=".repeat(80));
    console.log("RESULTS:");
    console.log("=".repeat(80) + "\n");

    for (const result of results) {
      if (result.avatarUrl) {
        console.log(`${result.displayName}: ${result.avatarUrl}`);
      } else {
        console.log(`${result.displayName}: not found`);
      }
    }

    // Export as JSON
    const jsonOutput = results.reduce((acc, r) => {
      acc[r.displayName] = r.avatarUrl || "not found";
      return acc;
    }, {} as Record<string, string>);

    console.log("\n" + "=".repeat(80));
    console.log("JSON FORMAT:");
    console.log("=".repeat(80));
    console.log(JSON.stringify(jsonOutput, null, 2));
  } finally {
    await browser.close();
    console.log("\nBrowser closed.");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
