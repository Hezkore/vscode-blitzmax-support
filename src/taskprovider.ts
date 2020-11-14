import * as vscode from 'vscode'
import * as path from 'path'
import * as cp from 'child_process'

let terminal: BmxBuildTaskTerminal | undefined

export interface BmxBuildTaskDefinition extends vscode.TaskDefinition {
	make: string
	onlycompile?: string
	source: string
	fullcompile?: string
	appstub?: string | undefined
	debug?: string
	architecture?: string
	gdb?: string
	threaded?: string
	universal?: string
	crosscompile?: string
	musl?: string
	nostrictupgrade?: string
	output?: string
	quiet?: string
	quick?: string
	release?: string
	standalone?: string
	static?: string
	apptype?: string
	platform?: string
	verbose?: string
	funcargcasting?: string
	execute?: string
	framework?: string
	nomanifest?: string
	single?: string
	nodef?: string
	nohead?: string
	override?: string
	overerr?: string
	nopie?: string
	upx?: string
	conditionals?: string[]
	args?: string[]
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
	let definition = {
			type: 'bmx',
			detail: detail,
			source: '${file}',
			label: label,
			make: make,
			apptype: apptype
		}
	return makeTask(definition)
}

export function makeTask(definition: BmxBuildTaskDefinition): vscode.Task {
		
	// Setup custom execution
	let exec = new vscode.CustomExecution(async (resolvedDefinition: vscode.TaskDefinition): Promise<vscode.Pseudoterminal> => {
		
		let bmkPath: vscode.Uri | undefined
		let args: string[] = []
		
		if (resolvedDefinition.bmk) {
			bmkPath = vscode.Uri.file(resolvedDefinition.bmk)
		} else {
			let workspace = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(resolvedDefinition.source))
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
		
		if (resolvedDefinition.execute) args.push('-e')
		
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
		
		if (resolvedDefinition.output) {
			args.push('-o', resolvedDefinition.output)
		} else {
			// Always force output!
			let outPath = path.parse(vscode.Uri.file( resolvedDefinition.source ).fsPath)
			args.push('-o', vscode.Uri.file(outPath.dir + '/' + outPath.name).fsPath)
		}
		
		args.push(resolvedDefinition.source)
		
		// Terminal setup
		if (!terminal) terminal = new BmxBuildTaskTerminal
		terminal.prepare(bmkPath.fsPath, args)
		return terminal
	})
	
	// Make sure label exists!
	if (!definition.label) definition.label = 'Custom'
	
	// Create the task
	let task = new vscode.Task( definition, vscode.TaskScope.Workspace, definition.label, 'BlitzMax', exec, '$blitzmax' )
	
	return task
}

class BmxBuildTaskTerminal implements vscode.Pseudoterminal {
	private writeEmitter = new vscode.EventEmitter<string>()
	onDidWrite: vscode.Event<string> = this.writeEmitter.event
	private closeEmitter = new vscode.EventEmitter<void>()
	onDidClose?: vscode.Event<void> = this.closeEmitter.event
	
	cmd: string
	args: string[] | undefined
	
	prepare(cmd: string, args: string[] | undefined) {
		this.cmd = cmd
		this.args = args
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
				this.closeEmitter.fire()
				return resolve()
			}
			
			this.writeEmitter.fire('== BUILDING ==\r\n\r\n')
			this.writeEmitter.fire(`${this.cmd} ${this.args.join(' ')}\r\n`)
			
			let bmkProcess = cp.spawn(this.cmd, this.args)
			
			bmkProcess.stdout.on('data', (data) => {
				this.writeEmitter.fire(`${data}`)
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
					}, 500)
				} else {
					this.writeEmitter.fire(`\r\n== DONE ==\r\n\r\n`)
				}
				
				this.closeEmitter.fire()
				resolve()
			})
		})
	}
}