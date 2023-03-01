# TSTL Extensions
[![npm (scoped)](https://img.shields.io/npm/v/@cheatoid/tstl-extensions?style=for-the-badge)](https://www.npmjs.com/package/@cheatoid/tstl-extensions)

Plugin for [TSTL](https://github.com/TypeScriptToLua/TypeScriptToLua) which provides various low-level extensions.

## 🛠 Installation
1. Get the latest package from npm:
    ```
    npm i @cheatoid/tstl-extensions
    ```
2. Edit your `tsconfig.json` file accordingly to enable the plugin:
    ```diff
    {
      "compilerOptions": {
        "types": [
    +     "@typescript-to-lua/language-extensions",
    +     "@cheatoid/tstl-extensions",
        ]
      },
      "tstl": {
        "luaPlugins": [
    +     { "name": "@cheatoid/tstl-extensions/index.js" },
        ]
      }
    }
    ```

## ✨ Features

Note: This plugin exposes most of low-level functionality via special functions which are prefixed with double-underscore (`__`).

### ***`continue` support***
If your target Lua environment supports `continue` statement (such as Garry's Mod Lua)...  
Due to specific nature of this feature, you must explicitly opt-in by modifying your `tsconfig.json` file by appending the following on the bottom (outside of `"tstl"` node):
```diff
{
  "compilerOptions": {
    ...
  },
  "tstl": {
    ...
  },
+ "tstlCustom": {
+   "luaContinueSupport": true
+ }
}
```
With this change applied, you can use `continue` in your TS code and it will emit a `continue` statement in Lua.


### ***`goto` & label support***
Only usable if your target Lua environment supports `goto` and labels (such as Lua 5.2+ or JIT)...  
The following table is hopefully self-explanatory:
|    **TypeScript**    |    **Lua**     |
| :------------------: | :------------: |
| `__goto("MyLabel")`  | `goto MyLabel` |
| `__label("MyLabel")` | `::MyLabel::`  |


### ***Efficient swapping***
This allows you to swap two values [without a temporary variable](https://typescripttolua.github.io/play/#code/MYewdgzgLgBAhgJwTAvDA2gIgGYEsHSYA0MmEApqGACaYC6A3AFDqILoAMdJb6AjHTqoMvATySdBDGAHoZMKAE8ADrmBwANjAgB3OMqbKEuMFAAUUOACMN5AHRV15tiUykAlO4ZA):  
The following table is hopefully self-explanatory:
|      **TypeScript**      |              **Lua**              |
| :----------------------: | :-------------------------------: |
| `__swap(arr[0], arr[1])` | `arr[1], arr[2] = arr[2], arr[1]` |


### ***`unsafe_cast`***
This is useful in-place replacement for `as any` casting, because it allows to "find all references" quickly.  
For example, instead of writing `foo as any as TheFoo` (or `<TheFoo><any>foo`), you can instead do `unsafe_cast<TheFoo>(foo)`.


### ***`next` iterator support***
Call `__next` using for-of loop, you may optionally want to specify a starting index.  
Example usage:
```ts
for (const [k, v] of __next(_G)) {
    print(k, v);
}
```
Transpiles to:
```lua
for k, v in next, _G do
    print(k, v)
end
```


### ***Aggressive inlining***
Function calls have certain performance overhead. This feature allows to inline the body of the given function in-place, which can be beneficial in hot-path for high-performance code. It mostly just works, but consider it as experimental.  
Currently there is a drawback in the implementation, the target function must be defined in the same file where you want to inline it.  
Simple example:
```ts
function InlineExample(name: string) {
    print(`Hello, ${name}`);
    print("The code to be inlined goes here");
}
const john = "John";
__inline(InlineExample, john);
__inline(InlineExample, "Moon");
```
Transpiles to:
```lua
local john = "John"
do
    local name = john
    print("Hello, " .. name)
    print("The code to be inlined goes here")
end
do
    local name = "Moon"
    print("Hello, " .. name)
    print("The code to be inlined goes here")
end
```


### ***Top-level return***
This feature allows you to bypass TypeScript limitation - ts(1108) error.  
You should only consider this as a last resort option (hint: try using export assignment `export = ...`), or if you want to bail out from a script.  
Simply call `__return`, you may optionally pass additional arguments to be returned at call site.


### ***And more...***
*I am just tired to go over all of them... I hope there is a little bit of something for everyone to enjoy.* :P


## 📜 History
This plugin was initially published at GitHub Gist ([here](https://gist.github.com/ea4573c6bd1992fc4940090543ec9380)), which is **outdated** as of now, perhaps you may still find something interesting down in the comments.


## 👏 Credits
Special thanks to [TypeScriptToLua](https://typescripttolua.github.io) developers and contributors for their awesome project.
