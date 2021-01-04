'use strict'

import * as vscode from 'vscode'
import * as awaitNotify from 'await-notify'
import * as cp from 'child_process'
import * as path from 'path'
import { toggleBool } from './common'

let terminal: BmxBuildTaskTerminal | undefined
export let internalBuildDefinition: BmxBuildTaskDefinition = {
	type: 'bmx',
	funcargcasting: 'warning',
	make: 'application',
	apptype: 'console',
	source: '${file}',
	release: true,
	debug: false
}

export interface BmxBuildOptions {
	make: string
	onlycompile?: boolean
	source: string
	fullcompile?: boolean
	appstub?: string | undefined
	debug?: boolean
	architecture?: string
	gdb?: boolean
	threaded?: boolean
	universal?: boolean
	crosscompile?: string
	musl?: boolean
	nostrictupgrade?: boolean
	output?: string
	quiet?: boolean
	quick?: boolean
	release?: boolean
	standalone?: boolean
	static?: boolean
	apptype?: string
	platform?: string
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
		vscode.tasks.registerTaskProvider('bmx', new BmxBuildTaskProvider)
	)
	
	// Related commands
	context.subscriptions.push(vscode.commands.registerCommand('blitzmax.build', () => {
		vscode.tasks.executeTask(makeTask(getBuildDefinitionFromWorkspace(undefined)))
	}))
	
	context.subscriptions.push(vscode.commands.registerCommand('blitzmax.setSourceFile', (document: vscode.Uri) => {
		const path = document ? document.fsPath : vscode.window.activeTextEditor?.document.uri.fsPath
		if (!path) return
		const def = getBuildDefinitionFromWorkspace()
		def.source = path
		saveAsDefaultTaskDefinition(def)
	}))
}

export function getBuildDefinitionFromWorkspace(workspace: vscode.WorkspaceFolder | undefined = undefined): BmxBuildTaskDefinition {
	
	if (!workspace) {
		const doc = vscode.window.activeTextEditor?.document
		if (doc) workspace = vscode.workspace.getWorkspaceFolder(doc.uri)
	}
	
	// If there's no workspace, we just return the internal build definition
	if (!workspace) return internalBuildDefinition
	
	// Figure out the default task and get the definition
	const config = vscode.workspace.getConfiguration('tasks', workspace)
	const tasks: vscode.WorkspaceConfiguration | undefined = config.get('tasks')
	if (tasks) {
		
		let firstBmxTask: BmxBuildTaskDefinition | undefined
		for (let i = 0; i < tasks.length; i++) {
			const task: BmxBuildTaskDefinition = tasks[i]
			if (!task || task.type != 'bmx' ) continue
			if (!firstBmxTask) firstBmxTask = task
			if (task.group && task.group.isDefault) return task
		}
		if (firstBmxTask) return firstBmxTask
	}
	
	// Something went wrong, return default
	return internalBuildDefinition
}

export function saveAsDefaultTaskDefinition(newDef: BmxBuildTaskDefinition | undefined) : boolean {
	
	if (!newDef) return false
	
	const doc = vscode.window.activeTextEditor?.document
	let workspace: vscode.WorkspaceFolder | undefined
	if (doc) workspace = vscode.workspace.getWorkspaceFolder(doc.uri)
	if (!workspace) {
		internalBuildDefinition = newDef
		return true
	}
	
	// Try to update the actual default task
	const config = vscode.workspace.getConfiguration('tasks')
	const tasks: BmxBuildTaskDefinition[] | undefined = config.get('tasks')
	if (tasks){
		
		let updatedTasks: BmxBuildTaskDefinition[] = []
		let foundDefault: boolean = false
		let firstBmxTaskAtIndex: number = -1
		for (let i = 0; i < tasks.length; i++) {
			const oldDef: BmxBuildTaskDefinition = tasks[i]
			if (!oldDef) continue
			if (firstBmxTaskAtIndex < 0 && oldDef.type == 'bmx') firstBmxTaskAtIndex = i
			
			if (oldDef.group && oldDef.group.isDefault){
				
				updatedTasks.push(newDef)
				foundDefault = true
			} else updatedTasks.push(oldDef)
		}
		
		if (foundDefault) {
			config.update('tasks', updatedTasks)
			return true
		} else {
			if (firstBmxTaskAtIndex >= 0) {
				updatedTasks[firstBmxTaskAtIndex] = newDef
				config.update('tasks', updatedTasks)
				return true
			} else {
				updatedTasks.push(newDef)
				config.update('tasks', updatedTasks)
				return true
			}
		}
	}
	
	config.update('tasks', [newDef])
	return true
}

