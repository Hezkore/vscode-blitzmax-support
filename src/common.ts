'use strict'

import * as vscode from 'vscode'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'

export function debugDelay( ms: number ) {
	return new Promise( resolve => setTimeout( resolve, ms ) )
}

export async function readFile( filename: string ): Promise<string> {
	return new Promise( function ( resolve, reject ) {
		fs.readFile( filename, function ( err, data ) {
			if ( err )
				reject( err )
			else
				resolve( data.toString() )
		} )
	} )
}

export function previousTokenPosition( document: vscode.TextDocument, position: vscode.Position ): any {

	while ( position.character > 0 ) {

		const word = document.getWordRangeAtPosition( position )
		if ( word ) return word
		position = position.translate( 0, -1 )
	}

	return null
}

export function getCurrentDocumentWord( position: vscode.Position | undefined = undefined, document: vscode.TextDocument | undefined = undefined, editor: vscode.TextEditor | undefined = undefined ): string | undefined {

	// Use the current active editor if no editor was specified
	if ( !editor ) editor = vscode.window.activeTextEditor
	if ( !editor ) return

	// Use the cursor position if no position was specified
	if ( !position ) position = editor.selection.start
	if ( !position ) return

	// Use the editor document if no document was specified
	if ( !document ) document = editor.document
	if ( !document ) return

	
	// Fetch the word at this position
	let wordRange = document.getWordRangeAtPosition( position )
	if ( !wordRange ) return
	
	// Join two words togther if needed
	let word = jointBmxWord( document, wordRange )

	//let word = document.getText( wordRange )
	return word
}

export function jointBmxWord( document: vscode.TextDocument, wordRange: vscode.Range ): string | undefined {
	
	// Setup
	const startChr = wordRange.start.character <= 0 ? undefined : document.getText( new vscode.Range( wordRange.start.translate( 0, -1), wordRange.start ) )
	const endChr = wordRange.start.character > document.getText().length ? undefined : document.getText( new vscode.Range( wordRange.start, wordRange.start.translate( 0, 1) ) )
	
	let joinStartWord: boolean = false
	let joinEndWord: boolean = false
	
	
	// Do we need to join these two words?
	if (startChr == '.') joinStartWord = true
	
	
	// Join together words
	let joinedWord: string = ''
	if (joinStartWord) joinedWord += document.getText( previousTokenPosition( document, wordRange.start.translate( 0, -1) ) ) + startChr
	joinedWord += document.getText( wordRange )
	if (joinEndWord) joinedWord += document.getText( previousTokenPosition( document, wordRange.start.translate( 0, 1) ) ) + endChr
	
	// Send off our new complete word
	return joinedWord
}

export function workspaceOrGlobalConfig( workspace: vscode.WorkspaceFolder | undefined, section: string ): unknown {
	const rootSection = section.substr( 0, section.indexOf( '.' ) )
	const childSection = section.slice( rootSection.length + 1 )

	return workspace ?
		vscode.workspace.getConfiguration( rootSection, workspace ).get( childSection ) :
		vscode.workspace.getConfiguration( rootSection ).inspect( childSection )?.globalValue
}

export function workspaceOrGlobalConfigString( workspace: vscode.WorkspaceFolder | undefined, section: string ): string | undefined {
	const gVal = workspaceOrGlobalConfig( workspace, section )
	if ( typeof ( gVal ) === 'string' ) return gVal
}

export function workspaceOrGlobalConfigBoolean( workspace: vscode.WorkspaceFolder | undefined, section: string ): boolean | undefined {
	const gVal = workspaceOrGlobalConfig( workspace, section )
	if ( typeof ( gVal ) === 'boolean' ) return gVal
}

export function workspaceOrGlobalConfigArray( workspace: vscode.WorkspaceFolder | undefined, section: string ): any[] | undefined {
	const gVal = workspaceOrGlobalConfig( workspace, section )
	if ( Array.isArray( gVal ) ) return gVal
}

export function boolToString( bool: boolean | undefined ): string | undefined {
	switch ( bool ) {
		case undefined: return undefined
		case true: return 'true'
		default: return 'false'
	}
}

export function toggleBool( bool: boolean | undefined ): boolean | undefined {
	switch ( bool ) {
		case undefined: return true
		case true: return false
		default: return undefined
	}
}

export function existsSync( file: string ): string | undefined {

	if ( os.platform() == 'win32' ) file = file.toUpperCase()
	const filePath = path.parse( vscode.Uri.file( file ).fsPath )
	let found: string | undefined

	try {
		fs.readdirSync( filePath.dir ).forEach( f => {
			if ( os.platform() == 'win32' ) {
				f = f.toUpperCase()
				if ( f.endsWith( '.EXE' ) && f.slice( 0, -4 ) == filePath.name ) {
					found = f
					return
				}
			}
			if ( f == filePath.name ) {
				found = f
				return
			}
		} )
		return found
	} catch ( error ) {
		return undefined
	}
}