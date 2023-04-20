# BlitzMax for Visual Studio Code
[![Version](https://vsmarketplacebadges.dev/version-short/hezkore.BlitzMax.svg)](https://marketplace.visualstudio.com/items?itemName=hezkore.Blitzmax)
[![Installs](https://vsmarketplacebadges.dev/installs-short/hezkore.BlitzMax.svg)](https://marketplace.visualstudio.com/items?itemName=hezkore.BlitzMax)
[![Rating](https://vsmarketplacebadges.dev/rating-star/hezkore.BlitzMax.svg)](https://marketplace.visualstudio.com/items?itemName=hezkore.BlitzMax)
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
A "LSP" server is an external application that monitors your project and source code.\
It can provide linting and very accurate auto-complete suggestions, among many other things.\
\
You will have to provide _(or write)_ your own LSP server.\
A work in progress LSP server can be found [here](https://github.com/GWRon/bmxng-languageserver).

Useful LSP links for server developers:\
[VS Code specific information](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide)\
[Official LSP specifications](https://microsoft.github.io/language-server-protocol/specifications/specification-current/)

### ***Note about using formatting***
---
Formatting is currently handled externally.\
You will have to install a BlitzMax specific formatter.\
_(Unless your [LSP](#note-about-using-the-language-server-protocol)  server handles it)_\
\
The extension will guide you through this process on the first format.

### FAQ
---
* **Q**. What languages are supported?
	* **A**. Only [BlitzMax NG](https://blitzmax.org/) is officially supported.\
	You can enable the *'Legacy Mode'* build option for basic BlitzMax Vanilla/Legacy build support.\
	_(I highly recommend you upgrade to [BlitzMax NG](https://blitzmax.org/))_

* **Q**. Why is the [outlines](https://code.visualstudio.com/docs/getstarted/userinterface#_outline-view) view and [breadcrumbs](https://code.visualstudio.com/docs/editor/editingevolved#_breadcrumbs) not working?
	* **A**. These features are provided by the [LSP](#note-about-using-the-language-server-protocol) server.\
	Make sure your current [LSP](#note-about-using-the-language-server-protocol) supports these features.

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
Licensed under the [MIT](https://github.com/Hezkore/vscode-blitzmax-support/blob/master/LICENSE.md) License.
