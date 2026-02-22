# Item Override Modes

`createitems/cass.py` reads `createitems/item-overrides.json` and applies overrides
after live data is fetched but before `Items.ts` is generated.

## Shape

```json
{
  "schemaVersion": 1,
  "items": {
    "<Item Name>": {
      "<field>": "<direct value>"
    }
  }
}
```

`<field>` can be any generated item field (`aliases`, `cost`, `attack_damage`, etc.).

## Operations

Direct value:

```json
{
  "items": {
    "Infinity Edge": {
      "cost": 3600
    }
  }
}
```

Explicit set:

```json
{
  "items": {
    "Infinity Edge": {
      "cost": { "mode": "set", "value": 3600 }
    }
  }
}
```

List operations (for fields like `aliases`):

```json
{
  "items": {
    "Cull": {
      "aliases": { "mode": "remove", "values": ["dblade"] }
    },
    "Rapid Firecannon": {
      "aliases": { "mode": "add", "values": ["rfcannon"] }
    },
    "Trinity Force": {
      "aliases": { "mode": "replace", "values": ["triforce", "tf"] }
    },
    "Lord Dominik's Regards": {
      "aliases": {
        "mode": "patch",
        "add": ["ldr"],
        "remove": ["lw"]
      }
    }
  }
}
```

`patch` applies in this order: `replace` -> `add` -> `remove`.
