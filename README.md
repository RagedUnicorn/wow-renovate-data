# WoW Renovate Data Source


![](./docs/wow_renovate_data.png)
[![Update WoW Versions](https://github.com/RagedUnicorn/wow-renovate-data/actions/workflows/update_wow_versions.yml/badge.svg)](https://github.com/RagedUnicorn/wow-renovate-data/actions/workflows/update_wow_versions.yml)
[![Update Game Versions](https://github.com/RagedUnicorn/wow-renovate-data/actions/workflows/update_game_versions.yml/badge.svg)](https://github.com/RagedUnicorn/wow-renovate-data/actions/workflows/update_game_versions.yml)
![](docs/license_badge.svg)

> A data source for [Renovate](https://docs.renovatebot.com/) to track World of Warcraft interface versions. This allows automated dependency updates for WoW addon TOC and other similar files.

## Features

- Automatically fetches WoW version information from CurseForge API
- Supports all WoW variants:
  - Retail (1.0.0 - current)
  - Classic Era (1.13.x - 1.15.x)
  - The Burning Crusade Classic (2.5.x)
  - Wrath of the Lich King Classic (3.4.x)
  - Cataclysm Classic (4.4.x)
  - Mists of Pandaria Classic (5.5.x)
- GitHub Actions workflow for automated updates
- Compatible with Renovate's custom datasource feature

## Setup

### 1. Get a CurseForge API Key

1. Go to [CurseForge Console](https://console.curseforge.com/)
2. Create an account or sign in
3. Generate an API key

### 2. Fork and Configure This Repository

1. Fork this repository
2. Add your CurseForge API key as a GitHub secret named `CURSEFORGE_API_KEY`
3. The GitHub Actions will run every 6 hours to check for new versions (both WoW interface versions and game version IDs)

### 3. Configure Renovate in Your Addon Project

Add this configuration to your addon project's `renovate.json`:

#### For TOC files (tracking interface versions):

```json
{
  "customDatasources": {
    "wow-versions": {
      "defaultRegistryUrlTemplate": "https://raw.githubusercontent.com/ragedunicorn/wow-renovate-data/master/versions.json",
      "format": "json",
      "transformTemplates": [
        "{ \"releases\": $.versions[variant = 'classic_era'].{ \"version\": version } }"
      ]
    }
  },
  "customManagers": [
    {
      "customType": "regex",
      "description": "Update WoW Interface versions in TOC files",
      "fileMatch": ["\\.toc$"],
      "matchStrings": [
        "## Interface:\\s*(?<currentValue>\\d+)"
      ],
      "datasourceTemplate": "custom.wow-versions",
      "depNameTemplate": "wow-interface"
    }
  ]
}
```

#### For pom.xml files (tracking both interface and patch versions):

```json
{
  "customDatasources": {
    "wow-versions": {
      "defaultRegistryUrlTemplate": "https://raw.githubusercontent.com/ragedunicorn/wow-renovate-data/master/versions.json",
      "format": "json",
      "transformTemplates": [
        "{ \"releases\": $.versions[variant = 'classic_era'].{ \"version\": version } }"
      ]
    },
    "wow-patch-versions": {
      "defaultRegistryUrlTemplate": "https://raw.githubusercontent.com/ragedunicorn/wow-renovate-data/master/versions.json",
      "format": "json",
      "transformTemplates": [
        "{ \"releases\": $.versions[variant = 'classic_era'].{ \"version\": name } }"
      ]
    }
  },
  "customManagers": [
    {
      "customType": "regex",
      "fileMatch": ["^pom\\.xml$"],
      "matchStrings": [
        "<!-- renovate: datasource=custom.wow-versions depName=wow-interface versioning=loose -->\\n\\s*<addon\\.interface>(?<currentValue>\\d+)</addon\\.interface>"
      ],
      "datasourceTemplate": "custom.wow-versions",
      "depNameTemplate": "wow-interface"
    },
    {
      "customType": "regex",
      "fileMatch": ["^pom\\.xml$"],
      "matchStrings": [
        "<!-- renovate: datasource=custom.wow-patch-versions depName=wow-patch versioning=loose -->\\n\\s*<addon\\.supported\\.patch>(?<currentValue>[\\d\\.]+)</addon\\.supported\\.patch>"
      ],
      "datasourceTemplate": "custom.wow-patch-versions",
      "depNameTemplate": "wow-patch"
    }
  ]
}
```

Then in your `pom.xml`:

```xml
<!-- renovate: datasource=custom.wow-versions depName=wow-interface versioning=loose -->
<addon.interface>11507</addon.interface>

<!-- renovate: datasource=custom.wow-patch-versions depName=wow-patch versioning=loose -->
<addon.supported.patch>1.15.7</addon.supported.patch>
```

**Note**: You can filter by variant in the transformTemplates. Available variants are:
- `retail` - Current retail version
- `classic_era` - Classic Era (Vanilla)
- `tbc_classic` - The Burning Crusade Classic
- `wotlk_classic` - Wrath of the Lich King Classic
- `cata_classic` - Cataclysm Classic
- `mop_classic` - Mists of Pandaria Classic

## How It Works

1. The CurseForge API client fetches all WoW game versions
2. The version parser filters and extracts WoW versions
3. Interface version numbers are calculated from version strings (e.g., "1.15.3" → "11503")
4. Results are saved to `versions.json` for Renovate to consume
5. GitHub Actions run periodically to keep the data up-to-date

## Manual Usage

To manually fetch and update versions:

```bash
# Install dependencies
npm install

# Create .env file with your API key
echo "CURSEFORGE_API_KEY=your-key-here" > .env

# Fetch latest WoW interface versions
npm run fetch-wow-versions

# Fetch latest WoW game versions
npm run fetch-game-versions

# Debug scripts (for development)
npm run fetch-wow-versions:debug
npm run fetch-game-versions:debug
```

## Version Format

WoW interface versions follow this pattern:
- Major version (1 digit) + Minor version (2 digits) + Patch version (2 digits)
- Example: Version 1.15.3 becomes Interface 11503

## CurseForge Game Version IDs

CurseForge gameVersion IDs (needed for uploading addons) are maintained in `game-versions.json`.

```bash
# Generate game-versions.json
npm run fetch-game-versions
```

The script fetches gameVersion IDs from the CurseForge WoW API (`wow.curseforge.com/api/game/versions`). It automatically maps each version to its correct variant (retail, classic_era, tbc_classic, etc.) and generates a `game-versions.json` file in Renovate-compatible datasource format.

### Tracking GameVersion IDs with Renovate

The `game-versions.json` file can be used with Renovate to track gameVersion IDs. You can filter by variant using JSONPath.

To automatically update gameVersion IDs when new WoW patches are released, add this to your `renovate.json`:

```json
{
  "customDatasources": {
    "wow-game-versions-classic": {
      "defaultRegistryUrlTemplate": "https://raw.githubusercontent.com/ragedunicorn/wow-renovate-data/master/game-versions.json",
      "transformTemplates": [
        "{\"releases\": $.releases[?(@.variant == 'classic_era')].{\"version\": version, \"gameVersionId\": gameVersionId}}"
      ]
    }
  },
  "customManagers": [
    {
      "customType": "regex",
      "fileMatch": ["^pom\\.xml$"],
      "matchStrings": [
        "<!-- renovate: datasource=custom.wow-game-versions-classic depName=wow-gameversion -->\\n\\s*<addon\\.curseforge\\.gameVersion>(?<currentValue>\\d+)</addon\\.curseforge\\.gameVersion>"
      ],
      "datasourceTemplate": "custom.wow-game-versions-classic",
      "depNameTemplate": "wow-gameversion",
      "versioningTemplate": "regex:^(?<major>\\d+)$",
      "currentValueTemplate": "{{{gameVersionId}}}"
    }
  ]
}
```

Then in your `pom.xml`, you can place this comment wherever the gameVersion property is defined:

```xml
<!-- renovate: datasource=custom.wow-game-versions-classic depName=wow-gameversion -->
<addon.curseforge.gameVersion>12919</addon.curseforge.gameVersion>
```

This approach tracks the gameVersion ID independently. When a new version is released, Renovate will update the gameVersion ID to match the latest version in the specified variant.

When a new Classic Era version is released (e.g., 1.15.8), Renovate will update both the patch version and the corresponding gameVersion ID.

## Dependency Management

This project uses [Renovate](https://renovatebot.com/) for automated dependency updates. Renovate will:
- Check for updates to npm dependencies weekly (every Monday)
- Group related updates (ESLint packages, GitHub Actions)
- Automatically merge dev dependency updates
- Create pull requests for review of production dependencies

The Renovate configuration can be found in `renovate.json`.

## License

MIT License

Copyright (c) 2025 Michael Wiesendanger

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
