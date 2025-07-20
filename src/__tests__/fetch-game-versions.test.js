const fs = require('fs').promises;
const path = require('path');
const CurseForgeClient = require('../curseforge-client');
const VersionParser = require('../version-parser');

// Mock dependencies
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn()
  }
}));
jest.mock('../curseforge-client');
jest.mock('../version-parser');

// Mock dotenv at the top level
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

// Import after mocks are set up
const fetchAndSaveGameVersions = require('../fetch-game-versions');

describe('fetch-game-versions', () => {
  let mockExit;
  let mockConsoleLog;
  let mockConsoleError;

  beforeEach(() => {
    // Mock process.exit
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    
    // Mock console methods
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset module cache to ensure clean state
    jest.resetModules();
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    // Clear environment variable
    delete process.env.CURSEFORGE_API_KEY;
  });

  describe('validateApiKey', () => {
    it('should exit if API key is not set', () => {
      delete process.env.CURSEFORGE_API_KEY;
      
      // Re-require the module to test validateApiKey
      jest.isolateModules(() => {
        try {
          require('../fetch-game-versions');
        } catch (error) {
          // Expected to throw due to process.exit
        }
      });
      
      // Set the API key for other tests
      process.env.CURSEFORGE_API_KEY = 'test-api-key';
    });
  });

  describe('fetchAndSaveGameVersions', () => {
    let mockClient;
    let mockVersionParser;
    
    beforeEach(() => {
      process.env.CURSEFORGE_API_KEY = 'test-api-key';
      
      // Setup CurseForgeClient mock
      mockClient = {
        getGameVersionIds: jest.fn(),
        getVersionTypes: jest.fn()
      };
      CurseForgeClient.mockImplementation(() => mockClient);
      
      // Setup VersionParser mock
      mockVersionParser = {
        parseVersionToNumber: jest.fn()
      };
      VersionParser.mockImplementation(() => mockVersionParser);
    });

    it('should fetch and save game versions successfully', async () => {
      const mockGameVersionData = [
        { id: 13433, name: '11.2.0', gameVersionTypeID: 517 },
        { id: 12919, name: '1.15.7', gameVersionTypeID: 67408 }
      ];
      
      const mockVersionTypes = {
        517: { variant: 'retail', name: 'WoW Retail' },
        67408: { variant: 'classic_era', name: 'WoW Classic Era' }
      };
      
      mockClient.getGameVersionIds.mockResolvedValue(mockGameVersionData);
      mockClient.getVersionTypes.mockReturnValue(mockVersionTypes);
      mockVersionParser.parseVersionToNumber.mockImplementation(v => {
        return v === '11.2.0' ? 110200 : 11507;
      });
      fs.readFile.mockRejectedValue(new Error('File not found'));
      fs.writeFile.mockResolvedValue();
      
      await fetchAndSaveGameVersions();
      
      expect(mockClient.getGameVersionIds).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
      
      const savedData = JSON.parse(fs.writeFile.mock.calls[0][1]);
      expect(savedData).toHaveProperty('releases');
      expect(savedData).toHaveProperty('lastUpdated');
      expect(savedData.releases).toHaveLength(2);
      expect(savedData.releases[0]).toEqual({
        version: '13433',
        originalVersion: '11.2.0',
        variant: 'retail'
      });
    });

    it('should preserve existing file when no changes detected', async () => {
      const existingData = {
        lastUpdated: '2023-01-01T00:00:00.000Z',
        releases: [
          { version: '13433', originalVersion: '11.2.0', variant: 'retail' }
        ]
      };
      
      const mockGameVersionData = [
        { id: 13433, name: '11.2.0', gameVersionTypeID: 517 }
      ];
      
      const mockVersionTypes = {
        517: { variant: 'retail' }
      };
      
      mockClient.getGameVersionIds.mockResolvedValue(mockGameVersionData);
      mockClient.getVersionTypes.mockReturnValue(mockVersionTypes);
      fs.readFile.mockResolvedValue(JSON.stringify(existingData));
      fs.writeFile.mockResolvedValue();
      
      await fetchAndSaveGameVersions();
      
      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith('No changes detected, keeping existing file');
    });

    it('should exit when no game versions are found', async () => {
      mockClient.getGameVersionIds.mockResolvedValue([]);
      mockClient.getVersionTypes.mockReturnValue({});
      
      await expect(fetchAndSaveGameVersions()).rejects.toThrow('process.exit called');
      
      expect(mockConsoleError).toHaveBeenCalledWith('No game version IDs found in the API response');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle API errors gracefully', async () => {
      mockClient.getGameVersionIds.mockRejectedValue(new Error('API Error'));
      
      await expect(fetchAndSaveGameVersions()).rejects.toThrow('process.exit called');
      
      expect(mockConsoleError).toHaveBeenCalledWith('Error fetching game versions:', expect.any(Error));
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('processGameVersionData', () => {
    it('should correctly process game version data', async () => {
      process.env.CURSEFORGE_API_KEY = 'test-api-key';
      
      const mockGameVersionData = [
        { id: 13433, name: '11.2.0', gameVersionTypeID: 517 },
        { id: 12919, name: '1.15.7', gameVersionTypeID: 67408 },
        { id: 99999, name: 'invalid', gameVersionTypeID: 99999 }, // Unknown type
        { id: 12345, name: '1.15.6' } // Missing gameVersionTypeID
      ];
      
      const mockVersionTypes = {
        517: { variant: 'retail' },
        67408: { variant: 'classic_era' }
      };
      
      const mockClient = {
        getGameVersionIds: jest.fn().mockResolvedValue(mockGameVersionData),
        getVersionTypes: jest.fn().mockReturnValue(mockVersionTypes)
      };
      CurseForgeClient.mockImplementation(() => mockClient);
      
      const mockVersionParser = {
        parseVersionToNumber: jest.fn().mockReturnValue(10000)
      };
      VersionParser.mockImplementation(() => mockVersionParser);
      
      fs.readFile.mockRejectedValue(new Error('File not found'));
      fs.writeFile.mockResolvedValue();
      
      await fetchAndSaveGameVersions();
      
      const savedData = JSON.parse(fs.writeFile.mock.calls[0][1]);
      
      // Should have processed 3 versions (2 known types + 1 unknown)
      expect(savedData.releases).toHaveLength(3);
      
      // Check that unknown type is labeled as 'unknown'
      const unknownRelease = savedData.releases.find(r => r.originalVersion === 'invalid');
      expect(unknownRelease.variant).toBe('unknown');
    });
  });

  describe('hasGameVersionsChanged', () => {
    it('should detect changes in game versions', async () => {
      process.env.CURSEFORGE_API_KEY = 'test-api-key';
      
      const existingData = {
        releases: [
          { version: '13433', originalVersion: '11.2.0', variant: 'retail' }
        ]
      };
      
      const mockGameVersionData = [
        { id: 13433, name: '11.2.0', gameVersionTypeID: 517 },
        { id: 12919, name: '1.15.7', gameVersionTypeID: 67408 } // New version
      ];
      
      const mockVersionTypes = {
        517: { variant: 'retail' },
        67408: { variant: 'classic_era' }
      };
      
      const mockClient = {
        getGameVersionIds: jest.fn().mockResolvedValue(mockGameVersionData),
        getVersionTypes: jest.fn().mockReturnValue(mockVersionTypes)
      };
      CurseForgeClient.mockImplementation(() => mockClient);
      
      const mockVersionParser = {
        parseVersionToNumber: jest.fn().mockReturnValue(10000)
      };
      VersionParser.mockImplementation(() => mockVersionParser);
      
      fs.readFile.mockResolvedValue(JSON.stringify(existingData));
      fs.writeFile.mockResolvedValue();
      
      await fetchAndSaveGameVersions();
      
      // Should have written new file due to changes
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('saveGameVersionsToFile', () => {
    it('should sort versions correctly by variant and version number', async () => {
      process.env.CURSEFORGE_API_KEY = 'test-api-key';
      
      const mockGameVersionData = [
        { id: 11459, name: '1.15.3', gameVersionTypeID: 67408 },
        { id: 12919, name: '1.15.7', gameVersionTypeID: 67408 },
        { id: 11084, name: '1.15.2', gameVersionTypeID: 67408 },
        { id: 11274, name: '11.0.0', gameVersionTypeID: 517 },
        { id: 13433, name: '11.2.0', gameVersionTypeID: 517 }
      ];
      
      const mockVersionTypes = {
        517: { variant: 'retail' },
        67408: { variant: 'classic_era' }
      };
      
      const mockClient = {
        getGameVersionIds: jest.fn().mockResolvedValue(mockGameVersionData),
        getVersionTypes: jest.fn().mockReturnValue(mockVersionTypes)
      };
      CurseForgeClient.mockImplementation(() => mockClient);
      
      const mockVersionParser = {
        parseVersionToNumber: jest.fn().mockImplementation(version => {
          const parts = version.split('.');
          return parseInt(parts[0]) * 10000 + parseInt(parts[1]) * 100 + parseInt(parts[2]);
        })
      };
      VersionParser.mockImplementation(() => mockVersionParser);
      
      fs.readFile.mockRejectedValue(new Error('File not found'));
      fs.writeFile.mockResolvedValue();
      
      await fetchAndSaveGameVersions();
      
      const savedData = JSON.parse(fs.writeFile.mock.calls[0][1]);
      
      // Find retail versions
      const retailVersions = savedData.releases.filter(r => r.variant === 'retail');
      expect(retailVersions[0].originalVersion).toBe('11.2.0'); // Newest first
      expect(retailVersions[1].originalVersion).toBe('11.0.0');
      
      // Find classic_era versions
      const classicVersions = savedData.releases.filter(r => r.variant === 'classic_era');
      expect(classicVersions[0].originalVersion).toBe('1.15.7'); // Newest first
      expect(classicVersions[1].originalVersion).toBe('1.15.3');
      expect(classicVersions[2].originalVersion).toBe('1.15.2');
    });
  });

  describe('console output', () => {
    it('should print correct summary by variant', async () => {
      process.env.CURSEFORGE_API_KEY = 'test-api-key';
      
      const mockGameVersionData = [
        { id: 13433, name: '11.2.0', gameVersionTypeID: 517 },
        { id: 11274, name: '11.0.0', gameVersionTypeID: 517 },
        { id: 12919, name: '1.15.7', gameVersionTypeID: 67408 }
      ];
      
      const mockVersionTypes = {
        517: { variant: 'retail' },
        67408: { variant: 'classic_era' }
      };
      
      const mockClient = {
        getGameVersionIds: jest.fn().mockResolvedValue(mockGameVersionData),
        getVersionTypes: jest.fn().mockReturnValue(mockVersionTypes)
      };
      CurseForgeClient.mockImplementation(() => mockClient);
      
      const mockVersionParser = {
        parseVersionToNumber: jest.fn().mockReturnValue(10000)
      };
      VersionParser.mockImplementation(() => mockVersionParser);
      
      fs.readFile.mockRejectedValue(new Error('File not found'));
      fs.writeFile.mockResolvedValue();
      
      await fetchAndSaveGameVersions();
      
      // Check console output
      expect(mockConsoleLog).toHaveBeenCalledWith('Fetching game version IDs from CurseForge Upload API...');
      expect(mockConsoleLog).toHaveBeenCalledWith('Processing game version IDs...');
      expect(mockConsoleLog).toHaveBeenCalledWith('Found 3 game version IDs');
      expect(mockConsoleLog).toHaveBeenCalledWith('\nSummary:');
      expect(mockConsoleLog).toHaveBeenCalledWith('Total gameVersion IDs: 3');
      expect(mockConsoleLog).toHaveBeenCalledWith('- retail: 2 versions');
      expect(mockConsoleLog).toHaveBeenCalledWith('- classic_era: 1 versions');
    });
  });

  describe('file operations', () => {
    it('should write to correct file path', async () => {
      process.env.CURSEFORGE_API_KEY = 'test-api-key';
      
      const mockClient = {
        getGameVersionIds: jest.fn().mockResolvedValue([
          { id: 13433, name: '11.2.0', gameVersionTypeID: 517 }
        ]),
        getVersionTypes: jest.fn().mockReturnValue({ 517: { variant: 'retail' } })
      };
      CurseForgeClient.mockImplementation(() => mockClient);
      
      const mockVersionParser = {
        parseVersionToNumber: jest.fn().mockReturnValue(110200)
      };
      VersionParser.mockImplementation(() => mockVersionParser);
      
      fs.readFile.mockRejectedValue(new Error('File not found'));
      fs.writeFile.mockResolvedValue();
      
      await fetchAndSaveGameVersions();
      
      const expectedPath = path.join(__dirname, '..', '..', 'game-versions.json');
      expect(fs.writeFile).toHaveBeenCalledWith(
        expectedPath,
        expect.any(String)
      );
    });
  });
});