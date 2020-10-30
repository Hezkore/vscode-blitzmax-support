'use strict'

import * as vscode from 'vscode'
import * as lsp from 'vscode-languageclient'
//import * as url from 'url'
//import * as os from 'os'

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

	let pathRoot = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'path' )
	let pathLsp = vscode.Uri.file(pathRoot+"\\bin\\lsp")
	let outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel('BlitzMax Language Server')

	function didOpenTextDocument(document: vscode.TextDocument): void {
		if (document.languageId !== 'blitzmax' || (document.uri.scheme !== 'file' && document.uri.scheme !== 'untitled')) {
			return
		}

		let uri = document.uri
		// Untitled files go to a default client
		if (uri.scheme === 'untitled' && !defaultClient) {
			let clientOptions: lsp.LanguageClientOptions = {
				documentSelector: [
					{ scheme: 'untitled', language: 'blitzmax' }
				],
				diagnosticCollectionName: 'bmx-lsp',
				outputChannel: outputChannel
			}
			defaultClient = new lsp.LanguageClient('BlitzMax Language Server',
				{ command: pathLsp.fsPath, args: undefined, options: { env: undefined } },
				clientOptions
			)
			defaultClient.start()
			return
		}
		let folder = vscode.workspace.getWorkspaceFolder(uri)
		// Files outside a folder can't be handled. This might depend on the language
		// Single file languages like JSON might handle files outside the workspace folders
		if (!folder) {
			return
		}
		// If we have nested workspace folders we only start a server on the outer most workspace folder
		folder = getOuterMostWorkspaceFolder(folder)

		if (!clients.has(folder.uri.toString())) {
			let clientOptions: lsp.LanguageClientOptions = {
				documentSelector: [
					{ scheme: 'file', language: 'blitzmax', pattern: `${folder.uri.fsPath}/**/*` }
				],
				diagnosticCollectionName: 'bmx-lsp',
				workspaceFolder: folder,
				outputChannel: outputChannel
			}
			let client = new lsp.LanguageClient('BlitzMax Language Server',
				{ command: pathLsp.fsPath, args: undefined, options: { env: undefined } },
				clientOptions
			)
			client.start()
			clients.set(folder.uri.toString(), client)
		}
	}

	vscode.workspace.onDidOpenTextDocument(didOpenTextDocument)
	vscode.workspace.textDocuments.forEach(didOpenTextDocument)
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
	if (defaultClient) {
		promises.push(defaultClient.stop())
	}
	for (let client of clients.values()) {
		promises.push(client.stop())
	}
	return Promise.all(promises).then(() => undefined)
}