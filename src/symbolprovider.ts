'use strict'

import * as vscode from 'vscode'
import { activeLspCapabilities } from './lsp'

export let workspaceSymbols: Map<string, BmxWorkspaceSymbol[]>

export function registerSymbolProvider( context: vscode.ExtensionContext ) {
	workspaceSymbols = new Map()

	vscode.workspace.onDidDeleteFiles( ( event ) => {
		event.files.forEach( file => {
			workspaceSymbols.delete( file.fsPath )
		} )
	} )

	context.subscriptions.push(
		vscode.languages.registerDocumentSymbolProvider( { scheme: 'file', language: 'blitzmax' },
			new BmxDocumentSymbolProvider()
		)
	)

	context.subscriptions.push(
		vscode.languages.registerWorkspaceSymbolProvider(
			new BmxWorkspaceSymbolProvider()
		)
	)
}

interface BmxWorkspaceSymbol {
	searchName: string
	symbolInformation: vscode.SymbolInformation
}

export function CacheWorkspaceSymbols() {
	return new Promise<void>( async ( resolve ) => {

		const files = await vscode.workspace.findFiles( '**/*.bmx', '**/.bmx/**' )

		for ( let index = 0; index < files.length; index++ ) {
			const file = files[index]
			if ( !workspaceSymbols.has( file.fsPath ) ) {
				const document = await vscode.workspace.openTextDocument( file.fsPath )
				GetBmxDocSymbols( document )
			}
		}

		resolve()
	} )
}

export class BmxWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {
	public async provideWorkspaceSymbols( query: string ): Promise<vscode.SymbolInformation[]> {

		console.log( activeLspCapabilities() )

		if ( activeLspCapabilities().workspaceSymbolProvider ) return []

		if ( query.length <= 0 ) return []
		query = query.toLowerCase()
		let matches: vscode.SymbolInformation[] = []


		// Make sure we've got symbols for all files
		await CacheWorkspaceSymbols()

		// Check for matches
		workspaceSymbols.forEach( symbols => {
			for ( let index = 0; index < symbols.length; index++ ) {
				if ( symbols[index].symbolInformation.kind == vscode.SymbolKind.TypeParameter )
					continue
				const symbol = symbols[index]
				if ( symbol.searchName.includes( query ) ) matches.push( symbol.symbolInformation )
			}
		} )

		return matches
	}
}

export class BmxDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
	public provideDocumentSymbols( document: vscode.TextDocument ): vscode.DocumentSymbol[] {

		if ( activeLspCapabilities().documentSymbolProvider ) return []

		return GetBmxDocSymbols( document )
	}
}

function GetBmxDocSymbols( document: vscode.TextDocument ): vscode.DocumentSymbol[] {

	let symbols: vscode.DocumentSymbol[] = []
	let containers: vscode.DocumentSymbol[] = []
	let inRemBlock: boolean = false

	workspaceSymbols.set( document.uri.fsPath, [] )

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
				isSymbolKind = vscode.SymbolKind.Variable
				supportsMultiDefine = true
				break

			case 'local':
				isSymbolKind = vscode.SymbolKind.TypeParameter // Not correct, but what am I do to?!
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
					if ( containers.length > 0 ) {
						if ( symbol.kind != vscode.SymbolKind.TypeParameter ) containers[containers.length - 1].children.push( symbol )
						workspaceSymbols.get( document.uri.fsPath )?.push(
							{
								searchName: symbol.name.toLowerCase(),
								symbolInformation:
									new vscode.SymbolInformation( symbol.name, symbol.kind, containers[containers.length - 1].name,
										new vscode.Location( document.uri, symbol.range )
									)
							}
						)
					} else {
						if ( symbol.kind != vscode.SymbolKind.TypeParameter ) symbols.push( symbol )
						workspaceSymbols.get( document.uri.fsPath )?.push(
							{
								searchName: symbol.name.toLowerCase(),
								symbolInformation:
									new vscode.SymbolInformation( symbol.name, symbol.kind, '',
										new vscode.Location( document.uri, symbol.range )
									)
							}
						)
					}

					// Store this symbol as a container
					if ( isContainer )
						containers.push( symbol )
				}
			}
		}
	}


	return symbols
}