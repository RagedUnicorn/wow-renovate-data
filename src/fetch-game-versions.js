require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const CurseForgeClient = require('./curseforge-client');
const VersionParser = require('./version-parser');

/**
 * Prints a summary of game versions grouped by variant.
 *
 * @param {Object} gameVersions - Object mapping version names to version data
 */
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

/**
 * Saves game versions to a JSON file in Renovate-compatible format.
 * Organizes versions by variant and assigns release timestamps.
 *
 * @param {Object} gameVersions - Object mapping version names to version data
 * @param {VersionParser} versionParser - Instance of VersionParser for version number parsing
 *
 * @returns {Promise<void>}
 */
async function saveGameVersionsToFile(gameVersions, versionParser) {
  // First, organize all versions by variant
  const versionsByVariant = {};

  Object.entries(gameVersions).forEach(([versionName, data]) => {
    if (!versionsByVariant[data.variant]) {
      versionsByVariant[data.variant] = [];
    }
    versionsByVariant[data.variant].push({
      version: versionName,
      gameVersionId: data.id,
      sortOrder: versionParser.parseVersionToNumber(versionName)
    });
  });

  // Sort each variant's versions by sortOrder (newest first)
  Object.values(versionsByVariant).forEach(versions => {
    versions.sort((a, b) => b.sortOrder - a.sortOrder);
  });

  const renovateReleases = [];

  // Process each variant
  Object.entries(versionsByVariant).forEach(([variant, versions]) => {
    versions.forEach((versionData, index) => {
      renovateReleases.push({
        // Use gameVersionId as the version (what Renovate will use)
        version: String(versionData.gameVersionId),
        // Keep the original version for reference
        originalVersion: versionData.version,
        variant: variant,
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
}

/**
 * Reads the existing game versions from the JSON file.
 *
 * @returns {Promise<Object|null>} The parsed game version data or null if file doesn't exist
 */
async function readExistingGameVersions() {
  const outputPath = path.join(__dirname, '..', 'game-versions.json');

  try {
    const content = await fs.readFile(outputPath, 'utf8');
    return JSON.parse(content);
  } catch (_error) {
    return null;
  }
}

/**
 * Checks if game versions have changed between old and new data.
 *
 * @param {Object|null} oldData - The previous game version data
 * @param {Object} gameVersions - The new game version data
 *
 * @returns {boolean} True if versions have changed or oldData is null
 */
function hasGameVersionsChanged(oldData, gameVersions) {
  if (!oldData || !oldData.releases) return true;

  // Create a map of existing versions for comparison
  const oldVersionsMap = {};

  oldData.releases.forEach(release => {
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

/**
 * Processes raw game version data from the API into a structured format.
 *
 * @param {Array} data - Array of game version objects from CurseForge API
 * @param {Object} versionTypeMap - Mapping of version type IDs to variant names
 *
 * @returns {Object} Object mapping version names to {id, variant} objects
 */
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

/**
 * Validates that the CurseForge API key is present in environment variables.
 * Exits the process if the API key is not found.
 *
 * @returns {string} The CurseForge API key
 */
function validateApiKey() {
  const apiKey = process.env.CURSEFORGE_API_KEY;

  if (!apiKey) {
    console.error('Error: CURSEFORGE_API_KEY environment variable is not set');
    console.error('Please create a .env file with your CurseForge API key');
    process.exit(1);
  }

  return apiKey;
}

/**
 * Main function to fetch game version IDs from CurseForge and save them to file.
 * Checks for changes before updating to preserve lastUpdated timestamp when appropriate.
 *
 * @returns {Promise<void>}
 */
async function fetchAndSaveGameVersions() {
  const apiKey = validateApiKey();
  const client = new CurseForgeClient(apiKey);

  try {
    console.log('Fetching game version IDs from CurseForge Upload API...');
    const gameVersionData = await client.getGameVersionIds();
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
      const versionParser = new VersionParser();
      await saveGameVersionsToFile(gameVersions, versionParser);
    }

    printSummary(gameVersions);
  } catch (error) {
    console.error('Error fetching game versions:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  fetchAndSaveGameVersions();
}

module.exports = fetchAndSaveGameVersions;
