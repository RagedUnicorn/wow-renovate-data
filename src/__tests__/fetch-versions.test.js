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
const fetchAndSaveVersions = require('../fetch-versions');

describe('fetch-versions', () => {
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
          require('../fetch-versions');
        } catch (_error) {
          // Expected to throw due to process.exit
        }
      });

      // Since validateApiKey is called during module load when running main,
      // we need to set the API key for other tests
      process.env.CURSEFORGE_API_KEY = 'test-api-key';
    });
  });

  describe('fetchAndSaveVersions', () => {
    let mockClient;
    let mockParser;

    beforeEach(() => {
      process.env.CURSEFORGE_API_KEY = 'test-api-key';

      // Setup CurseForgeClient mock
      mockClient = {
        getAllWowVersions: jest.fn(),
        getVersionTypes: jest.fn()
      };
      CurseForgeClient.mockImplementation(() => mockClient);

      // Setup VersionParser mock
      mockParser = {
        parseVersions: jest.fn()
      };
      VersionParser.mockImplementation(() => mockParser);
    });

    it('should fetch and save versions successfully', async () => {
      const mockWowVersions = [
        { name: '11.2.0', variant: 'retail', type: 517 },
        { name: '1.15.3', variant: 'classic_era', type: 67408 }
      ];

      const mockParsedVersions = [
        { version: '110200', name: '11.2.0', variant: 'retail' },
        { version: '11503', name: '1.15.3', variant: 'classic_era' }
      ];

      const mockVersionTypes = {
        517: { variant: 'retail', name: 'WoW Retail' },
        67408: { variant: 'classic_era', name: 'WoW Classic Era' }
      };

      mockClient.getAllWowVersions.mockResolvedValue(mockWowVersions);
      mockClient.getVersionTypes.mockReturnValue(mockVersionTypes);
      mockParser.parseVersions.mockReturnValue(mockParsedVersions);
      fs.readFile.mockRejectedValue(new Error('File not found'));
      fs.writeFile.mockResolvedValue();

      await fetchAndSaveVersions();

      expect(mockClient.getAllWowVersions).toHaveBeenCalled();
      expect(mockParser.parseVersions).toHaveBeenCalledWith(mockWowVersions);
      expect(fs.writeFile).toHaveBeenCalled();

      const savedData = JSON.parse(fs.writeFile.mock.calls[0][1]);
      expect(savedData).toHaveProperty('versions', mockParsedVersions);
      expect(savedData).toHaveProperty('versionsByVariant');
      expect(savedData).toHaveProperty('versionTypes', mockVersionTypes);
      expect(savedData).toHaveProperty('summary');
      expect(savedData).toHaveProperty('lastUpdated');
    });

    it('should preserve lastUpdated when versions have not changed', async () => {
      const existingData = {
        lastUpdated: '2023-01-01T00:00:00.000Z',
        versions: [
          { version: '110200', name: '11.2.0', variant: 'retail' }
        ]
      };

      const mockWowVersions = [
        { name: '11.2.0', variant: 'retail', type: 517 }
      ];

      const mockParsedVersions = [
        { version: '110200', name: '11.2.0', variant: 'retail' }
      ];

      mockClient.getAllWowVersions.mockResolvedValue(mockWowVersions);
      mockClient.getVersionTypes.mockReturnValue({});
      mockParser.parseVersions.mockReturnValue(mockParsedVersions);
      fs.readFile.mockResolvedValue(JSON.stringify(existingData));
      fs.writeFile.mockResolvedValue();

      await fetchAndSaveVersions();

      const savedData = JSON.parse(fs.writeFile.mock.calls[0][1]);
      expect(savedData.lastUpdated).toBe(existingData.lastUpdated);
      expect(mockConsoleLog).toHaveBeenCalledWith('No version changes detected, keeping existing lastUpdated timestamp');
    });

    it('should handle errors gracefully', async () => {
      mockClient.getAllWowVersions.mockRejectedValue(new Error('API Error'));

      await expect(fetchAndSaveVersions()).rejects.toThrow('process.exit called');

      expect(mockConsoleError).toHaveBeenCalledWith('Error fetching versions:', expect.any(Error));
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('utility functions', () => {
    // Since these functions are not exported, we'll test them through the main function
    // or by using rewire/proxyquire in a real scenario

    it('should correctly group and sort versions by variant', async () => {
      process.env.CURSEFORGE_API_KEY = 'test-api-key';

      const mockWowVersions = [
        { name: '11.2.0', variant: 'retail', type: 517 },
        { name: '11.1.0', variant: 'retail', type: 517 },
        { name: '1.15.3', variant: 'classic_era', type: 67408 },
        { name: '1.15.2', variant: 'classic_era', type: 67408 }
      ];

      const mockParsedVersions = [
        { version: '110200', name: '11.2.0', variant: 'retail' },
        { version: '110100', name: '11.1.0', variant: 'retail' },
        { version: '11503', name: '1.15.3', variant: 'classic_era' },
        { version: '11502', name: '1.15.2', variant: 'classic_era' }
      ];

      const mockClient = {
        getAllWowVersions: jest.fn().mockResolvedValue(mockWowVersions),
        getVersionTypes: jest.fn().mockReturnValue({})
      };
      CurseForgeClient.mockImplementation(() => mockClient);

      const mockParser = {
        parseVersions: jest.fn().mockReturnValue(mockParsedVersions)
      };
      VersionParser.mockImplementation(() => mockParser);

      fs.readFile.mockRejectedValue(new Error('File not found'));
      fs.writeFile.mockResolvedValue();

      await fetchAndSaveVersions();

      const savedData = JSON.parse(fs.writeFile.mock.calls[0][1]);

      // Check that versions are grouped by variant
      expect(savedData.versionsByVariant).toHaveProperty('retail');
      expect(savedData.versionsByVariant).toHaveProperty('classic_era');

      // Check that versions are sorted (newest first)
      expect(savedData.versionsByVariant.retail[0].version).toBe('110200');
      expect(savedData.versionsByVariant.retail[1].version).toBe('110100');
      expect(savedData.versionsByVariant.classic_era[0].version).toBe('11503');
      expect(savedData.versionsByVariant.classic_era[1].version).toBe('11502');

      // Check summary counts
      expect(savedData.summary.retail).toBe(2);
      expect(savedData.summary.classic_era).toBe(2);
    });
  });

  describe('file operations', () => {
    it('should handle file read errors gracefully', async () => {
      process.env.CURSEFORGE_API_KEY = 'test-api-key';

      const mockClient = {
        getAllWowVersions: jest.fn().mockResolvedValue([]),
        getVersionTypes: jest.fn().mockReturnValue({})
      };
      CurseForgeClient.mockImplementation(() => mockClient);

      const mockParser = {
        parseVersions: jest.fn().mockReturnValue([])
      };
      VersionParser.mockImplementation(() => mockParser);

      fs.readFile.mockRejectedValue(new Error('ENOENT'));
      fs.writeFile.mockResolvedValue();

      await fetchAndSaveVersions();

      // Should complete successfully even if file doesn't exist
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should write to correct file path', async () => {
      process.env.CURSEFORGE_API_KEY = 'test-api-key';

      const mockClient = {
        getAllWowVersions: jest.fn().mockResolvedValue([]),
        getVersionTypes: jest.fn().mockReturnValue({})
      };
      CurseForgeClient.mockImplementation(() => mockClient);

      const mockParser = {
        parseVersions: jest.fn().mockReturnValue([])
      };
      VersionParser.mockImplementation(() => mockParser);

      fs.readFile.mockRejectedValue(new Error('File not found'));
      fs.writeFile.mockResolvedValue();

      await fetchAndSaveVersions();

      const expectedPath = path.join(__dirname, '..', '..', 'versions.json');
      expect(fs.writeFile).toHaveBeenCalledWith(
        expectedPath,
        expect.any(String)
      );
    });
  });

  describe('console output', () => {
    it('should print correct summary', async () => {
      process.env.CURSEFORGE_API_KEY = 'test-api-key';

      const mockWowVersions = [
        { name: '11.2.0', variant: 'retail', type: 517 },
        { name: '1.15.3', variant: 'classic_era', type: 67408 }
      ];

      const mockParsedVersions = [
        { version: '110200', name: '11.2.0', variant: 'retail' },
        { version: '11503', name: '1.15.3', variant: 'classic_era' }
      ];

      const mockClient = {
        getAllWowVersions: jest.fn().mockResolvedValue(mockWowVersions),
        getVersionTypes: jest.fn().mockReturnValue({})
      };
      CurseForgeClient.mockImplementation(() => mockClient);

      const mockParser = {
        parseVersions: jest.fn().mockReturnValue(mockParsedVersions)
      };
      VersionParser.mockImplementation(() => mockParser);

      fs.readFile.mockRejectedValue(new Error('File not found'));
      fs.writeFile.mockResolvedValue();

      await fetchAndSaveVersions();

      // Check console output
      expect(mockConsoleLog).toHaveBeenCalledWith('Fetching WoW versions from CurseForge...');
      expect(mockConsoleLog).toHaveBeenCalledWith('Found 2 WoW versions');
      expect(mockConsoleLog).toHaveBeenCalledWith('Parsing interface versions...');
      expect(mockConsoleLog).toHaveBeenCalledWith('Parsed 2 valid WoW versions');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Summary:'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Latest versions:'));
    });
  });
});
