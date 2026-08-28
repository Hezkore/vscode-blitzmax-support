![BlitzMax Logo](../media/blitzmax_title.svg)

# Changing your BlitzMax build options

Your activity bar has a brand new BlitzMax button!\
Click the rocket in your activity bar to see your current BlitzMax build options.

![Build Options](../media/build_options.png)

Double click to toggle items on and off.\
Hover your mouse over an item to display more information.

![Build Hover](../media/build_hover.png)

* _The build options view is displaying your default build task in `.vscode/tasks.json`.\
Read more in the "Building & Tasks" step._

# Locking the build file

The **Build File** at the top of the view controls which `.bmx` file is used by
Build, Build and Run, and debugging. Compatible language servers also use a
locked file as the project-analysis root.

By default it displays **Active editor file (unlocked)**. This is equivalent to
MaxIDE without a locked file: whichever source file is active is built.

Use **BlitzMax: Lock Current File for Building** from the editor or Explorer
context menu to make that file the application root. The view then displays its
path followed by **(locked)**. This is equivalent to locking a file in MaxIDE.

Use **BlitzMax: Unlock Build File** to return to building the active editor file.
The extension stores the same setting in the default BlitzMax task's `source`
field, so existing `.vscode/tasks.json` files remain compatible.

# Multiple build options

Click the cogwheel to select a new build task or create a new one.

![Build Task](../media/build_task.png)

* _This will change your default build task in `.vscode/tasks.json`.\
Read more in the "Building & Tasks" step._

# Legacy build option

The legacy build option is unique to VS Code.\
It ensures that no NG specific build options are passed to the BlitzMax legacy compiler.\
This means that the legacy build option should __only__ be enabled if you're using BlitzMax legacy.
