'use strict'

import {
	LoggingDebugSession,
	InitializedEvent, OutputEvent,
	Thread, TerminatedEvent
} from 'vscode-debugadapter'
import { DebugProtocol } from 'vscode-debugprotocol'
import * as process from 'child_process'
import * as awaitNotify from 'await-notify'
import * as vscode from 'vscode'
import * as os from 'os'
import { makeTask, taskOutput, getBuildDefinitionFromWorkspace, BmxBuildTaskDefinition, BmxBuildOptions } from './taskprovider'
import { BmxDebugger, BmxDebugStackFrame } from './bmxdebugger'

interface BmxLaunchRequestArguments extends DebugProtocol.LaunchRequestArguments, BmxBuildOptions {
	workspace?: vscode.WorkspaceFolder
}

// A bunch of initial setup stuff and providers
//
export function registerDebugger( context: vscode.ExtensionContext ) {

	// Register a configuration provider for 'bmx' debug type
	const provider = new BmxDebugConfigurationProvider()
	context.subscriptions.push( vscode.debug.registerDebugConfigurationProvider( 'bmx', provider ) )

	let factory: vscode.DebugAdapterDescriptorFactory = new BmxInlineDebugAdapterFactory()
	context.subscriptions.push( vscode.debug.registerDebugAdapterDescriptorFactory( 'bmx', factory ) )

	// Related commands
	context.subscriptions.push( vscode.commands.registerCommand( 'blitzmax.buildAndDebug', () => {
		vscode.debug.startDebugging( undefined,
			<vscode.DebugConfiguration>( provider.resolveDebugConfiguration( undefined, undefined ) ),
			{ noDebug: false } )
	} ) )
	context.subscriptions.push( vscode.commands.registerCommand( 'blitzmax.buildAndRun', () => {
		vscode.debug.startDebugging( undefined,
			<vscode.DebugConfiguration>( provider.resolveDebugConfiguration( undefined, undefined ) ),
			{ noDebug: true } )
	} ) )
}

// Read or create the configuration
//
export class BmxDebugConfigurationProvider implements vscode.DebugConfigurationProvider {

	resolveDebugConfigurationWithSubstitutedVariables( workspace: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, token?: vscode.CancellationToken ): vscode.ProviderResult<vscode.DebugConfiguration> {
		return config
	}

	resolveDebugConfiguration( workspace: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration | undefined, token?: vscode.CancellationToken ): vscode.ProviderResult<vscode.DebugConfiguration> {

		const doc = vscode.window.activeTextEditor?.document
		if ( doc ) workspace = vscode.workspace.getWorkspaceFolder( doc.uri )

		if ( !config ) config = { type: '', request: '', name: '' }

		// Are we part of any workspace?
		if ( !workspace ) {
			config.type = ''
			config.request = ''
			config.name = ''
		}

		// If launch.json is missing or empty, we create a new one based on the current task
		if ( !config.type && !config.request && !config.name ) {
			const definition = getBuildDefinitionFromWorkspace( workspace )
			if ( definition ) {
				config = Object.assign( { noDebug: config.noDebug, name: definition.label, request: 'launch' }, definition )
			}
		}

		if ( !config.source ) {
			return vscode.window.showInformationMessage( 'Cannot find source file to debug' ).then( _ => {
				return undefined	// abort launch
			} )
		}

		config.workspace = workspace

		return config
	}
}

