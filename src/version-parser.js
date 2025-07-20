/**
 * Parser for converting CurseForge version names to WoW interface version numbers.
 */
class VersionParser {
  /**
   * Parses a version name into a WoW interface version number.
   *
   * @param {string} versionName - Version name like "1.15.3" or "11.2.0"
   *
   * @returns {string|null} Interface version number like "11503" or null if parsing fails
   */
  parseInterfaceVersion(versionName) {
    // Extract version numbers from CurseForge version names
    // Examples:
    // "1.15.3" -> 11503 (Classic Era)
    // "3.4.3" -> 30403 (WotLK Classic)
    // "4.4.0" -> 40400 (Cata Classic)
    // "11.2.0" -> 110200 (Retail)
    const versionMatch = versionName.match(/(\d+)\.(\d+)\.(\d+)/);

    if (!versionMatch) {
      return null;
    }

    const [, major, minor, patch] = versionMatch;
    return `${major}${minor.padStart(2, '0')}${patch.padStart(2, '0')}`;
  }

  /**
   * Parses a CurseForge version object into a structured version format.
   *
   * @param {Object} curseforgeVersion - CurseForge version object
   *
   * @returns {Object|null} Parsed version object with interface version and metadata, or null if parsing fails
   */
  parseVersion(curseforgeVersion) {
    const interfaceVersion = this.parseInterfaceVersion(curseforgeVersion.name);

    if (!interfaceVersion) {
      return null;
    }

    return {
      version: interfaceVersion,
      name: curseforgeVersion.name,
      variant: curseforgeVersion.variant,
      gameVersionTypeId: curseforgeVersion.type,
      versionTypeName: curseforgeVersion.versionTypeName,
      versionTypeSlug: curseforgeVersion.versionTypeSlug
    };
  }

  /**
   * Parses an array of CurseForge versions.
   *
   * @param {Array} curseforgeVersions - Array of CurseForge version objects
   *
   * @returns {Array} Array of successfully parsed version objects
   */
  parseVersions(curseforgeVersions) {
    return curseforgeVersions
      .map(version => this.parseVersion(version))
      .filter(version => version !== null);
  }

  /**
   * Parses a version string into a comparable numeric value.
   * Converts version strings like "1.15.3" into numbers for sorting.
   *
   * @param {string} versionString - Version string in format "major.minor.patch"
   *
   * @returns {number} Numeric representation: major*10000 + minor*100 + patch
   */
  parseVersionToNumber(versionString) {
    const parts = versionString.split('.');
    // Convert to a single number for easy comparison: major*10000 + minor*100 + patch
    const major = parseInt(parts[0] || '0', 10);
    const minor = parseInt(parts[1] || '0', 10);
    const patch = parseInt(parts[2] || '0', 10);

    return major * 10000 + minor * 100 + patch;
  }
}

module.exports = VersionParser;
