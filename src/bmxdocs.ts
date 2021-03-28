'use strict'

import * as fs from 'fs'
import { EOL } from 'os'
import * as vscode from 'vscode'

let commandsList: BmxCommand[]

export function registerDocsProvider( context: vscode.ExtensionContext ) {

	// Related commands
	context.subscriptions.push( vscode.commands.registerCommand( 'blitzmax.quickHelp', ( word: any ) => {
		// If not word was specified, we look at the word under the cursor
		if ( !word || typeof word !== "string" ) {
			const wordPos = vscode.window.activeTextEditor?.document.getWordRangeAtPosition(
				vscode.window.activeTextEditor.selection.active
			)
			const curWord = vscode.window.activeTextEditor?.document.getText( wordPos )
			if ( !curWord ) return
			word = curWord
		}

		showQuickHelp( word )
	} ) )
}

export async function showQuickHelp( command: string ) {
	if ( !commandsList || commandsList.length <= 0 ) {
		await cacheCommands()
		if ( !commandsList || commandsList.length <= 0 ) {
			// Notify about building docs
			vscode.window.showErrorMessage( 'Could not find BlitzMax documentations.\nMake sure you\'ve built documentations.',
				'Build Docs' ).then( ( selection ) => {
					if ( selection?.startsWith( 'Build' ) ) {
						vscode.commands.executeCommand( 'blitzmax.buildDocs' )
					}
				} )
			return
		}
	}

	command = command.toLowerCase()
	console.log( 'Finding help for: ' + command )
	let matches: BmxCommand[] = []

	commandsList.forEach( cmd => {
		if ( cmd.searchName == command ) matches.push( cmd )
	} )

	console.log( 'Matches: ' + matches.length )

	if ( matches.length > 1 ) {
		let pickOptions: vscode.QuickPickItem[] = []
		matches.forEach(match => {
			pickOptions.push({label: match.realName, detail: match.module})
		})
		
		const result = await vscode.window.showQuickPick( pickOptions )
		
		return
	} else if ( matches.length = 1 ) {
		vscode.window.showInformationMessage( matches[0].description )
		return
	}

	// Did we find something?
	if ( matches.length <= 0 ) {
		vscode.window.showErrorMessage( 'No help available for "' + command + '"' )
		return
	}
}

function cacheCommands() {
	return new Promise<void>( ( resolve ) => {
		console.log( 'Caching BlitzMax commands' )

		const globalBmxPath = vscode.workspace.getConfiguration( 'blitzmax' ).inspect( 'base.path' )?.globalValue
		const relativePath = '/docs/html/Modules/commands.txt'
		const absolutePath = vscode.Uri.file( globalBmxPath + relativePath ).fsPath

		try {
			const data = fs.readFileSync( absolutePath, 'utf8' )
			commandsList = []
			processCommandsData( data )
		} catch ( err ) {
			console.log( 'Couldn\'t open commands.txt' )
			//console.error( err )
		}

		return resolve()
	} )
}

function processCommandsData( data: string ) {
	const lines = data.split( EOL )
	lines.forEach( line => {
		if ( line ) {
			
			const lineSplit = line.split( '|' )
			const command: BmxCommand = {
				realName: 'Undefined', description: 'No description', isFunction: false, returns: 'Int'
			}
			let leftSide = lineSplit[0]
			let rightSide = lineSplit[lineSplit.length - 1]
			
			// Figure out URL
			if ( rightSide.includes( '#' ) ) {
				command.urlLocation = rightSide.substr(rightSide.indexOf('#'))
				command.url = rightSide.slice(0, -command.urlLocation.length)
			} else {
				command.url = rightSide
			}
			
			// Track down module
			if ( command.url ) {
				const pathSplits = command.url.split( '/' )
				
				if ( pathSplits[1].toLowerCase() == 'docs' ) {
					command.module = pathSplits[4] + '/' + pathSplits[5]
				} else if (pathSplits[1].toLowerCase() == 'mod') {
					command.module = pathSplits[2] + '/' + pathSplits[3]
				}
			}

			// Take care of the description
			if ( leftSide.includes( ' : ' ) ) {
				command.description = leftSide.split( ' : ' )[1]
				leftSide = leftSide.slice( 0, -command.description.length - 3 )
			}

			// Figure out if this is a function
			if ( leftSide.includes( '(' ) ) {
				const funcParams = leftSide.substr( leftSide.indexOf( '(' ) + 1 ).slice( 0, -1 )
				leftSide = leftSide.slice( 0, -funcParams.length - 2 )
				command.isFunction = true

				// TODO: Parse parameters
			}

			// Returns?
			if ( leftSide.includes( ':' ) ) {
				command.returns = leftSide.substr( leftSide.indexOf( ':' ) + 1 )
				leftSide = leftSide.slice( 0, -command.returns.length - 1 )
			}

			// And we should be left with the command name
			command.realName = leftSide
			command.searchName = command.realName.toLowerCase()

			commandsList.push( command )
		}
	} )
}

interface BmxCommand {
	realName: string,
	searchName?: string
	description: string,

	isFunction: boolean
	returns: string,
	params?: BmxCommandParam[],

	url?: string,
	urlLocation?: string
	
	module?: string
}

interface BmxCommandParam {
	name: string,
	type: string
}