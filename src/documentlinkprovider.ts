'use strict'

import * as path from 'path'
import * as vscode from 'vscode'
import { getModule } from './bmxdocs'
import { BlitzMaxPath } from './helper'

const linkInits: string[] = ['import', 'framework', 'include']

export function registerDocumentLinkProvider( context: vscode.ExtensionContext ) {
	vscode.languages.registerDocumentLinkProvider( 'blitzmax', {
		provideDocumentLinks( document: vscode.TextDocument, token: vscode.CancellationToken ): vscode.DocumentLink[] | undefined {

			const links: vscode.DocumentLink[] = []

			for ( let lineIndex = 0; lineIndex < document.lineCount; lineIndex++ ) {
				const line = document.lineAt( lineIndex )
				if ( line.isEmptyOrWhitespace ) continue
				const trimmedLine = line.text.toLowerCase().trim()

				linkInits.forEach( i => {
					if ( trimmedLine.startsWith( i ) &&
						( trimmedLine[i.length] == ' ' ||
							trimmedLine[i.length] == '\t'
						) ) {

						let linkUrl = line.text.substr( line.firstNonWhitespaceCharacterIndex + i.length ).trim()
						let rangeStart: number = 0
						let rangeEnd: number = 0

						if ( linkUrl.startsWith( '"' ) ) {
							// File
							linkUrl = linkUrl.split( '"' )[1]
							linkUrl = path.join( path.dirname( document.uri.fsPath ), linkUrl )
							rangeStart = line.text.indexOf( '"' ) + 1
							rangeEnd = line.text.indexOf( '"', rangeStart + 1 )

						} else {
							// Module
							const moduleMatches = linkUrl.match( new RegExp( '\\w+\\.\\w+' ) )
							if ( moduleMatches && BlitzMaxPath ) {
								const module = getModule( moduleMatches[0] )
								if ( module.length > 0 ) {
									linkUrl = module[0].pathSource
									const modSplit = moduleMatches[0].split( '.' )
									
									rangeStart = line.text.indexOf( '.' ) - modSplit[0].length
									rangeEnd = rangeStart + modSplit[0].length + modSplit[1].length + 1
								}
							} else linkUrl = ''
						}

						if ( linkUrl && rangeStart > 0 && rangeEnd > rangeStart ) {
							const linkRange = new vscode.Range(
								new vscode.Position( lineIndex, rangeStart ),
								new vscode.Position( lineIndex, rangeEnd )
							)
							

							links.push(
								new vscode.DocumentLink( linkRange, vscode.Uri.file( linkUrl ) )
							)
						}
					}
				} )
			}

			return links
		}
	} )
}