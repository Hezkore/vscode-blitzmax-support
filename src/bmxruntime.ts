'use strict'

import {
	LoggingDebugSession,
	InitializedEvent, OutputEvent,
	Thread, TerminatedEvent
} from 'vscode-debugadapter'
import { DebugProtocol } from 'vscode-debugprotocol'
import * as process from 'child_process'
import * as path from 'path'
import * as awaitNotify from 'await-notify'
import * as vscode from 'vscode'
import { makeTask, getBuildDefinitionFromWorkspace, BmxBuildTaskDefinition, BmxBuildOptions } from './taskprovider'
import { BmxDebugger, BmxDebugStackFrame } from './bmxdebugger'

interface BmxLaunchRequestArguments extends DebugProtocol.LaunchRequestArguments, BmxBuildOptions {
}

// A bunch of initial setup stuff and providers
//
export function registerBmxDebugger( context: vscode.ExtensionContext ) {
		
	// Register a configuration provider for 'bmx' debug type
	const provider = new BmxDebugConfigurationProvider()
	context.subscriptions.push( vscode.debug.registerDebugConfigurationProvider( 'bmx', provider ) )
	
	let factory: vscode.DebugAdapterDescriptorFactory = new BmxInlineDebugAdapterFactory()
	context.subscriptions.push( vscode.debug.registerDebugAdapterDescriptorFactory( 'bmx', factory) )
	if ('dispose' in factory) context.subscriptions.push( factory )
	
	// Related commands
	context.subscriptions.push(vscode.commands.registerCommand('blitzmax.buildAndDebug', () => {
		vscode.debug.startDebugging(undefined,
			<vscode.DebugConfiguration>(provider.resolveDebugConfiguration(undefined, undefined)),
			{noDebug: false})
	}))
	context.subscriptions.push(vscode.commands.registerCommand('blitzmax.buildAndRun', () => {
		vscode.debug.startDebugging(undefined,
			<vscode.DebugConfiguration>(provider.resolveDebugConfiguration(undefined, undefined)),
			{noDebug: true})
	}))
}

