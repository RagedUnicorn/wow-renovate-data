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
   * Fetches game version groups from the CurseForge API.
   *
   * @returns {Promise<Array>} Array of version group objects
   *
   * @throws {Error} If the API request fails
   */
  async getGameVersions() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/games/${this.wowGameId}/versions`,
        {
          headers: {
            'Accept': 'application/json',
            'x-api-key': this.apiKey,
            'User-Agent': this.userAgent
          }
        }
      );

      return response.data.data;
    } catch (error) {
      console.error('Error fetching game versions:', error.message);

      throw error;
    }
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
    try {
      const response = await axios.get(
        `https://wow.curseforge.com/api/game/versions?token=${this.apiKey}`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': this.userAgent
          },
          timeout: 5000
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching game version IDs:', error.message);

      throw error;
    }
  }
}

module.exports = CurseForgeClient;
