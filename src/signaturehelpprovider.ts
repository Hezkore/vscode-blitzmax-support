'use strict'

import * as vscode from 'vscode'
import { getCommand } from './bmxdocs'
import { previousTokenPosition } from './common'
import { activeLspCapabilities } from './lsp'

export function registerSignatureHelpProvider( context: vscode.ExtensionContext ) {
	vscode.languages.registerSignatureHelpProvider( 'blitzmax', {
		provideSignatureHelp( document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.SignatureHelpContext ): vscode.ProviderResult<vscode.SignatureHelp> {
			
			if ( activeLspCapabilities().signatureHelpProvider ) return null
			
			let call = findStart( document, position )
			if ( !call ) return null

			const funcRange = previousTokenPosition( document, call.openParen )
			const fileContents = document.getText()
			const funcName = fileContents.slice( document.offsetAt( funcRange.start ), document.offsetAt( funcRange.end ) )
			const paramIndex = call.commas.length

			const commands = getCommand( funcName, { hasParameters: true } )
			if ( !commands || commands.length <= 0 ) return null

			const sigStack = new vscode.SignatureHelp()
			let sigCmd: vscode.SignatureInformation
			let sigParam: vscode.ParameterInformation
			let paramPreview: string

			for ( let index = 0; index < commands.length; index++ ) {
				const cmd = commands[index]
				const params = cmd.params
				if ( !params ) continue
				if ( params.length - 1 < paramIndex ) continue

				let cmdPreview: string = ''
				
				sigCmd = new vscode.SignatureInformation( cmdPreview, cmd.shortMarkdownString )

				for ( var ai = 0; ai < params.length; ai++ ) {

					const arg = params[ai]
					if ( !arg ) continue

					paramPreview = arg.name + ':' + arg.type
					cmdPreview += paramPreview
					if ( arg.default ) cmdPreview += ' = ' + arg.default
					if ( ai < params.length - 1 ) cmdPreview += ', '

					sigParam = new vscode.ParameterInformation( paramPreview )

					sigCmd.parameters.push( sigParam )
				}

				sigCmd.label = cmdPreview
				sigStack.signatures.push( sigCmd )
			}

			sigStack.activeSignature = 0
			sigStack.activeParameter = paramIndex

			return sigStack
		}
	}, '(', ',', ' ', '"' )
}

function findStart( document: vscode.TextDocument, position: vscode.Position ): any {

	let currentLine = document.lineAt( position.line ).text.substring( 0, position.character )
	let parenBalance = 0
	let commas: vscode.Position[] = []

	for ( let char = position.character; char >= 0; char-- ) {

		switch ( currentLine[char] ) {
			case '(':
				parenBalance--
				if ( parenBalance < 0 ) {
					return {
						openParen: new vscode.Position( position.line, char ),
						commas: commas
					}
				}
				break

			case ')':
				parenBalance++
				break

			case ',':
				if ( parenBalance === 0 ) {
					commas.push( new vscode.Position( position.line, char ) )
				}
		}

	}

	return null
}