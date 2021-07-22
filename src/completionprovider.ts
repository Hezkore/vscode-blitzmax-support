'use strict'

import * as vscode from 'vscode'
import { getCommand, getModule } from './bmxdocs'
import { previousTokenPosition } from './common'
import { activeLspCapabilities } from './lsp'

export function registerCompletionProvider( context: vscode.ExtensionContext ) {

	vscode.languages.registerCompletionItemProvider( 'blitzmax', {
		provideCompletionItems( document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext ) {

			if (activeLspCapabilities().completionProvider) return []
			
			const completionItems: vscode.CompletionItem[] = []

			// Triggered via typing
			if ( document.getText( new vscode.Range( position.translate( 0, -1), position ) ) != '.' ) {

				// Get all commands I guess?
				const commands = getCommand()

				commands.forEach( cmd => {
					// Construct and push the completion item
					completionItems.push( {
						label: cmd.realName,
						kind: cmd.isFunction ? vscode.CompletionItemKind.Function : vscode.CompletionItemKind.Keyword,
						detail: cmd.returns,
						documentation: cmd.markdownString,
						insertText: cmd.insertText,
						command: { title: 'Signature Help', command: 'editor.action.triggerParameterHints' }
					} )
				} )

				// Also send all modules in their raw format
				const modules = getModule()

				modules.forEach( mod => {
					// Construct and push the completion item
					completionItems.push( {
						label: mod.name,
						kind: vscode.CompletionItemKind.Module,
						insertText: mod.name
					} )
				} )
			} else {
				// Triggered via .
				if ( position.character >= 2 ) {

					// Figure out what's before the .
					const modRange = previousTokenPosition( document, position )
					const modParent = document.getText( modRange )

					// Send modules with cut insert text
					const modules = getModule( modParent )

					modules.forEach( mod => {
						// Construct and push the completion item
						completionItems.push( {
							label: mod.name,
							kind: vscode.CompletionItemKind.Module,
							insertText: mod.child
						} )
					} )
				}
			}

			return completionItems
		}
	}, '.', ' ' )
}