'use strict'

import { unwatchFile, watchFile } from 'fs'
import { setTimeout } from 'timers'
import * as vscode from 'vscode'
import { existsSync } from './common'
import * as lsp from 'vscode-languageclient/node'
import { workspaceOrGlobalConfigBoolean, workspaceOrGlobalConfigArray, workspaceOrGlobalConfigString } from './common'
import { lockedBuildSourcePath } from './taskprovider'
let multiInstance: boolean | undefined
let forcedStop: boolean
let outputChannel: vscode.LogOutputChannel
let activeBmxLsp: BmxLSP | undefined
let defaultBmxLsp: BmxLSP | undefined
let runningBmxLsps: Map<string, BmxLSP> = new Map()
let lspStatusBarItem: vscode.StatusBarItem

interface LspQuickPickItem extends vscode.QuickPickItem {
	action?: 'restart' | 'view-output' | 'stop-all' | 'about' | 'copy-sdk' | 'copy-server'
}

function runLSPTask( task: Promise<void>, action: string ): void {
	void task.catch( error => outputChannel.appendLine( `Unable to ${action}: ${String( error )}` ) )
}

let _sortedWorkspaceFolders: string[] | undefined
function sortedWorkspaceFolders(): string[] {
	if ( _sortedWorkspaceFolders === void 0 ) {
		_sortedWorkspaceFolders = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.map( folder => {
			let result = folder.uri.toString()
			if ( result.charAt( result.length - 1 ) !== '/' ) {
				result = result + '/'
			}
			return result
		} ).sort(
			( a, b ) => {
				return a.length - b.length
			}
		) : []
	}
	return _sortedWorkspaceFolders
}
vscode.workspace.onDidChangeWorkspaceFolders( () => _sortedWorkspaceFolders = undefined )

function getOuterMostWorkspaceFolder( folder: vscode.WorkspaceFolder | undefined ): vscode.WorkspaceFolder | undefined {
	if ( !folder ) return undefined
	let sorted = sortedWorkspaceFolders()
	for ( let element of sorted ) {
		let uri = folder.uri.toString()
		if ( uri.charAt( uri.length - 1 ) !== '/' ) {
			uri = uri + '/'
		}
		if ( uri.startsWith( element ) ) {
			return vscode.workspace.getWorkspaceFolder( vscode.Uri.parse( element ) )!
		}
	}
	return folder
}

// Fires whenever a language server starts, stops, or finishes telling us what it
// can do
//
// The formatter needs to know, because a server that formats should be left to do
// it, and that is not known until the server has answered
const lspChanged = new vscode.EventEmitter<void>()
export const onLspChanged = lspChanged.event

// Whether the running language server offers to format documents itself
export function lspFormats(): boolean {

	const capabilities = activeLspCapabilities()

	return !!capabilities.documentFormattingProvider
		|| !!capabilities.documentRangeFormattingProvider
}

export function activeLspCapabilities(): lsp.ServerCapabilities {

	if (!activeBmxLsp) return {}
	return activeBmxLsp.capabilities()
}

// What bls reads its settings from, at startup through initializationOptions and
// afterwards through workspace/didChangeConfiguration
//
// A key left out keeps whatever the server already had, so anything still at its
// VS Code default is omitted rather than sent as an empty string, which the
// server would take literally
interface BmxLspSettings {
	sdkPath?: string
	rootSourcePath: string
	buildMode?: string
	targetPlatform?: string
	targetArchitecture?: string
	conditionalSymbols?: string[]
	requireCoreInterface?: boolean
	useDependencySnapshots?: boolean
	warnImplicitDefaultReturns?: boolean
}

