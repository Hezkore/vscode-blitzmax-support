'use strict'

import * as fs from 'fs'
import { EOL } from 'os'
import * as vscode from 'vscode'
import { getCurrentDocumentWord } from './common'

let _commandsList: BmxCommand[]

export function registerDocsProvider( context: vscode.ExtensionContext ) {
	// Related commands
	context.subscriptions.push( vscode.commands.registerCommand( 'blitzmax.quickHelp', ( word: any ) => {
		// If no word was specified, we look at the word under the cursor
		if ( !word || typeof word !== "string" ) word = getCurrentDocumentWord()
		showQuickHelp( word )
	} ) )
}

export async function showQuickHelp( command: string ) {
	cacheCommandsIfEmpty( true )
	let commands = getCommand( command, { hasMarkdown: true } )

	// Multi match
	if ( commands.length > 1 ) {
		let pickOptions: vscode.QuickPickItem[] = []
		commands.forEach( match => {
			pickOptions.push( { label: match.realName, detail: match.module } )
		} )

		const result = await vscode.window.showQuickPick( pickOptions ).then( selection => {

		} )
		console.log( 'PCIEDK: ' + result )
		return
	}

	// Single match
	if ( commands.length == 1 ) {
		generateQuickHelp( commands[0] )
		return
	}

	// No match
	vscode.window.showErrorMessage( 'No help available for "' + command + '"' )
	return
}

function generateQuickHelp( command: BmxCommand ) {
	if ( !command || !command.description ) return

	vscode.window.showInformationMessage( command.description )
}

// Fetch all commands matching a string
interface GetCommandFilter {
	hasDescription?: boolean
	hasMarkdown?: boolean
}
export function getCommand( command: string, filter: GetCommandFilter | undefined = undefined ): BmxCommand[] {
	// Cache commands if needed
	cacheCommandsIfEmpty( false )

	// Find the command
	command = command.toLowerCase()
	let matches: BmxCommand[] = []

	for ( let index = 0; index < _commandsList.length; index++ ) {
		const cmd = _commandsList[index]
		if ( cmd.searchName == command ) {

			// Filter out some matches
			if ( filter ) {
				if ( filter.hasDescription && !cmd.description ) continue
				if ( filter.hasMarkdown && !cmd.markdownString ) continue
			}

			matches.push( cmd )
		}
	}

	return matches
}

function cacheCommandsIfEmpty( showPopup: boolean ): boolean {
	if ( !_commandsList || _commandsList.length <= 0 ) cacheCommands( showPopup )
	return _commandsList ? _commandsList.length >= 0 : false
}

// Read commands.txt and then add the command (addCommand)
function cacheCommands( showPopup: boolean ): boolean {
	console.log( 'Caching BlitzMax commands' )

	const globalBmxPath = vscode.workspace.getConfiguration( 'blitzmax' ).inspect( 'base.path' )?.globalValue
	const relativePath = '/docs/html/Modules/commands.txt'
	const absolutePath = vscode.Uri.file( globalBmxPath + relativePath ).fsPath

	try {
		const data = fs.readFileSync( absolutePath, 'utf8' )
		_commandsList = []
		addCommand( data )
	} catch ( err ) {
		//console.error( 'Couldn\'t open commands.txt:' )
		//console.error( err )
	}

	// Did we add any commands?
	if ( showPopup ) {
		if ( !_commandsList || _commandsList.length <= 0 ) {
			// Notify about building docs
			vscode.window.showErrorMessage( 'Could not find BlitzMax documentations.\nMake sure you\'ve built documentations.',
				'Build Docs' ).then( ( selection ) => {
					if ( selection?.startsWith( 'Build' ) ) {
						vscode.commands.executeCommand( 'blitzmax.buildDocs' )
					}
				} )
		}
	}

	return _commandsList ? _commandsList.length >= 0 : false
}

