# Custom Encoder/Decoder Implementation

## Overview

I've successfully implemented a custom encoder/decoder system that significantly reduces the size of build export strings while adding champion level support.

## Key Improvements

### 1. **Size Reduction**

-   **Item Compression**: Instead of storing full item data (name, cost, AD, etc.), items are now referenced by simple numeric IDs
-   **Compact JSON**: Uses abbreviated field names (`n` for name, `i` for items, `b` for bonuses)
-   **Removed Redundancy**: Eliminates calculated values that can be recomputed (like totalCost, AD, etc.)

### 2. **Champion Level Support**

-   Export now includes the current champion level
-   Import automatically sets the champion level when available
-   Backward compatible with existing exports

### 3. **Backward Compatibility**

-   New decoder tries the new format first, falls back to legacy format
-   Existing shared builds will continue to work
-   Graceful error handling for invalid data

## Technical Implementation

### Files Modified:

-   `app/utils/encoder.ts` - New custom encoder/decoder
-   `app/components/ShareModal.tsx` - Updated to use new encoder and include champion level
-   `app/components/BuildPanel.tsx` - Pass champion level to ShareModal
-   `app/pages/CalculatorPage.tsx` - Updated import logic to handle champion level
-   `app/components/ImportModal.tsx` - Updated to use new decoder

### Size Comparison Example:

```
Old Format (JSON + Base64):
{"name":"Test Build","items":[{"name":"Long Sword","cost":350,"AD":10,"critChance":0,"infinityEdgeBonus":false,"lethality":0,"armorPenetration":0,"aliases":[],"imagePath":""}],"critChance":0,"critDamageModifier":1.75,"AD":10,"armorPenetration":0,"lethality":0,"totalCost":350,"bonusAD":0,"bonusLethality":0,"bonusCrit":0}

New Format (Compressed):
{"v":1,"l":18,"b":[{"n":"Test Build","i":[1],"b":[0,0,0]}]}
```

**Estimated size reduction: 60-80%** depending on build complexity.

## Usage

### Exporting:

-   Champion level is automatically included in exports
-   Both "Copy Code" and "Copy URL" buttons use the new compressed format

### Importing:

-   Automatically detects and imports champion level when available
-   Falls back to legacy format for older exports
-   No user action required - works transparently

## Benefits:

1. **Smaller URLs**: Much shorter shareable links
2. **Better UX**: Faster loading and sharing
3. **Champion Level**: Preserves build context
4. **Backward Compatible**: Existing shares still work
5. **Future Proof**: Extensible format for additional features