function lspSettingsFor( workspace: vscode.WorkspaceFolder | undefined ): BmxLspSettings {

	const settings: BmxLspSettings = { rootSourcePath: lockedBuildSourcePath( workspace ) }

	const sdkPath = workspaceOrGlobalConfigString( workspace, 'blitzmax.base.path' )
	if ( sdkPath ) settings.sdkPath = sdkPath

	const buildMode = workspaceOrGlobalConfigString( workspace, 'blitzmax.lsp.buildMode' )
	if ( buildMode ) settings.buildMode = buildMode

	const targetPlatform = workspaceOrGlobalConfigString( workspace, 'blitzmax.lsp.targetPlatform' )
	if ( targetPlatform ) settings.targetPlatform = targetPlatform

	const targetArchitecture = workspaceOrGlobalConfigString( workspace, 'blitzmax.lsp.targetArchitecture' )
	if ( targetArchitecture ) settings.targetArchitecture = targetArchitecture

	// Sending this replaces the server's whole set rather than adding to it, so an
	// empty array has to mean "leave the target's own symbols alone"
	const conditionalSymbols = workspaceOrGlobalConfigArray( workspace, 'blitzmax.lsp.conditionalSymbols' )
	if ( conditionalSymbols && conditionalSymbols.length > 0 ) settings.conditionalSymbols = conditionalSymbols

	const requireCoreInterface = workspaceOrGlobalConfigBoolean( workspace, 'blitzmax.lsp.requireCoreInterface' )
	if ( requireCoreInterface !== undefined ) settings.requireCoreInterface = requireCoreInterface

	const useDependencySnapshots = workspaceOrGlobalConfigBoolean( workspace, 'blitzmax.lsp.useDependencySnapshots' )
	if ( useDependencySnapshots !== undefined ) settings.useDependencySnapshots = useDependencySnapshots

	const warnImplicitDefaultReturns = workspaceOrGlobalConfigBoolean( workspace, 'blitzmax.lsp.warnImplicitDefaultReturns' )
	if ( warnImplicitDefaultReturns !== undefined ) settings.warnImplicitDefaultReturns = warnImplicitDefaultReturns

	return settings
}

// Defaults go under 'blitzmax', then each folder overrides them in 'workspaces'
//
// The server matches those entries on the URI string it was handed at startup, so
// they have to be written the same way the client writes them
function lspSettingsPayload( workspace: vscode.WorkspaceFolder | undefined ): object {

	const payload: { blitzmax: BmxLspSettings, workspaces?: object[] } = {
		blitzmax: lspSettingsFor( workspace )
	}

	const folders = workspace ? [workspace] : vscode.workspace.workspaceFolders
	if ( folders && folders.length > 0 ) {
		payload.workspaces = folders.map( folder => {
			return { uri: folder.uri.toString(), ...lspSettingsFor( folder ) }
		} )
	}

	return payload
}

function sendSettingsToAllLSP() {
	if ( defaultBmxLsp ) runLSPTask( defaultBmxLsp.sendSettings(), 'send settings to language server' )
	for ( let bmxLsp of runningBmxLsps.values() ) {
		runLSPTask( bmxLsp.sendSettings(), 'send settings to language server' )
	}
}

export interface BmxDocsTarget {
	name: string
	owner?: string
	module?: string
	url?: string
}

// Asks the language server what the docs call whatever the cursor is on.
//
// Reading the line ourselves gives "_done.Insert", which no page is named after,
// because _done is a variable. The server knows it is a TMap, so it can say
// TMap.Insert instead. Returns undefined when there is no server, or when it has
// nothing to say, and then the caller falls back to reading the line.
export async function lspDocsTarget(): Promise<BmxDocsTarget | undefined> {

	if ( !activeBmxLsp || !activeBmxLsp.isRunning() ) return undefined

	const editor = vscode.window.activeTextEditor
	if ( !editor || editor.document.languageId !== 'blitzmax' ) return undefined

	try {
		return await activeBmxLsp.client.sendRequest<BmxDocsTarget | null>(
			'blitzmax/documentation',
			{
				textDocument: { uri: editor.document.uri.toString() },
				position: { line: editor.selection.start.line, character: editor.selection.start.character }
			}
		) ?? undefined
	} catch ( error ) {
		// An older server does not know this request, and that is not an error
		return undefined
	}
}