// Process a line/lines from commands.txt
function addCommand( data: string ) {
	const lines = data.split( EOL )
	lines.forEach( line => {
		if ( line ) {

			const lineSplit = line.split( '|' )
			const command: BmxCommand = {
				realName: 'No Name', searchName: 'no name', isFunction: false, returns: undefined
			}
			let leftSide = lineSplit[0]
			let rightSide = lineSplit[lineSplit.length - 1]

			// Figure out URL
			if ( rightSide.includes( '#' ) ) {
				command.urlLocation = rightSide.substr( rightSide.indexOf( '#' ) )
				command.url = rightSide.slice( 0, -command.urlLocation.length )
			} else {
				command.url = rightSide
			}

			// Track down module
			if ( command.url ) {
				const pathSplits = command.url.split( '/' )

				if ( pathSplits[1].toLowerCase() == 'docs' ) {
					command.module = pathSplits[4] + '/' + pathSplits[5]
				} else if ( pathSplits[1].toLowerCase() == 'mod' ) {
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
				command.paramsRaw = leftSide.substr( leftSide.indexOf( '(' ) + 1 ).slice( 0, -1 )
				leftSide = leftSide.slice( 0, -command.paramsRaw.length - 2 )
				parseCommandParams( command )
				command.isFunction = true
			}

			// Returns?
			if ( leftSide.includes( ':' ) ) {
				command.returns = leftSide.substr( leftSide.indexOf( ':' ) + 1 )
				leftSide = leftSide.slice( 0, -command.returns.length - 1 )
			}

			// And we should be left with the command name
			command.realName = leftSide
			command.searchName = command.realName.toLowerCase()

			// Make a pretty markdown description of this command
			if ( command.description || command.paramsPretty ) {
				command.markdownString = new vscode.MarkdownString( undefined, true )

				if ( command.paramsPretty ) {
					let codeBlock = command.realName
					
					// Construct code block
					if (command.returns) codeBlock += ':' + command.returns
					codeBlock += '( ' + command.paramsPretty + ' )'
					
					// Append
					command.markdownString.appendCodeblock(codeBlock, 'blitzmax'
					)
				}
				
				if ( command.description )
					command.markdownString.appendText( command.description + '\n' )

				if ( command.module )
					command.markdownString.appendMarkdown( '$(package) _' + command.module + '_\n' )
			}

			_commandsList.push( command )
		}
	} )
}

function parseCommandParams( cmd: BmxCommand ) {

	// Make sure there's actually something to parse
	if ( !cmd.paramsRaw ) return
	cmd.paramsRaw = cmd.paramsRaw.trim()
	if ( !cmd.paramsRaw ) return

	// Reset//create the parameter array
	cmd.params = []

	// Make sure we have at least one parameter to work with
	let createNewParam: boolean = true

	// Current step of parsing
	enum parsePart {
		name,
		type,
		default
	}
	let parse: parsePart = parsePart.name

	// Currently parsing inside a string?
	let inString: boolean = false

	// Go through parameters, letter by letter
	for ( let index = 0; index < cmd.paramsRaw.length; index++ ) {
		const chr = cmd.paramsRaw[index]

		if ( createNewParam ) {
			createNewParam = false
			cmd.params.push( { name: '', type: 'Int', default: '' } )
		}

		const param = cmd.params[cmd.params.length - 1]

		switch ( parse ) {
			case parsePart.name:
				// Add character to the parameters name
				switch ( chr ) {

					// Move onto type parsing
					case ':':
						param.type = ''
						parse = parsePart.type
						break
					
					// Assume Int type and move to default value
					case '=':
						parse = parsePart.default
						break
					
					// Assume Int type and move to new value
					case ',':
						// Reset
						createNewParam = true
						parse = parsePart.name
						break

					// Ugh I hate these old BASIC type shortcuts!
					case '%':
						param.type = 'Int'
						parse = parsePart.type
						break

					case '#':
						param.type = 'Float'
						parse = parsePart.type
						break

					case '!':
						param.type = 'Double'
						parse = parsePart.type
						break

					case '$':
						param.type = 'String'
						parse = parsePart.type
						break

					// Okay NOW add to the name
					default:
						if (chr != ' ') param.name += chr
						break
				}
				break

			case parsePart.type:
				// The type of this parameter
				switch ( chr ) {
					case ',':
						// Reset
						createNewParam = true
						parse = parsePart.name
						break

					case '=':
						parse = parsePart.default
						break

					default:
						if (chr != ' ') param.type += chr
						break
				}
				break

			case parsePart.default:
				// The default value of this parameter
				
				if ( inString ) {
					param.default += chr
				} else {
					if ( chr == ',' ) {
						// Reset
						createNewParam = true
						parse = parsePart.name
						
					} else {
						if (chr != ' ') param.default += chr
					}
				}
				
				if ( chr == '"' ) inString = !inString
				break
		}
	}
	
	// Make things pretty!
	cmd.paramsPretty = ''
	
	for (let index = 0; index < cmd.params.length; index++) {
		const param = cmd.params[index]
		
		cmd.paramsPretty += param.name + ':' + param.type
		if ( param.default.length > 0 ) cmd.paramsPretty += ' = ' + param.default
		
		if ( index < cmd.params.length - 1 ) cmd.paramsPretty += ', '
	}
}

interface BmxCommand {
	realName: string,
	searchName: string
	description?: string,
	markdownString?: vscode.MarkdownString

	isFunction: boolean
	returns?: string,
	params?: BmxCommandParam[],
	paramsRaw?: string,
	paramsPretty?: string

	url?: string,
	urlLocation?: string

	module?: string
}

interface BmxCommandParam {
	name: string,
	type: string,
	default: string
}