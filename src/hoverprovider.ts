'use strict'

import * as vscode from 'vscode'
import { getCommand } from './bmxdocs'
import { getCurrentDocumentWord } from './common'

export function registerHoverProvider( context: vscode.ExtensionContext ) {

	vscode.languages.registerHoverProvider( 'blitzmax', {
		provideHover( document, position, token ) {

			// What word are we looking for?
			let word = getCurrentDocumentWord( position, document, undefined, false )
			if ( !word ) return

			let commands = getCommand( word, { hasMarkdown: true } )
			if ( !commands || commands.length <= 0 ) return

			let matches: vscode.MarkdownString[] = []
			commands.forEach( cmd => {
				if ( cmd.markdownString ) matches.push( cmd.markdownString )
			} )

			return new vscode.Hover( matches )
		}
	} )

}