# Cassiopeia Integration for Item ID Mapping

## Overview

The encoder now uses Cassiopeia's official League of Legends API to get accurate, up-to-date item IDs instead of hardcoded mappings. This ensures the system stays current with game patches and new items.

## How It Works

### 1. **Cassiopeia Integration** (`createitems/cass.py`)

-   Uses Cassiopeia to fetch all items from the official Riot Games API
-   Extracts official item IDs from the API
-   Generates both JSON and TypeScript files with the mapping
-   Only includes items that are available on Summoner's Rift (map ID 11)

### 2. **Fallback System** (`scripts/generate-item-ids.js`)

-   When Cassiopeia is not available, generates item IDs from existing `Items.ts`
-   Creates sequential IDs (1, 2, 3, ...) for all items in the database
-   Ensures the system works even without Python/Cassiopeia installed

### 3. **Dynamic Loading** (`app/utils/encoder.ts`)

-   Tries to load Cassiopeia-generated IDs first
-   Falls back to generated IDs if Cassiopeia data is unavailable
-   Falls back to hardcoded mapping as final resort
-   Provides console logging for debugging

## File Structure

```
league-calculator/
├── createitems/
│   └── cass.py                    # Cassiopeia integration script
├── scripts/
│   └── generate-item-ids.js       # Fallback ID generator
├── data/
│   ├── item-ids.json              # JSON mapping (Cassiopeia)
│   └── item-ids.ts                # TypeScript mapping
└── app/
    └── utils/
        └── encoder.ts              # Dynamic encoder with fallbacks
```

## Usage

### For Development (with Cassiopeia):

```bash
# Install Cassiopeia (if not already installed)
pip install cassiopeia

# Run the Cassiopeia script to get official item IDs
python createitems/cass.py
```

### For Development (without Cassiopeia):

```bash
# Generate fallback item IDs from existing Items.ts
node scripts/generate-item-ids.js
```

### For Production:

-   The system automatically detects which data is available
-   No manual intervention required
-   Graceful fallback ensures the app always works

## Benefits

### 1. **Always Up-to-Date**

-   Uses official Riot Games API
-   Automatically includes new items from patches
-   Removes deprecated items
-   Maintains correct item IDs

### 2. **Robust Fallback System**

-   Works without Python/Cassiopeia
-   Multiple fallback layers
-   No breaking changes to existing functionality

### 3. **Better Compression**

-   Official item IDs are often smaller than sequential numbers
-   More efficient encoding
-   Smaller export strings

### 4. **Future-Proof**

-   Easy to extend for other game data
-   Can be adapted for other Riot Games APIs
-   Maintains compatibility with existing exports

## Technical Details

### Item ID Mapping Priority:

1. **Cassiopeia-generated IDs** (official Riot Games API)
2. **Generated sequential IDs** (from existing Items.ts)
3. **Hardcoded fallback IDs** (manual mapping)

### Console Output:

-   `"Loaded Cassiopeia item IDs for encoding"` - Using official API data
-   `"Loaded generated item IDs for encoding"` - Using generated fallback data
-   `"Using fallback item ID mapping"` - Using hardcoded data

### Error Handling:

-   Graceful degradation through multiple fallback layers
-   No user-facing errors
-   Maintains backward compatibility with existing exports

## Maintenance

### Regular Updates:

-   Run `python createitems/cass.py` after major patches
-   Ensures new items are included
-   Removes deprecated items
-   Updates item IDs if they change

### Monitoring:

-   Check console logs to see which mapping is being used
-   Verify item ID generation is working correctly
-   Test export/import functionality after updates

This system ensures your League of Legends damage calculator stays current with the game while maintaining robust fallback mechanisms for reliability.




