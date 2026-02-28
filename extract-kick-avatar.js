/**
 * Browser Console Script to Extract Kick Avatar
 * 
 * Instructions:
 * 1. Open a Kick.com profile page (e.g., https://kick.com/hubrisss)
 * 2. Open browser DevTools (F12)
 * 3. Go to the Console tab
 * 4. Paste this script and press Enter
 * 5. Copy the output
 * 6. Repeat for each profile
 */

(function() {
  // Try multiple selectors to find the avatar
  const selectors = [
    'img[alt*="avatar"]',
    'img[alt*="profile"]',
    'img.avatar',
    'img.profile-pic',
    'img.profile-picture',
    '[class*="avatar"] img',
    '[class*="profile"] img',
  ];

  let avatarUrl = null;

  for (const selector of selectors) {
    const img = document.querySelector(selector);
    if (img && img.src && img.src.includes('files.kick.com')) {
      avatarUrl = img.src;
      break;
    }
  }

  // If not found, try to find any image from files.kick.com
  if (!avatarUrl) {
    const allImages = document.querySelectorAll('img');
    for (const img of allImages) {
      if (img.src && img.src.includes('files.kick.com')) {
        // Check if it looks like a profile picture (usually square-ish)
        if (img.width > 50 && img.height > 50 && Math.abs(img.width - img.height) < 50) {
          avatarUrl = img.src;
          break;
        }
      }
    }
  }

  // Get username from URL
  const username = window.location.pathname.split('/')[1];

  if (avatarUrl) {
    console.log(`✓ Found avatar for ${username}:`);
    console.log(avatarUrl);
    console.log('\nCopy this line:');
    console.log(`${username}: ${avatarUrl}`);
  } else {
    console.log(`✗ No avatar found for ${username}`);
    console.log('Try inspecting the page manually to find the profile image.');
  }

  return avatarUrl;
})();
