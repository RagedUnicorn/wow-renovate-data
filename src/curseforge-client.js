const axios = require('axios');
const packageInfo = require('../package.json');

/**
 * Client for interacting with the CurseForge API to fetch WoW version data.
 */
class CurseForgeClient {
  /**
   * Creates a new CurseForgeClient instance.
   *
   * @param {string} apiKey - The CurseForge API key for authentication
   */
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.curseforge.com/v1';
    this.wowGameId = 1;
    this.userAgent = `${packageInfo.name}/${packageInfo.version}`;

    this.requestTimeout = 30000;
    this.maxRetries = 3;
    this.retryBaseDelay = 1000;

    // Hardcoded mappings based on known gameVersionTypeIds
    this.versionTypeMap = {
      67408: { id: 67408, name: 'WoW Classic Era', slug: 'wow-classic-era', variant: 'classic_era' },
      73246: { id: 73246, name: 'WoW Burning Crusade Classic', slug: 'wow-burning-crusade-classic', variant: 'tbc_classic' },
      73713: { id: 73713, name: 'WoW Wrath of the Lich King Classic', slug: 'wow-wrath-of-the-lich-king-classic', variant: 'wotlk_classic' },
      77522: { id: 77522, name: 'WoW Cataclysm Classic', slug: 'wow-cataclysm-classic', variant: 'cata_classic' },
      79434: { id: 79434, name: 'WoW Mists of Pandaria Classic', slug: 'wow-mists-of-pandaria-classic', variant: 'mop_classic' },
      517: { id: 517, name: 'WoW Retail', slug: 'wow-retail', variant: 'retail' }
    };
  }

  /**
   * Performs an HTTP GET with a request timeout and exponential-backoff retries.
   *
   * @param {string} url - The URL to request
   * @param {Object} headers - Request headers
   * @param {string} label - Human-readable label used in log messages
   *
   * @returns {Promise<Object>} The axios response
   *
   * @throws {Error} If all retry attempts fail
   */
  async requestWithRetry(url, headers, label) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await axios.get(url, { headers, timeout: this.requestTimeout });
      } catch (error) {
        lastError = error;

        if (attempt < this.maxRetries) {
          const delay = this.retryBaseDelay * 2 ** (attempt - 1);

          console.warn(
            `Error fetching ${label} (attempt ${attempt}/${this.maxRetries}): ${error.message}. ` +
            `Retrying in ${delay}ms...`
          );

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`Error fetching ${label} after ${this.maxRetries} attempts:`, lastError.message);

    throw lastError;
  }

  /**
   * Fetches game version groups from the CurseForge API.
   *
   * @returns {Promise<Array>} Array of version group objects
   *
   * @throws {Error} If the API request fails
   */
  async getGameVersions() {
    const response = await this.requestWithRetry(
      `${this.baseUrl}/games/${this.wowGameId}/versions`,
      {
        'Accept': 'application/json',
        'x-api-key': this.apiKey,
        'User-Agent': this.userAgent
      },
      'game versions'
    );

    return response.data.data;
  }

  /**
   * Fetches and processes all WoW versions from all version groups.
   *
   * @returns {Promise<Array>} Array of version objects with name, type, variant, and type metadata
   */
  async getAllWowVersions() {
    const versionGroups = await this.getGameVersions();

    // Extract all WoW versions (Classic and Retail)
    const allVersions = [];

    versionGroups.forEach(group => {
      if (!group.versions || !Array.isArray(group.versions)) {
        return;
      }

      // Check if this is a known version type
      const versionType = this.versionTypeMap[group.type];

      if (!versionType) {
        return;
      }

      group.versions.forEach(version => {
        allVersions.push({
          name: version,
          type: group.type,
          variant: versionType.variant,
          versionTypeName: versionType.name,
          versionTypeSlug: versionType.slug
        });
      });
    });

    return allVersions;
  }

  /**
   * Returns the hardcoded version type mappings.
   *
   * @returns {Object} Object mapping version type IDs to their metadata
   */
  getVersionTypes() {
    return this.versionTypeMap;
  }

  /**
   * Fetches game version IDs from the CurseForge Upload API.
   *
   * @returns {Promise<Array>} Array of game version objects with IDs
   *
   * @throws {Error} If the API request fails
   */
  async getGameVersionIds() {
    const response = await this.requestWithRetry(
      `https://wow.curseforge.com/api/game/versions?token=${this.apiKey}`,
      {
        'Accept': 'application/json',
        'User-Agent': this.userAgent
      },
      'game version IDs'
    );

    return response.data;
  }
}

module.exports = CurseForgeClient;
