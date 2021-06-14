![BlitzMax Logo](../media/blitzmax_title.svg)

## Projects

While VS Code works just fine with single source files, it works best for large projects!

A project is simply any existing source folder, there is no need for a separate project file.\
Open any BlitzMax source folder via the `File` menu.

![Open Folder](../media/open_folder.png)

This will allow VS Code to create its `.vscode` folder, where any project settings are stored.

The source file for your default build task can be locked.\
Right click any `.bmx` document and select "Set As Default Build Task Source File".

![Set Source](../media/set_source.png)

## Workspaces

An alternate - _rarely used_ - version of a folder project is a "workspace".\
It consists of multiple folder projects, all stored at different locations and cannot be a subfolder.

While a workspace has it advantages, it can also be confusing for new users.\
Each folder project inside a workspace still behaves as a separate project, using its own settings, build options and debug configurations.\
The "active" folder project in a workspace will be based on things like your active source document.

A workspace is automatically created when adding more folders to your project.\
Select "Add Folder to Workspace" in the `File` menu to create a workspace.

![Add Folder](../media/add_folder.png)

Unlike a folder project, a workspace needs a separate workspace file.\
This means you will have to use "Open Workspace" in the `File` menu to later open your workspace.

![Open Workspace](../media/open_workspace.png)