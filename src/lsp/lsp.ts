'use strict'

import * as vscode from 'vscode'
import { LanguageClient, LanguageClientOptions } from 'vscode-languageclient'
import * as url from 'url'

export function registerBmxLsp( context: vscode.ExtensionContext ) {

	let client: LanguageClient

	let myOutput = vscode.window.createOutputChannel("BMX")
	myOutput.show(true)

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for bmx documents
		revealOutputChannelOn: 1,
		outputChannel: myOutput,
		traceOutputChannel: myOutput,
		documentSelector: [
			{ scheme: 'file', language: 'blitzmax' },
			{ scheme: 'file', language: 'blitzmax' },
			{ scheme: 'untitled', language: 'blitzmax' },
			{ scheme: 'untitled', language: 'blitzmax' }
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

	var path: string | undefined = vscode.workspace.getConfiguration( 'blitzmax.lsp' ).get( 'path' )
	if (path) {
		console.log( 'Launching LSP ' + path )

		client = new LanguageClient('BlitzMax Language Server',
			{ command: path, args: args, options: { env: undefined } },
			clientOptions
		)
		context.subscriptions.push( client.start() )
	} else console.log( 'No LSP path configured' )
}