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

// Helper function to parse version strings like "1.15.3" into comparable numbers
function parseVersion(versionString) {
  const parts = versionString.split('.');
  // Convert to a single number for easy comparison: major*10000 + minor*100 + patch
  const major = parseInt(parts[0] || '0', 10);
  const minor = parseInt(parts[1] || '0', 10);
  const patch = parseInt(parts[2] || '0', 10);
  return major * 10000 + minor * 100 + patch;
}

async function saveGameVersionsToFile(gameVersions) {
  // First, organize all versions by variant
  const versionsByVariant = {};

  Object.entries(gameVersions).forEach(([versionName, data]) => {
    if (!versionsByVariant[data.variant]) {
      versionsByVariant[data.variant] = [];
    }
    versionsByVariant[data.variant].push({
      version: versionName,
      gameVersionId: data.id,
      sortOrder: parseVersion(versionName)
    });
  });

  // Sort each variant's versions by sortOrder (newest first)
  Object.values(versionsByVariant).forEach(versions => {
    versions.sort((a, b) => b.sortOrder - a.sortOrder);
  });

  // Create releases for Renovate datasource
  const renovateReleases = [];

  // Process each variant
  Object.entries(versionsByVariant).forEach(([variant, versions]) => {
    // For each version in this variant, create a release
    versions.forEach((versionData, index) => {
      renovateReleases.push({
        // Use gameVersionId as the version (what Renovate will use)
        version: String(versionData.gameVersionId),
        // Keep the original version for reference
        originalVersion: versionData.version,
        variant: variant,
        // Create a timestamp that ensures proper ordering
        // Most recent versions get the most recent timestamp
        releaseTimestamp: new Date(Date.now() - (versions.length - index - 1) * 86400000).toISOString()
      });
    });
  });

  const datasource = {
    lastUpdated: new Date().toISOString(),
    releases: renovateReleases
  };

  const outputPath = path.join(__dirname, '..', 'game-versions.json');
  await fs.writeFile(outputPath, JSON.stringify(datasource, null, 2));
  console.log(`Saved game versions to ${outputPath}`);

  // Also save a mapping file for debugging/reference
  const mappingData = {
    lastUpdated: new Date().toISOString(),
    mappings: Object.entries(gameVersions).map(([version, data]) => ({
      version: version,
      gameVersionId: data.id,
      variant: data.variant
    })).sort((a, b) => {
      if (a.variant !== b.variant) {
        return a.variant.localeCompare(b.variant);
      }
      return parseVersion(b.version) - parseVersion(a.version);
    })
  };

  const mappingPath = path.join(__dirname, '..', 'game-versions-mapping.json');
  await fs.writeFile(mappingPath, JSON.stringify(mappingData, null, 2));
  console.log(`Saved version mappings to ${mappingPath}`);
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
    // Map by gameVersionId since that's what we're using as version now
    oldVersionsMap[release.version] = {
      originalVersion: release.originalVersion,
      variant: release.variant
    };
  });

  // Compare with new data
  const newVersionsMap = {};
  Object.entries(gameVersions).forEach(([version, data]) => {
    newVersionsMap[String(data.id)] = {
      originalVersion: version,
      variant: data.variant
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
