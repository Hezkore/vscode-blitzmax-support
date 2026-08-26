# BlitzMax for Visual Studio Code
[![Version](https://badgen.net/vs-marketplace/v/hezkore.BlitzMax)](https://marketplace.visualstudio.com/items?itemName=hezkore.Blitzmax)
[![Installs](https://badgen.net/vs-marketplace/i/hezkore.BlitzMax)](https://marketplace.visualstudio.com/items?itemName=hezkore.BlitzMax)
[![Rating](https://badgen.net/vs-marketplace/rating/hezkore.BlitzMax)](https://marketplace.visualstudio.com/items?itemName=hezkore.BlitzMax)
[![Discord Chat](https://img.shields.io/discord/613699895139762176.svg?logo=discord&style=social)](https://discord.gg/yF6PMaY5aE)

Welcome to the [BlitzMax](https://blitzmax.org/) extension for [Visual Studio Code](https://code.visualstudio.com/)!\
If you are new to BlitzMax or VS Code, make sure you read [how to get started](#get-started-writing-blitzmax-code-in-vs-code).

This extension provides the following features inside VS Code for BlitzMax source files:

* Built-in documentation, examples and help
* [Language Server Protocol](#note-about-using-the-language-server-protocol)
* Easy quick build buttons
* Syntax highlighting
* Build options view
* Problem matcher
* [Formatting *](#note-about-using-formatting)
* Debugging
* Snippets

BlitzMax NG 1.00 and newer ships with its own language server, so error checking, auto-complete, outline, go to definition and rename work straight away with nothing to install and nothing to set up.

You can discuss this extension on Discord: [![Discord Chat](https://img.shields.io/discord/613699895139762176.svg?logo=discord&style=social)](https://discord.gg/yF6PMaY5aE)\
We hang out in the **#vscode-extension** channel!

### **Get started writing BlitzMax code in VS Code**
---
* [Step by step guide](https://github.com/Hezkore/vscode-blitzmax-support/discussions/10) - A guide to installing and compiling your first application.
* [Extension FAQ](#faq) - Make sure you read this first.
* [BlitzMax NG](https://blitzmax.org/docs/en/setup/get_started/) - Everything you need to start using BlitzMax NG.
* [VS Code Introduction](https://code.visualstudio.com/docs/getstarted/introvideos) - Videos on how to get started with VS Code.
* [Basics Editing](https://code.visualstudio.com/docs/editor/codebasics) - Learn about highly productive source code editing.
* [Debugging](https://code.visualstudio.com/docs/editor/debugging) - All you need to know about debugging.
* [Tasks](https://code.visualstudio.com/docs/editor/tasks) - Get things done quicker with tasks.
* [Guide to tasks](https://github.com/Hezkore/vscode-blitzmax-support/discussions/12) - A guide to using tasks specifically with BlitzMax NG.

### **Changelog**
---
See [CHANGELOG](https://marketplace.visualstudio.com/items/Hezkore.blitzmax/changelog).

### ***Note about using the Language Server Protocol***
---
A language server is a separate program that reads your project and your code, and tells the editor what it found.\
Error checking, auto-complete, the outline, go to definition, rename and hover documentation all come from it.

**BlitzMax NG 1.00 and newer ships with one, so a recent release is all you need.**

It is called `bls` and it sits in the `bin` folder of your BlitzMax NG install, next to `bcc` and `bmk`, which is exactly where the extension looks.\
If you moved it somewhere else, point `blitzmax.lsp.path` at it.

`bls` shares its parser and its model of the language with the compiler, so what it tells you is what a build would tell you.\
It also works on a project that has never been built, and on edits you have not saved yet.

You get:

* Errors and warnings straight from the compiler, shown as you work
* Outline, breadcrumbs, folding and Go to Symbol in Workspace
* Auto-complete offering only what your program can actually reach
* Go to definition, go to type, find all references, and rename across the whole project
* Type hierarchy, so you can walk up and down from any type
* Hover documentation, signature help and inline hints
* Colouring by what a name really is, so a type and a local no longer look alike
* Quick fixes on the problems it reports

Any other server will work too, as long as it speaks LSP.\
Point `blitzmax.lsp.path` at it and put anything it needs on the command line in `blitzmax.lsp.args`.

The server reads your project the way a build would, so it needs to know which build you mean.\
`blitzmax.lsp.buildMode` picks debug or release, `blitzmax.lsp.targetPlatform` and `blitzmax.lsp.targetArchitecture` pick the target, and leaving those two empty means the machine you are sitting at.\
The rest of the `blitzmax.lsp` settings are described in the settings editor.

If different workspace folders use different BlitzMax SDKs, enable `blitzmax.lsp.multi`. Each folder can then override `blitzmax.base.path` and `blitzmax.lsp.path` in its own `.vscode/settings.json`; folders without overrides continue to use your user-level defaults.

Useful LSP links for server developers:\
[VS Code specific information](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide)\
[Official LSP specifications](https://microsoft.github.io/language-server-protocol/specifications/specification-current/)

### ***Note about using formatting***
---
Formatting is not part of the language server, so this one still needs a separate program.

The extension looks for a formatter called `bfm` in the `bin` folder of your BlitzMax NG install, next to `bls`.\
If yours has a different name or lives somewhere else, point `blitzmax.formatter.path` at it.\
The extension will offer to help the first time you format without one.

### FAQ
---
* **Q**. What languages are supported?
	* **A**. Only [BlitzMax NG](https://blitzmax.org/) is officially supported.\
	You can enable the *'Legacy Mode'* build option for basic BlitzMax Vanilla/Legacy build support.\
	_(I highly recommend you upgrade to [BlitzMax NG](https://blitzmax.org/))_

* **Q**. Why is the [outlines](https://code.visualstudio.com/docs/getstarted/userinterface#_outline-view) view and [breadcrumbs](https://code.visualstudio.com/docs/editor/editingevolved#_breadcrumbs) not working?
	* **A**. These come from the [language server](#note-about-using-the-language-server-protocol).\
	BlitzMax NG 1.00 and newer ships with one, so updating BlitzMax is usually the fix.

* **Q**. I've found an issue / I'd like to make a feature request\, what do I do?
	* **A**. Is the issue or request already listed at [GitHub Issues](https://github.com/Hezkore/vscode-blitzmax-support/issues)?\
	If not, you can open up a new [GitHub issue here](https://github.com/Hezkore/vscode-blitzmax-support/issues/new).

* **Q**. How do I _`<do this or that>`_ in VS Code?\
	_(aka. I need more help)_
	* **A**. For general questions or VS Code related help you have few options:
		
		1. Read [Get started writing BlitzMax code in VS Code](#get-started-writing-blitzmax-code-in-vs-code).
		
		2. Use our [GitHub Discussions board](https://github.com/Hezkore/vscode-blitzmax-support/discussions).
		3. Visit our **#vscode-extension** channel on Discord: [![Discord Chat](https://img.shields.io/discord/613699895139762176.svg?logo=discord&style=social)](https://discord.gg/yF6PMaY5aE)

### **Credits**
---
[BlitzMax](https://nitrologic.itch.io/blitzmax/) by [Mark Sibly](https://github.com/blitz-research).\
[BlitzMax NG](https://blitzmax.org/) by [Brucey](https://github.com/woollybah).\
Extension by [Hezkore](https://github.com/Hezkore).\
Icons by [GWRon](https://github.com/GWRon).

### **Contributing**
---
Contributions are greatly appreciated.\
Fork this repository and open your pull requests.

### **License**
---
Licensed under the [MIT](https://github.com/Hezkore/vscode-blitzmax-support/blob/master/LICENSE.txt) License.
