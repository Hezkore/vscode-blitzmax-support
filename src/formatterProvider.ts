'use strict'

import * as vscode from 'vscode'
import * as process from 'child_process'
import * as awaitNotify from 'await-notify'
import { existsSync, workspaceOrGlobalConfigString } from './common'
import { triggerBmxFormatterHelp } from './helper'

let formatterBusy = new awaitNotify.Subject()
let formatterOptions: FormatterOptions = {
	ready: false,
	initAttempts: 0,
	path: undefined,
	exists: false
}

interface FormatterOptions {
	ready: boolean,
	initAttempts: number,
	path?: string,
	exists: boolean,
	arg?: string[],
	onTypeArg?: string[],
	startArg?: string,
	endArg?: string
}

function resetFormatter() {
	formatterOptions.exists = false
	formatterOptions.path = undefined
	formatterOptions.initAttempts = 0
	formatterOptions.ready = false
}

export function registerFormatterProvider( context: vscode.ExtensionContext ) {

	vscode.workspace.onDidChangeConfiguration( ( event ) => {
		if ( event.affectsConfiguration( 'blitzmax.formatter' ) ) {
			console.log( 'FORMATTER CHANGES' )
			resetFormatter()
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

				return [vscode.TextEdit.replace( textRange, await format( text, false ) )]
			}
		} ),

		vscode.languages.registerDocumentRangeFormattingEditProvider( 'blitzmax', {
			async provideDocumentRangeFormattingEdits( document: vscode.TextDocument, range: vscode.Range ): Promise<vscode.TextEdit[]> {

				if ( vscode.workspace.getConfiguration( 'blitzmax' ).get( 'formatter.useRange' ) ) {
					const firstLine = document.lineAt( 0 )
					const lastLine = document.lineAt( document.lineCount - 1 )
					const textRange = new vscode.Range( firstLine.range.start, lastLine.range.end )
					const text = document.getText( textRange )
					if ( text.length <= 0 ) return []

					return [vscode.TextEdit.replace( textRange, await format( text, false, range ) )]
				} else {
					const text = document.getText( range )
					if ( text.length <= 0 ) return []

					return [vscode.TextEdit.replace( range, await format( text, false ) )]
				}
			}
		} ),

		vscode.languages.registerOnTypeFormattingEditProvider( 'blitzmax', {
			async provideOnTypeFormattingEdits( document: vscode.TextDocument, position: vscode.Position ): Promise<vscode.TextEdit[]> {

				const line = document.lineAt( position.line )
				if ( line.isEmptyOrWhitespace ) return []

				return [vscode.TextEdit.replace( line.range, await format( line.text, true ) )]
			}
		}, ' ', '\r', '\n' ),
	)
}

async function initFormatter(): Promise<boolean> {
	return new Promise( async ( resolve, reject ) => {

		//console.log( 'Initializing BlitzMax formatter' )

		// Reset
		formatterOptions.ready = false
		formatterOptions.path = undefined
		formatterOptions.exists = false

		// Count attempt
		if ( formatterOptions.initAttempts < 0 ) formatterOptions.initAttempts = 0
		formatterOptions.initAttempts += 1

		// Fetch formatter path
		formatterOptions.path = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'formatter.path' )
		if ( !formatterOptions.path ) return resolve( false )

		// Relative formatter path?
		const isRelativePath: boolean = formatterOptions.path.startsWith( '.' )
		if ( isRelativePath ) {
			// relative
			formatterOptions.path = formatterOptions.path.slice( 1 )
			const bmxPath = workspaceOrGlobalConfigString( undefined, 'blitzmax.base.path' )
			if ( bmxPath ) formatterOptions.path = vscode.Uri.file( bmxPath + formatterOptions.path ).fsPath
		}

		// Does it exist?
		formatterOptions.exists = !!existsSync( formatterOptions.path )

		// Set ready flag
		formatterOptions.ready = formatterOptions.exists
		if ( !formatterOptions.ready ) return resolve( false )

		// Fetch arguments
		formatterOptions.arg = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'formatter.args' )
		formatterOptions.onTypeArg = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'formatter.onType' )
		formatterOptions.startArg = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'formatter.range.start' )
		formatterOptions.endArg = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'formatter.range.end' )

		return resolve( true )
	} )
}

async function format( text: string, onType: boolean, range: vscode.Range | undefined = undefined ): Promise<string> {
	return new Promise( async ( resolve, reject ) => {

		// Only init on the first "Format On Type"
		if ( !onType || ( onType && formatterOptions.initAttempts <= 0 ) ) {
			// Make sure the formatter is properly setup
			if ( !formatterOptions.ready ) await initFormatter()

			// Help with setting up the formatter if it doesn't exist
			if ( !formatterOptions.ready && !onType ) triggerBmxFormatterHelp()
		}
		if ( !formatterOptions.ready || !formatterOptions.path ) return resolve( text )

		let args: string[] = []
		if ( formatterOptions.arg ) args = args.concat( formatterOptions.arg )
		if ( onType && formatterOptions.onTypeArg ) args = args.concat( formatterOptions.onTypeArg )
		if ( range && formatterOptions.startArg ) args.push( formatterOptions.startArg, range.start.line.toString() )
		if ( range && formatterOptions.endArg ) args.push( formatterOptions.endArg, range.end.line.toString() )

		try {
			let proc = process.spawn( formatterOptions.path, args )
			proc.stdin.write( text )
			text = ''
			proc.stdin.end()

			proc.on( 'error', function ( err ) {
				vscode.window.showErrorMessage( "Formating error: " + err )
			} )

			proc.stdout.on( 'data', function ( data ) {
				text += data.toString()
			} )

			proc.stderr.on( 'data', function ( data ) {
				vscode.window.showErrorMessage( "Formating error: " + data )
			} )

			proc.on( 'close', function ( code ) {
				formatterBusy.notify()
				if ( code ) vscode.window.showErrorMessage( "Formating error: #" + code )
			} )

			await formatterBusy.wait()

			return resolve( text )

		} catch ( err ) {

			resetFormatter()
			vscode.window.showErrorMessage( "Formating error: " + err )
			return resolve( text )
		}
	} )
}