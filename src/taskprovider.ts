'use strict'

import * as vscode from 'vscode'
import * as awaitNotify from 'await-notify'
import * as cp from 'child_process'
import * as path from 'path'
import * as os from 'os'

let terminal: BmxBuildTaskTerminal | undefined
export let internalBuildDefinition: BmxBuildTaskDefinition = makeTaskDefinition(
	'BlitzMax: Default',
	'Automatically generated BlitzMax task',
	'application',
	'gui'
)

export interface BmxBuildOptions {
	make: string
	onlycompile?: boolean
	source: string
	fullcompile?: boolean
	appstub?: string | undefined
	debug?: boolean
	architecture?: string
	hidpi?: boolean
	gdb?: boolean
	gprof?: boolean
	threaded?: boolean
	universal?: boolean
	target?: string
	musl?: boolean
	nostrictupgrade?: boolean
	output?: string
	quiet?: boolean
	quick?: boolean
	standalone?: boolean
	static?: boolean
	apptype?: string
	verbose?: boolean
	funcargcasting?: string
	framework?: string
	nomanifest?: boolean
	single?: boolean
	nodef?: boolean
	nohead?: boolean
	override?: boolean
	overerr?: boolean
	nopie?: boolean
	upx?: boolean
	conditionals?: string[]
	args?: string[]
}

export interface BmxBuildTaskDefinition extends BmxBuildOptions, vscode.TaskDefinition {

}

export function registerTaskProvider( context: vscode.ExtensionContext ) {
	// Register the provider
	context.subscriptions.push(
		vscode.tasks.registerTaskProvider( 'bmx', new BmxBuildTaskProvider )
	)

	// Related commands
	context.subscriptions.push( vscode.commands.registerCommand( 'blitzmax.build', () => {
		vscode.tasks.executeTask( makeTask( getBuildDefinitionFromWorkspace( undefined ) ) )
	} ) )

	context.subscriptions.push( vscode.commands.registerCommand( 'blitzmax.setSourceFile', ( document: vscode.Uri ) => {
		const path = document ? document.fsPath : vscode.window.activeTextEditor?.document.uri.fsPath
		if ( !path ) return
		const def = getBuildDefinitionFromWorkspace()
		def.source = path
		saveAsDefaultTaskDefinition( def )
	} ) )
}

export function getBuildDefinitionFromWorkspace( workspace: vscode.WorkspaceFolder | undefined = undefined ): BmxBuildTaskDefinition {

	if ( !workspace ) {
		const doc = vscode.window.activeTextEditor?.document
		if ( doc ) workspace = vscode.workspace.getWorkspaceFolder( doc.uri )
	}

	// If there's no workspace, we just return the internal build definition
	if ( !workspace ) return internalBuildDefinition

	// Figure out the default task and get the definition
	const config = vscode.workspace.getConfiguration( 'tasks', workspace )
	const tasks: vscode.WorkspaceConfiguration | undefined = config.get( 'tasks' )
	if ( tasks ) {

		let firstBmxTask: BmxBuildTaskDefinition | undefined
		for ( let i = 0; i < tasks.length; i++ ) {
			const task: BmxBuildTaskDefinition = tasks[i]
			if ( !task || task.type != 'bmx' ) continue
			if ( !firstBmxTask ) firstBmxTask = task
			if ( task.group && task.group.isDefault ) return task
		}
		if ( firstBmxTask ) return firstBmxTask
	}

	// Something went wrong, return default
	return internalBuildDefinition
}

export function saveAsDefaultTaskDefinition( newDef: BmxBuildTaskDefinition | undefined ): boolean {

	if ( !newDef ) return false

	const doc = vscode.window.activeTextEditor?.document
	let workspace: vscode.WorkspaceFolder | undefined
	if ( doc ) workspace = vscode.workspace.getWorkspaceFolder( doc.uri )
	if ( !workspace ) {
		internalBuildDefinition = newDef
		return true
	}

	// Try to update the actual default task
	const config = vscode.workspace.getConfiguration( 'tasks' )
	const tasks: BmxBuildTaskDefinition[] | undefined = config.get( 'tasks' )
	if ( tasks ) {

		let updatedTasks: BmxBuildTaskDefinition[] = []
		let foundDefault: boolean = false
		let firstBmxTaskAtIndex: number = -1
		for ( let i = 0; i < tasks.length; i++ ) {
			const oldDef: BmxBuildTaskDefinition = tasks[i]
			if ( !oldDef ) continue
			if ( firstBmxTaskAtIndex < 0 && oldDef.type == 'bmx' ) firstBmxTaskAtIndex = i

			if ( oldDef.group && oldDef.group.isDefault ) {

				updatedTasks.push( newDef )
				foundDefault = true
			} else updatedTasks.push( oldDef )
		}

		if ( foundDefault ) {
			config.update( 'tasks', updatedTasks )
			return true
		} else {
			if ( firstBmxTaskAtIndex >= 0 ) {
				updatedTasks[firstBmxTaskAtIndex] = newDef
				config.update( 'tasks', updatedTasks )
				return true
			} else {
				updatedTasks.push( newDef )
				config.update( 'tasks', updatedTasks )
				return true
			}
		}
	}

	config.update( 'tasks', [newDef] )
	return true
}

