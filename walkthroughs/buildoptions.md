![BlitzMax Logo](../media/blitzmax_title.svg)

## Changing your BlitzMax build options

Your activity bar has a brand new BlitzMax button!\
Click the rocket in your activity bar to see the options for your current BlitzMax build task.

![Build Options](../media/build_options.png)

Double click to toggle items on and off.\
Hover your mouse over an item to display more information.

![Build Hover](../media/build_hover.png)

The source file for your default build task can be locked.\
Right click any `.bmx` document and select "Set As Default Build Task Source File".

![Set Source](../media/set_source.png)

## Multiple build tasks

Click the cogwheel to select a new default build task or create new one.

![Build Task](../media/build_task.png)

BlitzMax VS Code tasks use the `bmx` task type.\
You can read more about VS Code tasks [here](https://code.visualstudio.com/docs/editor/tasks)

## Legacy build option

The legacy build option is unique to VS Code.\
It ensures that no NG specific build options are passed to the BlitzMax legacy compiler.\
This means that the legacy build option should __only__ be enabled if you're using BlitzMax legacy.