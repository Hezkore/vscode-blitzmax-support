'use strict'

import * as vscode from 'vscode'
import * as path from 'path'
import { getBuildDefinitionFromWorkspace,
	saveAsDefaultTaskDefinition,
	internalBuildDefinition,
	toggleBuildOptions } from './taskProvider'
import * as fs from 'fs'

export function registerBmxBuildTreeProvider(context: vscode.ExtensionContext) {
	
	const bmxBuildTreeProvider = new BmxBuildTreeProvider(context)
	vscode.window.registerTreeDataProvider('blitzmax-build', bmxBuildTreeProvider)
	
	vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration('tasks')) bmxBuildTreeProvider.refresh()
	})
	
	// Related commands
	context.subscriptions.push(vscode.commands.registerCommand('blitzmax.toggleBuildOption', async (option: any) => {
		if (typeof option !== "string") {
			const treeItem: vscode.TreeItem = option
			if (treeItem && treeItem.label) option = treeItem.label.toLocaleLowerCase()
		}
		
		const definition = getBuildDefinitionFromWorkspace()
		if (definition === internalBuildDefinition) {
			// Don't toggle options directly in the internal definition!
			saveAsDefaultTaskDefinition(await toggleBuildOptions(Object.assign({}, definition), option))
			// tasks.json will not change if we're updating the internal task
			// We have to refresh manually
			bmxBuildTreeProvider.refresh()
		} else {
			saveAsDefaultTaskDefinition(await toggleBuildOptions(definition, option))
		}

	}))
	
	vscode.commands.registerCommand('blitzmax.refreshBuildOptions',() => bmxBuildTreeProvider.refresh())
}

