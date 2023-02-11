# TSTL Extensions
![npm (scoped)](https://img.shields.io/npm/v/@cheatoid/tstl-extensions?style=for-the-badge)

Plugin for [TSTL](https://github.com/TypeScriptToLua/TypeScriptToLua) which provides various low-level extensions.

## Installation
1. Get this package from npm:
  `npm i @cheatoid/tstl-extensions`
2. Edit your `tsconfig.json` file accordingly to enable the plugin:
    ```diff
    {
      "tstl": {
        "luaPlugins": [
    +      { "name": "@cheatoid/tstl-extensions/dist/index.js" },
        ]
      }
    }
    ```
