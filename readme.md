# BlitzMax LSP and Debug concept

This is a proof of concept VS Code debug adapter and LSP for BlitzMax.
The LSP and debug adapter are both incomplete and will not work as intended.

The sample is meant as an educational piece showing how to implement a BlitzMax debug
adapter and LSP  client for VS Code. It can be used as a starting point for developing a real adapter and LSP.

More information about how to develop a new debug adapter can be found
[here](https://code.visualstudio.com/docs/extensions/example-debuggers). LSP information can be found
[here](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide).

Or discuss this proof of concept on Discord: [![Discord Chat](https://img.shields.io/discord/613699895139762176.svg?logo=discord&style=social)](https://discord.gg/DrrVwhz)

**The extension does *not* feature any task provider! This means it cannot build any BlitzMax files or projects. Any BlitzMax source files must be compiled outside of VS Code.**

## Build and Run

* Make sure any previous BlitzMax extensions are disabled or uninstalled.
* Clone the project [https://github.com/Hezkore/vscode-blitzmax-concept.git](https://github.com/Hezkore/vscode-blitzmax-concept.git)
* Open the project folder in VS Code.
* Type `npm install` in the terminal.
* Press `F5` to build and launch in a new VS Code window.

### LSP
* Compile *bmx/lsp.bmx* in MaxIDE.
* In the new VS Code window.
  * Open Settings and navigate to *Extensions > BlitzMax > LSP Path*.
  * Enter the absolute path to your newly compiled LSP executable.
  * Open the **Command Palette** and type `Reload Window` to reload the window and extension with the correct path.

### Debug
* In the new VS Code window.
  * Open a folder or **.bmx** file.
  * Make sure the opened **.bmx** file has a **.debug** executable in the same folder.
  * *(ie. **test.bmx** will need a **test.debug.exe** on Windows.)*
  * Press `F5` and select **BlitzMax Debug** to start debugging the executable.