export class BmxBuildTaskProvider implements vscode.TaskProvider {
	private tasks: vscode.Task[] | undefined
	
	provideTasks( token?: vscode.CancellationToken ): vscode.ProviderResult<vscode.Task[]> {
		if (this.tasks !== undefined) return this.tasks
		
		// Provide new tasks
		this.tasks = []
		
		this.tasks.push(makeSimpleTask('module','Build a module', 'module'))
		this.tasks.push(makeSimpleTask('gui application', 'Build a GUI application', 'application', 'gui'))
		this.tasks.push(makeSimpleTask('console application', 'Build a console application', 'application', 'console'))
		
		return this.tasks
	}
	
	public resolveTask(_task: vscode.Task): vscode.Task | undefined {
		const definition: BmxBuildTaskDefinition = <any>_task.definition
		
		return makeTask( definition )
    }
}

export function makeSimpleTask(label: string, detail: string, make: string, apptype: string | undefined = undefined): vscode.Task {
	let definition = Object.assign({label, detail, make, apptype}, internalBuildDefinition)
	return makeTask(definition)
}

export function makeTask(definition: BmxBuildTaskDefinition): vscode.Task {
	
	// Setup custom execution
	let exec = new vscode.CustomExecution(async (resolvedDefinition: vscode.TaskDefinition): Promise<vscode.Pseudoterminal> => {
		
		let bmkPath: vscode.Uri | undefined
		let args: string[] = []
		let workspace = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(resolvedDefinition.source))
		
		if (resolvedDefinition.bmk) {
			bmkPath = vscode.Uri.file(resolvedDefinition.bmk)
		} else {
			let bmxPath: string | undefined
			
			if (workspace) {
				// If this is part of a workspace, we use that path
				bmxPath = vscode.workspace.getConfiguration( 'blitzmax', workspace ).get( 'base.path' )
			} else {
				// If this is a separate unkown file, we use the default BlitzMax path
				let globalBmxPath = vscode.workspace.getConfiguration( 'blitzmax' ).inspect( 'base.path' )?.globalValue
				if (typeof(globalBmxPath)==='string') bmxPath = globalBmxPath
			}
			
			bmkPath = vscode.Uri.file(bmxPath + '/bin/bmk')
		}
		
		// Process args
		switch (resolvedDefinition.make) {
			case 'module':
				args.push('makemods')
				break
			case 'library':
				args.push('makelib')
				break
			case 'bootstrap':
				args.push('makebootstrap')
				break
			default:
				args.push('makeapp')
				break
		}
		
		if (resolvedDefinition.onlycompile) args.push('compile')
		
		if (resolvedDefinition.fullcompile) args.push('-a')
		
		if (resolvedDefinition.appstub) args.push('-b', resolvedDefinition.appstub)
		
		if (resolvedDefinition.debug) args.push('-d')
		
		if (resolvedDefinition.architecture) args.push('-g', resolvedDefinition.architecture)
		
		if (resolvedDefinition.gdb) args.push('-gdb')
		
		if (resolvedDefinition.threaded) args.push('-h')
		
		if (resolvedDefinition.universal) args.push('-i')
		
		if (resolvedDefinition.crosscompile) args.push('-l', resolvedDefinition.crosscompile)
		
		if (resolvedDefinition.musl) args.push('-musl')
		
		if (resolvedDefinition.nostrictupgrade) args.push('-nostrictupgrade')
		
		if (resolvedDefinition.quiet) args.push('-q')
		
		if (resolvedDefinition.quick) args.push('-quick')
		
		if (resolvedDefinition.release) args.push('-r')
		
		if (resolvedDefinition.standalone) args.push('-standalone')
		
		if (resolvedDefinition.static) args.push('-static')
		
		if (resolvedDefinition.apptype) args.push('-t', resolvedDefinition.apptype)
		
		//if (resolvedDefinition.platform) args.push('-p', resolvedDefinition.platform)
		
		if (resolvedDefinition.verbose) args.push('-v')
		
		if (resolvedDefinition.funcargcasting == 'warning') args.push('-w')
		
		if (resolvedDefinition.framework) args.push('-f', resolvedDefinition.framework)
		
		if (resolvedDefinition.nomanifest) args.push('-nomanifest')
		
		if (resolvedDefinition.single) args.push('-single')
		
		if (resolvedDefinition.nodef) args.push('-nodef')
		
		if (resolvedDefinition.nohead) args.push('-nohead')
		
		if (resolvedDefinition.override) args.push('-override')
		
		if (resolvedDefinition.overerr) args.push('-overerr')
		
		if (resolvedDefinition.nopie) args.push('-no-pie')
		
		if (resolvedDefinition.upx) args.push('-upx')
		
		const conditionals = resolvedDefinition.conditionals
		if (conditionals) {
			args.push( '-ud' )
			args.push( conditionals.toString().trim().replace( ' ', '' ) )
		}
		
		if (resolvedDefinition.args) args = args.concat(resolvedDefinition.args)
		
		if (resolvedDefinition.output) args.push('-o', resolvedDefinition.output)
		
		args.push(resolvedDefinition.source)
		
		// Terminal setup
		if (!terminal) terminal = new BmxBuildTaskTerminal
		terminal.prepare(bmkPath.fsPath, args, workspace?.uri.fsPath)
		return terminal
	})
	
	// Make sure label exists!
	if (!definition.label) definition.label = 'blitzmax'
	
	// Create the task
	let task = new vscode.Task( definition, vscode.TaskScope.Workspace, definition.label, 'BlitzMax', exec, '$blitzmax' )
	
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
	progress: any
	
	prepare(cmd: string, args: string[] | undefined, cwd: string | undefined) {
		this.cmd = cmd
		this.args = args
		this.cwd = cwd
	}
	
	open(initialDimensions: vscode.TerminalDimensions | undefined): void {
		this.doBuild()
	}
	
	close() {
	}
	
	processBmkOutput(data){
		data.toString().split('\r\n').forEach((str: string) => {
			// Try to colour some of the lines
			// Links
			if (str.startsWith('[') && str.endsWith(']')) {
				this.writeEmitter.fire('\u001b[36m')
				this.colorReset = true
			} else {
				// Errors
				if (str.startsWith('Compile Error: ') || str.startsWith('Build Error: ')) {
					this.writeEmitter.fire('\u001b[31m')
					this.colorReset = true
				} else {
					// Warnings
					if (str.startsWith('Compile Warning: ')) {
						this.writeEmitter.fire('\u001b[33m')
						this.colorReset = true
					}
				}
			}
			
			this.writeEmitter.fire(str + '\r\n')
			
			if (this.colorReset) {
				this.writeEmitter.fire('\u001b[0m')
				this.colorReset = false
			}
		})
	}
	
	private async doBuild(): Promise<void> {
		return new Promise<void>((resolve) => {
			// We have a defininition, right?
			if (!this.cmd || !this.args) {
				this.closeEmitter.fire(-1)
				return resolve()
			}
			
			this.writeEmitter.fire(`${this.cmd} ${this.args.join(' ')}\r\n\r\n`)
			this.writeEmitter.fire('== BUILDING ==\r\n\r\n')
			
			const bmkColors = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'pref.showBuildColors' )
			let loc = vscode.ProgressLocation.Window
			if (vscode.workspace.getConfiguration( 'blitzmax' ).get( 'pref.showBuildProgress' ))
				loc = vscode.ProgressLocation.Notification
			
			this.progress = vscode.window.withProgress({
				location: loc,
				title: 'Building ' + path.parse(this.args[this.args.length-1]).base,
				cancellable: true
			}, async (progress, token) => {
				token.onCancellationRequested(() => {
					if (bmkProcess) {
						bmkProcess.kill('SIGINT')
						this.writeEmitter.fire(`\r\n== ABORTED ==\r\n\r\n`)
						this.closeEmitter.fire(-1)
						this.busy.notify()
						resolve()
					}
				})
				
				const procStart = process.hrtime()
				let bmkProcess = cp.spawn(this.cmd, this.args, {cwd: this.cwd})
				
				bmkProcess.stdout.on('data', (data) => {
					const str = data.toString()
					
					// Always update progress
					if (str.startsWith('[') && str[5] == ']') {
						this.percent = Number( str.split('%')[0].slice(1) )
						this.progress.report({ message: ` ${this.percent}%`, increment: this.percent - this.lastPercent })
						this.lastPercent = this.percent
					}
					
					// Add colors
					if (bmkColors) {
						this.processBmkOutput(str)
					} else {
						this.writeEmitter.fire(data.toString())
					}
				})
				
				bmkProcess.stderr.on('data', (data) => {
					// Add colors
					if (bmkColors) {
						this.processBmkOutput(data)
					} else {
						this.writeEmitter.fire(data.toString())
					}
				})
				
				bmkProcess.on('error', (error) => {
					this.processBmkOutput(error.message)
				})
				
				bmkProcess.on('close', (code) => {
					if (code) {
						this.writeEmitter.fire(`\r\n== ERROR ==\r\n\r\n`)
						
						// Is this too hacky?
						setTimeout(() => {
							if (vscode.workspace.getConfiguration( 'blitzmax' ).get( 'pref.jumpToProblemOnBuildError' ))
								vscode.commands.executeCommand('editor.action.marker.nextInFiles')
							
							if (vscode.workspace.getConfiguration( 'blitzmax' ).get( 'pref.showProblemsOnBuildError' ))
								vscode.commands.executeCommand('workbench.actions.view.problems')
						}, 500)
					} else {
						this.writeEmitter.fire(`\r\n== COMPLETE  ==\r\n\r\n`)
					}
					
					const procEnd = process.hrtime(procStart)
					
					this.writeEmitter.fire(`Execution time: ${procEnd[0]}s ${procEnd[1]/1000000}ms\r\n\r\n`)
					
					this.closeEmitter.fire(code)
					this.busy.notify()
					resolve()
				})
				
				await this.busy.wait()
				return resolve()
			})
		})
	}
}

