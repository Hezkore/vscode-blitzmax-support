# BlitzMax for Visual Studio Code
[![Version](https://badgen.net/vs-marketplace/v/hezkore.BlitzMax)](https://marketplace.visualstudio.com/items?itemName=hezkore.Blitzmax)
[![Installs](https://badgen.net/vs-marketplace/i/hezkore.BlitzMax)](https://marketplace.visualstudio.com/items?itemName=hezkore.BlitzMax)
[![Rating](https://badgen.net/vs-marketplace/rating/hezkore.BlitzMax)](https://marketplace.visualstudio.com/items?itemName=hezkore.BlitzMax)
[![Discord Chat](https://img.shields.io/discord/613699895139762176.svg?logo=discord&style=social)](https://discord.gg/yF6PMaY5aE)

Welcome to the [BlitzMax](https://blitzmax.org/) extension for [Visual Studio Code](https://code.visualstudio.com/)!\
If you are new to BlitzMax or VS Code, make sure you read [how to get started](#get-started-writing-blitzmax-code-in-vs-code).

This extension provides the following features inside VS Code for BlitzMax source files:

* Built-in documentation, examples and help
* [Language Server Protocol *](#note-about-using-the-language-server-protocol)
* Easy quick build buttons
* Syntax highlighting
* Build options view
* Problem matcher
* [Formatting *](#note-about-using-formatting)
* Debugging
* Snippets

Install the [BlitzMax Language Server](https://github.com/Hezkore/blitzmax-language-server) alongside it and you also get error checking, auto-complete, outline, go to definition, rename and formatting.\
See [the note below](#note-about-using-the-language-server-protocol) for how to set it up.

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
A "LSP" server is an external application that reads your project and source code.\
It can provide linting and very accurate auto-complete suggestions, among many other things.

[**BlitzMax Language Server**](https://github.com/Hezkore/blitzmax-language-server) is the one to use.\
It is written in BlitzMax NG and uses the real `bcc` compiler front end, so what it tells you is what a build would tell you.\
It also works on a project that has never been built, and on edits you have not saved yet.

Put the `bls` binary in the `bin` folder of your BlitzMax NG install, next to `bmk` and `bcc`.\
The extension looks there on its own, so nothing needs configuring.\
If you keep it somewhere else, point `blitzmax.lsp.path` at it.

With it installed you get:

* Errors and warnings straight from the compiler, shown as you work
* Outline, breadcrumbs and Go to Symbol in Workspace
* Auto-complete offering only what your program can actually reach
* Go to definition, find all references, and rename across the whole project
* Hover documentation, signature help and inline hints
* Formatting, so you no longer need a separate formatter
* Advice on syntax that compiles cleanly but does not do what it looks like

Any other server will work too, as long as it speaks LSP.\
An older work in progress server can be found [here](https://github.com/GWRon/bmxng-languageserver).

Useful LSP links for server developers:\
[VS Code specific information](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide)\
[Official LSP specifications](https://microsoft.github.io/language-server-protocol/specifications/specification-current/)

### ***Note about using formatting***
---
The [BlitzMax Language Server](https://github.com/Hezkore/blitzmax-language-server) handles formatting, so installing it is all you need.

Without a server, formatting is handled externally and you will have to install a BlitzMax specific formatter.\
The extension will guide you through this process on the first format.

### FAQ
---
* **Q**. What languages are supported?
	* **A**. Only [BlitzMax NG](https://blitzmax.org/) is officially supported.\
	You can enable the *'Legacy Mode'* build option for basic BlitzMax Vanilla/Legacy build support.\
	_(I highly recommend you upgrade to [BlitzMax NG](https://blitzmax.org/))_

* **Q**. Why is the [outlines](https://code.visualstudio.com/docs/getstarted/userinterface#_outline-view) view and [breadcrumbs](https://code.visualstudio.com/docs/editor/editingevolved#_breadcrumbs) not working?
	* **A**. These features are provided by the [LSP](#note-about-using-the-language-server-protocol) server.\
	Install the [BlitzMax Language Server](https://github.com/Hezkore/blitzmax-language-server) and they start working.

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
