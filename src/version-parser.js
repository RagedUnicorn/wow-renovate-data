class VersionParser {
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

  parseVersions(curseforgeVersions) {
    return curseforgeVersions
      .map(version => this.parseVersion(version))
      .filter(version => version !== null);
  }
}

module.exports = VersionParser;