export function registerLSP( context: vscode.ExtensionContext ) {
	
	multiInstance = workspaceOrGlobalConfigBoolean( undefined, 'blitzmax.lsp.multi' )
	if (multiInstance == undefined) multiInstance = false

	// Create our output channel
	outputChannel = vscode.window.createOutputChannel( 'BlitzMax Language Server', { log: true } )

	// Creatus status bar item
	const statusBarCommandId = 'blitzmax.showLspOptions'
	context.subscriptions.push( vscode.commands.registerCommand( statusBarCommandId, () => {

		if ( activeBmxLsp && activeBmxLsp.status.error ) {
			vscode.window.showErrorMessage( activeBmxLsp.status.error, 'Open Settings', 'View Output' ).then( choice => {
				if ( choice === 'Open Settings' ) vscode.commands.executeCommand( 'workbench.action.openSettings', '@ext:hezkore.blitzmax blitzmax.lsp' )
				if ( choice === 'View Output' ) outputChannel.show()
			} )
			return
		}

		if ( activeBmxLsp && !activeBmxLsp._running ) {
			outputChannel.show()
			vscode.commands.executeCommand( 'workbench.action.openSettings', '@ext:hezkore.blitzmax blitzmax.lsp' )
			return
		}

		if ( activeBmxLsp ) {
			const scope = activeBmxLsp.workspace ? `Workspace: ${activeBmxLsp.workspace.name}` : 'All workspaces'
			const items: LspQuickPickItem[] = [
				{ label: `$(refresh) Restart ${activeBmxLsp.name}`, action: 'restart' },
				{ label: '$(output) View output', action: 'view-output' },
				{ label: '$(debug-stop) Stop all language servers', action: 'stop-all' },
				{ label: '$(info) About', action: 'about' },
				{ label: scope, kind: vscode.QuickPickItemKind.Separator }
			]
			if ( activeBmxLsp.sdkPath ) items.push( { label: '$(copy) Copy SDK path', description: activeBmxLsp.sdkPath, action: 'copy-sdk' } )
			if ( activeBmxLsp.clientPath ) items.push( { label: '$(copy) Copy language server path', description: activeBmxLsp.clientPath, action: 'copy-server' } )

			vscode.window.showQuickPick( items ).then( pick => {
				if ( !activeBmxLsp || !pick ) return
				switch ( pick.action ) {
					case 'restart':
						runLSPTask( restartSingleLSP( activeBmxLsp ), 'restart language server' )
						break
					case 'stop-all':
						forcedStop = true
						runLSPTask( restartAllLSP(), 'stop language servers' )
						break
					case 'about':
						vscode.window.showInformationMessage( `${activeBmxLsp.name}\r\n${activeBmxLsp.version}` )
						break
					case 'view-output':
						outputChannel.show()
						break
					case 'copy-sdk':
						if ( activeBmxLsp.sdkPath ) vscode.env.clipboard.writeText( activeBmxLsp.sdkPath )
						break
					case 'copy-server':
						if ( activeBmxLsp.clientPath ) vscode.env.clipboard.writeText( activeBmxLsp.clientPath )
						break
				}
			} )
		} else {
			vscode.window.showQuickPick( ['View output', `Start all`] ).then( ( pick ) => {
				switch ( pick?.split( ' ' )[0] ) {
					case 'Start':
						forcedStop = false
						runLSPTask( restartAllLSP(), 'prepare language servers' )
						changeBmxDocument( vscode.window.activeTextEditor?.document )
						break
					case 'View':
						outputChannel.show()
						break
				}
			} )
		}
	} ) )


	lspStatusBarItem = vscode.window.createStatusBarItem( vscode.StatusBarAlignment.Right, 100 )
	lspStatusBarItem.command = statusBarCommandId
	context.subscriptions.push( lspStatusBarItem )

	// Start LSP for each document with unique workspace
	if ( multiInstance ) {
		changeBmxDocument( vscode.window.activeTextEditor?.document )
		vscode.window.onDidChangeActiveTextEditor( ( event ) => {
			changeBmxDocument( event?.document )
		} )
	} else {
		activateBmxLSP( undefined )
	}
	
	// Reset LSPs when settings change
	//
	// A different binary or a different SDK means a different process, but the rest
	// the server takes as a notification, which leaves its analysis standing
	vscode.workspace.onDidChangeConfiguration( ( event ) => {
		const needsRestart = event.affectsConfiguration( 'blitzmax.base.path' ) ||
			event.affectsConfiguration( 'blitzmax.lsp.path' ) ||
			event.affectsConfiguration( 'blitzmax.lsp.args' ) ||
			event.affectsConfiguration( 'blitzmax.lsp.hotReload' )

		if ( needsRestart ) {
			if ( multiInstance )
				runLSPTask( restartAllLSP(), 'restart language servers' )
			else
				runLSPTask( restartSingleLSP( activeBmxLsp ), 'restart language server' )
			return
		}

		if ( event.affectsConfiguration( 'blitzmax.lsp' ) || event.affectsConfiguration( 'tasks' ) ) sendSettingsToAllLSP()
	} )
	
	// Notify about multi instance reload
	vscode.workspace.onDidChangeConfiguration( ( event ) => {
		if ( event.affectsConfiguration( 'blitzmax.lsp.multi' ) ) {
			vscode.window.showInformationMessage( 'Restart or reload VS Code to apply settings.', "Reload" ).then( choice => {
				if (choice) vscode.commands.executeCommand('workbench.action.reloadWindow')
			})
		}
	} )
	
	// Remove LSPs for removed folders
	if ( multiInstance ) {
		vscode.workspace.onDidChangeWorkspaceFolders( ( event ) => {
			for ( let folder of event.removed ) {
				let bmxLsp = runningBmxLsps.get( folder.uri.toString() )
				if ( bmxLsp ) {
					runningBmxLsps.delete( folder.uri.toString() )
					runLSPTask( bmxLsp.client.stop(), 'stop language server' )
				}
			}
		} )
	}

	// A folder that arrives later still needs its own settings, which are keyed by
	// folder URI and so cannot have been sent before the folder existed
	vscode.workspace.onDidChangeWorkspaceFolders( () => sendSettingsToAllLSP() )
}

