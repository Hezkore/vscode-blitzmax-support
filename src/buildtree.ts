'use strict'

import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import {
	getBuildDefinitionFromWorkspace,
	saveAsDefaultTaskDefinition,
	internalBuildDefinition,
	BmxBuildTaskDefinition,
	makeTaskDefinition
} from './taskprovider'


export function registerBuildTreeProvider( context: vscode.ExtensionContext ) {

	const bmxBuildTreeProvider = new BmxBuildTreeProvider( context )
	vscode.window.registerTreeDataProvider( 'blitzmax-options', bmxBuildTreeProvider )

	vscode.workspace.onDidChangeConfiguration( ( event ) => {
		if ( event.affectsConfiguration( 'tasks' ) ) bmxBuildTreeProvider.refresh()
	} )

	// Related commands
	context.subscriptions.push( vscode.commands.registerCommand( 'blitzmax.resetBuildOptions', () => {
		const definition = getBuildDefinitionFromWorkspace()
		saveAsDefaultTaskDefinition( makeTaskDefinition( definition.label, definition.detail, 'application', 'console' ) )
		if ( getBuildDefinitionFromWorkspace() === internalBuildDefinition ) bmxBuildTreeProvider.refresh()
	} ) )

	context.subscriptions.push( vscode.commands.registerCommand( 'blitzmax.changeDefaultBuildTask', () => {
		const document = vscode.window.activeTextEditor?.document
		const partOfWorkspace = document ? vscode.workspace.getWorkspaceFolder( document.uri ) : undefined
		if ( partOfWorkspace ) {
			const definition = getBuildDefinitionFromWorkspace()
			if ( definition === internalBuildDefinition ) saveAsDefaultTaskDefinition( definition )
			vscode.commands.executeCommand( 'workbench.action.tasks.configureDefaultBuildTask' )
		} else {
			vscode.window.showInformationMessage( 'File is not part of a workspace.\nOpen the folder containing this file to edit your custom build tasks.', { modal: true } )
		}
	} ) )

	context.subscriptions.push( vscode.commands.registerCommand( 'blitzmax.setSourceFile', ( document: vscode.Uri ) => {
		// Figure source path
		let sourcePath = document ? document.fsPath : vscode.window.activeTextEditor?.document.uri.fsPath
		if ( !sourcePath ) return

		// Figure out workspace
		let workspace: vscode.WorkspaceFolder | undefined
		if ( document )
			workspace = vscode.workspace.getWorkspaceFolder( document )
		else if ( vscode.window.activeTextEditor )
			workspace = vscode.workspace.getWorkspaceFolder( vscode.window.activeTextEditor.document.uri )

		// Figure out relative path if we have a workspace
		if ( workspace ) // we could use path.join here, but I think / looks better in json
			sourcePath = '${workspaceFolder}' + '/' + path.relative( workspace.uri.fsPath, sourcePath )

		// Update task
		const definition = getBuildDefinitionFromWorkspace()
		definition.source = sourcePath
		saveAsDefaultTaskDefinition( definition )
	} ) )

	context.subscriptions.push( vscode.commands.registerCommand( 'blitzmax.toggleBuildOption', async ( option: any ) => {
		// Just highlight the options view if no option was specified
		if ( !option ) {
			vscode.commands.executeCommand( 'blitzmax-options.focus' )
			return
		}

		// Make sure we're getting a string
		if ( typeof option !== "string" ) {
			const treeItem: vscode.TreeItem = option
			if ( treeItem && treeItem.label ) option = treeItem.id
		}

		const definition = getBuildDefinitionFromWorkspace()
		if ( definition === internalBuildDefinition ) {
			// Don't toggle options directly in the internal definition!
			saveAsDefaultTaskDefinition( await toggleBuildOptions( Object.assign( {}, definition ), option ) )
			// tasks.json will not change if we're updating the internal task
			// We have to refresh manually
			bmxBuildTreeProvider.refresh()
		} else {
			saveAsDefaultTaskDefinition( await toggleBuildOptions( definition, option ) )
		}

	} ) )

	vscode.commands.registerCommand( 'blitzmax.refreshBuildOptions', () => bmxBuildTreeProvider.refresh() )
}

