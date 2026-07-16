'use strict'

import { unwatchFile, watchFile } from 'fs'
import { setTimeout } from 'timers'
import * as vscode from 'vscode'
import { existsSync } from './common'
import * as lsp from 'vscode-languageclient/node'
import { workspaceOrGlobalConfigBoolean, workspaceOrGlobalConfigArray, workspaceOrGlobalConfigString } from './common'
let multiInstance: boolean | undefined
let forcedStop: boolean
let outputChannel: vscode.OutputChannel
let activeBmxLsp: BmxLSP | undefined
let defaultBmxLsp: BmxLSP | undefined
let runningBmxLsps: Map<string, BmxLSP> = new Map()
let lspStatusBarItem: vscode.StatusBarItem

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

export function activeLspCapabilities(): lsp.ServerCapabilities {
	
	if (!activeBmxLsp) return {}
	return activeBmxLsp.capabilities()
}

export function registerLSP( context: vscode.ExtensionContext ) {
	
	multiInstance = workspaceOrGlobalConfigBoolean( undefined, 'blitzmax.lsp.multi' )
	if (multiInstance == undefined) multiInstance = false

	// Create our output channel
	outputChannel = vscode.window.createOutputChannel( 'BlitzMax Language Server' )

	// Creatus status bar item
	const statusBarCommandId = 'blitzmax.showLspOptions'
	context.subscriptions.push( vscode.commands.registerCommand( statusBarCommandId, () => {

		if ( activeBmxLsp && !activeBmxLsp._running ) {
			outputChannel.show()
			vscode.commands.executeCommand( 'workbench.action.openSettings', '@ext:hezkore.blitzmax blitzmax.lsp' )
			return
		}

		if ( activeBmxLsp && activeBmxLsp.status.error ) {
			// Show error
			vscode.window.showErrorMessage( activeBmxLsp.status.error )
		} else {
			// Show options
			if ( activeBmxLsp ) {
				vscode.window.showQuickPick( [`Restart ${activeBmxLsp.name}`, 'View output', `Stop all`, 'About'] ).then( ( pick ) => {
					if ( !activeBmxLsp ) return

					switch ( pick?.split( ' ' )[0] ) {
						case 'Restart':
							runLSPTask( restartSingleLSP( activeBmxLsp ), 'restart language server' )
							break
						case 'Stop':
							forcedStop = true
							runLSPTask( restartAllLSP(), 'stop language servers' )
							break
						case 'About':
							vscode.window.showInformationMessage( `${activeBmxLsp.name}\r\n${activeBmxLsp.version}` )
							break
						case 'View':
							outputChannel.show()
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
	vscode.workspace.onDidChangeConfiguration( ( event ) => {
		if ( event.affectsConfiguration( 'blitzmax.base.path' ) ||
			event.affectsConfiguration( 'blitzmax.lsp' ) ) {
			if ( multiInstance )
				runLSPTask( restartAllLSP(), 'restart language servers' )
			else
				runLSPTask( restartSingleLSP( activeBmxLsp ), 'restart language server' )
		}
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
			this.status.tooltip = 'Language server ready'
		} catch ( error ) {
			const message = error instanceof Error ? error.message : String( error )
			this.status.icon = '$(circle-slash)'
			this.status.color = 'errorForeground'
			this.status.error = message
			this.status.tooltip = `Language server failed to start: ${message}`
			this._started = false
			this._running = false
		}
		if ( activeBmxLsp === this ) updateStatusBarItem()
	}

	constructor( workspace: vscode.WorkspaceFolder | undefined ) {
		this.workspace = workspace

		// Setup client
		this.clientOptions = {
			diagnosticCollectionName: 'bmx-lsp',
			outputChannel: outputChannel
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
		this.clientPath = workspaceOrGlobalConfigString( this.workspace, 'blitzmax.lsp.path' )
		console.log(this.clientPath)
		if ( !this.clientPath ) return

		// Relative LSP path?
		const isRelativePath: boolean = this.clientPath.startsWith( '.' )
		if ( isRelativePath ) {
			// relative
			this.clientPath = this.clientPath.slice( 1 )
			const bmxPath = workspaceOrGlobalConfigString( this.workspace, 'blitzmax.base.path' )
			if ( bmxPath ) this.clientPath = vscode.Uri.file( bmxPath + this.clientPath ).fsPath

			// Does it exist?
			if ( !existsSync( this.clientPath ) ) {
				// We can ignore non-existant binary quietly if it's a relative path
				return
			}
		}

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
						this.status.tooltip = 'Language server is starting...'
						this._running = false
						break

					case 2:
						// Running
						this.status.icon = '$(check)'
						this.status.color = undefined
						this.status.tooltip = 'Language server started, waiting for initialization...'
						this._running = true
						break

					default:
						// Stopped
						this.status.icon = '$(circle-slash)'
						this.status.color = 'errorForeground'
						this.status.tooltip = 'Language server encountered an error'
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