export function deactivateLSP(): Promise<void> {
	let promises: Promise<void>[] = []
	if ( defaultBmxLsp && defaultBmxLsp.client ) {
		promises.push( defaultBmxLsp.client.stop() )
	}
	for ( let bmxLsp of runningBmxLsps.values() ) {
		promises.push( bmxLsp.client.stop() )
	}
	return Promise.all( promises ).then( () => undefined )
}

function changeBmxDocument( document: vscode.TextDocument | undefined ) {
	if ( !document || document.languageId != "blitzmax" ) return
	activateBmxLSP(
		getOuterMostWorkspaceFolder(
			vscode.workspace.getWorkspaceFolder( document.uri )
		)
	)

	updateStatusBarItem()
}

function activateBmxLSP( workspace: vscode.WorkspaceFolder | undefined ) {
	if ( forcedStop ) return

	// Do we have an active LSP?
	if ( activeBmxLsp ) {
		// Is it the same LSP?
		if ( activeBmxLsp.workspace === workspace ) {
			// Yep!
			return activeBmxLsp
		} else {
			// Nope!
			void activeBmxLsp.pause()
			activeBmxLsp = undefined
		}
	}

	// Try to find an existing LSP for this workspace
	let existingBmxLsp: BmxLSP | undefined
	if ( workspace ) {
		existingBmxLsp = runningBmxLsps.get( workspace.uri.toString() )
	} else {
		existingBmxLsp = defaultBmxLsp
	}

	// Did we find one?
	if ( existingBmxLsp ) {
		// Yep!
		activeBmxLsp = existingBmxLsp
		void existingBmxLsp.resume()
		updateStatusBarItem()
		return activeBmxLsp
	}

	// Start a new LSP
	existingBmxLsp = new BmxLSP( workspace )

	// Where do we store this?
	if ( !workspace ) {
		defaultBmxLsp = existingBmxLsp
	} else {
		runningBmxLsps.set( workspace.uri.toString(), existingBmxLsp )
	}

	// Make this our active LSP
	activeBmxLsp = existingBmxLsp
	updateStatusBarItem()
	return activeBmxLsp
}

async function restartAllLSP() {
	activeBmxLsp = undefined

	let promises: Promise<void>[] = []
	if ( defaultBmxLsp ) {
		if ( defaultBmxLsp.client ) promises.push( defaultBmxLsp.client.stop() )
		defaultBmxLsp = undefined
	}

	runningBmxLsps.forEach( bmxLsp => {
		if ( bmxLsp.client ) promises.push( bmxLsp.client.stop() )
	} )

	runningBmxLsps.clear()
	await Promise.all( promises )

	updateStatusBarItem()
}

async function restartSingleLSP( lsp: BmxLSP | undefined ) {
	if ( !lsp ) return

	if ( activeBmxLsp === lsp ) {
		activeBmxLsp = undefined
		updateStatusBarItem()
	}

	if ( lsp === defaultBmxLsp ) {
		defaultBmxLsp = undefined
	} else if ( lsp.workspace ) {
		runningBmxLsps.delete( lsp.workspace.uri.toString() )
	}

	if ( lsp.client ) await lsp.client.stop()

	activateBmxLSP( lsp.workspace )
}

