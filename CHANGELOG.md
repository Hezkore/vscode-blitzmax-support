## 2.17.4
* Extension will now disable features the LSP covers

## 2.17.3
* Updated language configuration

## 2.17.2
* Updated grammar syntax

## 2.17.1
* Re-write of grammar syntax

## 2.17.0
* Linked 'Go to Definition' function to 'Go to Symbol in Workspace' function

## 2.16.2
* Adjusted BlitzMax-like default text settings

## 2.16.1
* More work on grammar syntax and language configuration
* New BlitzMax-like default text settings

## 2.16.0
* Complete re-write of the grammar syntax and language configuration
	* This fixes a lot of syntax highlighting issues, indention issues, allows VS Code to make smarter decisions when it comes to BlitzMax quirks, and allows usage of the 'Reindent Lines' command to some degree

## 2.15.4
* New 'Stop all' LSP option

## 2.15.3
* Change in dependencies

## 2.15.2
* Fixed an issue with the build tree

## 2.15.1
* More information during build

## 2.15.0
* New documentation view
* Hover information now shows default value
* Fixed multiple issues with the documentation parser
* Fixed multiple hover information issues
* Fixed an issue with the signature helper
* Fixed an issue with the Html CSS replacer

## 2.14.0
* Added workspace symbols

## 2.13.0
* Added document color preview
* Fixed an issue with the 'Rebuild Documentation' command
* Added 'Build Modules', 'Rebuild All Modules' and 'Display BlitzMax Version' commands

## 2.12.0
* Added document symbol provider (outliner)
* Fixed an evaluation request error

## 2.11.3
* Walkthrough now has direct comparisons with MaxIDE

## 2.11.2
* Fixed an issue with the debugger not stopping correctly
* The build options view now sets task group to 'build'
* Updated walkthrough with new steps and information

## 2.11.1
* Added 'Run Without Debugging' button in debug menu
* Added debug stack variable hover
* Changed default build options

## 2.11.0
* Added custom BlitzMax 'Getting Started' walkthrough
* Changed default build options

## 2.10.1
* Fixed an issue with the 'Rebuild Documentation' command
* Setting task source file will now try to use a relative path

## 2.10.0 "The Windows Update"
* Fixed multiple Windows related issues
* Module suggestions in auto complete list
* Selected text is now used for quick help
* Better settings descriptions

## 2.9.2
* Fixed an issue with the code formatter and 'Format On Type'

## 2.9.1
* Fixed an issue where the code formatter could get stuck forever
* Added code formatter argument options
* Added helper guide for selecting code formatter path

## 2.9.0
* Added support for external code formatters

## 2.8.4
* Fixed a build problem when the user had no workspace
* More extension activation rules

## 2.8.3
* Problems view will no longer be focused when there are no problems to display

## 2.8.2
* Error messages are now correctly displayed in debug mode

## 2.8.1
* 'Unhandled Exceptions' are now handled correctly

## 2.8.0
* Added BlitzMax documentation webview

## 2.7.0
* Support for BlitzMax 'commands.txt' file
* Press F1 on words to get information
* Hover over words to get information
* Auto complete support
* Signature helper support
* Added 'Rebuild Documentation' command

## 2.6.1
* Fixed a build task bug

## 2.6.0
* Added option to reset build options
* Added option to change build task
* Build tree now shows task in use

## 2.5.0
* Added BlitzMax Legacy support
* More advanced build options

## 2.4.6
* Fixed a build tree issue
* Fixed a task provider issue

## 2.4.5
* Updated webpack

## 2.4.4
* Optimized file sizes

## 2.4.3
* The build view is now the options view
* Added options view welcome screen

## 2.4.2
* Quick Run button will now change depending on debugging state
* Added 'hidpi' and 'gprof' build options
* Updated build tree layout
* Default build task is now identical to MaxIDE
* Fixed some incorrect build flags

## 2.4.1
* Fixed a LSP error

## 2.4.0
* Breakpoint support

## 2.3.1
* LSP hot reload option
* LSP fixes

## 2.3.0
* New LSP options
* Fixed a few LSP bugs
* Fixed 'Run Without Debugging' still starting a debug session
* The BlitzMax debugger will now be selected by default for .bmx files
* Fixed a build output path problem
* Prettier build terminal output

## 2.2.1
* New icons
* LSP fixes
* Debugger fixes

## 2.2.0
* New BlitzMax debug parser

## 2.1.3
* Updated dependencies
* Fixed some task provider issues

## 2.1.2
* Removed -p parameter
* Updated dependencies
* Fixed some Linux specific issues

## 2.1.1
* Added snippets

## 2.1.0
* Added build-tree
* Added debug/build shortcuts

## 2.0.1
* Extension will no longer crash if no LSP is found

## 2.0.0
* Complete re-write of extension