export class BmxBuildTaskProvider implements vscode.TaskProvider {
	private tasks: vscode.Task[] | undefined

	provideTasks( token?: vscode.CancellationToken ): vscode.ProviderResult<vscode.Task[]> {
		if ( this.tasks !== undefined ) return this.tasks

		// Provide new tasks
		this.tasks = []

		this.tasks.push( makeSimpleTask( 'Module', 'Build a module', 'module' ) )
		this.tasks.push( makeSimpleTask( 'Shared Library', 'Build a shared library', 'library' ) )
		this.tasks.push( makeSimpleTask( 'GUI Application', 'Build a GUI application', 'application', 'gui' ) )
		this.tasks.push( makeSimpleTask( 'Console Application', 'Build a console application', 'application', 'console' ) )

		return this.tasks
	}

	public resolveTask( _task: vscode.Task ): vscode.Task | undefined {
		const definition: BmxBuildTaskDefinition = <any>_task.definition

		return makeTask( definition )
	}
}

export function taskOutput( definition: vscode.TaskDefinition, workspace: vscode.WorkspaceFolder | undefined ): string {
	let outPath: string = ''

	if ( definition.output ) {
		outPath = workspace ? vscode.Uri.file( workspace.uri.fsPath + '/' + definition.output ).fsPath : definition.output
	} else {
		const sourcePath = path.parse( definition.source )
		outPath = vscode.Uri.file( sourcePath.dir + '/' + sourcePath.name ).fsPath
	}

	if ( definition.debug ) {
		outPath += '.debug'
	}

	return outPath
}

export function makeSimpleTask( label: string, detail: string, make: string, apptype: string | undefined = undefined ): vscode.Task {
	let definition: BmxBuildTaskDefinition = makeTaskDefinition( label, detail, make, apptype )
	return makeTask( definition )
}

export function makeTaskDefinition( label: string, detail: string, make: string, apptype: string | undefined = undefined ): BmxBuildTaskDefinition {
	let definition: BmxBuildTaskDefinition = {
		type: 'bmx',
		label: label,
		detail: detail,
		funcargcasting: 'warning',
		make: make,
		apptype: apptype,
		source: '${file}',
		fullcompile: true,
		quick: true,
		hidpi: true,
		architecture: os.arch(),
		target: os.platform() == 'darwin' ? 'macos' : os.platform(),
		debug: true
	}

	return definition
}

