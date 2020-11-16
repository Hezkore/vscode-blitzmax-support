# BlitzMax LSP and Debug concept

This is a proof of concept VS Code debug adapter extension with integrated LSP support for BlitzMax.\
The debug adapter and LSP support is incomplete and will not work as intended, nor does it represent the final product.

You can discuss this proof of concept on Discord: [![Discord Chat](https://img.shields.io/discord/613699895139762176.svg?logo=discord&style=social)](https://discord.gg/DrrVwhz)\
We hang out in the **#vscode-extension** channel!

### ***The extension does *not* include a LSP!***
---
This means you'll have to provide or write your own LSP.\
A WIP LSP can be found [here](https://github.com/GWRon/bmxng-languageserver).

*Useful links:*\
[VS Code specific information](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide)\
[Official LSP specifications](https://microsoft.github.io/language-server-protocol/specifications/specification-current/)

# Instructions
## Build and Run
* Make sure any previous BlitzMax VS Code extensions are disabled or uninstalled
* Make sure you have [Node.js](https://nodejs.org/) installed
* Clone [https://github.com/Hezkore/vscode-blitzmax-concept.git](https://github.com/Hezkore/vscode-blitzmax-concept.git) to any folder
* Open the folder in VS Code
* Type `npm install` in the terminal
* Press `F5` to build and launch in a new VS Code instance

The extension will start when a BlitzMax source file *(`.bmx`)* is opened, or when a debug session is started.

## LSP information
The LSP starts along with the extension.
* Place your LSP executable *(`lsp.exe` on Windows)*  inside your `BlitzMax\bin` folder
* In the new VS Code instance
	* Set your BlitzMax root path in Settings
	* Reload the VS Code window with the command `Reload Window` via the Command Palette *(`Ctrl+Shift+P`)*