export class BmxBuildTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {

	private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | null> = new vscode.EventEmitter<vscode.TreeItem | null>()
	readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | null> = this._onDidChangeTreeData.event

	private isForWorkspace: boolean = false

	private buildCategories: vscode.TreeItem[] = []

	private mainTreeRoot: vscode.TreeItem

	constructor( context: vscode.ExtensionContext ) {
		vscode.window.onDidChangeActiveTextEditor( () => this.onActiveEditorChanged() )
		this.refresh()
	}

	private onActiveEditorChanged(): void {
		this.refresh()
	}

	refresh() {
		vscode.commands.executeCommand( 'setContext', 'blitzmax:debugging', getBuildDefinitionFromWorkspace().debug );
		this._onDidChangeTreeData.fire( null )
	}

	createChildItem( enabled: boolean, id: string, label: string, tooltip: string, state: string | boolean | undefined, cmd: string = 'blitzmax.toggleBuildOption', cmdArgs: string[] = [] ): vscode.TreeItem {

		let item = new vscode.TreeItem( enabled ? label : '*', vscode.TreeItemCollapsibleState.None )
		item.id = id
		item.description = enabled ? state : label
		item.tooltip = tooltip ? tooltip : 'No information'
		item.contextValue = 'option'
		item.command = enabled ? {
			command: cmd,
			title: 'Toggle ' + label + ' build option',
			arguments: cmdArgs.length > 0 ? cmdArgs : [id]
		} : undefined

		if ( enabled ) {
			if ( typeof ( state ) === 'boolean' ) {
				if ( state == true )
					item.iconPath =
						new vscode.ThemeIcon( 'check',
							new vscode.ThemeColor( 'list.highlightForeground' )
						)
			}
		} else {
			// item.iconPath = new vscode.ThemeIcon( 'dash' )
		}

		return item
	}

	getChildren( element?: vscode.TreeItem ): Thenable<vscode.TreeItem[]> {
		if ( element ) {
			if ( element == this.mainTreeRoot )
				return this.generateAllBuildCategories()
			else
				return this.generateBuildCategory( element )
		} else {
			return this.generateWorkbenchRoot()
		}
	}

	cleanWorkbenchRootTaskName( taskName: string ): string {
		if ( taskName.toLowerCase().startsWith( 'blitzmax:' ) )
			taskName = taskName.slice( 9 )

		return taskName.trim()
	}