export async function toggleBuildOptions(definition: BmxBuildTaskDefinition | undefined, option: string): Promise<BmxBuildTaskDefinition | undefined> {
	
	if (!definition) return undefined
	
	switch (option) {
		case 'make':
			await vscode.window.showQuickPick(["application", "module", "library", "bootstrap"], {canPickMany: false}).then((picked) => {
				if (picked) definition.make = picked
			})
			break
			
		case 'onlycompile':
			definition.onlycompile = toggleBool(definition.onlycompile)
			break
			
		case 'source':
			await vscode.window.showInputBox({prompt: 'Absolute path to root source file', value: definition.source != '${file}' ? definition.source : vscode.window.activeTextEditor?.document.uri.fsPath}).then((picked) => {
				if (picked != undefined) definition.source = picked
				if (!definition.source) definition.source = '${file}'
			})
			break
			
		case 'fullcompile':
			definition.fullcompile = toggleBool(definition.fullcompile)
			break
			
		case 'appstub':
			await vscode.window.showInputBox({prompt: 'Custom appstub'}).then((picked) => {
				if (picked != undefined) definition.appstub = picked
			})
			break
			
		case 'debug':
			definition.debug = toggleBool(definition.debug)
			break
			
		case 'architecture':
			await vscode.window.showQuickPick(["armeabiv7a", "arm64v8a", "armeabi", "arm64", "arm", "x86", "x64"], {canPickMany: false}).then((picked) => {
				if (picked) definition.architecture = picked
			})
			break
			
		case 'gdb':
			definition.gdb = toggleBool(definition.gdb)
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
			
		case 'output':
			await vscode.window.showInputBox({prompt: 'Output file'}).then((picked) => {
				if (picked != undefined) definition.output = picked
			})
			break
			
		case 'quiet':
			definition.quiet = toggleBool(definition.quiet)
			break
			
		case 'quick':
			definition.quick = toggleBool(definition.quick)
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
			
		case 'apptype':
			await vscode.window.showQuickPick(["console", "gui"], {canPickMany: false}).then((picked) => {
				if (picked) definition.apptype = picked
			})
			break
			
		case 'platform':
			await vscode.window.showQuickPick(["win32", "macos", "linux", "android", "raspberrypi", "emscripten"], {canPickMany: false}).then((picked) => {
				if (picked) definition.platform = picked
			})
			break
			
		case 'verbose':
			definition.verbose = toggleBool(definition.verbose)
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
			
		case 'upx':
			definition.upx = toggleBool(definition.upx)
			break
			
		case 'conditionals':
			await vscode.window.showInputBox({prompt: 'User defined conditionals (space as separator)', value: definition.conditionals?.join(' ')}).then((picked) => {
				if (picked != undefined) definition.conditionals = picked.split(' ')
			})
			break
			
		case 'args':
			await vscode.window.showInputBox({prompt: 'User defined arguments (space as separator)', value: definition.args?.join(' ')}).then((picked) => {
				if (picked != undefined) definition.args = picked.split(' ')
			})
			break
			
		default:
			console.log(`Unknown build option ${option}`)
			break
	}
	
	return definition
}