const VersionParser = require('../version-parser');

describe('VersionParser', () => {
  let parser;

  beforeEach(() => {
    parser = new VersionParser();
  });

  describe('parseInterfaceVersion', () => {
    it('should parse Classic Era version correctly', () => {
      expect(parser.parseInterfaceVersion('1.15.3')).toBe('11503');
    });

    it('should parse WotLK Classic version correctly', () => {
      expect(parser.parseInterfaceVersion('3.4.3')).toBe('30403');
    });

    it('should parse Cata Classic version correctly', () => {
      expect(parser.parseInterfaceVersion('4.4.0')).toBe('40400');
    });

    it('should parse Retail version correctly', () => {
      expect(parser.parseInterfaceVersion('11.2.0')).toBe('110200');
    });

    it('should handle single digit minor/patch versions', () => {
      expect(parser.parseInterfaceVersion('1.2.3')).toBe('10203');
    });

    it('should handle double digit minor/patch versions', () => {
      expect(parser.parseInterfaceVersion('10.15.20')).toBe('101520');
    });

    it('should parse version with letter suffix correctly', () => {
      expect(parser.parseInterfaceVersion('4.0.3a')).toBe('40003');
      expect(parser.parseInterfaceVersion('1.15.3b')).toBe('11503');
      expect(parser.parseInterfaceVersion('11.2.0c')).toBe('110200');
    });

    it('should return null for invalid version format', () => {
      expect(parser.parseInterfaceVersion('invalid')).toBeNull();
      expect(parser.parseInterfaceVersion('1.2')).toBeNull();
      expect(parser.parseInterfaceVersion('')).toBeNull();
      expect(parser.parseInterfaceVersion('1.2.3.4')).toBeNull();
      expect(parser.parseInterfaceVersion('1.15.3-beta')).toBeNull();
      expect(parser.parseInterfaceVersion('v1.15.3')).toBeNull();
      expect(parser.parseInterfaceVersion(' 1.15.3')).toBeNull();
      expect(parser.parseInterfaceVersion('1.15.3 ')).toBeNull();
      expect(parser.parseInterfaceVersion('1.15.3ab')).toBeNull(); // Multiple letters not allowed
    });
  });

  describe('parseVersion', () => {
    it('should parse a complete CurseForge version object', () => {
      const curseforgeVersion = {
        name: '1.15.3',
        variant: 'classic_era',
        type: 67408,
        versionTypeName: 'WoW Classic Era',
        versionTypeSlug: 'wow-classic-era'
      };

      const result = parser.parseVersion(curseforgeVersion);

      expect(result).toEqual({
        version: '11503',
        name: '1.15.3',
        variant: 'classic_era',
        gameVersionTypeId: 67408,
        versionTypeName: 'WoW Classic Era',
        versionTypeSlug: 'wow-classic-era'
      });
    });

    it('should return null for unparseable version name', () => {
      const curseforgeVersion = {
        name: 'invalid-version',
        variant: 'retail',
        type: 517
      };

      expect(parser.parseVersion(curseforgeVersion)).toBeNull();
    });

    it('should handle missing optional fields', () => {
      const curseforgeVersion = {
        name: '11.2.0',
        variant: 'retail'
      };

      const result = parser.parseVersion(curseforgeVersion);

      expect(result).toEqual({
        version: '110200',
        name: '11.2.0',
        variant: 'retail',
        gameVersionTypeId: undefined,
        versionTypeName: undefined,
        versionTypeSlug: undefined
      });
    });
  });

  describe('parseVersions', () => {
    it('should parse multiple versions successfully', () => {
      const curseforgeVersions = [
        {
          name: '1.15.3',
          variant: 'classic_era',
          type: 67408
        },
        {
          name: '11.2.0',
          variant: 'retail',
          type: 517
        }
      ];

      const results = parser.parseVersions(curseforgeVersions);

      expect(results).toHaveLength(2);
      expect(results[0].version).toBe('11503');
      expect(results[1].version).toBe('110200');
    });

    it('should filter out unparseable versions', () => {
      const curseforgeVersions = [
        {
          name: '1.15.3',
          variant: 'classic_era'
        },
        {
          name: 'invalid',
          variant: 'retail'
        },
        {
          name: '11.2.0',
          variant: 'retail'
        }
      ];

      const results = parser.parseVersions(curseforgeVersions);

      expect(results).toHaveLength(2);
      expect(results.map(r => r.version)).toEqual(['11503', '110200']);
    });

    it('should handle empty array', () => {
      expect(parser.parseVersions([])).toEqual([]);
    });
  });

  describe('parseVersionToNumber', () => {
    it('should convert version string to comparable number', () => {
      expect(parser.parseVersionToNumber('1.15.3')).toBe(11503);
      expect(parser.parseVersionToNumber('11.2.0')).toBe(110200);
      expect(parser.parseVersionToNumber('3.4.3')).toBe(30403);
    });

    it('should handle single digit versions correctly', () => {
      expect(parser.parseVersionToNumber('1.2.3')).toBe(10203);
      expect(parser.parseVersionToNumber('1.0.0')).toBe(10000);
    });

    it('should handle double digit versions correctly', () => {
      expect(parser.parseVersionToNumber('10.15.20')).toBe(101520);
      expect(parser.parseVersionToNumber('99.99.99')).toBe(999999);
    });

    it('should allow version comparison', () => {
      const v1 = parser.parseVersionToNumber('1.15.3');
      const v2 = parser.parseVersionToNumber('1.15.2');
      const v3 = parser.parseVersionToNumber('2.0.0');

      expect(v1).toBeGreaterThan(v2);
      expect(v3).toBeGreaterThan(v1);
    });

    it('should handle missing parts as zero', () => {
      expect(parser.parseVersionToNumber('1')).toBe(10000);
      expect(parser.parseVersionToNumber('1.2')).toBe(10200);
    });

    it('should handle non-numeric parts', () => {
      // parseInt returns NaN for non-numeric strings, and NaN propagates through arithmetic
      expect(parser.parseVersionToNumber('a.b.c')).toBeNaN();
      expect(parser.parseVersionToNumber('1.a.3')).toBeNaN();
    });
  });
});