	generateWorkbenchRoot(): Promise<vscode.TreeItem[]> {

		//const def = getBuildDefinitionFromWorkspace()
		const sourceFile = vscode.window.activeTextEditor?.document

		let rootName: string = 'Unknown'
		let taskName: string = 'Internal'

		// Is the file even a BlitzMax file?
		if ( sourceFile && sourceFile.languageId == 'blitzmax' ) {

			// It's a BlitzMax file, check if it's part of the workspace
			const workspace = vscode.workspace.getWorkspaceFolder( sourceFile.uri )
			if ( workspace )
				taskName = this.cleanWorkbenchRootTaskName( getBuildDefinitionFromWorkspace( workspace ).label )
			rootName = workspace
				? workspace.name.toUpperCase()
				: 'File: ' + path.basename( sourceFile.uri.fsPath )
			this.isForWorkspace = workspace ? true : false
		} else {

			// It's not a BlitzMax file
			// Let's use the first workspace with a .bmx file

			this.isForWorkspace = false

			if ( !vscode.workspace || !vscode.workspace.workspaceFolders ) {
				// There are no workspaces, abort mission!
				return Promise.resolve( [] )
			}

			// Go through all workspaces
			for ( let workspaceIndex = 0; workspaceIndex < vscode.workspace.workspaceFolders.length; workspaceIndex++ ) {
				const workspace = vscode.workspace.workspaceFolders[workspaceIndex]

				// Get all the files
				const files = fs.readdirSync( workspace.uri.fsPath )

				// Check for .bmx files
				for ( let fileIndex = 0; fileIndex < files.length; fileIndex++ ) {
					const file = files[fileIndex]

					if ( file.toLowerCase().endsWith( '.bmx' ) ) {
						this.isForWorkspace = true
						taskName = this.cleanWorkbenchRootTaskName( getBuildDefinitionFromWorkspace( workspace ).label )
						rootName = workspace.name.toUpperCase()
						break
					}
				}

				if ( this.isForWorkspace ) break
			}

			if ( !this.isForWorkspace ) return Promise.resolve( [] )
		}

		this.mainTreeRoot = new vscode.TreeItem( rootName + ' (' + taskName + ')', vscode.TreeItemCollapsibleState.Expanded )
		this.mainTreeRoot.iconPath = new vscode.ThemeIcon( 'rocket' )
		this.mainTreeRoot.tooltip = 'Workspace: ' + rootName + '\nTask: ' + taskName
		this.mainTreeRoot.contextValue = 'workspaceRoot'
		return Promise.resolve( [this.mainTreeRoot] )
	}

	generateAllBuildCategories(): Promise<vscode.TreeItem[]> {

		const def = getBuildDefinitionFromWorkspace()

		this.buildCategories = [
			// No category root items
			this.createChildItem( true, 'root_file', 'Source File', 'Absolute path to root source file', def.source ),

			{ id: 'build', label: 'Build Options', collapsibleState: vscode.TreeItemCollapsibleState.Expanded },
			{ id: 'app', label: 'App Options', collapsibleState: vscode.TreeItemCollapsibleState.Expanded },
			{ id: 'plat', label: 'Platform', collapsibleState: vscode.TreeItemCollapsibleState.Collapsed },
			{ id: 'arch', label: 'Architecture', collapsibleState: vscode.TreeItemCollapsibleState.Collapsed },
			{ id: 'misc', label: 'Misc Options', collapsibleState: vscode.TreeItemCollapsibleState.Collapsed },
			{ id: 'stub', label: 'App Stub', collapsibleState: vscode.TreeItemCollapsibleState.Collapsed },
			{ id: 'dev', label: 'Developer Options', collapsibleState: vscode.TreeItemCollapsibleState.Collapsed },
			{
				id: 'adv',
				label: 'Advanced Options',
				collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
				iconPath: new vscode.ThemeIcon( 'beaker' )
			},

			this.createChildItem( true, 'legacy', 'Legacy Mode', 'Enable BlitzMax Legacy suspport', def.legacy )
		]

		return Promise.resolve( this.buildCategories )
	}

