'use strict'

import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { boolToString } from './common'
import { getBuildDefinitionFromWorkspace,
	saveAsDefaultTaskDefinition,
	internalBuildDefinition,
	toggleBuildOptions } from './taskprovider'


export function registerBuildTreeProvider(context: vscode.ExtensionContext) {
	
	const bmxBuildTreeProvider = new BmxBuildTreeProvider(context)
	vscode.window.registerTreeDataProvider('blitzmax-build', bmxBuildTreeProvider)
	
	vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration('tasks')) bmxBuildTreeProvider.refresh()
	})
	
	// Related commands
	context.subscriptions.push(vscode.commands.registerCommand('blitzmax.toggleBuildOption', async (option: any) => {
		if (typeof option !== "string") {
			const treeItem: vscode.TreeItem = option
			if (treeItem && treeItem.label) option = treeItem.label.toString().toLowerCase()
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
	private mainTreeRoot
	private subTreeRoot
	
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
			
			if (element == this.mainTreeRoot) {
				items.push(this.createChildItem('source', 'Absolute path to root source file', def.source))
				items.push(this.createChildItem('make', 'Type of project', def.make))
				items.push(this.createChildItem('apptype', 'Specifies the application type"', def.apptype))
				items.push(this.createChildItem('quick', 'Do not scan modules for changes', boolToString(def.quick)))
				
				this.subTreeRoot = new vscode.TreeItem('Advanced', vscode.TreeItemCollapsibleState.Collapsed)
				items.push(this.subTreeRoot)
			} else {
				
				items.push(this.createChildItem('onlycompile', 'Compile sources only, no building of the application)', boolToString(def.onlycompile)))
				items.push(this.createChildItem('fullcompile', 'Recompiles all source/modules regardless of timestamp', boolToString(def.fullcompile)))
				items.push(this.createChildItem('appstub', 'Builds an app using a custom appstub', def.appstub))
				items.push(this.createChildItem('debug', 'Builds a debug version', boolToString(def.debug)))
				items.push(this.createChildItem('architecture', 'Compiles to the specified architecture', def.architecture))
				items.push(this.createChildItem('gdb', 'Generates line mappings suitable for GDB debugging', boolToString(def.gdb)))
				items.push(this.createChildItem('threaded', 'Builds multithreaded version)', boolToString(def.threaded)))
				items.push(this.createChildItem('universal', 'Creates a Universal build for supported platforms', boolToString(def.universal)))
				items.push(this.createChildItem('crosscompile', 'Cross-compiles to the specific target platform', def.crosscompile))
				items.push(this.createChildItem('musl', 'Enables musl libc compatibility', boolToString(def.musl)))
				items.push(this.createChildItem('nostrictupgrade', 'Don\'t upgrade strict method void return types, if required', boolToString(def.nostrictupgrade)))
				items.push(this.createChildItem('output', 'Specifies the output file', def.output))
				items.push(this.createChildItem('quiet', 'Quiet build', boolToString(def.quiet)))
				items.push(this.createChildItem('release', 'Builds a release version', boolToString(def.release)))
				items.push(this.createChildItem('standalone', 'Generate but do not compile into binary form', boolToString(def.standalone)))
				items.push(this.createChildItem('static', 'Statically link binary', boolToString(def.static)))
				//items.push(this.createChildItem('platform', 'Select platform to create code for', def.platform))
				items.push(this.createChildItem('verbose', 'Verbose (noisy) build', boolToString(def.verbose)))
				items.push(this.createChildItem('funcargcasting', 'How to handle function argument casting issues', def.funcargcasting))
				items.push(this.createChildItem('framework', 'Defines to use a specific module as framework', def.framework))
				items.push(this.createChildItem('nomanifest', 'Do not generate a manifest file for the built application', boolToString(def.nomanifest)))
				items.push(this.createChildItem('single', 'Disabled multi threaded processing in a bmk built with thread support', boolToString(def.single)))
				items.push(this.createChildItem('nodef', 'Defines to not generate .def files useable by created DLLs/shared libraries', boolToString(def.nodef)))
				items.push(this.createChildItem('nohead', 'Defines to not generate header files useable by created DLLs/shared libraries', boolToString(def.nohead)))
				items.push(this.createChildItem('override', 'Sets requirement for overriding methods and functions to append override to their definitions', boolToString(def.override)))
				items.push(this.createChildItem('overerr', 'Defines missing override keywords in overridden methods and functions to be handled as error instead of warning', boolToString(def.overerr)))
				items.push(this.createChildItem('no-pie', 'Do not generate PIE binaries', boolToString(def.nopie)))
				items.push(this.createChildItem('upx', 'Compress the created binary with UPX', boolToString(def.upx)))
				items.push(this.createChildItem('conditionals', 'User defined conditionals, usable via `?myconditional`', def.conditionals?.join(', ')))
				items.push(this.createChildItem('args', 'User defined arguments', def.args?.join(', ')))
			}
			
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
			
			this.mainTreeRoot = new vscode.TreeItem( rootName, vscode.TreeItemCollapsibleState.Expanded )
			return Promise.resolve([this.mainTreeRoot])
		}
	}
	
	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element
	}
}