export class BmxInlineDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {
	createDebugAdapterDescriptor( _session: vscode.DebugSession ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
		return new vscode.DebugAdapterInlineImplementation( new BmxDebugSession() )
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
	bmxProcess: process.ChildProcess
	workspace: vscode.WorkspaceFolder | undefined
	bmxProcessPath: string | undefined
	debugParser: BmxDebugger
	killSignal: NodeJS.Signals = 'SIGKILL'
	isRestart: boolean

	private _buildDone = new awaitNotify.Subject()
	private _buildTaskExecution: vscode.TaskExecution | undefined
	private _buildError: boolean
	private terminal: vscode.Terminal
	private pseudoTerminal: BmxDebugTerminal

	public constructor() {
		super( 'bmx-debug.txt' )

		this.setDebuggerLinesStartAt1( false )
		this.setDebuggerColumnsStartAt1( false )
	}

	protected initializeRequest( response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments ): void {

		// Return capabilities
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
		response.body.supportsEvaluateForHovers = true

		this.sendResponse( response )

		this.sendEvent( new InitializedEvent() )
	}

	protected configurationDoneRequest( response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments ): void {
		super.configurationDoneRequest( response, args )
	}

	protected async launchRequest( response: DebugProtocol.LaunchResponse, args: BmxLaunchRequestArguments ) {
		// Setup a build task definition based on our launch arguments
		let debuggerTaskDefinition: BmxBuildTaskDefinition = <BmxBuildTaskDefinition>( args )

		debuggerTaskDefinition.debug = !!!args.noDebug

		if ( debuggerTaskDefinition.debug ) this.debugParser = new BmxDebugger( this )

		// Create a build task from our definition
		let debuggerTask = makeTask( debuggerTaskDefinition )

		// Prepare what happens once the task is done
		vscode.tasks.onDidEndTaskProcess( ( ( e ) => {
			// Make sure it's our debugger task
			if ( e.execution.task === debuggerTask ) {
				this._buildError = e.exitCode ? true : false
				this._buildDone.notify()
			}
		} ) )

		// Store the task execution
		vscode.tasks.onDidStartTaskProcess( ( ( e ) => {
			// Make sure it's our debugger task
			if ( e.execution.task === debuggerTask )
				this._buildTaskExecution = e.execution
		} ) )

		// Execute the task!
		await vscode.tasks.executeTask( debuggerTask )

		// Wait until task is complete
		await this._buildDone.wait()

		// Went as expected?
		if ( this._buildError || !this._buildTaskExecution ) {
			//console.log('Error during build task')
			this.sendEvent( new TerminatedEvent() )
			return undefined
		} else {
			//console.log('Starting debug session')
		}

		this._buildTaskExecution = undefined
		this.workspace = args.workspace

		// Figure out output path
		this.bmxProcessPath = taskOutput( debuggerTaskDefinition, args.workspace )
		if ( os.platform() == 'darwin' && args.apptype == 'gui' ) {
			this.bmxProcessPath +=
				'.app/Contents/MacOS/' +
				this.bmxProcessPath.substr( this.bmxProcessPath.lastIndexOf( '/' ) + 1 )
		}
		
		// Launch!
		//console.log("LAUNCHING: " + this._bmxProcessPath)
		this.startRuntime()

		//console.log( 'started ' + this._bmxProcessPath )
		this.sendResponse( response )
	}

	startRuntime() {

		// Make sure we have a path
		if ( !this.bmxProcessPath ) return

		if ( !this.pseudoTerminal ) this.pseudoTerminal = new BmxDebugTerminal
		this.pseudoTerminal.configure( this )
		
		if ( !this.terminal ) this.terminal = vscode.window.createTerminal( {
			name: 'BlitzMax Debug Session',
			pty: this.pseudoTerminal,
			iconPath: new vscode.ThemeIcon( 'rocket' )
		} )
		//this.terminal.show( true )

		// Reset some stuff
		this.isDebugging = false
	}

	protected terminateRequest( response: DebugProtocol.TerminateResponse, args: DebugProtocol.TerminateArguments, request?: DebugProtocol.Request ) {
		// Are we running the build task?
		if ( this._buildTaskExecution ) {
			this._buildTaskExecution.terminate()
			this._buildTaskExecution = undefined
		}

		// Are we running the process?
		if ( this.bmxProcess ) {
			if ( this.isDebugging && this.debugParser ) {
				// Use the debugger to quit
				this.debugParser.sendInputToDebugger( 'q' )
			} else {
				// Just kill the process
				this.bmxProcess.kill( this.killSignal )
			}
		}

		this.sendResponse( response )
	}

	protected pauseRequest( response: DebugProtocol.PauseResponse, args: DebugProtocol.PauseArguments, request?: DebugProtocol.Request ) {
		response.message = 'Pause is not supported'
		response.success = false
		this.sendResponse( response )
	}

	protected restartRequest( response: DebugProtocol.RestartResponse, args: DebugProtocol.RestartArguments, request?: DebugProtocol.Request ) {
		this.debugParser.restartRequest()
		this.isRestart = true
		this.startRuntime()
		this.sendResponse( response )
	}

	protected threadsRequest( response: DebugProtocol.ThreadsResponse ) {
		// No threads! Just return a default thread
		response.body = { threads: [new Thread( BmxDebugSession.THREAD_ID, "thread 1" )] }
		this.sendResponse( response )
	}

	protected async evaluateRequest( response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments, request?: DebugProtocol.Request ) {
		response = await this.debugParser.evaluateRequest( response, args )
		this.sendResponse( response )
	}

	protected async stackTraceRequest( response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments ): Promise<void> {
		response = await this.debugParser.onStackTraceRequest( response, args )
		this.sendResponse( response )
	}

	protected async scopesRequest( response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments ): Promise<void> {
		response = await this.debugParser.onScopesRequest( response, args )
		this.sendResponse( response )
	}

	protected async variablesRequest( response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments ): Promise<void> {
		response = await this.debugParser.onVariablesRequest( response, args )
		this.sendResponse( response )
	}

	protected async continueRequest( response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments ): Promise<void> {
		response = await this.debugParser.continueRequest( response, args )
		this.sendResponse( response )
	}

	protected async nextRequest( response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments ): Promise<void> {
		response = await this.debugParser.nextRequest( response, args )
		this.sendResponse( response )
	}

	protected async stepInRequest( response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments ): Promise<void> {
		response = await this.debugParser.stepInRequest( response, args )
		this.sendResponse( response )
	}

	protected async stepOutRequest( response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments ): Promise<void> {
		response = await this.debugParser.stepOutRequest( response, args )
		this.sendResponse( response )
	}
}

class BmxDebugTerminal implements vscode.Pseudoterminal {
	private writeEmitter = new vscode.EventEmitter<string>()
	onDidWrite: vscode.Event<string> = this.writeEmitter.event
	private closeEmitter = new vscode.EventEmitter<number>()
	onDidClose?: vscode.Event<number> = this.closeEmitter.event