	generateBuildCategory( element: vscode.TreeItem ): Promise<vscode.TreeItem[]> {

		let def = getBuildDefinitionFromWorkspace()
		let items: vscode.TreeItem[] = []

		switch ( element.id ) {
			case 'build':
				items.push(
					this.createChildItem( true, 'b_quick', 'Quick Build', 'Only recompile source/modules modified since the last build', !def.fullcompile ),
					this.createChildItem( true, 'b_debug', 'Debug Build', 'Builds a debug version', def.debug ),
					this.createChildItem( !def.legacy, 'b_qscan', 'Quick Scan', 'Do not scan modules for changes', def.quick ),
					this.createChildItem( !def.legacy, 'b_overload', 'Overload Warnings', 'Defines missing override keywords in overridden methods and functions to be handled as error instead of warning', def.funcargcasting == 'warning' ),
					this.createChildItem( !def.legacy, 'b_override', 'Require \'Override\' declaration', 'Sets requirement for overriding methods and functions to append override to their definitions', def.override ),
					this.createChildItem( !def.legacy && def.override == true, 'b_raise', 'Raise \'override\' errors not warnings', 'Sets requirement for overriding methods and functions to append override to their definitions', def.overerr ),
					this.createChildItem( !def.legacy && def.make == 'application' && def.apptype == 'gui', 'b_dpi', 'High Resolution (HiDPI)', 'Specifies that the application supports high-resolution screens', def.hidpi )
				)
				break

			case 'app':
				items.push(
					this.createChildItem( true, 'app_con', 'Build Console App', '', def.make == 'application' && def.apptype == 'console' ),
					this.createChildItem( true, 'app_gui', 'Build GUI App', '', def.make == 'application' && def.apptype == 'gui' ),
					this.createChildItem( true, 'app_lib', 'Build Shared Library', '', def.make == 'library' )
				)
				break

			case 'plat':
				items.push(
					this.createChildItem( !def.legacy, 'plat_win32', 'Win32', '', def.target == 'win32' ),
					this.createChildItem( !def.legacy, 'plat_linux', 'Linux', '', def.target == 'linux' ),
					this.createChildItem( !def.legacy && os.platform() == 'darwin', 'plat_macos', 'MacOS', '', def.target == 'macos' ),
					this.createChildItem( !def.legacy, 'plat_raspberrypi', 'Raspberry Pi', '', def.target == 'raspberrypi' ),
					this.createChildItem( !def.legacy, 'plat_android', 'Android', '', def.target == 'android' ),
					this.createChildItem( !def.legacy, 'plat_nx', 'NX', '', def.target == 'nx' ),
					this.createChildItem( !def.legacy, 'plat_emscripten', 'Web', '', def.target == 'emscripten' )
				)
				break

			case 'arch':
				let archIndex: number = 0
				switch ( os.arch() ) {
					case 'x86':
						archIndex = 1
						break

					case 'x64':
						archIndex = 2
						break

					default:
						archIndex = 3
						break
				}

				items.push(
					this.createChildItem( !def.legacy && archIndex <= 2, 'arch_x86', 'x86', '', def.architecture == 'x86' ),
					this.createChildItem( !def.legacy && archIndex <= 2, 'arch_x64', 'x64', '', def.architecture == 'x64' ),
					this.createChildItem( !def.legacy && archIndex >= 3, 'arch_ppc', 'PPC', '', def.architecture == 'ppc' ),
					this.createChildItem( !def.legacy && archIndex >= 3, 'arch_arm', 'ARM', '', def.architecture == 'arm' ),
					this.createChildItem( !def.legacy && archIndex >= 3, 'arch_armeabiv5', 'ARMeabi v5', '', def.architecture == 'armeabiv5' ),
					this.createChildItem( !def.legacy && archIndex >= 3, 'arch_armeabiv7a', 'ARMeabi v7a', '', def.architecture == 'armeabiv7a' ),
					this.createChildItem( !def.legacy && archIndex >= 3, 'arch_arm64v8a', 'ARM64 v8a', '', def.architecture == 'arm64v8a' ),
					this.createChildItem( !def.legacy && archIndex >= 3, 'arch_js', 'js', '', def.architecture == 'js' ),
					this.createChildItem( !def.legacy && archIndex >= 3, 'arch_armv7', 'ARMv7', '', def.architecture == 'armv7' ),
					this.createChildItem( !def.legacy && archIndex >= 3, 'arch_arm64', 'ARM64', '', def.architecture == 'arm64' )
				)
				break

			case 'misc':
				items.push(
					this.createChildItem( !def.legacy, 'misc_upx', 'Pack App with UPX', '', def.upx )
				)
				break
				os.arch()
			case 'stub':
				// Hmm... do I really need to scan for app stubs? :S
				items.push(
					this.createChildItem( !def.legacy, 'stub_brl.appstub', 'brl.appstub', '', def.appstub == 'brl.appstub' )
				)
				break

			case 'dev':
				items.push(
					this.createChildItem( !def.legacy, 'dev_verbose', 'Verbose Build', '', def.verbose ),
					this.createChildItem( !def.legacy, 'dev_gdb', 'GDB Debug Generation', '', def.gdb ),
					this.createChildItem( !def.legacy, 'dev_gprof', 'GProf Profiling', 'Gprof is a performance analysis tool for Unix applications', def.gprof )
				)
				break

			case 'adv':
				items.push(
					this.createChildItem( def.make == 'application', 'adv_output', 'Output file', 'Specifies the output file', def.output ),
					this.createChildItem( !def.legacy, 'adv_conditional', 'Conditionals', 'User defined conditionals', def.conditionals?.join( ', ' ) ),
					this.createChildItem( true, 'adv_threaded', 'Threaded', 'Builds multi-threaded version (NG always builds multi-threaded )', def.threaded ),
					this.createChildItem( ( def.target == 'linux' || def.target == 'raspberrypi' ) && !def.legacy, 'adv_musl', 'Musl libc', 'Enables musl libc compatibility (Linux NG only)', def.musl ),
					this.createChildItem( !def.legacy, 'adv_compileonly', 'Compile Only', 'Compile sources only, no building of the application', def.onlycompile ),
					this.createChildItem( !def.legacy && def.target == 'macos', 'adv_universal', 'Universal Build', 'Creates a Universal build for supported platforms (Mac OS X and iOS)', def.universal ),
					this.createChildItem( !def.legacy, 'adv_nostrictupgrade', 'No Strict Upgrade', 'Don\'t upgrade strict method void return types, if required', def.nostrictupgrade ),
					this.createChildItem( !def.legacy, 'adv_quiet', 'Quiet build', 'Quiet build', def.quiet ),
					this.createChildItem( !def.legacy, 'adv_standalone', 'Standalone', 'Generate but do not compile into binary form', def.standalone ),
					this.createChildItem( ( def.target == 'linux' || def.target == 'raspberrypi' ) && !def.legacy, 'adv_static', 'Static', 'Statically link binary (Linux NG only)', def.static ),
					this.createChildItem( def.target == 'win32' && !def.legacy, 'adv_nomanifest', 'No Manifest', 'Do not generate a manifest file for the built application (Win32 only)', def.nomanifest ),
					this.createChildItem( !def.legacy, 'adv_single', 'Single Thread Compile', 'Disabled multi-threaded processing in a bmk build with thread support', def.single ),
					this.createChildItem( !def.legacy, 'adv_nodef', 'No Def Files', 'Do not generate .def files useable by created DLLs/shared libraries', def.nodef ),
					this.createChildItem( !def.legacy, 'adv_nohead', 'No Header Files', 'Do not generate header files useable by created DLLs/shared libraries', def.nohead ),
					this.createChildItem( ( def.target == 'linux' || def.target == 'raspberrypi' ) && !def.legacy, 'adv_nopie', 'No PIE Binary', 'Do not generate PIE binaries (Linux only).', def.nopie ),
				)
				break

			default:
				break
		}

		return Promise.resolve( items )
	}

