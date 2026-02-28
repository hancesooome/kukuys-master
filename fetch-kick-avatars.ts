/**
 * fetch-kick-avatars.ts
 *
 * Fetches Kick.com profile pages and extracts avatar URLs
 *
 * Usage: npx tsx fetch-kick-avatars.ts
 */

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

async function fetchKickAvatar(username: string): Promise<string | null> {
  try {
    // Use Kick.com public API v2
    const apiUrl = `https://kick.com/api/v2/channels/${username}`;
    const apiResponse = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
    });

    if (apiResponse.ok) {
      const data = await apiResponse.json();
      
      // Check various possible fields for avatar
      const avatarUrl = 
        data?.user?.profile_pic ||
        data?.user?.profilepic ||
        data?.user?.avatar ||
        data?.profilepic ||
        data?.profile_pic ||
        data?.avatar ||
        data?.user_image ||
        data?.image ||
        null;

      if (avatarUrl) {
        return avatarUrl;
      }

      // Log the structure to help debug
      console.log(`  Debug: API response keys:`, Object.keys(data));
      if (data?.user) {
        console.log(`  Debug: user keys:`, Object.keys(data.user));
      }
    } else {
      console.error(`  ✗ API HTTP ${apiResponse.status} for ${username}`);
    }

    // Fallback to HTML scraping
    const url = `https://kick.com/${username}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": "https://kick.com/",
        "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    if (!response.ok) {
      console.error(`  ✗ HTTP ${response.status} for ${username}`);
      return null;
    }

    const html = await response.text();

    // Try multiple patterns to find the avatar image
    const patterns = [
      // Pattern 1: Look for profile image in meta tags
      /<meta\s+property="og:image"\s+content="([^"]+)"/i,
      // Pattern 2: Look for avatar in img tags with specific classes/attributes
      /<img[^>]*class="[^"]*avatar[^"]*"[^>]*src="([^"]+)"/i,
      // Pattern 3: Look for profile picture in img tags
      /<img[^>]*alt="[^"]*profile[^"]*"[^>]*src="([^"]+)"/i,
      // Pattern 4: Look for images from files.kick.com
      /<img[^>]*src="(https:\/\/files\.kick\.com\/[^"]+)"/i,
      // Pattern 5: Look for user avatar in data attributes
      /data-avatar="([^"]+)"/i,
      // Pattern 6: Look for profile image in JSON-LD
      /"image":\s*"([^"]+)"/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        // Filter out generic/placeholder images
        const imageUrl = match[1];
        if (!imageUrl.includes("default") && !imageUrl.includes("placeholder")) {
          return imageUrl;
        }
      }
    }

    // Try to find any kick.com CDN images
    const kickCdnMatch = html.match(/https:\/\/files\.kick\.com\/[^\s"'<>]+/i);
    if (kickCdnMatch) {
      return kickCdnMatch[0];
    }

    console.error(`  ✗ No avatar found in HTML for ${username}`);
    return null;
  } catch (error) {
    console.error(`  ✗ Error fetching ${username}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function main() {
  console.log("Fetching Kick.com avatar URLs...\n");

  const results: Array<{ displayName: string; username: string; avatarUrl: string | null }> = [];

  for (const profile of KICK_PROFILES) {
    console.log(`[${profile.displayName}] (${profile.username})`);
    const avatarUrl = await fetchKickAvatar(profile.username);
    
    if (avatarUrl) {
      console.log(`  ✓ ${avatarUrl}\n`);
    } else {
      console.log(`  ✗ not found\n`);
    }

    results.push({
      displayName: profile.displayName,
      username: profile.username,
      avatarUrl,
    });

    // Rate limiting: wait 1 second between requests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("\n" + "=".repeat(80));
  console.log("RESULTS:");
  console.log("=".repeat(80) + "\n");

  for (const result of results) {
    if (result.avatarUrl) {
      console.log(`${result.displayName}: ${result.avatarUrl}`);
    } else {
      console.log(`${result.displayName}: not found`);
    }
  }

  // Export as JSON for easy import
  const jsonOutput = results.reduce((acc, r) => {
    acc[r.displayName] = r.avatarUrl || "not found";
    return acc;
  }, {} as Record<string, string>);

  console.log("\n" + "=".repeat(80));
  console.log("JSON FORMAT:");
  console.log("=".repeat(80));
  console.log(JSON.stringify(jsonOutput, null, 2));
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
