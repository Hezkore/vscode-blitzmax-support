'use strict'

import {
	LoggingDebugSession,
	InitializedEvent, StoppedEvent, OutputEvent,
	Thread, Handles, TerminatedEvent, ContinuedEvent
} from 'vscode-debugadapter'
import { DebugProtocol } from 'vscode-debugprotocol'
import * as process from 'child_process'
import * as path from 'path'
import * as awaitNotify from 'await-notify'
import * as vscode from 'vscode'
import { makeTask, getBuildDefinitionFromWorkspace, BmxBuildTaskDefinition, BmxBuildOptions } from './taskprovider'

interface BmxLaunchRequestArguments extends BmxBuildOptions, DebugProtocol.LaunchRequestArguments {
	noDebug?: boolean
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
			if (definition)
				config = Object.assign({name: definition.label, request: 'launch'}, definition)
		}
		
		if (!config.source) {
			return vscode.window.showInformationMessage( 'Cannot find a source file to debug' ).then(_ => {
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

// Debugger starts here!
export class BmxDebugSession extends LoggingDebugSession {
	
	// We don't support multiple threads!
	private static THREAD_ID = 1

	private _variableHandles = new Handles<string>()
	
	private _buildDone = new awaitNotify.Subject()
	
	private _buildTaskExecution: vscode.TaskExecution | undefined
	
	private _buildError: boolean
	
	private _bmxProcess: process.ChildProcessWithoutNullStreams
	
	private _isRestart: boolean
	
	private _bmxProcessPath: string | undefined
	
	private _stackFrames: DebugProtocol.StackFrame[] = []
	
	private _stackSteps: BmxStackStep[] = []
	
	private _stackStepId: number = 0
	
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
		debuggerTaskDefinition.debug = !args.noDebug
		
		if (debuggerTaskDefinition.debug)
			debuggerTaskDefinition.release = false
		
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
		// Make sure we have a path
		if (!this._bmxProcessPath) return
		
		// Kill if already running
		if (this._bmxProcess) this._bmxProcess.kill('SIGINT')
		
		this._bmxProcess = process.spawn( this._bmxProcessPath, [])
		//if (this._bmxProcess) {
		//	this.sendEvent(new OutputEvent('Debug started ' + Date(), 'stdout'))
		//}
		
		this._bmxProcess.stdout.on('data', (data) => {
			this.sendEvent(new OutputEvent(data.toString(), 'stdout'))
		})
		
		this._bmxProcess.on('error', (err) => {
			this.sendEvent(new OutputEvent(err.message.toString(), 'stderr'))
		})
		
		this._bmxProcess.stderr.on('data', (data) => {
			this.sendEvent(new OutputEvent(data.toString(), 'stderr'))

			let insideBlock: number = 0
			let blockType: string | undefined
			let dumpForBmxStep: BmxStackStep[] | undefined
			let trace: string[] = []
			const lines: string[] = data.toString().split( '\r\n' )
			for (let i = 0; i < lines.length; i++) {
				if (!lines[i].startsWith( '~>' )) continue
				const line = lines[i].slice( 2 )
				if (!line) continue

				if (!blockType) {
					if (line.startsWith( 'ObjectDump@' )) {
						const addr = line.slice( 11, -1 )
						blockType = "ObjectDump"
						insideBlock ++
						dumpForBmxStep = this.findStepWithAddress( addr )
						if (!dumpForBmxStep) console.log( 'UNABLE TO FIND VARIABLE ' + addr )
						continue
					}
				}

				switch (line) {
					case 'DebugStop:':
						if (!blockType) {
							this._stackStepId = 0
							this._bmxProcess.stdin.write( 't\n' )
							this.sendEvent(new StoppedEvent('debug stop', BmxDebugSession.THREAD_ID))
						}
						break

					case 'Debug:':
						if (!blockType) {
							this._stackStepId = 0
							this._bmxProcess.stdin.write( 't\n' )
							this.sendEvent(new StoppedEvent('step', BmxDebugSession.THREAD_ID))
						}
						break

					case 'StackTrace{':
						if (!blockType) {
							blockType = "StackTrace"
							insideBlock++
						}
						break

					case '}':
						insideBlock--
						if (insideBlock == 0) {
							if (blockType == "StackTrace") this.processStack( trace )
							if (blockType == "ObjectDump" && dumpForBmxStep) {
								dumpForBmxStep = []
							}
						}
						break

					default:
						if (insideBlock > 0) {
							if (blockType == "StackTrace") trace.push( line )
							if (blockType == "ObjectDump" && dumpForBmxStep) {
								dumpForBmxStep.forEach( step => {
									if (!step.children) step.children = []
									step.children.push(
										this.processStackString( line, step.path )
									)
									this.clearChildLoops()
								})
							}
						} else console.log( 'Unknown error: ' + line )
						break
				}
			}
		})
		
		this._bmxProcess.on('close', (code) => {
			//console.log(`Application exited with code ${code.toString()}`)
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
		if (this._bmxProcess) this._bmxProcess.kill('SIGINT')
		
		this.sendResponse(response)
	}
	
	protected pauseRequest(response: DebugProtocol.PauseResponse, args: DebugProtocol.PauseArguments, request?: DebugProtocol.Request){
		response.message = 'Pause is not support'
		response.success = false
		this.sendResponse(response)
	}
	
	protected restartRequest(response: DebugProtocol.RestartResponse, args: DebugProtocol.RestartArguments, request?: DebugProtocol.Request){
		this._isRestart = true
		this.startRuntime()
		this.sendResponse(response)
	}
	
	protected processStack( trace: string[] ) {
		
		this._stackFrames = []
		this._stackSteps = []
		
		let file: string = ''
		let lastStep: BmxStackStep | undefined
		
		//console.log( 'TRACE THIS: ' + trace )
		trace.forEach( line => {

			if (line.startsWith( '@' )) {
				lastStep = undefined
				file = line.split( '<' )[0].slice( 1 )
				const lineNr = Number( line.split( '<' )[1].split( ',' )[0] )
				const columnNr = Number( line.split( '<' )[1].split( ',' )[1].slice( 0, -1 ) )
				this._stackFrames.push({
					id: 0,
					name: path.basename( file ),
					line: lineNr,
					column: columnNr,
					source: {name: path.basename( file ), path: file}
				})
			} else {
				const newStep = this.processStackString( line, file )
				if (lastStep) {
					newStep.parent = lastStep
					if (!lastStep.children) lastStep.children = []
					lastStep.children.push( newStep )
				} else {
					this._stackSteps.push( newStep )
					lastStep = newStep
				}
			}
		})
		this._stackFrames.reverse()
	}

	protected processStackString( variable: string, path: string ): BmxStackStep {

		enum processStep {
			define,
			variableName,
			type,
			value,
			dumpAddr
		}

		let step = processStep.define
		const newBmxStackStep: BmxStackStep = {
			id: this._stackStepId.toString(),
			name: variable,
			path: path,
			variableName: ''
		}

		this._stackStepId++

		for (let i = 0; i < variable.length; i++) {
			const chr = variable[i]

			switch (step) {
				case processStep.define:
					if (chr == '[') {
						step = processStep.variableName
						newBmxStackStep.variableName = '['
						break
					}

					if (chr == ' ') {
						step = processStep.variableName
					} else {
						if (!newBmxStackStep.define) newBmxStackStep.define = ''
						newBmxStackStep.define += chr
					}
					break

				case processStep.variableName:
					if (newBmxStackStep.variableName.startsWith( '[' ) && chr == ']') {
						newBmxStackStep.variableName += ']'
						step = processStep.type
						break
					}

					if (chr == ':') {
						step = processStep.type
					} else {
						if (!newBmxStackStep.variableName) newBmxStackStep.variableName = ''
						newBmxStackStep.variableName += chr
					}
					break

				case processStep.type:
					if (chr == '=') {
						step = processStep.value
					} else {
						if (!newBmxStackStep.type) newBmxStackStep.type = ''
						newBmxStackStep.type += chr
					}
					break

				case processStep.value:
					if (!newBmxStackStep.value) {
						newBmxStackStep.value = ''
						if (chr == '$') {
							step = processStep.dumpAddr
							break
						}
					}
					newBmxStackStep.value += chr
					break

				case processStep.dumpAddr:
					if (!newBmxStackStep.needsDump) {
						newBmxStackStep.needsDump = ''
						newBmxStackStep.value = undefined
					}
					newBmxStackStep.needsDump += chr
					break
			}
		}

		return newBmxStackStep
	}

	protected dumpStackStep( step: BmxStackStep ) {

		if (!step.needsDump) return

		this._bmxProcess.stdin.write( `d${step.needsDump}\n` )
	}

	protected findStepWithAddress( add: string, steps: BmxStackStep[] | undefined = undefined, matches: BmxStackStep[] | undefined = undefined ): BmxStackStep[] {

		if (!steps) steps = this._stackSteps
		if (!matches) matches = []

		for (let i = 0; i < steps.length; i++) {
			const step = steps[i]
			if (step.needsDump == add) matches.push( step )
			if (step.children) {
				const childrenMatch = this.findStepWithAddress( add, step.children, matches )
				if (childrenMatch.length > 0) matches.concat( childrenMatch )
			}
		}

		return matches
	}

	protected findStepWithId( id: string, steps: BmxStackStep[] | undefined = undefined ): BmxStackStep | undefined {

		if (!steps) steps = this._stackSteps

		for (let i = 0; i < steps.length; i++) {
			const step = steps[i]
			if (step.id == id) return step
			if (step.children) {
				const childrenMatch = this.findStepWithId( id, step.children )
				if (childrenMatch) return childrenMatch
			}
		}

		return undefined
	}

	protected clearChildLoops( steps: BmxStackStep[] | undefined = undefined, parent: BmxStackStep | undefined = undefined ) {

		return
		/*if (!steps) steps = this._stackSteps

		for (let i = 0; i < steps.length; i++) {
			const step = steps[i]
			if (parent) step.parent = parent
			if (step.children) this.clearChildLoops( step.children, step )
		}*/
	}

	public logStackSteps() {

		console.log( 'STACK STEPS:')
		this._stackSteps.forEach( step => {
			console.log( step )
		})
	}

	protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments, request?: DebugProtocol.Request) {
		/*
		console.log( 'setBreakPointsRequest' )
		
		if (!args.breakpoints) return
		console.log(args.source)
		args.breakpoints.forEach(breakpoint => {
			console.log(breakpoint)
		})*/
	}

	protected breakpointLocationsRequest(response: DebugProtocol.BreakpointLocationsResponse, args: DebugProtocol.BreakpointLocationsArguments, request?: DebugProtocol.Request): void {
		console.log( 'Wants breakpoints apparently?' )
	}

	protected threadsRequest(response: DebugProtocol.ThreadsResponse) {
		//console.log( 'Wants threads apparently?' )
		
		// No threads! Just return a default thread
		response.body = {
			threads: [
				new Thread( BmxDebugSession.THREAD_ID, "thread 1" )
			]
		}
		
		this.sendResponse(response)
	}
	
	protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
		console.log( 'Wants stack apparently?' )
		
		response.body = {
			stackFrames: this._stackFrames,
			totalFrames: this._stackFrames.length
		}

		this.sendResponse(response)
	}
	
	protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
		console.log( 'Wants scopes apparently?' )
		
		// These are only the root items in the tree list!
		
		this.logStackSteps()
		
		const scopes: DebugProtocol.Scope[] = []
		
		for (let i = 0; i < this._stackSteps.length; i++) {
			const step = this._stackSteps[i]
			
			if (step.children || step.needsDump) {
				const newScope: DebugProtocol.Scope = {
					name: step.name,
					variablesReference: this._variableHandles.create( step.id ),
					expensive: !!step.needsDump,
					//presentationHint: 'locals',
					//line: 3,
					//endLine: 5,
					//source: { name: 'File', path: step.path }
				}
				//new Scope( step.name, this._variableHandles.create( step.id ), !!step.needsDump)
				scopes.push( newScope )
			}
		}

		response.body = { scopes: scopes }
		this.sendResponse(response)
	}
	
	protected async variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments, request?: DebugProtocol.Request) {
		console.log( 'Wants variables apparently?' )
		
		const variables: DebugProtocol.Variable[] = []
		const id = this._variableHandles.get( args.variablesReference )
		if (!id) {
			console.log( 'No ID for variables request?!' )
			return
		}
		
		const rootStep = this.findStepWithId( id )
		if (!rootStep) {
			console.log( 'No root step found for ID ' + id  )
			return
		}
		
		// No children, do we need to create them?
		if (!rootStep.children) {
			
			if (rootStep.needsDump) {
				
				function ensureDumpIsComplete( step: BmxStackStep ) {
					return new Promise(function (resolve, reject) {
						(function waitFordump(){
							if (step.children) return resolve()
							setTimeout( waitFordump, 25 )
						})()
					})
				}

				this.dumpStackStep( rootStep )
				await ensureDumpIsComplete(rootStep)
			}
			
			if (!rootStep.children) {
				console.log( 'Root step has no children for ID ' + id  )
				return
			}
		}
		
		for (let i = 0; i < rootStep.children.length; i++) {
			const step = rootStep.children[i]

			variables.push({
				name: `${step.define ? step.define + ' ' : ''}${step.variableName}`,
				type: step.type,
				value: step.value ? step.value : step.needsDump ? `$${step.needsDump}` : '',
				memoryReference: step.needsDump,
				variablesReference: step.needsDump ? this._variableHandles.create( step.id ) : 0,
				presentationHint: {
					kind: 'method',
					visibility: 'internal'
				}
			})
		}
		
		response.body = { variables: variables }
		this.sendResponse( response )
	}
	
	protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
		console.log('continueRequest')
		this.sendEvent( new ContinuedEvent( BmxDebugSession.THREAD_ID ) )
		this._bmxProcess.stdin.write( 'r\n' )
	}
	
	protected reverseContinueRequest(response: DebugProtocol.ReverseContinueResponse, args: DebugProtocol.ReverseContinueArguments) : void {
		console.log('reverseContinueRequest')
 	}
	 
	protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
		console.log('nextRequest')
		this.sendEvent( new ContinuedEvent( BmxDebugSession.THREAD_ID ) )
		this._bmxProcess.stdin.write( 's\n' )
	}
	
	protected stepBackRequest(response: DebugProtocol.StepBackResponse, args: DebugProtocol.StepBackArguments): void {
		console.log('stepBackRequest')
		this.sendResponse(response)
	}
	
	protected stepInTargetsRequest(response: DebugProtocol.StepInTargetsResponse, args: DebugProtocol.StepInTargetsArguments) {
		console.log('stepInTargetsRequest')
	}
	
	protected stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): void {
		console.log('stepInRequest')
		this.sendEvent( new ContinuedEvent( BmxDebugSession.THREAD_ID ) )
		this._bmxProcess.stdin.write( 'e\n' )
	}
	
	protected stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments): void {
		console.log('stepOutRequest')
		this.sendEvent( new ContinuedEvent( BmxDebugSession.THREAD_ID ) )
		this._bmxProcess.stdin.write( 'l\n' )
	}
	
	protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {
		console.log('evaluateRequest')
	}
	
	protected dataBreakpointInfoRequest(response: DebugProtocol.DataBreakpointInfoResponse, args: DebugProtocol.DataBreakpointInfoArguments): void {
		console.log('dataBreakpointInfoRequest')
	}
	
	protected setDataBreakpointsRequest(response: DebugProtocol.SetDataBreakpointsResponse, args: DebugProtocol.SetDataBreakpointsArguments): void {
		console.log('setDataBreakpointsRequest')
	}
	
	protected completionsRequest(response: DebugProtocol.CompletionsResponse, args: DebugProtocol.CompletionsArguments): void {
		console.log('completionsRequest')
	}
	
	protected cancelRequest(response: DebugProtocol.CancelResponse, args: DebugProtocol.CancelArguments) {
		console.log('cancelRequest')
	}
}

// Internally used interface
//
interface BmxStackStep {
	id: string
	name: string // Visible name in the list
	path: string // From BMX file
	variableName: string // Name of the variable
	type?: string // TType
	value?: string
	define?: string // Local, Global, Field etc.
	needsDump?: string // Needs dumped data to be explored
	children?: BmxStackStep[]
	parent?: BmxStackStep
}