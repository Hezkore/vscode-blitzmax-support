'use strict'

import * as vscode from 'vscode'
import * as process from 'child_process'
import * as awaitNotify from 'await-notify'
import { existsSync, workspaceOrGlobalConfigString } from './common'

let formatterPath: string | undefined
let formatterExist: boolean = false
let formatterBusy = new awaitNotify.Subject()
const gitHubTopics: string = 'topic%3ABlitzMax+topic%3Aformatter'

export function registerFormatterProvider( context: vscode.ExtensionContext ) {

	vscode.workspace.onDidChangeConfiguration( ( event ) => {
		if ( event.affectsConfiguration( 'blitzmax.formatter.path' ) ) {
			formatterPath = undefined
			formatterExist = false
		}
	} )

	context.subscriptions.push(
		vscode.languages.registerDocumentFormattingEditProvider( 'blitzmax', {
			async provideDocumentFormattingEdits( document: vscode.TextDocument ): Promise<vscode.TextEdit[]> {

				const firstLine = document.lineAt( 0 )
				const lastLine = document.lineAt( document.lineCount - 1 )
				const textRange = new vscode.Range( firstLine.range.start, lastLine.range.end )
				const text = document.getText( textRange )
				if ( text.length <= 0 ) return []

				return [vscode.TextEdit.replace( textRange, await format( text, true ) )]
			}
		} ),

		vscode.languages.registerDocumentRangeFormattingEditProvider( 'blitzmax', {
			async provideDocumentRangeFormattingEdits( document: vscode.TextDocument, range: vscode.Range ): Promise<vscode.TextEdit[]> {
				const text = document.getText( range )
				if ( text.length <= 0 ) return []

				return [vscode.TextEdit.replace( range, await format( text, true ) )]
			}
		} ),

		vscode.languages.registerOnTypeFormattingEditProvider( 'blitzmax', {
			async provideOnTypeFormattingEdits( document: vscode.TextDocument, position: vscode.Position ): Promise<vscode.TextEdit[]> {

				const line = document.lineAt( position.line )
				if ( line.isEmptyOrWhitespace ) return []

				return [vscode.TextEdit.replace( line.range, await format( line.text, false ) )]
			}
		}, '\n', '\r', ' ' ),
	)
}

async function format( text: string, showHelp: boolean ): Promise<string> {
	return new Promise( async ( resolve, reject ) => {

		// Fetch formatter path
		if ( !formatterPath ) {
			formatterPath = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'formatter.path' )
			if ( !formatterPath ) return resolve( text )

			// Relative formatter path?
			const isRelativePath: boolean = formatterPath.startsWith( '.' )
			if ( isRelativePath ) {
				// relative
				formatterPath = formatterPath.slice( 1 )
				const bmxPath = workspaceOrGlobalConfigString( undefined, 'blitzmax.base.path' )
				if ( bmxPath ) formatterPath = vscode.Uri.file( bmxPath + formatterPath ).fsPath
			}

			// Does it exist?
			formatterExist = !!existsSync( formatterPath )
		}

		if ( !formatterExist ) {
			vscode.window.showWarningMessage(
				'No BlitzMax formatter found.\nWould you like to download one?',
				'Yes',
				'No'
			).then( selection => {
				if ( selection?.toLowerCase() == 'yes' ) {
					vscode.env.openExternal( vscode.Uri.parse( 'https://github.com/search?q=' + gitHubTopics ) )
				}
			} )

			return resolve( text )
		}

		let proc = process.spawn( formatterPath )
		proc.stdin.write( text )
		proc.stdin.end()

		proc.on( 'error', function ( err ) {
			vscode.window.showErrorMessage( "Formating error: " + err )
		} )

		proc.stdout.on( 'data', function ( data ) {
			text = data.toString()
			formatterBusy.notify()
		} )

		proc.stderr.on( 'data', function ( data ) {
			vscode.window.showErrorMessage( "Formating error: " + data )
		} )

		proc.on( 'close', function ( code ) {
			if ( code ) {
				vscode.window.showErrorMessage( "Formating error: #" + code )
			}
		} )

		await formatterBusy.wait()

		return resolve( text )
	} )
}