	getTreeItem( element: vscode.TreeItem ): vscode.TreeItem {
		return element
	}
}

export async function toggleBuildOptions( definition: BmxBuildTaskDefinition | undefined, option: string ): Promise<BmxBuildTaskDefinition | undefined> {

	if ( !definition ) return undefined

	if ( option.startsWith( 'stub_' ) ) {
		definition.appstub = option.slice( 5 )
		return definition
	}

	switch ( option ) {
		case 'legacy':
			definition.legacy = !definition.legacy
			break

		case 'root_file':
			await vscode.window.showInputBox(
				{
					prompt: 'Absolute path to root source file',
					value: definition.source != '${file}'
						? definition.source
						: vscode.window.activeTextEditor?.document.uri.fsPath
				}
			).then( ( picked ) => {
				if ( picked != undefined ) definition.source = picked
				if ( !definition.source ) definition.source = '${file}'
			} )
			break

		// Build
		case 'b_quick':
			definition.fullcompile = !definition.fullcompile
			break

		case 'b_debug':
			definition.debug = !definition.debug
			break

		case 'b_qscan':
			definition.quick = !definition.quick
			break

		case 'b_overload':
			if ( definition.funcargcasting == 'warning' )
				definition.funcargcasting = 'error'
			else
				definition.funcargcasting = 'warning'
			break


		case 'b_override':
			definition.override = !definition.override
			break


		case 'b_raise':
			definition.overerr = !definition.overerr
			break


		case 'b_dpi':
			definition.hidpi = !definition.hidpi
			break

		// App
		case 'app_con':
			definition.apptype = 'console'
			definition.make = 'application'
			break

		case 'app_gui':
			definition.apptype = 'gui'
			definition.make = 'application'
			break

		case 'app_lib':
			definition.make = 'library'
			break

		// Platform Target
		case 'plat_win32':
		case 'plat_linux':
		case 'plat_macos':
		case 'plat_raspberrypi':
		case 'plat_android':
		case 'plat_nx':
		case 'plat_emscripten':
			definition.target = option.slice( 5 )
			break

		// Architecture
		case 'arch_x86':
		case 'arch_x64':
		case 'arch_ppc':
		case 'arch_arm':
		case 'arch_armeabiv5':
		case 'arch_armeabiv7a':
		case 'arch_arm64v8a':
		case 'arch_js':
		case 'arch_armv7':
		case 'arch_arm64':
			definition.architecture = option.slice( 5 )
			break

		// Misc
		case "misc_upx":
			definition.upx = !definition.upx
			break

		// Developer
		case 'dev_verbose':
			definition.verbose = !definition.verbose
			break

		case 'dev_gdb':
			definition.gdb = !definition.gdb
			break

		case 'dev_gprof':
			definition.gprof = !definition.gprof
			break

		// Advanced
		case 'adv_output':
			await vscode.window.showInputBox( { prompt: 'Output file' } ).then( ( picked ) => {
				if ( picked != undefined ) definition.output = picked
			} )
			break

		case 'adv_conditional':
			await vscode.window.showInputBox( { prompt: 'User defined conditionals (space as separator)', value: definition.conditionals?.join( ' ' ) } ).then( ( picked ) => {
				if ( picked != undefined ) definition.conditionals = picked.split( ' ' )
			} )
			break

		case 'adv_threaded':
			definition.threaded = !definition.threaded
			break

		case 'adv_musl':
			definition.musl = !definition.musl
			break

		case 'adv_compileonly':
			definition.onlycompile = !definition.onlycompile
			break

		case 'adv_universal':
			definition.universal = !definition.universal
			break

		case 'adv_nostrictupgrade':
			definition.nostrictupgrade = !definition.nostrictupgrade
			break

		case 'adv_quiet':
			definition.quiet = !definition.quiet
			break

		case 'adv_standalone':
			definition.standalone = !definition.standalone
			break

		case 'adv_static':
			definition.static = !definition.static
			break

		case 'adv_nomanifest':
			definition.nomanifest = !definition.nomanifest
			break

		case 'adv_single':
			definition.single = !definition.single
			break

		case 'adv_nodef':
			definition.nodef = !definition.nodef
			break

		case 'adv_nohead':
			definition.nohead = !definition.nohead
			break

		case 'adv_nopie':
			definition.nopie = !definition.nopie
			break


		// Unknown
		default:
			console.log( 'Undefined build option - ' + option )
			vscode.window.showErrorMessage( 'Unknown build option: ' + option )
			break
	}

	return definition
}