	debugSession: BmxDebugSession

	configure( session: BmxDebugSession ) {
		this.debugSession = session
	}

	open( initialDimensions: vscode.TerminalDimensions | undefined ): void {
		this.run()
	}

	close() {
	}

	handleInput( data: string ) {
		if ( this.debugSession.bmxProcess &&
			this.debugSession.bmxProcess.stdin &&
			this.debugSession.bmxProcess.stdin.writable ) {
				
			this.writeEmitter.fire( data )
			if ( data == '\r' ) data = '\n'
			this.debugSession.bmxProcess.stdin.write( data )
		}
	}

	private async run(): Promise<void> {
		return new Promise<void>( ( resolve ) => {
			// We have a defininition, right?
			if ( !this.debugSession || !this.debugSession.bmxProcessPath ) {
				this.closeEmitter.fire( -1 )
				return resolve()
			}

			this.writeEmitter.fire( `${this.debugSession.bmxProcessPath}\r\n\r\n` )


			// Kill if already running
			if ( this.debugSession.bmxProcess ) {
				if ( this.debugSession.isDebugging && this.debugSession.debugParser ) {
					// Use the debugger to quit
					this.debugSession.debugParser.sendInputToDebugger( 'q' )
				} else {
					// Just kill the process
					this.debugSession.bmxProcess.kill( this.debugSession.killSignal )
				}
			}

			this.debugSession.bmxProcess = process.spawn( this.debugSession.bmxProcessPath )

			// Any normal stdout goes to debug console
			if ( this.debugSession.bmxProcess.stdout ) this.debugSession.bmxProcess.stdout.on( 'data', ( data ) => {
				this.writeEmitter.fire( data.toString() )
				this.debugSession.sendEvent( new OutputEvent( data.toString(), 'stdout' ) )
			} )

			this.debugSession.bmxProcess.on( 'error', ( err ) => {
				this.writeEmitter.fire( err.message.toString() )
				vscode.window.showErrorMessage( 'BlitzMax process error: ' +
					err.message.toString() )
				this.debugSession.sendEvent( new OutputEvent( err.message.toString(), 'stderr' ) )
			} )

			if ( this.debugSession.bmxProcess.stderr ) this.debugSession.bmxProcess.stderr.on( 'data', ( data ) => {
				this.writeEmitter.fire( data.toString() )
				if ( this.debugSession.debugParser ) {
					this.debugSession.debugParser.onDebugOutput( data.toString() )
				} else {
					this.debugSession.sendEvent( new OutputEvent( data.toString(), 'stderr' ) )
				}
			} )

			this.debugSession.bmxProcess.on( 'close', ( code ) => {
				this.closeEmitter.fire( code ? code : 0 )
				if ( !this.debugSession.isRestart )
					this.debugSession.sendEvent( new TerminatedEvent() )
				this.debugSession.isRestart = false
			} )
		} )
	}
}