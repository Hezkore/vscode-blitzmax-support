'use strict'

import * as vscode from 'vscode'
import * as lsp from 'vscode-languageclient'
import * as url from 'url'
import * as os from 'os'

export function registerBmxLsp( context: vscode.ExtensionContext ) {

	// Options to control the language client
	const clientOptions: lsp.LanguageClientOptions = {
		// Register the server for bmx documents
		revealOutputChannelOn: 1,
		outputChannel: vscode.window.createOutputChannel('BlitzMax Language Server'),
		documentSelector: [
			{ scheme: 'file', language: 'blitzmax' },
			{ scheme: 'untitled', language: 'blitzmax' },
		],
		uriConverters: {
			// VS Code by default %-encodes even the colon after the drive letter
			// NodeJS handles it much better
			code2Protocol: uri => url.format(url.parse(uri.toString(true))),
			protocol2Code: str => vscode.Uri.parse(str)
		},
		synchronize: {
			// Synchronize the setting section 'blitzmax' to the server
			configurationSection: 'blitzmax.lsp',
			// Notify the server about changes to BMX files in the workspace
			fileEvents: vscode.workspace.createFileSystemWatcher('**/*.bmx')
		}
	}

	let args: string[] = []
	args.push("--lsp")
	args.push("-loglevel"); args.push("0")
	args.push("-mode"); args.push("stdio")
	args.push("-bmx"); args.push("D:/Applications/BlitzMaxNG")
	args.push("-cores"); args.push(os.cpus().length.toString())

	var path: string | undefined = vscode.workspace.getConfiguration( 'blitzmax.lsp' ).get( 'path' )
	if (path) {
		console.log( 'Launching LSP ' + path )

		let client: lsp.LanguageClient = new lsp.LanguageClient('BlitzMax Language Server',
			{ command: path, args: args, options: { env: undefined } },
			clientOptions
		)
		client.onReady().then(() => { // Test custom method
			client.sendNotification('hezkore/isReallyCool',{really:'Is he though?'})

			const progressTokens: any[] = []
			client.onNotification("$/progress", (param) => {

				const message = Object.getOwnPropertyNames(param['value'])[0]
				const value = param['value'][message]

				if (!progressTokens[param.token]) {

					vscode.window.withProgress({
						location: vscode.ProgressLocation.Window,
						title: "BlitzMax",
						cancellable: false
					}, async (progress, token) => {

						progressTokens[param.token] = progress

						progress.report({message: message})

						function waitForComplete() {
							return new Promise(function (resolve, reject) {
								(function doWait(){
									if (!progressTokens[param.token]) return resolve()
									setTimeout( doWait, 25 )
								})()
							})
						}

						await waitForComplete()
					})
				} else {

					progressTokens[param.token].report({message: message, increment: value})
					if (value >= 100) progressTokens[param.token] = undefined
				}
			})
		})

		context.subscriptions.push( client.start() )
	} else console.log( 'No LSP path configured' )
}