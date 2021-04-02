'use strict'

import * as vscode from 'vscode'
import { getCommand } from './bmxdocs'

export function registerCompletionProvider( context: vscode.ExtensionContext ) {

	vscode.languages.registerCompletionItemProvider( 'blitzmax', {
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
			
			// Get all commands I guess?
			const commands = getCommand()
			const completionItems: vscode.CompletionItem[] = []
			
			commands.forEach( cmd => {
				// Construct and push the completion item
				completionItems.push( {
					label: cmd.realName,
					kind: cmd.isFunction ? vscode.CompletionItemKind.Function : vscode.CompletionItemKind.Keyword,
					detail: cmd.returns,
					documentation: cmd.markdownString,
					insertText: cmd.insertText
				})
			})
			
			return completionItems
		}
	} )
}