const axios = require('axios');
const CurseForgeClient = require('../curseforge-client');

// Mock axios
jest.mock('axios');

describe('CurseForgeClient', () => {
  let client;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    client = new CurseForgeClient(mockApiKey);
    // Avoid real backoff sleeps slowing down the suite
    client.retryBaseDelay = 0;
    jest.clearAllMocks();
    // Mock console.error/warn to avoid noise in test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
    console.warn.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(client.apiKey).toBe(mockApiKey);
      expect(client.baseUrl).toBe('https://api.curseforge.com/v1');
      expect(client.wowGameId).toBe(1);
      expect(client.userAgent).toMatch(/wow-renovate-datasource\/\d+\.\d+\.\d+/);
    });

    it('should have correct version type mappings', () => {
      const versionTypes = client.getVersionTypes();
      expect(versionTypes).toHaveProperty('67408');
      expect(versionTypes).toHaveProperty('73246');
      expect(versionTypes).toHaveProperty('73713');
      expect(versionTypes).toHaveProperty('77522');
      expect(versionTypes).toHaveProperty('79434');
      expect(versionTypes).toHaveProperty('517');

      expect(versionTypes[67408].variant).toBe('classic_era');
      expect(versionTypes[73246].variant).toBe('tbc_classic');
      expect(versionTypes[73713].variant).toBe('wotlk_classic');
      expect(versionTypes[77522].variant).toBe('cata_classic');
      expect(versionTypes[79434].variant).toBe('mop_classic');
      expect(versionTypes[517].variant).toBe('retail');
    });
  });

  describe('getVersionTypes', () => {
    it('should return version type mappings', () => {
      const types = client.getVersionTypes();
      expect(types).toBeDefined();
      expect(Object.keys(types)).toHaveLength(6);
      expect(types[517]).toEqual({
        id: 517,
        name: 'WoW Retail',
        slug: 'wow-retail',
        variant: 'retail'
      });
    });
  });

  describe('getGameVersions', () => {
    it('should fetch game versions successfully', async () => {
      const mockResponse = {
        data: {
          data: [
            {
              type: 517,
              versions: ['11.2.0', '11.1.7']
            },
            {
              type: 67408,
              versions: ['1.15.7', '1.15.6']
            }
          ]
        }
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await client.getGameVersions();

      expect(axios.get).toHaveBeenCalledWith(
        'https://api.curseforge.com/v1/games/1/versions',
        {
          headers: {
            'Accept': 'application/json',
            'x-api-key': mockApiKey,
            'User-Agent': client.userAgent
          },
          timeout: client.requestTimeout
        }
      );

      expect(result).toEqual(mockResponse.data.data);
    });

    it('should throw error after exhausting retries when API request fails', async () => {
      const mockError = new Error('API Error');
      axios.get.mockRejectedValue(mockError);

      await expect(client.getGameVersions()).rejects.toThrow('API Error');
      expect(axios.get).toHaveBeenCalledTimes(client.maxRetries);
      expect(console.error).toHaveBeenCalledWith(
        `Error fetching game versions after ${client.maxRetries} attempts:`,
        'API Error'
      );
    });

    it('should retry and succeed after a transient failure', async () => {
      const mockResponse = { data: { data: [{ type: 517, versions: ['11.2.0'] }] } };
      axios.get
        .mockRejectedValueOnce(new Error('timeout of 30000ms exceeded'))
        .mockResolvedValueOnce(mockResponse);

      const result = await client.getGameVersions();

      expect(axios.get).toHaveBeenCalledTimes(2);
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResponse.data.data);
    });
  });

  describe('getAllWowVersions', () => {
    it('should process all WoW versions correctly', async () => {
      const mockVersionGroups = [
        {
          type: 517,
          versions: ['11.2.0', '11.1.7']
        },
        {
          type: 67408,
          versions: ['1.15.7', '1.15.6']
        },
        {
          type: 99999, // Unknown type
          versions: ['1.0.0']
        }
      ];

      jest.spyOn(client, 'getGameVersions').mockResolvedValue(mockVersionGroups);

      const result = await client.getAllWowVersions();

      expect(result).toHaveLength(4); // Only known types
      expect(result[0]).toEqual({
        name: '11.2.0',
        type: 517,
        variant: 'retail',
        versionTypeName: 'WoW Retail',
        versionTypeSlug: 'wow-retail'
      });
      expect(result[2]).toEqual({
        name: '1.15.7',
        type: 67408,
        variant: 'classic_era',
        versionTypeName: 'WoW Classic Era',
        versionTypeSlug: 'wow-classic-era'
      });
    });

    it('should handle groups without versions array', async () => {
      const mockVersionGroups = [
        {
          type: 517,
          versions: ['11.2.0']
        },
        {
          type: 67408
          // Missing versions array
        },
        {
          type: 73246,
          versions: null // Null versions
        }
      ];

      jest.spyOn(client, 'getGameVersions').mockResolvedValue(mockVersionGroups);

      const result = await client.getAllWowVersions();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('11.2.0');
    });

    it('should handle empty version groups', async () => {
      jest.spyOn(client, 'getGameVersions').mockResolvedValue([]);

      const result = await client.getAllWowVersions();

      expect(result).toEqual([]);
    });
  });

  describe('getGameVersionIds', () => {
    it('should fetch game version IDs successfully', async () => {
      const mockResponse = {
        data: [
          { id: 13433, name: '11.2.0', gameVersionTypeID: 517 },
          { id: 12919, name: '1.15.7', gameVersionTypeID: 67408 }
        ]
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await client.getGameVersionIds();

      expect(axios.get).toHaveBeenCalledWith(
        `https://wow.curseforge.com/api/game/versions?token=${mockApiKey}`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': client.userAgent
          },
          timeout: client.requestTimeout
        }
      );

      expect(result).toEqual(mockResponse.data);
    });

    it('should throw error after exhausting retries when API request fails', async () => {
      const mockError = new Error('Network Error');
      axios.get.mockRejectedValue(mockError);

      await expect(client.getGameVersionIds()).rejects.toThrow('Network Error');
      expect(axios.get).toHaveBeenCalledTimes(client.maxRetries);
      expect(console.error).toHaveBeenCalledWith(
        `Error fetching game version IDs after ${client.maxRetries} attempts:`,
        'Network Error'
      );
    });

    it('should retry timeout errors and rethrow after exhausting retries', async () => {
      const timeoutError = new Error('timeout of 30000ms exceeded');
      timeoutError.code = 'ECONNABORTED';
      axios.get.mockRejectedValue(timeoutError);

      await expect(client.getGameVersionIds()).rejects.toThrow('timeout of 30000ms exceeded');
      expect(axios.get).toHaveBeenCalledTimes(client.maxRetries);
    });

    it('should retry and succeed after a transient timeout', async () => {
      const timeoutError = new Error('timeout of 30000ms exceeded');
      timeoutError.code = 'ECONNABORTED';
      const mockResponse = { data: [{ id: 13433, name: '11.2.0', gameVersionTypeID: 517 }] };
      axios.get
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce(mockResponse);

      const result = await client.getGameVersionIds();

      expect(axios.get).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockResponse.data);
    });
  });
});
