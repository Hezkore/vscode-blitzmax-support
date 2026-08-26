'use strict'

import * as vscode from 'vscode'
import * as process from 'child_process'
import * as awaitNotify from 'await-notify'
import { existsSync, workspaceOrGlobalConfigString } from './common'
import { triggerBmxFormatterHelp } from './helper'

let formatterBusy = new awaitNotify.Subject()
let formatterProviders: vscode.Disposable[] = []
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
	endArg?: string,
	fileArg?: string
}

function resetFormatter() {
	formatterOptions.exists = false
	formatterOptions.path = undefined
	formatterOptions.initAttempts = 0
	formatterOptions.ready = false
}

// Where the formatter binary would be, if there is one
// Does not touch formatterOptions, so it is safe to ask at any time
function formatterPath(): string | undefined {

	let path: string | undefined = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'formatter.path' )
	if ( !path ) return undefined

	if ( path.startsWith( '.' ) ) {
		const bmxPath = workspaceOrGlobalConfigString( undefined, 'blitzmax.base.path' )
		if ( !bmxPath ) return undefined
		path = vscode.Uri.file( bmxPath + path.slice( 1 ) ).fsPath
	}

	return path
}

// The language server also offers formatting
// Registering these when there is no formatter binary just leaves the user
// with two providers to choose between, one of which cannot format anything
function updateFormatterProviders() {

	const path = formatterPath()
	const wanted = !!path && !!existsSync( path )
	const registered = formatterProviders.length > 0
	if ( wanted === registered ) return

	if ( !wanted ) {
		formatterProviders.forEach( provider => provider.dispose() )
		formatterProviders = []
		return
	}

	formatterProviders.push(
		vscode.languages.registerDocumentFormattingEditProvider( 'blitzmax', {
			async provideDocumentFormattingEdits( document: vscode.TextDocument ): Promise<vscode.TextEdit[]> {

				const firstLine = document.lineAt( 0 )
				const lastLine = document.lineAt( document.lineCount - 1 )
				const textRange = new vscode.Range( firstLine.range.start, lastLine.range.end )
				const text = document.getText( textRange )
				if ( text.length <= 0 ) return []

				return [vscode.TextEdit.replace( textRange, await format( text, false, undefined, document ) )]
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

					return [vscode.TextEdit.replace( textRange, await format( text, false, range, document ) )]
				} else {
					const text = document.getText( range )
					if ( text.length <= 0 ) return []

					return [vscode.TextEdit.replace( range, await format( text, false, undefined, document ) )]
				}
			}
		} ),

		vscode.languages.registerOnTypeFormattingEditProvider( 'blitzmax', {
			async provideOnTypeFormattingEdits( document: vscode.TextDocument, position: vscode.Position ): Promise<vscode.TextEdit[]> {

				const line = document.lineAt( position.line )
				if ( line.isEmptyOrWhitespace ) return []

				return [vscode.TextEdit.replace( line.range, await format( line.text, true, undefined, document ) )]
			}
		}, ' ', '\r', '\n' ),
	)
}

export function registerFormatterProvider( context: vscode.ExtensionContext ) {

	vscode.workspace.onDidChangeConfiguration( ( event ) => {
		if ( event.affectsConfiguration( 'blitzmax.formatter' )
			|| event.affectsConfiguration( 'blitzmax.base.path' ) ) {
			resetFormatter()
			updateFormatterProviders()
		}
	} )

	context.subscriptions.push( { dispose: () => {
		formatterProviders.forEach( provider => provider.dispose() )
		formatterProviders = []
	} } )

	updateFormatterProviders()
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
		formatterOptions.fileArg = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'formatter.file' )

		return resolve( true )
	} )
}

async function format( text: string, onType: boolean, range: vscode.Range | undefined = undefined, document: vscode.TextDocument | undefined = undefined ): Promise<string> {
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

		// A formatter reading the text on standard input has no idea which file it came
		// from, so it cannot find a settings file that lives next to it
		// Telling it the name is what makes per folder settings work at all
		if ( document && formatterOptions.fileArg && document.uri.scheme === 'file' ) {
			args.push( formatterOptions.fileArg, document.uri.fsPath )
		}

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