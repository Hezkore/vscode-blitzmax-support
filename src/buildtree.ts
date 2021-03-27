'use strict'

import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import {
	getBuildDefinitionFromWorkspace,
	saveAsDefaultTaskDefinition,
	internalBuildDefinition,
	BmxBuildTaskDefinition
} from './taskprovider'


export function registerBuildTreeProvider( context: vscode.ExtensionContext ) {

	const bmxBuildTreeProvider = new BmxBuildTreeProvider( context )
	vscode.window.registerTreeDataProvider( 'blitzmax-options', bmxBuildTreeProvider )

	vscode.workspace.onDidChangeConfiguration( ( event ) => {
		if ( event.affectsConfiguration( 'tasks' ) ) bmxBuildTreeProvider.refresh()
	} )

	// Related commands
	context.subscriptions.push( vscode.commands.registerCommand( 'blitzmax.toggleBuildOption', async ( option: any ) => {
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
	//private subTreeRoot: vscode.TreeItem

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

			/* 			
						
							items.push( this.createChildItem( 'onlycompile', 'Compile sources only, no building of the application)', boolToString( def.onlycompile ) ) )
							items.push( this.createChildItem( 'fullcompile', 'Recompiles all source/modules regardless of timestamp', boolToString( def.fullcompile ) ) )
							items.push( this.createChildItem( 'appstub', 'Builds an app using a custom appstub', def.appstub ) )
							items.push( this.createChildItem( 'architecture', 'Compiles to the specified architecture', def.architecture ) )
							items.push( this.createChildItem( 'gdb', 'Generates line mappings suitable for GDB debugging', boolToString( def.gdb ) ) )
							items.push( this.createChildItem( 'threaded', 'Builds multithreaded version)', boolToString( def.threaded ) ) )
							items.push( this.createChildItem( 'universal', 'Creates a Universal build for supported platforms', boolToString( def.universal ) ) )
							items.push( this.createChildItem( 'crosscompile', 'Cross-compiles to the specific target platform', def.crosscompile ) )
							items.push( this.createChildItem( 'musl', 'Enables musl libc compatibility', boolToString( def.musl ) ) )
							items.push( this.createChildItem( 'nostrictupgrade', 'Don\'t upgrade strict method void return types, if required', boolToString( def.nostrictupgrade ) ) )
							items.push( this.createChildItem( 'output', 'Specifies the output file', def.output ) )
							items.push( this.createChildItem( 'quiet', 'Quiet build', boolToString( def.quiet ) ) )
							items.push( this.createChildItem( 'release', 'Builds a release version', boolToString( def.release ) ) )
							items.push( this.createChildItem( 'standalone', 'Generate but do not compile into binary form', boolToString( def.standalone ) ) )
							items.push( this.createChildItem( 'static', 'Statically link binary', boolToString( def.static ) ) )
							//items.push(this.createChildItem('platform', 'Select platform to create code for', def.platform))
							items.push( this.createChildItem( 'verbose', 'Verbose (noisy) build', boolToString( def.verbose ) ) )
							items.push( this.createChildItem( 'funcargcasting', 'How to handle function argument casting issues', def.funcargcasting ) )
							items.push( this.createChildItem( 'framework', 'Defines to use a specific module as framework', def.framework ) )
							items.push( this.createChildItem( 'nomanifest', 'Do not generate a manifest file for the built application', boolToString( def.nomanifest ) ) )
							items.push( this.createChildItem( 'single', 'Disabled multi threaded processing in a bmk built with thread support', boolToString( def.single ) ) )
							items.push( this.createChildItem( 'nodef', 'Defines to not generate .def files useable by created DLLs/shared libraries', boolToString( def.nodef ) ) )
							items.push( this.createChildItem( 'nohead', 'Defines to not generate header files useable by created DLLs/shared libraries', boolToString( def.nohead ) ) )
			
							items.push( this.createChildItem( 'no-pie', 'Do not generate PIE binaries', boolToString( def.nopie ) ) )
							items.push( this.createChildItem( 'upx', 'Compress the created binary with UPX', boolToString( def.upx ) ) )
							items.push( this.createChildItem( 'conditionals', 'User defined conditionals, usable via `?myconditional`', def.conditionals?.join( ', ' ) ) )
							items.push( this.createChildItem( 'args', 'User defined arguments', def.args?.join( ', ' ) ) )
						}
						
						return Promise.resolve( items ) */
		} else
			return this.generateWorkbenchRoot()
	}

	generateWorkbenchRoot(): Promise<vscode.TreeItem[]> {

		//const def = getBuildDefinitionFromWorkspace()
		const sourceFile = vscode.window.activeTextEditor?.document

		let rootName: string = 'Unknown'

		// Is the file even a BlitzMax file?
		if ( sourceFile && sourceFile.languageId == 'blitzmax' ) {

			// It's a BlitzMax file, check if it's part of the workspace
			const workspaceFolder = vscode.workspace.getWorkspaceFolder( sourceFile.uri )
			rootName = workspaceFolder
				? workspaceFolder.name.toUpperCase()
				: 'File: ' + path.basename( sourceFile.uri.fsPath )
			this.isForWorkspace = workspaceFolder ? true : false
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
						rootName = workspace.name.toUpperCase()
						break
					}
				}

				if ( this.isForWorkspace ) break
			}

			if ( !this.isForWorkspace ) return Promise.resolve( [] )
		}

		this.mainTreeRoot = new vscode.TreeItem( rootName, vscode.TreeItemCollapsibleState.Expanded )
		this.mainTreeRoot.iconPath = new vscode.ThemeIcon( 'rocket' )
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
					this.createChildItem( true, 'b_qscan', 'Quick Scan', 'Do not scan modules for changes', def.quick ),
					this.createChildItem( true, 'b_overload', 'Overload Warnings', 'Defines missing override keywords in overridden methods and functions to be handled as error instead of warning', def.funcargcasting == 'warning' ),
					this.createChildItem( true, 'b_override', 'Require \'Override\' declaration', 'Sets requirement for overriding methods and functions to append override to their definitions', def.override ),
					this.createChildItem( def.override == true, 'b_raise', 'Raise \'override\' errors not warnings', 'Sets requirement for overriding methods and functions to append override to their definitions', def.overerr ),
					this.createChildItem( def.make == 'application' && def.apptype == 'gui', 'b_dpi', 'High Resolution (HiDPI)', 'Specifies that the application supports high-resolution screens', def.hidpi )
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
					this.createChildItem( true, 'plat_win32', 'Win32', '', def.target == 'win32' ),
					this.createChildItem( true, 'plat_linux', 'Linux', '', def.target == 'linux' ),
					this.createChildItem( os.platform() == 'darwin', 'plat_macos', 'MacOS', '', def.target == 'macos' ),
					this.createChildItem( true, 'plat_raspberrypi', 'Raspberry Pi', '', def.target == 'raspberrypi' ),
					this.createChildItem( true, 'plat_android', 'Android', '', def.target == 'android' ),
					this.createChildItem( true, 'plat_nx', 'NX', '', def.target == 'nx' ),
					this.createChildItem( true, 'plat_emscripten', 'Web', '', def.target == 'emscripten' )
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
					this.createChildItem( archIndex <= 2, 'arch_x86', 'x86', '', def.architecture == 'x86' ),
					this.createChildItem( archIndex <= 2, 'arch_x64', 'x64', '', def.architecture == 'x64' ),
					this.createChildItem( archIndex >= 3, 'arch_ppc', 'PPC', '', def.architecture == 'ppc' ),
					this.createChildItem( archIndex >= 3, 'arch_arm', 'ARM', '', def.architecture == 'arm' ),
					this.createChildItem( archIndex >= 3, 'arch_armeabiv5', 'ARMeabi v5', '', def.architecture == 'armeabiv5' ),
					this.createChildItem( archIndex >= 3, 'arch_armeabiv7a', 'ARMeabi v7a', '', def.architecture == 'armeabiv7a' ),
					this.createChildItem( archIndex >= 3, 'arch_arm64v8a', 'ARM64 v8a', '', def.architecture == 'arm64v8a' ),
					this.createChildItem( archIndex >= 3, 'arch_js', 'js', '', def.architecture == 'js' ),
					this.createChildItem( archIndex >= 3, 'arch_armv7', 'ARMv7', '', def.architecture == 'armv7' ),
					this.createChildItem( archIndex >= 3, 'arch_arm64', 'ARM64', '', def.architecture == 'arm64' )
				)
				break

			case 'misc':
				items.push(
					this.createChildItem( true, 'misc_upx', 'Pack App with UPX', '', def.upx )
				)
				break
				os.arch()
			case 'stub':
				// Hmm... do I really need to scan for app stubs? :S
				items.push(
					this.createChildItem( true, 'stub_brl.appstub', 'brl.appstub', '', def.appstub == 'brl.appstub' )
				)
				break

			case 'dev':
				items.push(
					this.createChildItem( true, 'dev_verbose', 'Verbose Build', '', def.verbose ),
					this.createChildItem( true, 'dev_gdb', 'GDB Debug Generation', '', def.gdb ),
					this.createChildItem( true, 'dev_gprof', 'GProf Profiling', 'Gprof is a performance analysis tool for Unix applications', def.gprof )
				)
				break

			case 'adv':
				items.push(
					this.createChildItem( def.make == 'application', 'adv_output', 'Output file', 'Specifies the output file', def.output ),
					this.createChildItem( true, 'adv_conditional', 'Conditionals', 'User defined conditionals', def.conditionals?.join( ', ' ) ),
					this.createChildItem( true, 'adv_threaded', 'Threaded', 'Builds multi-threaded version (NG always builds multi-threaded )', def.threaded ),
					this.createChildItem( true, 'adv_musl', 'Musl libc', 'Enables musl libc compatibility (Linux NG only)', def.musl ),
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

		default:
			console.log( 'Undefined build option - ' + option )
			vscode.window.showErrorMessage( 'Unknown build option: ' + option )
			break
	}

	/* switch (option) {
			
		case 'onlycompile':
			definition.onlycompile = toggleBool(definition.onlycompile)
			break
			
			
		case 'fullcompile':
			definition.fullcompile = toggleBool(definition.fullcompile)
			break
			

			
		case 'threaded':
			definition.threaded = toggleBool(definition.threaded)
			break
			
		case 'universal':
			definition.universal = toggleBool(definition.universal)
			break
			
		case 'crosscompile':
			await vscode.window.showQuickPick(["win32", "linux", "macos", "ios", "android", "raspberrypi", "nx"], {canPickMany: false}).then((picked) => {
				if (picked) definition.crosscompile = picked
			})
			break
			
		case 'musl':
			definition.musl = toggleBool(definition.musl)
			break
			
		case 'nostrictupgrade':
			definition.nostrictupgrade = toggleBool(definition.nostrictupgrade)
			break
			
		case 'quiet':
			definition.quiet = toggleBool(definition.quiet)
			break
		
			
		case 'release':
			definition.release = toggleBool(definition.release)
			break
			
		case 'standalone':
			definition.standalone = toggleBool(definition.standalone)
			break
			
		case 'static':
			definition.static = toggleBool(definition.static)
			break
		
			
		case 'funcargcasting':
			await vscode.window.showQuickPick(["error", "warning"], {canPickMany: false}).then((picked) => {
				if (picked) definition.funcargcasting = picked
			})
			break
			
		case 'framework':
			await vscode.window.showInputBox({prompt: 'Module to use as framework'}).then((picked) => {
				if (picked != undefined) definition.framework = picked
			})
			break
			
		case 'nomanifest':
			definition.nomanifest = toggleBool(definition.nomanifest)
			break
			
		case 'single':
			definition.single = toggleBool(definition.single)
			break
			
		case 'nodef':
			definition.nodef = toggleBool(definition.nodef)
			break
			
		case 'nohead':
			definition.nohead = toggleBool(definition.nohead)
			break
			
		case 'override':
			definition.override = toggleBool(definition.override)
			break
			
		case 'overerr':
			definition.overerr = toggleBool(definition.overerr)
			break
			
		case 'no-pie':
			definition.nopie = toggleBool(definition.nopie)
			break
						
		case 'args':
			await vscode.window.showInputBox({prompt: 'User defined arguments (space as separator)', value: definition.args?.join(' ')}).then((picked) => {
				if (picked != undefined) definition.args = picked.split(' ')
			})
			break
			
		default:
			console.log(`Unknown build option ${option}`)
			break
	} */

	return definition
}