function updateStatusBarItem() {
	if ( activeBmxLsp ) {
		if ( activeBmxLsp.status.error ) {
			lspStatusBarItem.text = `${activeBmxLsp.status.icon} Language server unavailable`
			lspStatusBarItem.color = new vscode.ThemeColor( activeBmxLsp.status.color || 'errorForeground' )
			lspStatusBarItem.tooltip = activeBmxLsp.status.tooltip
			lspStatusBarItem.show()
			return
		}
		if ( activeBmxLsp.client ) {
			// Update the icon and text
			lspStatusBarItem.text = activeBmxLsp.name ? `${activeBmxLsp.status.icon} ${activeBmxLsp.name}` : activeBmxLsp.status.icon

			// Update the color
			lspStatusBarItem.color = activeBmxLsp.status.color ? new vscode.ThemeColor( activeBmxLsp.status.color ) : undefined

			// Update tooltip
			lspStatusBarItem.tooltip = activeBmxLsp.status.tooltip

			lspStatusBarItem.show()
			return
		}
	} else {
		// Update the icon and text
		lspStatusBarItem.text = 'Language servers stopped'

		// Update the color
		lspStatusBarItem.color = undefined

		// Update tooltip
		lspStatusBarItem.tooltip = 'Click to start'

		lspStatusBarItem.show()
		return
	}

	lspStatusBarItem.hide()
}

class BmxLSP {

	name: string = "BlitzMax Language Server"
	version: string | undefined
	workspace: vscode.WorkspaceFolder | undefined
	clientOptions: lsp.LanguageClientOptions
	client: lsp.LanguageClient
	clientPath: string | undefined
	sdkPath: string | undefined
	status: { icon: string, color?: string, error?: string, tooltip?: string } = { icon: '$(sync~spin)', error: undefined }

	_started: boolean
	_running: boolean
	
	capabilities(): lsp.ServerCapabilities {
		if ( this.isRunning() && this.client.initializeResult )
			return this.client.initializeResult.capabilities
		return {}
	}
	
	isRunning(): boolean {
		if ( this.client && this._started && this._running ) return true
		return false
	}

	async pause(): Promise<void> {
		if ( this.client && this._started ) {
			this._started = false
			try {
				await this.client.sendNotification( '$/pause', { state: true } )
			} catch ( error ) {
				outputChannel.appendLine( `Unable to pause language server: ${String( error )}` )
			}
		}
	}

	async sendSettings(): Promise<void> {
		if ( !this.isRunning() ) return
		await this.client.sendNotification( 'workspace/didChangeConfiguration', { settings: lspSettingsPayload( this.workspace ) } )
	}

	async resume(): Promise<void> {
		if ( this.client && !this._started ) {
			this._started = true
			try {
				await this.client.sendNotification( '$/pause', { state: false } )
			} catch ( error ) {
				outputChannel.appendLine( `Unable to resume language server: ${String( error )}` )
			}
		}
	}

	private async startClient(): Promise<void> {
		try {
			await this.client.start()
			if ( this.client.initializeResult && this.client.initializeResult.serverInfo ) {
				this.name = this.client.initializeResult.serverInfo.name
				this.version = this.client.initializeResult.serverInfo.version
			} else {
				this.name = "BlitzMax Language Server"
				this.version = "Unknown Version"
			}
			this.status.icon = '$(check-all)'
			this.status.color = undefined
			this.status.error = undefined
			this.status.tooltip = this.statusTooltip( 'Language server ready' )
			lspChanged.fire()
		} catch ( error ) {
			const message = error instanceof Error ? error.message : String( error )
			const failure = `Language server failed to start: ${message}`
			this.status.icon = '$(circle-slash)'
			this.status.color = 'errorForeground'
			this.status.error = failure
			this.status.tooltip = this.statusTooltip( failure )
			this._started = false
			this._running = false
			lspChanged.fire()
		}
		if ( activeBmxLsp === this ) updateStatusBarItem()
	}

	private statusTooltip( message: string ): string {
		const scope = this.workspace ? `Workspace: ${this.workspace.name}` : 'Scope: all workspaces'
		const sdk = this.sdkPath || 'Not configured'
		const server = this.clientPath || 'Not configured'
		return `${message}\n${scope}\nSDK: ${sdk}\nLanguage server: ${server}`
	}

	private setUnavailable( message: string ): void {
		this.status.icon = '$(circle-slash)'
		this.status.color = 'errorForeground'
		this.status.error = message
		this.status.tooltip = this.statusTooltip( message )
		this._started = false
		this._running = false
		outputChannel.appendLine( message )
		lspChanged.fire()
	}

