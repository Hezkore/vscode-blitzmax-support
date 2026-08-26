![BlitzMax Logo](../media/blitzmax_title.svg)

# Code Formatter

A code formatter is an external application that helps keep your layout, indentation and capitalization consistent across all of your projects.\
Right click the BlitzMax document you're editing and select "Format Document".\
You can also select the specific text you want formatted.

![Format Document](../media/format.png)

VS Code has many optional settings for automatic formatting, including "Format On Type" and "Format On Save".

The [BlitzMax Language Server](https://github.com/Hezkore/blitzmax-language-server) does this for you, so if you have that installed there is nothing else to set up.

Otherwise a formatter needs to be installed manually and the "formatter path" needs be set in your [BlitzMax extension settings](command:blitzmax.settings).\
Search for BlitzMax code formatters on [GitHub](https://github.com/search?q=topic%3ABlitzMax+topic%3Aformatter).

# Language Server Protocol (LSP)

A LSP is an external application that provides diagnostics, document symbols _(outliner)_, better auto-complete, code fixes and suggestions among many other things.\
The LSP starts automatically and keeps track of your code changes in the background.

The one to use is the [BlitzMax Language Server](https://github.com/Hezkore/blitzmax-language-server).\
Put its `bls` binary in the `bin` folder of your BlitzMax NG install, next to `bmk` and `bcc`, and the extension finds it on its own.\
If you keep it somewhere else, set the "LSP path" in your [BlitzMax extension settings](command:blitzmax.settings).