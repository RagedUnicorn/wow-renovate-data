const axios = require('axios');

class CurseForgeClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.curseforge.com/v1';
    this.wowGameId = 1;

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

  async getGameVersions() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/games/${this.wowGameId}/versions`,
        {
          headers: {
            'Accept': 'application/json',
            'x-api-key': this.apiKey
          }
        }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error fetching game versions:', error.message);
      throw error;
    }
  }

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
        return; // Skip unknown version types
      }

      // Add all versions from this type
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

  getVersionTypes() {
    // Return our hardcoded version type mappings
    return this.versionTypeMap;
  }
}

module.exports = CurseForgeClient;
