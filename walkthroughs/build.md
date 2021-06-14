![BlitzMax Logo](../media/blitzmax_title.svg)

## Building

A quick way to build your application is by using the shortcut button in the upp right corner.\
This will automatically generate and run a VS Code build task.

![Quick Buttons](../media/quick_buttons.png)

Remember that VS Code is context sensitive.\
This means that the BlitzMax shortcut buttons will only be visible when editing a BlitzMax source file.

You can also use the `Terminal` menu to run a build task _(Ctrl + Shift + B)_.

![Build Start](../media/build_start.png)

If no build task exists you will be prompted to select a template build task.

![Task Template](../media/task_template.gif)

This will create a new `tasks.json` with your selected template.\
You're now ready to run your build task.

You can always use the BlitzMax build options view to configure your build task once a template has been selected.

![Build Options](../media/build_options.png)

The source file for your default build task can be locked.\
Right click any `.bmx` document and select "Set As Default Build Task Source File".

![Set Source](../media/set_source.png)

BlitzMax VS Code tasks use the `bmx` task type.\
You can read more about VS Code tasks [here](https://code.visualstudio.com/docs/editor/tasks)