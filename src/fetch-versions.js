require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const CurseForgeClient = require('./curseforge-client');
const VersionParser = require('./version-parser');

/**
 * Prints a summary of the fetched versions to the console.
 *
 * @param {Object} output - The complete output object containing summary
 * @param {Object} versionsByVariant - Versions grouped by variant
 */
function printVersionSummary(output, versionsByVariant) {
  console.log('\nSummary:');
  console.log(`- Classic Era versions: ${output.summary.classic_era}`);
  console.log(`- TBC Classic versions: ${output.summary.tbc_classic}`);
  console.log(`- WotLK Classic versions: ${output.summary.wotlk_classic}`);
  console.log(`- Cataclysm Classic versions: ${output.summary.cata_classic}`);
  console.log(`- MoP Classic versions: ${output.summary.mop_classic}`);
  console.log(`- Retail versions: ${output.summary.retail}`);
  console.log('\nLatest versions:');

  Object.entries(versionsByVariant).forEach(([variant, versions]) => {
    if (versions.length > 0) {
      console.log(`- ${variant}: ${versions[0].name} (Interface: ${versions[0].version})`);
    }
  });
}

/**
 * Saves the version data to the versions.json file.
 *
 * @param {Object} output - The complete version data object to save
 *
 * @returns {Promise<void>}
 */
async function saveVersionsToFile(output) {
  const outputPath = path.join(__dirname, '..', 'versions.json');
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
  console.log(`Saved versions to ${outputPath}`);
}

/**
 * Reads the existing versions from the versions.json file.
 *
 * @returns {Promise<Object|null>} The parsed version data or null if file doesn't exist or is invalid
 */
async function readExistingVersions() {
  const outputPath = path.join(__dirname, '..', 'versions.json');

  try {
    const content = await fs.readFile(outputPath, 'utf8');
    return JSON.parse(content);
  } catch (_error) {
    return null;
  }
}

/**
 * Checks if the versions have changed between old and new data.
 * Compares only the versions array, ignoring the lastUpdated timestamp.
 *
 * @param {Object|null} oldData - The previous version data object
 * @param {Object} newData - The new version data object
 *
 * @returns {boolean} True if versions have changed or oldData is null, false otherwise
 */
function hasVersionsChanged(oldData, newData) {
  if (!oldData) return true;

  // Compare versions array (excluding lastUpdated)
  const oldVersions = JSON.stringify(oldData.versions);
  const newVersions = JSON.stringify(newData.versions);

  return oldVersions !== newVersions;
}

/**
 * Creates the output object with all version data and metadata.
 *
 * @param {Array} parsedVersions - Array of parsed version objects
 * @param {Object} versionsByVariant - Versions grouped by variant (classic_era, retail, etc.)
 * @param {Object} versionTypes - Version type mappings from CurseForge
 *
 * @returns {Object} The complete output object with versions, metadata, and summary
 */
function createOutputObject(parsedVersions, versionsByVariant, versionTypes) {
  return {
    lastUpdated: new Date().toISOString(),
    versions: parsedVersions,
    versionsByVariant: versionsByVariant,
    versionTypes: versionTypes,
    summary: {
      classic_era: versionsByVariant.classic_era?.length || 0,
      tbc_classic: versionsByVariant.tbc_classic?.length || 0,
      wotlk_classic: versionsByVariant.wotlk_classic?.length || 0,
      cata_classic: versionsByVariant.cata_classic?.length || 0,
      mop_classic: versionsByVariant.mop_classic?.length || 0,
      retail: versionsByVariant.retail?.length || 0
    }
  };
}

/**
 * Groups parsed versions by variant and sorts them within each group.
 *
 * @param {Array} parsedVersions - Array of parsed version objects
 *
 * @returns {Object} Object with versions grouped by variant, sorted newest first
 */
function processVersionsByVariant(parsedVersions) {
  // Group versions by variant
  const versionsByVariant = parsedVersions.reduce((acc, version) => {
    if (!acc[version.variant]) {
      acc[version.variant] = [];
    }
    acc[version.variant].push(version);
    return acc;
  }, {});

  // Sort versions within each variant (newest first)
  Object.keys(versionsByVariant).forEach(variant => {
    versionsByVariant[variant].sort((a, b) => {
      return parseInt(b.version) - parseInt(a.version);
    });
  });

  return versionsByVariant;
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
 * Main function to fetch WoW versions from CurseForge and save them to file.
 * Checks for changes before updating to preserve lastUpdated timestamp when appropriate.
 *
 * @returns {Promise<void>}
 */
async function fetchAndSaveVersions() {
  const apiKey = validateApiKey();
  const client = new CurseForgeClient(apiKey);
  const parser = new VersionParser();

  try {
    console.log('Fetching WoW versions from CurseForge...');
    const wowVersions = await client.getAllWowVersions();
    console.log(`Found ${wowVersions.length} WoW versions`);

    console.log('Parsing interface versions...');
    const parsedVersions = parser.parseVersions(wowVersions);
    console.log(`Parsed ${parsedVersions.length} valid WoW versions`);

    const versionsByVariant = processVersionsByVariant(parsedVersions);
    const versionTypes = client.getVersionTypes();
    // Read existing versions to check for changes
    const existingData = await readExistingVersions();

    const output = createOutputObject(parsedVersions, versionsByVariant, versionTypes);

    // Only update lastUpdated if versions have actually changed
    if (existingData && !hasVersionsChanged(existingData, output)) {
      output.lastUpdated = existingData.lastUpdated;
      console.log('No version changes detected, keeping existing lastUpdated timestamp');
    }

    await saveVersionsToFile(output);

    printVersionSummary(output, versionsByVariant);
  } catch (error) {
    console.error('Error fetching versions:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  fetchAndSaveVersions();
}

module.exports = fetchAndSaveVersions;
