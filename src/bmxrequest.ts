'use strict'

import * as os from 'os'
import * as vscode from 'vscode'
import * as cp from 'child_process'
import { BlitzMaxPath } from './helper'
import * as awaitNotify from 'await-notify'
import path = require( 'path' )

export function registerBmxCliRequests( context: vscode.ExtensionContext ) {
	context.subscriptions.push( vscode.commands.registerCommand( 'blitzmax.buildModules', async () => {
		await vscode.window.showInputBox( { prompt: 'makemods' , title: 'Enter makemods flags', value: '-quick -w -g x64' } ).then( ( input ) => {
			if ( input )
				makeBmxCliRequest( 'bmk', ['makemods'].concat( input?.split( ' ' ) ),
					'Building modules', true, true )
		} )
	} ) )

	context.subscriptions.push( vscode.commands.registerCommand( 'blitzmax.rebuildAllModules', async () => {
		await vscode.window.showInputBox( { prompt: 'makemods -a' , title: 'Enter makemods flags', value: '-quick -w -g x64' } ).then( ( input ) => {
			if ( input )
				makeBmxCliRequest( 'bmk', ['makemods', '-a'].concat( input?.split( ' ' ) ),
					'Building modules', true, true )
		} )
	} ) )

	context.subscriptions.push( vscode.commands.registerCommand( 'blitzmax.version', async () => {
		let bccVer = await makeBmxCliRequest( 'bcc', ['-v'], 'Checking BlitzMax bcc version', false )
		let bmkVer = await makeBmxCliRequest( 'bmk', ['-v'], 'Checking BlitzMax bmk version', false )
		let result: string[] = []
		let blitzVer: string = ''
		
		if ( bccVer ) {
			const v = bccVer.filter( s => s.startsWith( "bcc" ) )[0].trim()
			result.push( v )
			blitzVer += v.substr( v.lastIndexOf( ' ' ) ).trim()
		}
		
		if ( bmkVer ) {
			const v = bmkVer.filter( s => s.startsWith( "bmk " ) )[0].trim()
			result.push( v )
			blitzVer += '.' + v.split( ' ' )[1].trim()
		}

		result.unshift( 'BlitzMax version '
			+ ( os.platform() == 'darwin' ? 'macos' : os.platform() )
			+ '_' + blitzVer )

		vscode.window.showQuickPick( result, { title: 'BlitzMax Version', placeHolder: result[0] } )
	} ) )
}

export function makeBmxCliRequest( executable: string, args: string[], desc: string, bigNotify: boolean = false, outputAsNotify: boolean = false ): Promise<string[] | undefined> {
	return new Promise( function ( resolve, reject ) {

		vscode.window.withProgress( {
			location: bigNotify ? vscode.ProgressLocation.Notification : vscode.ProgressLocation.Window,
			title: desc,
			cancellable: true
		}, async ( progress, token ) => {

			if ( !BlitzMaxPath ) return resolve( [] )

			let busy = new awaitNotify.Subject()

			token.onCancellationRequested( () => {
				if ( reqProcess ) {
					reqProcess.kill( 'SIGINT' )
					reqProcess.kill( 'SIGKILL' )
					busy.notify()
				}
			} )

			const procStart = process.hrtime()
			let percent: number = 0
			let lastPercent: number = 0
			let result: string[] = []
			let errors: string[] = []
			let reqProcess = cp.spawn( path.join( BlitzMaxPath, 'bin', executable ), args )

			function pushToResult( data: string[], progressBar: any, isError: boolean = false ) {
				const str: string[] = data.toString().trim().split( os.EOL )

				for ( let index = 0; index < str.length; index++ ) {
					const line = str[index].trim()
					if ( !line.length ) continue

					result.push( line )

					// Always update progress
					if ( progressBar && line.startsWith( '[' ) && line[5] == ']' ) {
						percent = Number( line.substring( 1, 4 ) )
						progressBar.report( { increment: percent - lastPercent } )
						if ( outputAsNotify ) progressBar.report( { message: line.substr( 7 ) } )
						lastPercent = percent
					} else if ( outputAsNotify ) {
						progressBar.report( { message: line } )
					}

					// Direct jump to paths
					if ( line.startsWith( '[' ) && line.endsWith( ']' ) ) {
						vscode.window.showTextDocument( vscode.Uri.file(
							line.substring( 1, line.indexOf( ';' ) ) )
							, {
								selection: new vscode.Selection(
									Number( line.split( ';' )[1] ) - 1, 0, Number( line.split( ';' )[1] ) - 1, 0 )
							} )
					}

					if ( isError ) errors.push( line )
				}
			}

			reqProcess.stdout.on( 'data', ( data ) => {
				pushToResult( data, progress )
			} )

			reqProcess.stderr.on( 'data', ( data ) => {
				pushToResult( data, progress, true )
			} )

			reqProcess.on( 'error', ( error ) => {
				pushToResult( [error.message], progress, true )
			} )

			reqProcess.on( 'close', ( code ) => {
				if ( code ) {
					vscode.window.showErrorMessage( errors.join( ', ' ) )
				}

				const procEnd = process.hrtime( procStart )

				console.log( `Request time: ${procEnd[0]}s ${procEnd[1] / 1000000}ms` )

				busy.notify()
			} )

			await busy.wait()
			return resolve( result )
		} )
	} )
}