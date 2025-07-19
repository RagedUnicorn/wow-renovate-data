require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const CurseForgeClient = require('./curseforge-client');

function printSummary(gameVersions) {
  const variantCounts = {};
  Object.values(gameVersions).forEach(v => {
    variantCounts[v.variant] = (variantCounts[v.variant] || 0) + 1;
  });
  
  console.log('\nSummary:');
  console.log(`Total gameVersion IDs: ${Object.keys(gameVersions).length}`);
  Object.entries(variantCounts).forEach(([variant, count]) => {
    console.log(`- ${variant}: ${count} versions`);
  });
}

async function saveGameVersionsToFile(gameVersions) {
  // Create a Renovate-friendly datasource format with all variants in one file
  const releases = [];
  
  Object.entries(gameVersions).forEach(([versionName, data]) => {
    releases.push({
      version: versionName,
      variant: data.variant,
      gameVersionId: data.id,
      releaseTimestamp: new Date().toISOString()
    });
  });
  
  const datasource = {
    lastUpdated: new Date().toISOString(),
    releases: releases
  };
  
  const outputPath = path.join(__dirname, '..', 'game-versions.json');
  await fs.writeFile(outputPath, JSON.stringify(datasource, null, 2));
  console.log(`Saved game versions to ${outputPath}`);
}

async function readExistingGameVersions() {
  const outputPath = path.join(__dirname, '..', 'game-versions.json');
  try {
    const content = await fs.readFile(outputPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    // File doesn't exist or is invalid
    return null;
  }
}

function hasGameVersionsChanged(oldData, gameVersions) {
  if (!oldData || !oldData.releases) return true;
  
  // Create a map of existing versions for comparison
  const oldVersionsMap = {};
  oldData.releases.forEach(release => {
    oldVersionsMap[release.version] = {
      variant: release.variant,
      gameVersionId: release.gameVersionId
    };
  });
  
  // Compare with new data
  const newVersionsMap = {};
  Object.entries(gameVersions).forEach(([version, data]) => {
    newVersionsMap[version] = {
      variant: data.variant,
      gameVersionId: data.id
    };
  });
  
  return JSON.stringify(oldVersionsMap) !== JSON.stringify(newVersionsMap);
}

function processGameVersionData(data, versionTypeMap) {
  // Transform the API response into our format
  const gameVersions = {};
  
  // The API returns an array of game versions
  if (Array.isArray(data)) {
    data.forEach(version => {
      if (version && version.name && version.id && version.gameVersionTypeID) {
        // Map the gameVersionTypeID to variant using the versionTypeMap
        const versionType = versionTypeMap[version.gameVersionTypeID];
        const variant = versionType ? versionType.variant : 'unknown';
        
        gameVersions[version.name] = {
          id: version.id,
          variant: variant
        };
      }
    });
  }
  
  return gameVersions;
}

function validateApiKey() {
  const apiKey = process.env.CURSEFORGE_API_KEY;

  if (!apiKey) {
    console.error('Error: CURSEFORGE_API_KEY environment variable is not set');
    console.error('Please create a .env file with your CurseForge API key');
    process.exit(1);
  }

  return apiKey;
}

async function fetchAndSaveGameVersions() {
  const apiKey = validateApiKey();

  const client = new CurseForgeClient(apiKey);

  try {
    console.log('Fetching game version IDs from CurseForge Upload API...');
    const gameVersionData = await client.getGameVersionIds();
    
    // Get the version type mappings from the client
    const versionTypeMap = client.getVersionTypes();
    
    console.log('Processing game version IDs...');
    const gameVersions = processGameVersionData(gameVersionData, versionTypeMap);
    
    if (Object.keys(gameVersions).length === 0) {
      console.error('No game version IDs found in the API response');
      process.exit(1);
    }
    
    console.log(`Found ${Object.keys(gameVersions).length} game version IDs`);

    // Read existing data to check for changes
    const existingData = await readExistingGameVersions();
    
    // Only update if versions have actually changed
    if (existingData && !hasGameVersionsChanged(existingData, gameVersions)) {
      console.log('No changes detected, keeping existing file');
    } else {
      // Save to game-versions.json in datasource format
      await saveGameVersionsToFile(gameVersions);
    }

    printSummary(gameVersions);

  } catch (error) {
    console.error('Error fetching game versions:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  fetchAndSaveGameVersions();
}

module.exports = fetchAndSaveGameVersions;