export function makeTask( definition: BmxBuildTaskDefinition ): vscode.Task {

	// Setup custom execution
	let exec = new vscode.CustomExecution( async ( resolvedDefinition: vscode.TaskDefinition ): Promise<vscode.Pseudoterminal> => {

		let bmkPath: vscode.Uri | undefined
		let args: string[] = []
		let workspace = vscode.workspace.getWorkspaceFolder( vscode.Uri.file( resolvedDefinition.source ) )

		if ( resolvedDefinition.bmk ) {
			bmkPath = vscode.Uri.file( resolvedDefinition.bmk )
		} else {
			let bmxPath: string | undefined

			if ( workspace ) {
				// If this is part of a workspace, we use that path
				bmxPath = vscode.workspace.getConfiguration( 'blitzmax', workspace ).get( 'base.path' )
			} else {
				// If this is a separate unkown file, we use the default BlitzMax path
				let globalBmxPath = vscode.workspace.getConfiguration( 'blitzmax' ).inspect( 'base.path' )?.globalValue
				if ( typeof ( globalBmxPath ) === 'string' ) bmxPath = globalBmxPath
			}

			bmkPath = vscode.Uri.file( bmxPath + '/bin/bmk' )
		}

		// Process args
		switch ( resolvedDefinition.make ) {
			case 'module':
				args.push( 'makemods' )
				break
			case 'library':
				args.push( 'makelib' )
				break
			case 'bootstrap':
				args.push( 'makebootstrap' )
				break
			default:
				args.push( 'makeapp' )
				break
		}

		args.push( resolvedDefinition.debug ? '-d' : '-r' )

		if ( resolvedDefinition.fullcompile ) args.push( '-a' )

		if ( resolvedDefinition.verbose ) args.push( '-v' )

		if ( resolvedDefinition.quick ) args.push( '-quick' )

		if ( resolvedDefinition.funcargcasting == 'warning' ) args.push( '-w' )

		if ( resolvedDefinition.override ) args.push( '-override' )

		if ( resolvedDefinition.override && resolvedDefinition.overerr ) args.push( '-overerr' )

		if ( resolvedDefinition.target ) args.push( '-l', resolvedDefinition.target )

		if ( resolvedDefinition.architecture ) args.push( '-g', resolvedDefinition.architecture )

		if ( resolvedDefinition.onlycompile ) args.push( 'compile' )

		if ( resolvedDefinition.appstub ) args.push( '-b', resolvedDefinition.appstub )

		if ( resolvedDefinition.gdb ) args.push( '-gdb' )

		if ( resolvedDefinition.gprof ) args.push( '-gprof' )

		if ( resolvedDefinition.threaded ) args.push( '-h' )

		if ( resolvedDefinition.universal ) args.push( '-i' )

		if ( resolvedDefinition.musl ) args.push( '-musl' )

		if ( resolvedDefinition.nostrictupgrade ) args.push( '-nostrictupgrade' )

		if ( resolvedDefinition.quiet ) args.push( '-q' )

		if ( resolvedDefinition.standalone ) args.push( '-standalone' )

		if ( resolvedDefinition.static ) args.push( '-static' )

		if ( resolvedDefinition.apptype !== 'console' ) args.push( '-t', resolvedDefinition.apptype )

		if ( resolvedDefinition.apptype == 'gui' && resolvedDefinition.hidpi ) args.push( '-hi' )

		if ( resolvedDefinition.framework ) args.push( '-f', resolvedDefinition.framework )

		if ( resolvedDefinition.nomanifest ) args.push( '-nomanifest' )

		if ( resolvedDefinition.single ) args.push( '-single' )

		if ( resolvedDefinition.nodef ) args.push( '-nodef' )

		if ( resolvedDefinition.nohead ) args.push( '-nohead' )

		if ( resolvedDefinition.nopie ) args.push( '-no-pie' )

		if ( resolvedDefinition.upx ) args.push( '-upx' )

		const conditionals = resolvedDefinition.conditionals
		if ( conditionals ) {
			args.push( '-ud' )
			args.push( conditionals.toString().trim().replace( ' ', '' ) )
		}

		if ( resolvedDefinition.args ) args = args.concat( resolvedDefinition.args )

		if ( resolvedDefinition.make == 'application' ) args.push( '-o', taskOutput( resolvedDefinition, workspace ) )

		args.push( resolvedDefinition.source )

		// Terminal setup
		if ( !terminal ) terminal = new BmxBuildTaskTerminal
		terminal.prepare( bmkPath.fsPath, args, workspace?.uri.fsPath )
		return terminal
	} )

	// Make sure label exists!
	if ( !definition.label ) definition.label = 'blitzmax'

	// Create the task
	//
	let task = new vscode.Task( definition, vscode.TaskScope.Workspace, definition.label, 'BlitzMax', exec,
		['$blitzmax', '$gcc'] ) // Include the GCC problem matcher for glue code

	// Setup task MaxIDE like
	task.presentationOptions.echo = false
	task.presentationOptions.focus = false
	task.presentationOptions.panel = vscode.TaskPanelKind.Shared
	task.presentationOptions.reveal = vscode.TaskRevealKind.Silent
	task.presentationOptions.showReuseMessage = false
	task.presentationOptions.clear = true

	return task
}

class BmxBuildTaskTerminal implements vscode.Pseudoterminal {
	private writeEmitter = new vscode.EventEmitter<string>()
	onDidWrite: vscode.Event<string> = this.writeEmitter.event
	private closeEmitter = new vscode.EventEmitter<number>()
	onDidClose?: vscode.Event<number> = this.closeEmitter.event

	cmd: string
	args: string[] | undefined
	cwd: string | undefined
	busy = new awaitNotify.Subject()

	lastPercent: number
	percent: number
	colorReset: boolean

	prepare( cmd: string, args: string[] | undefined, cwd: string | undefined ) {
		this.cmd = cmd
		this.args = args
		this.cwd = cwd
	}

	open( initialDimensions: vscode.TerminalDimensions | undefined ): void {
		this.doBuild()
	}

	close() {
	}

