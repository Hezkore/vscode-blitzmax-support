'use strict'

import * as vscode from 'vscode'

let colorFunctions: string[] | undefined

export function registerColorProvider( context: vscode.ExtensionContext ) {

	vscode.workspace.onDidChangeConfiguration( ( event ) => {
		if ( event.affectsConfiguration( 'blitzmax.syntax.colorFunctions' ) )
			colorFunctions = undefined
	} )

	function isIntegerColors( text: string ): boolean {

		const colors: string[] = text.split( ',' )
		for ( let index = 0; index < colors.length; index++ ) {
			const color = Number( colors[index] )

			if ( isNaN( color ) ) continue
			if ( colors[index].includes( '.' ) ) return false
			if ( !Number.isInteger( color ) ) return false
		}

		return true
	}

	vscode.languages.registerColorProvider( 'blitzmax', {
		provideDocumentColors( document: vscode.TextDocument ): vscode.ColorInformation[] {

			if ( !colorFunctions ) {
				colorFunctions = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'syntax.colorFunctions' )
				// Make sure it's all lowercase!
				if (colorFunctions) {
					for (let index = 0; index < colorFunctions.length; index++) {
						colorFunctions[index] = colorFunctions[index].toLowerCase()
					}
				}
			}
			if ( !colorFunctions ) return []

			let colors: vscode.ColorInformation[] = []
			let parsingColorValues: boolean = false
			let colorStartPosition: vscode.Position = new vscode.Position( 0, 0 )
			let colorEndPosition: vscode.Position = new vscode.Position( 0, 0 )
			let colorValues: number[] = []
			let curPos: vscode.Position = new vscode.Position( 0, 0 )

			while ( curPos.line < document.lineCount ) {
				if ( document.lineAt( curPos.line ).isEmptyOrWhitespace ) {
					curPos = new vscode.Position( curPos.line + 1, 0 )
					continue
				}

				const wordPos = document.getWordRangeAtPosition( curPos )
				let word: string | undefined
				if ( wordPos ) word = document.getText( wordPos )

				if ( word && wordPos ) {
					word = word.toLowerCase()

					if ( !parsingColorValues ) {
						if ( colorFunctions.includes( word ) ) {
							parsingColorValues = true
							colorValues = []
						}
					} else {

						if ( colorValues.length <= 0 )
							colorStartPosition = new vscode.Position( wordPos.start.line, wordPos.start.character )

						if ( isNaN( Number( word ) ) ) {
							parsingColorValues = false
							continue
						} else {
							colorValues.push( Number( word ) )
						}

						if ( colorValues.length >= 3 ) {
							parsingColorValues = false
							colorEndPosition = new vscode.Position( wordPos.end.line, wordPos.end.character )

							const colorsRange: vscode.Range = new vscode.Range( colorStartPosition, colorEndPosition )
							const colorsInteger = isIntegerColors( document.getText( colorsRange ) )

							colors.push(
								new vscode.ColorInformation(
									colorsRange
									, new vscode.Color(
										colorsInteger ? colorValues[0] / 255.0 : colorValues[0],
										colorsInteger ? colorValues[1] / 255.0 : colorValues[1],
										colorsInteger ? colorValues[2] / 255.0 : colorValues[2],
										1
									) )
							)

						}
					}
				}

				if ( curPos.character < document.lineAt( curPos.line ).range.end.character ) {
					if ( word ) {
						curPos = curPos.translate( 0, word.length + 1 )
					} else {
						curPos = curPos.translate( 0, 1 )
					}
				}

				if ( curPos.character >= document.lineAt( curPos.line ).range.end.character ) {
					parsingColorValues = false
					curPos = new vscode.Position( curPos.line + 1, 0 )
				}
			}

			return colors
		},
		provideColorPresentations( color: vscode.Color, context ): vscode.ColorPresentation[] {

			const colorsInteger = isIntegerColors( context.document.getText( context.range ) )

			if ( colorsInteger ) {
				return [new vscode.ColorPresentation(
					( color.red * 255 ) + ', ' + ( color.green * 255 ) + ', ' + ( color.blue * 255 )
				)]
			} else {
				return [new vscode.ColorPresentation(
					color.red.toFixed( 2 ) + ', ' + color.green.toFixed( 2 ) + ', ' + color.blue.toFixed( 2 )
				)]
			}
		}
	} )

}