// Read or create the configuration
//
export class BmxDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
	
	resolveDebugConfigurationWithSubstitutedVariables(workspace: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, token?:  vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration> {
		return config
	}
	
	resolveDebugConfiguration(workspace: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration | undefined, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration> {
		
		const doc = vscode.window.activeTextEditor?.document
		if (doc) workspace = vscode.workspace.getWorkspaceFolder(doc.uri)
		
		if (!config) config = {type: '', request: '', name: ''}
		
		// Are we part of any workspace?
		if (!workspace) {
			config.type = ''
			config.request = ''
			config.name = ''
		}
		
		// If launch.json is missing or empty, we create a new one based on the current task
		if (!config.type && !config.request && !config.name) {
			const definition = getBuildDefinitionFromWorkspace(workspace)
			if (definition) {
				config = Object.assign({name: definition.label, request: 'launch'}, definition)
			}
		}
		
		if (!config.source) {
			return vscode.window.showInformationMessage( 'Cannot find source file to debug' ).then(_ => {
				return undefined	// abort launch
			})
		}
		
		return config
	}
}

export class BmxInlineDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {
	createDebugAdapterDescriptor(_session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
		return new vscode.DebugAdapterInlineImplementation(new BmxDebugSession())
	}
}

// BlitzMax runtime
//
export class BmxDebugSession extends LoggingDebugSession {
	
	// We don't support multiple threads!
	static THREAD_ID = 1
	
	isDebugging: boolean // True if the Bmx debugger has halted the application
	lastStackFrameId: number
	stack: BmxDebugStackFrame[] = []
	bmxProcess: process.ChildProcessWithoutNullStreams
	
	private _killSignal: NodeJS.Signals = 'SIGKILL'
	private _buildDone = new awaitNotify.Subject()
	private _buildTaskExecution: vscode.TaskExecution | undefined
	private _buildError: boolean
	private _isRestart: boolean
	private _bmxProcessPath: string | undefined
	private debugParser: BmxDebugger
	
	public constructor() {
		super('bmx-debug.txt')
		
		this.setDebuggerLinesStartAt1( false )
		this.setDebuggerColumnsStartAt1( false )
	}
	

	
	protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
		
		// Build and return capabilities
		response.body = response.body || {}
		response.body.supportsStepInTargetsRequest = true
		response.body.supportsReadMemoryRequest = true
		response.body.supportsTerminateRequest = true
		response.body.supportsRestartRequest = true
		response.body.supportsConditionalBreakpoints = false
		response.body.supportsFunctionBreakpoints = false
		response.body.supportsHitConditionalBreakpoints = false
		response.body.supportsInstructionBreakpoints = false
		response.body.supportsBreakpointLocationsRequest = false
		response.body.supportsDataBreakpoints = false
		
		this.sendResponse(response)
		
		this.sendEvent(new InitializedEvent())
	}
	
	protected async launchRequest(response: DebugProtocol.LaunchResponse, args: BmxLaunchRequestArguments) {
		
		// Setup a build task definition based on our launch arguments
		let debuggerTaskDefinition: BmxBuildTaskDefinition = <BmxBuildTaskDefinition>(args)
		
		// Set debugging based on button pressed
		// FIX: This apparently doesn't work via the 'Run' menu?
		console.log("DEBUG?: " + args.noDebug)
		debuggerTaskDefinition.debug = !!!args.noDebug
		
		if (debuggerTaskDefinition.debug) {
			console.log('DEBUGGING BLITZMAX!')
			this.debugParser = new BmxDebugger(this)
			debuggerTaskDefinition.release = false
		} else {
			console.log('NOT DEBUGGING BLITZMAX!')
		}
		
		// Create a build task from our definition
		let debuggerTask = makeTask(debuggerTaskDefinition)
		
		// Prepare what happens once the task is done
		vscode.tasks.onDidEndTaskProcess(((e) => {
			// Make sure it's our debugger task
			if (e.execution.task === debuggerTask) {
				this._buildError = e.exitCode ? true : false
				this._buildDone.notify()
			}
		}))
		
		// Store the task execution
		vscode.tasks.onDidStartTaskProcess(((e) => {
			// Make sure it's our debugger task
			if (e.execution.task === debuggerTask)
				this._buildTaskExecution = e.execution
		}))
		
		// Execute the task!
		await vscode.tasks.executeTask(debuggerTask)
		
		// Wait until task is complete
		await this._buildDone.wait()
		
		// Went as expected?
		if (this._buildError || !this._buildTaskExecution) {
			//console.log('Error during build task')
			this.sendEvent( new TerminatedEvent() )
			return undefined
		} else {
			//console.log('Starting debug session')
		}
		
		this._buildTaskExecution = undefined
		
		// Figure out output path
		this._bmxProcessPath = args.output
		if (!this._bmxProcessPath) {
			const outPath = path.parse(args.source)
			this._bmxProcessPath = vscode.Uri.file( outPath.dir + '/' + outPath.name ).fsPath
		}
		
		// Launch!
		//console.log("LAUNCHING: " + this._bmxProcessPath)
		this.startRuntime()
		
		//console.log( 'started ' + this._bmxProcessPath )
		this.sendResponse(response)
	}
	
	startRuntime(){
		// Reset some stuff
		this.isDebugging = false
		
		// Make sure we have a path
		if (!this._bmxProcessPath) return
		
		// Kill if already running
		if (this.bmxProcess){
			if (this.isDebugging && this.debugParser) {
				// Use the debugger to quit
				this.debugParser.sendInputToDebugger('q')
			} else {
				// Just kill the process
				this.bmxProcess.kill(this._killSignal)
			}
		}
		
		this.bmxProcess = process.spawn( this._bmxProcessPath, [])
		
		// Any normal stdout goes to debug console
		this.bmxProcess.stdout.on('data', (data) => {
			this.sendEvent(new OutputEvent(data.toString(), 'stdout'))
		})
		
		this.bmxProcess.on('error', (err) => {
			this.sendEvent(new OutputEvent(err.message.toString(), 'stderr'))
		})
		
		this.bmxProcess.stderr.on('data', (data) => {
			if (this.debugParser) {
				this.debugParser.onDebugOutput(data.toString())
			} else {
				this.sendEvent(new OutputEvent(data.toString(), 'stderr'))
			}
		})
		
		this.bmxProcess.on('close', (code) => {
			if (!this._isRestart)
				this.sendEvent( new TerminatedEvent() )
			this._isRestart = false
		})
	}
	
	protected terminateRequest(response: DebugProtocol.TerminateResponse, args: DebugProtocol.TerminateArguments, request?: DebugProtocol.Request) {
		// Are we running the build task?
		if (this._buildTaskExecution) {
			this._buildTaskExecution.terminate()
			this._buildTaskExecution = undefined
		}
		
		// Are we running the process?
		if (this.bmxProcess){
			if (this.isDebugging && this.debugParser) {
				// Use the debugger to quit
				this.debugParser.sendInputToDebugger('q')
			} else {
				// Just kill the process
				this.bmxProcess.kill(this._killSignal)
			}
		}
		
		this.sendResponse(response)
	}
	
	protected pauseRequest(response: DebugProtocol.PauseResponse, args: DebugProtocol.PauseArguments, request?: DebugProtocol.Request){
		response.message = 'Pause is not supported'
		response.success = false
		this.sendResponse(response)
	}
	
	protected restartRequest(response: DebugProtocol.RestartResponse, args: DebugProtocol.RestartArguments, request?: DebugProtocol.Request){
		this._isRestart = true
		this.startRuntime()
		this.sendResponse(response)
	}
	
	protected threadsRequest(response: DebugProtocol.ThreadsResponse) {
		// No threads! Just return a default thread
		response.body = {threads: [new Thread( BmxDebugSession.THREAD_ID, "thread 1" )]}
		this.sendResponse(response)
	}
	
	protected async stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): Promise<void> {
		response = await this.debugParser.onStackTraceRequest(response, args)
		this.sendResponse(response)
	}
	
	protected async scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): Promise<void> {
		response = await this.debugParser.onScopesRequest(response, args)
		this.sendResponse(response)
	}
	
	protected async variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): Promise<void> {
		response = await this.debugParser.onVariablesRequest(response, args)
		this.sendResponse(response)
	}
	
	protected async continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): Promise<void> {
		response = await this.debugParser.continueRequest(response, args)
		this.sendResponse(response)
	}
	 
	protected async nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): Promise<void> {
		response = await this.debugParser.nextRequest(response, args)
		this.sendResponse(response)
	}
	
	protected async stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): Promise<void> {
		response = await this.debugParser.stepInRequest(response, args)
		this.sendResponse(response)
	}
	
	protected async stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments): Promise<void> {
		response = await this.debugParser.stepOutRequest(response, args)
		this.sendResponse(response)
	}
}