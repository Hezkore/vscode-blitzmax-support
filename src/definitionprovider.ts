import * as vscode from 'vscode'
import { CacheWorkspaceSymbols, workspaceSymbols } from './symbolprovider'

export function registerDefinitionProvider( context: vscode.ExtensionContext ) {
	vscode.languages.registerDefinitionProvider( 'blitzmax', {
		async provideDefinition( document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken ) {

			// What word are we looking for?
			let wordRange = document.getWordRangeAtPosition( position )
			if ( !wordRange ) return
			
			let word = document.getText( wordRange )
			if ( !word ) return
			word = word.toLowerCase()

			// Try to figure out the "trigger"
			let wordTrigger: string = ''
			if (wordRange.start.character-1 >= 0) {
				wordTrigger = document.getText(new vscode.Range(
					new vscode.Position( wordRange.start.line, wordRange.start.character-1 ),
					new vscode.Position( wordRange.start.line, wordRange.start.character)
				))
			}

			await CacheWorkspaceSymbols()

			const defs: vscode.Location[] = []
			workspaceSymbols.forEach( symbols => {
				for ( let index = 0; index < symbols.length; index++ ) {
					const symbol = symbols[index]
					if ( word && symbol.searchName == word ) {
						if ( wordTrigger == '.' ) {
							if ( !symbol.symbolInformation.containerName ) continue
						} else if ( wordTrigger == ':' ) {
							if (symbol.symbolInformation.kind != vscode.SymbolKind.Class) continue
						} else {
							if (symbol.symbolInformation.containerName) continue
						}
						defs.push( symbol.symbolInformation.location )
					}
				}
			} )

			return defs
		}
	} )
}