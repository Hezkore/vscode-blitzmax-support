'use strict'

import * as vscode from 'vscode'

export function registerSymbolProvider( context: vscode.ExtensionContext ) {
	context.subscriptions.push(
		vscode.languages.registerDocumentSymbolProvider( { scheme: 'file', language: 'blitzmax' },
			new BmxDocumentSymbolProvider()
		)
	)
}

export class BmxDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
	public provideDocumentSymbols( document: vscode.TextDocument, token: vscode.CancellationToken ): vscode.DocumentSymbol[] {

		let symbols: vscode.DocumentSymbol[] = []
		let containers: vscode.DocumentSymbol[] = []
		let inRemBlock: boolean = false

		for ( var lineNr = 0; lineNr < document.lineCount; lineNr++ ) {
			const line: vscode.TextLine = document.lineAt( lineNr )

			// Extend container range
			containers.forEach( container => {

				container.range = new vscode.Range(
					container.selectionRange.start,
					line.range.end
				)
			} )

			if ( line.isEmptyOrWhitespace || line.text.length < 2 ) continue
			if ( line.text.startsWith( "'" ) ) continue

			// Get a clean line to compare against
			const lineCleanText: string = line.text
				.slice( line.firstNonWhitespaceCharacterIndex )
				.replace( '\t', ' ' )
			//.trimRight()
			//.toLowerCase()

			if ( lineCleanText.length < 2 ) continue

			const words: string[] = lineCleanText.split( ' ' )
			if ( words.length < 0 ) continue

			if ( words.length > 1 && words[1].startsWith( "'" ) ) continue

			let firstWordOffset: number = 0
			let firstWord: string = words[0].toLowerCase()
			let firstWordLength: number = firstWord.length
			if ( firstWord == 'end' && words.length > 1 ) {

				let foundWord: string | undefined
				words.forEach( scanWord => {

					if ( scanWord.trim().length > 2 )
						foundWord = scanWord.trim()
				} )

				if ( foundWord )
					firstWord += foundWord.toLowerCase()
			}

			if ( inRemBlock ) {

				if ( firstWord == 'endrem' )
					inRemBlock = !inRemBlock

				continue
			} else {

				if ( firstWord == 'rem' ) {
					inRemBlock = !inRemBlock
					continue
				}
			}

			// Skip some words
			if ( words.length > 1 ) {
				switch ( firstWord ) {
					case 'public':
					case 'private':
						firstWordOffset += 1
						firstWord = words[firstWordOffset].toLowerCase()
						firstWordLength += firstWord.length
						break
				}
			}

			let isSymbolKind: vscode.SymbolKind | undefined = undefined
			let isContainer: boolean = false
			let splitters: string[] = ['(', ' ', ':', "'", '%', '#', '!', '$']
			let detail: string = ''
			let supportsMultiDefine: boolean = false

			// Define symbols
			switch ( firstWord ) {
				case 'function':
					isSymbolKind = vscode.SymbolKind.Function
					isContainer = true
					break

				case 'method':
					isSymbolKind = vscode.SymbolKind.Method
					isContainer = true
					break

				case 'interface':
					isSymbolKind = vscode.SymbolKind.Interface
					isContainer = true
					break

				case 'enum':
					isSymbolKind = vscode.SymbolKind.Enum
					isContainer = true
					break

				case 'type':
					isSymbolKind = vscode.SymbolKind.Class
					isContainer = true
					break

				case 'struct':
					isSymbolKind = vscode.SymbolKind.Struct
					isContainer = true
					break

				case 'const':
					isSymbolKind = vscode.SymbolKind.Constant
					supportsMultiDefine = true
					break

				case 'global':
				case 'local':
					isSymbolKind = vscode.SymbolKind.Variable
					supportsMultiDefine = true
					break

				case 'field':
					isSymbolKind = vscode.SymbolKind.Field
					supportsMultiDefine = true
					break

				case 'endtype':
				case 'endenum':
				case 'endstruct':
				case 'endinteface':
				case 'endfunction':
				case 'endmethod':
					containers.pop()
					break
			}

			if ( isSymbolKind ) {

				let names: string[] = []

				// Detect same line multi define
				if ( supportsMultiDefine ) {
					let multiName: string = ''
					let inString: boolean = false
					let depth: number = 0
					let spaceAt: number = 0

					for ( let chrNr = line.firstNonWhitespaceCharacterIndex + firstWordLength + 1;
						chrNr <= line.text.length; chrNr++ ) {
						let chr = ''

						if ( chrNr < line.text.length )
							chr = line.text[chrNr]

						if ( chrNr == line.text.length ||
							( ( chr == ',' || chr == "'" ) && ( depth == 0 && !inString && multiName.length > 0 ) ) ) {

							if ( spaceAt > 0 )
								multiName = multiName.slice( 0, spaceAt )

							spaceAt = 0

							if ( multiName.includes( ':' ) )
								multiName = multiName.split( ':' )[0]
							else if ( multiName.includes( '%' ) )
								multiName = multiName.split( '%' )[0]
							else if ( multiName.includes( '#' ) )
								multiName = multiName.split( '#' )[0]
							else if ( multiName.includes( '!' ) )
								multiName = multiName.split( '!' )[0]
							else if ( multiName.includes( '$' ) )
								multiName = multiName.split( '$' )[0]
							else if ( multiName.includes( '=' ) )
								multiName = multiName.split( '=' )[0]

							names.push( multiName )
							if ( chr == "'" ) break
							multiName = ''
						} else {

							switch ( chr ) {
								case '\t':
								case ' ':
									if ( spaceAt <= 0 )
										spaceAt = multiName.length
									break

								case '"':
									inString = !inString
									break

								case '[':
								case '(':
									if ( !inString ) depth++
									break

								case ']':
								case ')':
									if ( !inString ) depth--
									break

								default:
									if ( depth == 0 && !inString && chr != ' ' && chr != '\t' ) {
										multiName += chr
									}
									break
							}
						}
					}
				} else {
					while ( words[firstWordOffset + 1] == ' ' ||
						words[firstWordOffset + 1] == '\t' ||
						words[firstWordOffset + 1] == '' ) {
						firstWordOffset++
					}
					names.push( words[firstWordOffset + 1].trimLeft() )
				}

				for ( let nameNr = 0; nameNr < names.length; nameNr++ ) {
					let name = names[nameNr]

					// Apply name splitters
					splitters.forEach( splitter => {

						if ( name.includes( splitter ) )
							name = name.split( splitter )[0]
					} )

					if ( name.length > 0 ) {
						// Create the symbol
						const symbol = new vscode.DocumentSymbol(
							name,
							detail,
							isSymbolKind,
							line.range, line.range
						)

						// Where do we push the symbol?
						if ( containers.length > 0 )
							containers[containers.length - 1].children.push( symbol )
						else
							symbols.push( symbol )

						// Store this symbol as a container
						if ( isContainer )
							containers.push( symbol )
					}
				}
			}
		}

		return symbols
	}
}