	constructor( workspace: vscode.WorkspaceFolder | undefined ) {
		this.workspace = workspace

		// Setup client
		this.clientOptions = {
			diagnosticCollectionName: 'bmx-lsp',
			outputChannel: outputChannel,
			// Lets a language server put command links in its hovers, which is how
			// it offers to open the docs for whatever you are pointing at
			markdown: { isTrusted: true },
			// The server wants its settings before it reads anything, so they go in
			// here rather than waiting for the first notification
			initializationOptions: lspSettingsPayload( workspace )
		}

		if ( workspace ) {
			// For a proper workspace, we send everything
			this.clientOptions.documentSelector = [
				{ scheme: 'file', language: 'blitzmax', pattern: `${workspace.uri.fsPath}/**/*` }
			]
			this.clientOptions.workspaceFolder = workspace
		} else {
			// For files we know nothing about, we send nothing
			this.clientOptions.documentSelector = [
				{ scheme: 'file', language: 'blitzmax', pattern: '**' }
			]
			this.clientOptions.workspaceFolder = { uri: vscode.Uri.parse( '' ), name: '', index: -1 }
		}

		// Detect LSP path
		this.sdkPath = workspaceOrGlobalConfigString( this.workspace, 'blitzmax.base.path' )
		this.clientPath = workspaceOrGlobalConfigString( this.workspace, 'blitzmax.lsp.path' )
		if ( !this.clientPath ) {
			this.setUnavailable( 'No BlitzMax language server path is configured. Configure blitzmax.lsp.path.' )
			return
		}

		// Relative LSP path?
		const isRelativePath: boolean = this.clientPath.startsWith( '.' )
		if ( isRelativePath ) {
			if ( !this.sdkPath ) {
				this.setUnavailable( `Cannot resolve the relative language server path '${this.clientPath}' because no BlitzMax SDK path is configured.` )
				return
			}
			// relative
			this.clientPath = this.clientPath.slice( 1 )
			this.clientPath = vscode.Uri.file( this.sdkPath + this.clientPath ).fsPath
		}

		if ( !existsSync( this.clientPath ) ) {
			const scope = this.workspace ? ` for workspace '${this.workspace.name}'` : ''
			this.setUnavailable( `BlitzMax language server not found${scope}: ${this.clientPath}. Configure blitzmax.base.path or blitzmax.lsp.path.` )
			return
		}

		const scope = this.workspace ? `Workspace '${this.workspace.name}'` : 'All workspaces'
		outputChannel.appendLine( `${scope} SDK: ${this.sdkPath || 'Not configured'}` )
		outputChannel.appendLine( `${scope} language server: ${this.clientPath}` )

		// Setup LSP
		this.client = new lsp.LanguageClient(
			'blitzmax',
			'BlitzMax Language Server',
			{ command: this.clientPath, args: workspaceOrGlobalConfigArray( this.workspace, 'blitzmax.lsp.args' ), options: { env: undefined } },
			this.clientOptions
		)

		// Track state change
		this.client.onDidChangeState( ( event ) => {
			if ( activeBmxLsp === this ) {
				switch ( event.newState ) {
					case 3:
						// Starting
						this.status.icon = '$(sync~spin)'
						this.status.color = undefined
						this.status.tooltip = this.statusTooltip( 'Language server is starting...' )
						this._running = false
						break

					case 2:
						// Running
						this.status.icon = '$(check)'
						this.status.color = undefined
						this.status.tooltip = this.statusTooltip( 'Language server started, waiting for initialization...' )
						this._running = true
						break

					default:
						// Stopped
						this.status.icon = '$(circle-slash)'
						this.status.color = 'errorForeground'
						this.status.tooltip = this.statusTooltip( 'Language server encountered an error' )
						this._running = false
						break
				}
				updateStatusBarItem()
			}
		} )

		// START!
		this._started = true
		void this.startClient()

		// Watcher for hot reloading LSP
		if ( workspaceOrGlobalConfigBoolean( this.workspace, 'blitzmax.lsp.hotReload' ) ) {
			watchFile( this.clientPath, { interval: 500 }, ( curr, prev ) => {
				// Stop watching the file
				if ( this.clientPath ) unwatchFile( this.clientPath )

				// Wait for all tasks to be complete before restarting
				var timeout = setInterval( () => {
					if ( !!!vscode.tasks.taskExecutions.length ) {
						clearInterval( timeout )

						outputChannel.appendLine( 'LSP binary updated, restarting...' )
						// Wait before restarting
						setTimeout( () => runLSPTask( restartSingleLSP( this ), 'restart language server' ), 100 )
					}
				}, 100 )
			} )
		}
	}
}