export class BmxBuildTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
	
	private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | null> = new vscode.EventEmitter<vscode.TreeItem | null>()
	readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | null> = this._onDidChangeTreeData.event
	
	private isForWorkspace: boolean = false
	
	constructor(context: vscode.ExtensionContext) {
		vscode.window.onDidChangeActiveTextEditor(() => this.onActiveEditorChanged())
		this.refresh()
	}
	
	private onActiveEditorChanged(): void {
		this.refresh()
	}
	
	refresh() {
		this._onDidChangeTreeData.fire(null)
	}
	
	createChildItem(label: string, tooltip: string, state: string | undefined, command: string = 'blitzmax.toggleBuildOption', cmdArgs: string[] = []): vscode.TreeItem {
		
		let item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None)
		item.description = state ? state : 'default'
		item.tooltip = tooltip
		item.description
		item.contextValue = 'option'
		item.command = {
			command: command,
			title: '',
			arguments: cmdArgs.length > 0 ? cmdArgs : [label.toLowerCase()]
		}
		
		return item
	}
	
	getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
		
		if (element) {
			
			let def = getBuildDefinitionFromWorkspace()
			let items: vscode.TreeItem[] = []

			items.push(this.createChildItem('make', 'Type of project', def.make))
			items.push(this.createChildItem('onlycompile', 'Compile sources only, no building of the application)', def.onlycompile ? 'true' : 'false'))
			items.push(this.createChildItem('source', 'Absolute path to root source file', def.source))
			items.push(this.createChildItem('fullcompile', 'Recompiles all source/modules regardless of timestamp', def.fullcompile ? 'true' : 'false'))
			items.push(this.createChildItem('appstub', 'Builds an app using a custom appstub', def.appstub ? 'true' : 'false'))
			items.push(this.createChildItem('debug', 'Builds a debug version', def.debug ? 'true' : 'false'))
			items.push(this.createChildItem('architecture', 'Compiles to the specified architecture', def.architecture))
			items.push(this.createChildItem('gdb', 'Generates line mappings suitable for GDB debugging', def.gdb ? 'true' : 'false'))
			items.push(this.createChildItem('threaded', 'Builds multithreaded version|h)', def.threaded ? 'true' : 'false'))
			items.push(this.createChildItem('universal', 'Creates a Universal build for supported platforms', def.universal ? 'true' : 'false'))
			items.push(this.createChildItem('crosscompile', 'Cross-compiles to the specific target platform', def.crosscompile))
			items.push(this.createChildItem('musl', 'Enables musl libc compatibility', def.musl ? 'true' : 'false'))
			items.push(this.createChildItem('nostrictupgrade', 'Don\'t upgrade strict method void return types, if required', def.nostrictupgrade ? 'true' : 'false'))
			items.push(this.createChildItem('output', 'Specifies the output file', def.output))
			items.push(this.createChildItem('quiet', 'Quiet build', def.quiet ? 'true' : 'false'))
			items.push(this.createChildItem('quick', 'Do not scan modules for changes', def.quick ? 'true' : 'false'))
			items.push(this.createChildItem('release', 'Builds a release version', def.release ? 'true' : 'false'))
			items.push(this.createChildItem('standalone', 'Generate but do not compile into binary form', def.standalone ? 'true' : 'false'))
			items.push(this.createChildItem('static', 'Statically link binary', def.static ? 'true' : 'false'))
			items.push(this.createChildItem('apptype', 'Specifies the application type"', def.apptype))
			items.push(this.createChildItem('platform', 'Select platform to create code for', def.platform))
			items.push(this.createChildItem('verbose', 'Verbose (noisy) build', def.verbose ? 'true' : 'false'))
			items.push(this.createChildItem('funcargcasting', 'How to handle function argument casting issues', def.funcargcasting))
			items.push(this.createChildItem('framework', 'Defines to use a specific module as framework', def.framework))
			items.push(this.createChildItem('nomanifest', 'Do not generate a manifest file for the built application', def.nomanifest ? 'true' : 'false'))
			items.push(this.createChildItem('single', 'Disabled multi threaded processing in a bmk built with thread support', def.single ? 'true' : 'false'))
			items.push(this.createChildItem('nodef', 'Defines to not generate .def files useable by created DLLs/shared libraries', def.nodef ? 'true' : 'false'))
			items.push(this.createChildItem('nohead', 'Defines to not generate header files useable by created DLLs/shared libraries', def.nohead ? 'true' : 'false'))
			items.push(this.createChildItem('override', 'Sets requirement for overriding methods and functions to append override to their definitions', def.override ? 'true' : 'false'))
			items.push(this.createChildItem('overerr', 'Defines missing override keywords in overridden methods and functions to be handled as error instead of warning', def.overerr ? 'true' : 'false'))
			items.push(this.createChildItem('no-pie', 'Do not generate PIE binaries', def.nopie ? 'true' : 'false'))
			items.push(this.createChildItem('upx', 'Compress the created binary with UPX', def.upx ? 'true' : 'false'))
			items.push(this.createChildItem('conditionals', 'User defined conditionals, usable via `?myconditional`', def.conditionals?.join(', ')))
			items.push(this.createChildItem('args', 'User defined arguments', def.args?.join(', ')))
			
			return Promise.resolve( items )
		} else {
			
			let rootName: string = 'Unknown'
			
			const sourceFile = vscode.window.activeTextEditor?.document
			if (sourceFile && sourceFile.languageId == 'blitzmax') {

				const workspaceFolder = vscode.workspace.getWorkspaceFolder( sourceFile.uri )
				rootName = workspaceFolder ?
					'Workspace: ' + workspaceFolder.name.toUpperCase()
					:
					'File: ' + path.basename( sourceFile.uri.fsPath )
				this.isForWorkspace = workspaceFolder ? true : false
			} else {
				
				if (vscode.workspace && vscode.workspace.rootPath && vscode.workspace.name){
					const files = fs.readdirSync( vscode.workspace.rootPath )
					if (files.length > 0) {
						rootName = 'Workspace: ' + vscode.workspace.name.toUpperCase()
						this.isForWorkspace = true
					} else this.isForWorkspace = false
				} else this.isForWorkspace = false
				
				if (!this.isForWorkspace) return Promise.resolve( [] )
			}
			
			return Promise.resolve( [
				new vscode.TreeItem( rootName, vscode.TreeItemCollapsibleState.Expanded )
			] )
		}
	}
	
	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element
	}
}