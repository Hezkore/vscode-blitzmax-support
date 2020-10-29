'use strict'

import {
	Logger, logger,
	LoggingDebugSession,
	InitializedEvent, StoppedEvent,
	Thread, Handles, TerminatedEvent, ContinuedEvent
} from 'vscode-debugadapter'
import { DebugProtocol } from 'vscode-debugprotocol'
import * as process from 'child_process'
import * as path from 'path'
import * as awaitNotify from 'await-notify'
import * as vscode from 'vscode'

// A bunch of initial setup stuff and providers
//
export function registerBmxDebugger( context: vscode.ExtensionContext ) {

	// register a configuration provider for 'bmx' debug type
	const provider = new BmxDebugConfigurationProvider()
	context.subscriptions.push( vscode.debug.registerDebugConfigurationProvider( 'bmx', provider ) )

	// debug adapters can be run in different ways by using a vscode.DebugAdapterDescriptorFactory:
	let factory: vscode.DebugAdapterDescriptorFactory = new BmxInlineDebugAdapterFactory()
	context.subscriptions.push( vscode.debug.registerDebugAdapterDescriptorFactory( 'bmx', factory) )
	if ('dispose' in factory) context.subscriptions.push( factory )
}

export class BmxDebugConfigurationProvider implements vscode.DebugConfigurationProvider {

	/**
	 * Massage a debug configuration just before a debug session is being launched,
	 * e.g. add all missing attributes to the debug configuration.
	 */
	resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration> {

		// if launch.json is missing or empty
		if (!config.type && !config.request && !config.name) {
			const editor = vscode.window.activeTextEditor
			if (editor && editor.document.languageId === 'blitzmax') {
				config.type = 'bmx'
				config.name = 'Default BlitzMax debug'
				config.source = '${file}'
			}
		}

		if (!config.request) config.request = 'launch'

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

interface BmxLaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
	/** An absolute path to the "program" to debug. */
	source: string
	/** enable logging the Debug Adapter Protocol */
	trace?: boolean
	/** run without debugging */
	noDebug?: boolean
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

// Debugger starts here!
export class BmxDebugSession extends LoggingDebugSession {

	// We don't support multiple threads!
	private static THREAD_ID = 1

	private _variableHandles = new Handles<string>()

	private _configurationDone = new awaitNotify.Subject()

	private _bmxProcess: process.ChildProcessWithoutNullStreams

	private _stackFrames: DebugProtocol.StackFrame[] = []

	private _stackSteps: BmxStackStep[] = []

	private _stackStepId: number = 0

	public constructor() {
		super( "bmx-debug.txt" )

		this.setDebuggerLinesStartAt1( false )
		this.setDebuggerColumnsStartAt1( false )
	}

	protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
		console.log( 'initializeRequest' )
		if (args.supportsProgressReporting) {
		}

		// Build and return capabilities
		response.body = response.body || {}
		response.body.supportsStepInTargetsRequest = true
		response.body.supportsReadMemoryRequest = true

		this.sendResponse(response)

		this.sendEvent(new InitializedEvent())
	}

	/**
	 * Called at the end of the configuration sequence.
	 * Indicates that all breakpoints etc. have been sent to the DA and that the 'launch' can start.
	 */
	protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
		console.log( 'configurationDoneRequest' )
		super.configurationDoneRequest(response, args)

		// notify the launchRequest that configuration has finished
		this._configurationDone.notify()
	}

	protected async launchRequest( response: DebugProtocol.LaunchResponse, args: BmxLaunchRequestArguments ) {
		console.log( 'launchRequest' )
		// Make sure to 'Stop' the buffered logging if 'trace' is not set
		logger.setup( args.trace ? Logger.LogLevel.Verbose : Logger.LogLevel.Stop, false )

		// Wait until configuration has finished (and configurationDoneRequest has been called)
		await this._configurationDone.wait( 1000 )

		// Start the program
		console.log( 'SOURCE IS ' + args.source )

		// First we assume that the source is an executable
		let exePath:string = args.source

		// Check if it is infact a bmx file
		if (args.source.toLowerCase().endsWith('.bmx')) {
			exePath = args.source.slice( 0, -4 ) + '.debug'
		}

		this._bmxProcess = process.spawn( exePath, [])

		this._bmxProcess.on('error', function(err) {
			console.error( `Application ${err}`)
		})

		this._bmxProcess.stdout.on('data', (data) => {
			console.log(`stdout: ${data.toString()}`)
		})

		this._bmxProcess.stderr.on('data', (data) => {
			console.error(`stderr: ${data.toString()}`)

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
			console.log(`Application exited with code ${code.toString()}`)
			this.sendEvent( new TerminatedEvent() )
		})

		console.log( 'started ' + exePath )

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

	protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
		console.log( 'setBreakPointsRequest' )
	}

	protected breakpointLocationsRequest(response: DebugProtocol.BreakpointLocationsResponse, args: DebugProtocol.BreakpointLocationsArguments, request?: DebugProtocol.Request): void {
		console.log( 'Wants breakpoints apparently?' )
	}

	protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
		console.log( 'Wants threads apparently?' )

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