'use strict'

import * as vscode from 'vscode'
import * as lsp from 'vscode-languageclient'
//import * as url from 'url'
//import * as os from 'os'

let outputChannel: vscode.OutputChannel
let defaultClient: lsp.LanguageClient
let clients: Map<string, lsp.LanguageClient> = new Map()

let _sortedWorkspaceFolders: string[] | undefined
function sortedWorkspaceFolders(): string[] {
	if (_sortedWorkspaceFolders === void 0) {
		_sortedWorkspaceFolders = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.map(folder => {
			let result = folder.uri.toString()
			if (result.charAt(result.length - 1) !== '/') {
				result = result + '/'
			}
			return result
		}).sort(
			(a, b) => {
				return a.length - b.length
			}
		) : []
	}
	return _sortedWorkspaceFolders
}
vscode.workspace.onDidChangeWorkspaceFolders(() => _sortedWorkspaceFolders = undefined)

function getOuterMostWorkspaceFolder(folder: vscode.WorkspaceFolder): vscode.WorkspaceFolder {
	let sorted = sortedWorkspaceFolders()
	for (let element of sorted) {
		let uri = folder.uri.toString()
		if (uri.charAt(uri.length - 1) !== '/') {
			uri = uri + '/'
		}
		if (uri.startsWith(element)) {
			return vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(element))!
		}
	}
	return folder
}

export function registerBmxLsp(context: vscode.ExtensionContext) {
	
	outputChannel = vscode.window.createOutputChannel('BlitzMax Language Server')
	
	// When opening a text document
	function didOpenTextDocument(document: vscode.TextDocument): void {
		// Make sure this is BlitzMax related
		if (document.languageId !== 'blitzmax' || (document.uri.scheme !== 'file' && document.uri.scheme !== 'untitled'))
			return
		
		let docUri = document.uri
		let workspaceFolder = vscode.workspace.getWorkspaceFolder(docUri)
		let bmxFolder: string | undefined
		
		if (workspaceFolder) {
			// If we have nested workspace folders we only start a server on the outer most workspace folder
			workspaceFolder = getOuterMostWorkspaceFolder(workspaceFolder)
			bmxFolder = vscode.workspace.getConfiguration( 'blitzmax', workspaceFolder ).get( 'path' )
		} else {
			let globalBmxPath = vscode.workspace.getConfiguration( 'blitzmax' ).inspect( 'path' )?.globalValue
			if (typeof(globalBmxPath)==='string') bmxFolder = globalBmxPath
		}
		
		if (!bmxFolder) {
			vscode.window.showWarningMessage( "BlitzMax path is not configured", "Set Path" ).then( setPath => {
				if (setPath) vscode.commands.executeCommand("workbench.action.openSettings", "BlitzMax Path")
			})
			return
		}
		
		let lspPath = vscode.Uri.file( bmxFolder + "/bin/lsp" )
		
		// Untitled files go to a default client
		if (!workspaceFolder && !defaultClient) {
			let clientOptions: lsp.LanguageClientOptions = {
				documentSelector: [
					{ scheme: 'untitled', language: 'blitzmax' }
				],
				diagnosticCollectionName: 'bmx-lsp',
				outputChannel: outputChannel
			}
			defaultClient = new lsp.LanguageClient('BlitzMax Language Server',
				{ command: lspPath.fsPath, args: undefined, options: { env: undefined } },
				clientOptions
			)
			defaultClient.start()
		}
		
		if (!workspaceFolder) return
		
		if (!clients.has(workspaceFolder.uri.toString())) {
			let clientOptions: lsp.LanguageClientOptions = {
				documentSelector: [
					{ scheme: 'file', language: 'blitzmax', pattern: `${workspaceFolder.uri.fsPath}/**/*` }
				],
				diagnosticCollectionName: 'bmx-lsp',
				workspaceFolder: workspaceFolder,
				outputChannel: outputChannel
			}
			let client = new lsp.LanguageClient('BlitzMax Language Server',
				{ command: lspPath.fsPath, args: undefined, options: { env: undefined } },
				clientOptions
			)
			client.start()
			clients.set(workspaceFolder.uri.toString(), client)
		}
	}
	
	vscode.workspace.onDidOpenTextDocument(didOpenTextDocument)
	vscode.workspace.textDocuments.forEach(didOpenTextDocument)
	vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration( 'blitzmax.path' )) {
			vscode.window.showWarningMessage( "Reload Required", "Reload" ).then( wantsReload => {
				if (wantsReload) vscode.commands.executeCommand("workbench.action.reloadWindow")
			})
		}
	})
	vscode.workspace.onDidChangeWorkspaceFolders((event) => {
		for (let folder  of event.removed) {
			let client = clients.get(folder.uri.toString())
			if (client) {
				clients.delete(folder.uri.toString())
				client.stop()
			}
		}
	})
}

export function deactivateLsp(): Thenable<void> {
	let promises: Thenable<void>[] = []
	if (defaultClient) promises.push(defaultClient.stop())
	for (let client of clients.values()) {
		promises.push(client.stop())
	}
	return Promise.all(promises).then(() => undefined)
}