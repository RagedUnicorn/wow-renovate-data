# WoW Renovate Data Source


![](./docs/wow_renovate_data.png)
![](docs/license_badge.svg)

> A data source for [Renovate](https://docs.renovatebot.com/) to track World of Warcraft interface versions. This allows automated dependency updates for WoW addon TOC files.

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
3. The GitHub Action will run every 6 hours to check for new versions

### 3. Configure Renovate in Your Addon Project

Add this configuration to your addon project's `renovate.json`:

```json
{
  "customDatasources": {
    "wow-interface": {
      "defaultRegistryUrlTemplate": "https://raw.githubusercontent.com/ragedunicorn/wow-renovate-data/master/versions.json",
      "transformTemplates": [
        "{\"releases\": $.versions.map(v => ({\"version\": v.version, \"releaseTimestamp\": $.lastUpdated}))}"
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
      "datasourceTemplate": "custom.wow-interface",
      "depNameTemplate": "wow-interface",
      "versioningTemplate": "regex:^(?<major>\\d)(?<minor>\\d{2})(?<patch>\\d{2})$"
    }
  ]
}
```

## How It Works

1. The CurseForge API client fetches all WoW game versions
2. The version parser filters and extracts WoW versions
3. Interface version numbers are calculated from version strings (e.g., "1.15.3" → "11503")
4. Results are saved to `versions.json` for Renovate to consume
5. GitHub Actions runs periodically to keep the data up-to-date

## Manual Usage

To manually fetch and update versions:

```bash
# Install dependencies
npm install

# Create .env file with your API key
echo "CURSEFORGE_API_KEY=your-key-here" > .env

# Fetch latest versions
npm run fetch
```

## Version Format

WoW interface versions follow this pattern:
- Major version (1 digit) + Minor version (2 digits) + Patch version (2 digits)
- Example: Version 1.15.3 becomes Interface 11503

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
