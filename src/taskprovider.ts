import * as vscode from 'vscode'
import * as awaitNotify from 'await-notify'
import * as cp from 'child_process'
import * as path from 'path'

let terminal: BmxBuildTaskTerminal | undefined
let defaultBuildDefinition: BmxBuildTaskDefinition = {
	type: 'bmx',
	make: 'application',
	source: '${file}',
	debug: false,
	release: true,
	funcargcasting: 'warning'
}

export interface BmxBuildOptions {
	make: string
	onlycompile?: string
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
	standalone?: string
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

export function getBuildDefinitionFromWorkspace(workspace: vscode.WorkspaceFolder | undefined = undefined): BmxBuildTaskDefinition | undefined {
	
	if (!workspace) {
		const doc = vscode.window.activeTextEditor?.document
		if (doc) workspace = vscode.workspace.getWorkspaceFolder(doc.uri)
	}
	
	// If there's no workspace, we just return the default build definition
	if (!workspace) return defaultBuildDefinition
	
	// Figure out the default task and get the definition
	const config = vscode.workspace.getConfiguration( 'tasks', workspace )
	if (config) {
		
		const tasks: vscode.WorkspaceConfiguration | undefined = config.get( 'tasks' )
		if (tasks) {
			
			for (let i = 0; i < tasks.length; i++) {
				const def: BmxBuildTaskDefinition = tasks[i]
				if (!def) continue
				
				if (def.group.isDefault) return def
			}
		}
	}
	
	// Something went wrong, return default
	return defaultBuildDefinition
}

export class BmxBuildTaskProvider implements vscode.TaskProvider {
	private tasks: vscode.Task[] | undefined
	
	provideTasks( token?: vscode.CancellationToken ): vscode.ProviderResult<vscode.Task[]> {
		if (this.tasks !== undefined) return this.tasks
		
		// Provide new tasks
		this.tasks = []
		
		this.tasks.push(makeSimpleTask('console application', 'Build a console application', 'application', 'console'))
		this.tasks.push(makeSimpleTask('gui application', 'Build a GUI application', 'application', 'gui'))
		this.tasks.push(makeSimpleTask('module','Build a module', 'module'))
		
		return this.tasks
	}
	
	public resolveTask(_task: vscode.Task): vscode.Task | undefined {
		const definition: BmxBuildTaskDefinition = <any>_task.definition
		
		return makeTask( definition )
    }
}

export function makeSimpleTask(label: string, detail: string, make: string, apptype: string | undefined = undefined): vscode.Task {
	let definition = Object.assign({label, detail, make, apptype}, defaultBuildDefinition)
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
				bmxPath = vscode.workspace.getConfiguration( 'blitzmax', workspace ).get( 'path' )
			} else {
				// If this is a separate unkown file, we use the default BlitzMax path
				let globalBmxPath = vscode.workspace.getConfiguration( 'blitzmax' ).inspect( 'path' )?.globalValue
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
		
		if (resolvedDefinition.platform) args.push('-p', resolvedDefinition.platform)
		
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
	if (!definition.label) definition.label = 'build'
	
	// Create the task
	let task = new vscode.Task( definition, vscode.TaskScope.Workspace, definition.label, 'BlitzMax', exec, '$blitzmax' )
	
	// Setup task MaxIDE like
	task.presentationOptions.echo = true
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
	
	private async doBuild(): Promise<void> {
		return new Promise<void>((resolve) => {
			// We have a defininition, right?
			if (!this.cmd || !this.args) {
				this.closeEmitter.fire(-1)
				return resolve()
			}
			
			this.writeEmitter.fire('== BUILDING ==\r\n\r\n')
			this.writeEmitter.fire(this.cwd+'\r\n\r\n')
			this.writeEmitter.fire(`${this.cmd} ${this.args.join(' ')}\r\n`)
			
			vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Building ' + path.parse(this.args[this.args.length-1]).base,
				cancellable: true
			}, async (progress, token) => {
				token.onCancellationRequested(() => {
					if (bmkProcess) {
						bmkProcess.kill('SIGINT')
						this.writeEmitter.fire(`\r\n== ABORTED ==\r\n\r\n`)
						this.closeEmitter.fire(0)
						this.busy.notify()
						resolve()
					}
				})
				
				let bmkProcess = cp.spawn(this.cmd, this.args, {cwd: this.cwd})
				let lastPercent: number
				let percent: number
				
				bmkProcess.stdout.on('data', (data) => {
					this.writeEmitter.fire(`${data}`)
					
					const str = data.toString()
					//progress.report({ message: str.substring(0,5) })
					
					if (str.startsWith('[') && str[5] == ']') {
						percent = Number( str.split('%')[0].slice(1) )
						progress.report({ message: ` ${percent}%`, increment: percent - lastPercent })
						lastPercent = percent
					}
				})
				
				bmkProcess.stderr.on('data', (data) => {
					this.writeEmitter.fire(`${data}\r\n`)
				})
				
				bmkProcess.on('error', (error) => {
					this.writeEmitter.fire(`error: ${error.message}\r\n`)
				})
				
				bmkProcess.on('close', (code) => {
					if (code) {
						this.writeEmitter.fire(`\r\n== ERROR ==\r\n\r\n`)
						
						// Is this too hacky?
						setTimeout(() => {
							vscode.commands.executeCommand('editor.action.marker.nextInFiles')
							vscode.commands.executeCommand('workbench.actions.view.problems')
						}, 500)
					} else {
						this.writeEmitter.fire(`\r\n== DONE ==\r\n\r\n`)
					}
					
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