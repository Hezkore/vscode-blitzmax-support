![BlitzMax Logo](../media/blitzmax_title.svg)

## Project settings

While each folder project has its own build options and launch configurations, it can also have its very own user settings!\
Right click the explorer view and select "Open Folder Settings".

![Folder Settings](../media/folder_settings.png)

It is also recommended that you have a quick glance at the VS Code settings.\
There are a lot of cool features to enable, or disable!

## Snippets

Most of the basic keywords like `Type`, `Function` and `For` have pre-made snippets.\
Look for the snippet icon when inserting known keywords.

![Snippet Icon](../media/snippet_icon.png)

![Snippet](../media/snippet.gif)

## Tasks

You don't have to manually edit your build task options in `tasks.json` thanks to the BlitzMax build options view.\
But it still a good idea to learn about tasks and look at `tasks.json` located in the `.vscode` folder in your project.\
A task doesn't just have to compile your application, it can also start external applications, run scripts, test your application or generally anything you want.\
You can also create tasks that run in parallel, allowing you to compile multiple things at once.

![Task](../media/task.png)

Tasks are a powerful tool, and you can read more about them [here](https://code.visualstudio.com/docs/editor/tasks).

## Compiling for other platforms & remotely

VS Code has a few methods for allowing you to compile for other platforms.

If you have access to multiple computers, you can simply use SSH to remotely develop your application.\
It allows you to code, compile and run your code remotely using the SSH protocol.\
You can read more about it [here](https://code.visualstudio.com/docs/remote/ssh).

If you're using Windows, you can use Windows WSL to compile for Linux.\
You can read more about it [here](https://code.visualstudio.com/docs/remote/wsl).

The BlitzMax VS Code extension supports all current remote development methods.\
A general overview of remote coding can be found [here](https://code.visualstudio.com/docs/remote/remote-overview).

## Git integration

The BlitzMax VS Code extension fully supports the built-in Git extension.

![Git](../media/git.png)

The [GitLens](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens) extension is also fully supported.

![GitLens](../media/gitlens.png)

[Git Graph](https://marketplace.visualstudio.com/items?itemName=mhutchie.git-graph) helps you visualize your Git commits.

![Git Graph](../media/gitgraph.png)