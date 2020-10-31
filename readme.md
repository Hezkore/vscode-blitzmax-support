# BlitzMax LSP and Debug concept

This is a proof of concept VS Code debug adapter extension with integrated LSP support for BlitzMax.\
The debug adapter and LSP support is incomplete and will not work as intended, nor does it represent the final product.

You can discuss this proof of concept on Discord: [![Discord Chat](https://img.shields.io/discord/613699895139762176.svg?logo=discord&style=social)](https://discord.gg/DrrVwhz)\
We hang out in the #vscode-extension channel!

### ***The extension does *not* include a LSP!***
---
This means you'll have to provide or write your own LSP.\
Here's a very quick and dirty [Example LSP](https://gist.github.com/Hezkore/a48373bbc19815655ca7d5938325524e) written in [BlitzMax NG](https://blitzmax.org/) to get your started.\
It also contains a few notes on what to think about when developing your LSP.\
VS Code specific LSP information can be found
[here](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide), while the LSP specifications are found [here](https://microsoft.github.io/language-server-protocol/specifications/specification-current/).

### ***The extension does *not* feature a task provider yet!***
---
This means it cannot build any BlitzMax source files *(`.bmx`)* or projects.\
Any BlitzMax source files *(`.bmx`)* must be compiled outside of VS Code or using a separate extension.

# Instructions
## Build and Run
* Make sure any previous BlitzMax VS Code extensions are disabled or uninstalled
* Make sure you have [Node.js](https://nodejs.org/) installed
* Clone [https://github.com/Hezkore/vscode-blitzmax-concept.git](https://github.com/Hezkore/vscode-blitzmax-concept.git) to any folder
* Open the folder in VS Code
* Type `npm install` in the terminal
* Press `F5` to build and launch in a new VS Code instance

The extension will start when a BlitzMax source file *(`.bmx`)* is opened.

## LSP information
The LSP starts along with the extension.
* Place your LSP executable *(`lsp.exe` on Windows)*  inside your `BlitzMax\bin` folder
* In the new VS Code instance
	* Set your BlitzMax root path in Settings
	* Reload the VS Code window with the command `Reload Window` via the Command Palette *(`Ctrl+Shift+P`)*

## Debugger information
The debugger currently only launches an existing already-built executable.
* In the new VS Code instance
  * Open a folder or source file *(`.bmx`)* file
  * Make sure the opened source file *(`.bmx`)* has a `.debug` executable in the same folder\
  *(ie. `test.bmx` will need a `test.debug.exe` on Windows)*
  * Press `F5` and select `BlitzMax Debug` to start debugging the executable

Go [here](https://code.visualstudio.com/docs/editor/debugging#_run-view) to learn more about debugging in VS Code and how to *(not required)* setup a `launch.json` configuration.