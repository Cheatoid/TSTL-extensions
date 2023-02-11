# TSTL Extensions
Plugin for [TSTL](https://github.com/TypeScriptToLua/TypeScriptToLua) which provides various low-level extensions.

## Installation
1. `npm i @cheatoid/tstl-extensions`
2. Edit your `tsconfig.json` file accordingly to enable the plugin:
    ```json
    {
      "tstl": {
        "luaPlugins": [
          {
            "name": "./node_modules/@cheatoid/tstl-extensions/index.ts"
          }
        ]
      }
    }
    ```