	printBmkOutput( data: any, colorOuput: boolean | undefined, progressBar: any ) {
		const str: string[] = data.toString().split( os.EOL )

		for ( let index = 0; index < str.length; index++ ) {
			const line = str[index].trim()

			// Always update progress
			if ( progressBar && line.startsWith( '[' ) && line[5] == ']' ) {
				this.percent = Number( line.substring( 1, 4 ) )
				progressBar.report( { message: ` ${this.percent}%`, increment: this.percent - this.lastPercent } )
				this.lastPercent = this.percent
			}

			// Print output and potentially add colors
			if ( colorOuput ) {
				this.colorBmkOutput( line )
			} else {
				this.writeEmitter.fire( line + '\r\n' )
			}
		}
	}

	colorBmkOutput( line: string ) {
		// Try to colour some of the lines
		switch ( this.detectBmkOutputType( line ) ) {
			case 1: // Links
				this.writeEmitter.fire( '\u001b[36m' )
				this.colorReset = true
				break

			case 2: // Warnings
				this.writeEmitter.fire( '\u001b[33m' )
				this.colorReset = true
				break

			case 3: // Errors
				this.writeEmitter.fire( '\u001b[31m' )
				this.colorReset = true
				break
		}

		this.writeEmitter.fire( line + '\r\n' )

		if ( this.colorReset ) {
			this.writeEmitter.fire( '\u001b[0m' )
			this.colorReset = false
		}
	}

	detectBmkOutputType( line: string ) {
		// Links
		if ( line.startsWith( '[' ) && line.endsWith( ']' ) ) {
			return 1
		} else {
			// Errors
			if ( line.startsWith( 'Compile Error: ' ) || line.startsWith( 'Build Error: ' ) ) {
				return 3
			} else {
				// Warnings
				if ( line.startsWith( 'Compile Warning: ' ) ) {
					return 2
				}
			}
		}

		return 0
	}

	private async doBuild(): Promise<void> {
		return new Promise<void>( ( resolve ) => {
			// We have a defininition, right?
			if ( !this.cmd || !this.args ) {
				this.closeEmitter.fire( -1 )
				return resolve()
			}

			this.writeEmitter.fire( `${this.cmd} ${this.args.join( ' ' )}\r\n\r\n` )
			this.writeEmitter.fire( '== BUILDING ==\r\n\r\n' )

			const bmkColors: boolean | undefined = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'pref.showBuildColors' )
			let loc = vscode.ProgressLocation.Window
			if ( vscode.workspace.getConfiguration( 'blitzmax' ).get( 'pref.showBuildProgress' ) )
				loc = vscode.ProgressLocation.Notification

			vscode.window.withProgress( {
				location: loc,
				title: 'Building ' + path.parse( this.args[this.args.length - 1] ).base,
				cancellable: true
			}, async ( progress, token ) => {
				token.onCancellationRequested( () => {
					if ( bmkProcess ) {
						bmkProcess.kill( 'SIGINT' )
						this.writeEmitter.fire( `\r\n== ABORTED ==\r\n\r\n` )
						this.closeEmitter.fire( -1 )
						this.busy.notify()
						resolve()
					}
				} )

				const procStart = process.hrtime()
				let bmkProcess = cp.spawn( this.cmd, this.args, { cwd: this.cwd } )

				bmkProcess.stdout.on( 'data', ( data ) => {
					this.printBmkOutput( data, bmkColors, progress )
				} )

				bmkProcess.stderr.on( 'data', ( data ) => {
					this.printBmkOutput( data, bmkColors, progress )
				} )

				bmkProcess.on( 'error', ( error ) => {
					this.printBmkOutput( error.message, true, progress )
				} )

				bmkProcess.on( 'close', ( code ) => {
					if ( code ) {
						this.writeEmitter.fire( `\r\n== ERROR ==\r\n\r\n` )

						// Is this too hacky?
						setTimeout( () => {
							if ( vscode.workspace.getConfiguration( 'blitzmax' ).get( 'pref.jumpToProblemOnBuildError' ) )
								vscode.commands.executeCommand( 'editor.action.marker.nextInFiles' )

							if ( vscode.workspace.getConfiguration( 'blitzmax' ).get( 'pref.showProblemsOnBuildError' ) )
								vscode.commands.executeCommand( 'workbench.actions.view.problems' )
						}, 500 )
					} else {
						this.writeEmitter.fire( `\r\n== COMPLETE  ==\r\n\r\n` )
					}

					const procEnd = process.hrtime( procStart )

					this.writeEmitter.fire( `Execution time: ${procEnd[0]}s ${procEnd[1] / 1000000}ms\r\n\r\n` )

					this.closeEmitter.fire( code ? code : 0 )
					this.busy.notify()
					resolve()
				} )

				await this.busy.wait()
				return resolve()
			} )
		} )
	}
}