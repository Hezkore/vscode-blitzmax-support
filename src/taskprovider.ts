import * as vscode from 'vscode'
import * as cp from 'child_process'

export interface BmxBuildTaskDefinition extends vscode.TaskDefinition {
	apptype: string
	make: string
}

export class BmxBuildTaskProvider implements vscode.TaskProvider {
	private tasks: vscode.Task[] | undefined
	
	provideTasks( token?: vscode.CancellationToken ): vscode.ProviderResult<vscode.Task[]> {
		if (this.tasks !== undefined) return this.tasks
		
		// Provide new tasks
		this.tasks = []
		
		this.tasks.push(makeSimpleTask('console application', 'makeapp', 'console'))
		
		return this.tasks
	}
	
	public resolveTask(_task: vscode.Task): vscode.Task | undefined {
		const definition: BmxBuildTaskDefinition = <any>_task.definition
		
		return makeTask( definition )
    }
}

export function makeSimpleTask(label: string, make: string, apptype: string): vscode.Task {
	let definition = {
			type: 'bmx',
			label: label,
			make: make,
			apptype: apptype
		}
	return makeTask(definition)
}

export function makeTask(definition: BmxBuildTaskDefinition): vscode.Task {
	let exec = new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
		return new BmxBuildTaskTerminal(definition)
	})
	
	if (!definition.label) definition.label = 'Custom'
	
	let task = new vscode.Task( definition, vscode.TaskScope.Workspace, definition.label, 'BlitzMax', exec, '$blitzmax' )
	
	return task
}

class BmxBuildTaskTerminal implements vscode.Pseudoterminal {
	private writeEmitter = new vscode.EventEmitter<string>();
	onDidWrite: vscode.Event<string> = this.writeEmitter.event;
	private closeEmitter = new vscode.EventEmitter<void>();
	onDidClose?: vscode.Event<void> = this.closeEmitter.event;
	
	definition: BmxBuildTaskDefinition | undefined
	
	constructor(definition: BmxBuildTaskDefinition | undefined) {
	}
	
	open(initialDimensions: vscode.TerminalDimensions | undefined): void {
		this.doBuild()
	}
	
	close(): void {
	}
	
	private async doBuild(): Promise<void> {
		return new Promise<void>((resolve) => {
			this.writeEmitter.fire('Starting build...\r\n');
			
			let bmk = cp.spawn('D:/Applications/BlitzMaxNG/bin/bmk.exe', ['makeapp', '-a','D:/Applications/BlitzMaxNG/samples/breakout/breakout.bmx'])
			
			bmk.stdout.on('data', (data) => {
				this.writeEmitter.fire(`${data}`)
			})
			
			bmk.stderr.on('data', (data) => {
				this.writeEmitter.fire(`${data}\r\n`)
			})
			
			bmk.on('error', (error) => {
				this.writeEmitter.fire(`error: ${error.message}\r\n`)
			})
			
			bmk.on('close', (code) => {
				if (code) {
					this.writeEmitter.fire(`Error during build\r\n\r\n`)
				} else {
					this.writeEmitter.fire(`Build complete\r\n\r\n`)
				}
				
				this.closeEmitter.fire()
				resolve()
			})
		})
	}
}