'use strict'

import * as fs from 'fs'
import * as vscode from 'vscode'
import * as cp from 'child_process'
import { BlitzMaxPath } from './helper'
import { showBmxDocs } from './bmxwebviewer'
import { generateCommandText, getCurrentDocumentWord } from './common'
import * as awaitNotify from 'await-notify'

let _commandsList: BmxCommand[]
let _modulesList: BmxModule[]

export function registerDocsProvider( context: vscode.ExtensionContext ) {
	// Related commands
	context.subscriptions.push( vscode.commands.registerCommand( 'blitzmax.quickHelp', ( word: any ) => {
		// If no word was specified, we look at the word under the cursor
		if ( !word || typeof word !== "string" ) word = getCurrentDocumentWord( undefined, undefined, undefined, true, false )
		showQuickHelp( word )
	} ) )

	context.subscriptions.push( vscode.commands.registerCommand( 'blitzmax.rebuildDoc', _ => {
		if ( !BlitzMaxPath ) return

		// Reset old commands and modules
		_commandsList = []
		_modulesList = []

		vscode.window.withProgress( {
			location: vscode.ProgressLocation.Notification,
			title: 'Rebuilding Documentation',
			cancellable: true
		}, async ( progress, token ) => {

			let busy = new awaitNotify.Subject()

			token.onCancellationRequested( () => {
				if ( docProcess ) {
					docProcess.kill( 'SIGINT' )
					docProcess.kill( 'SIGKILL' )
					busy.notify()
				}
			} )

			const procStart = process.hrtime()
			let docProcess = cp.spawn( BlitzMaxPath + '/bin/makedocs' )

			function reportProgress( data: any ) {
				const str: string[] = data.toString().split( '\n' )
				for ( let index = 0; index < str.length; index++ ) {
					const line = str[index].trim()
					if ( line.length > 1 ) progress.report( { message: line } )
				}
			}

			docProcess.stdout.on( 'data', ( data ) => {
				reportProgress( data )
			} )

			docProcess.stderr.on( 'data', ( data ) => {
				reportProgress( data )
			} )

			docProcess.on( 'error', ( error ) => {
				console.error( error.message )
				vscode.window.showErrorMessage( 'Error rebuilding documentation: ' + error.message )
			} )

			docProcess.on( 'close', ( code ) => {
				const procEnd = process.hrtime( procStart )

				console.log( `Rebuild documentation time: ${procEnd[0]}s ${procEnd[1] / 1000000}ms\r\n\r\n` )
				busy.notify()
			} )

			await busy.wait()
			return
		} )
	} ) )
}

export async function showQuickHelp( command: string ) {
	cacheCommandsAndModulesIfEmpty( true )
	if ( !_commandsList ) return
	let commands = getCommand( command )//, { hasDescription: true } )

	// Multi match
	if ( commands.length > 1 ) {
		let pickOptions: vscode.QuickPickItem[] = []
		commands.forEach( match => {
			pickOptions.push( { label: match.realName, detail: match.module } )
		} )

		vscode.window.showQuickPick( pickOptions ).then( selection => {
			for ( let index = 0; index < pickOptions.length; index++ ) {
				const pickItem = pickOptions[index];
				if ( pickItem === selection ) {
					showBmxDocs( vscode.Uri.file( BlitzMaxPath + '/' + commands[index].url ).fsPath, commands[index].urlLocation )
					return
				}
			}
		} )
		return
	}

	// Single match
	if ( commands.length == 1 ) {
		showBmxDocs( vscode.Uri.file( BlitzMaxPath + '/' + commands[0].url ).fsPath, commands[0].urlLocation )
		return
	}

	// No matches, attempt search for command with trimmed spaces
	if ( command.includes( ' ' ) ) {
		showQuickHelp( command.replace( ' ', '' ) )
		return
	}

	// No match
	vscode.window.showErrorMessage( 'No help available for "' + command + '"' )
	return
}

// Fetch all commands matching a string
interface GetCommandFilter {
	hasDescription?: boolean
	hasMarkdown?: boolean
	hasParameters?: boolean
}
export function getCommand( command: string | undefined = undefined, filter: GetCommandFilter | undefined = undefined ): BmxCommand[] {
	// Cache commands if needed
	cacheCommandsAndModulesIfEmpty( false )
	if ( !_commandsList ) return []

	// Send raw command list
	if ( !command && !filter ) return _commandsList

	// Find the command
	if ( command ) command = command.toLowerCase()
	let matches: BmxCommand[] = []

	for ( let index = 0; index < _commandsList.length; index++ ) {
		const cmd = _commandsList[index]
		if ( !command || ( command && cmd.searchName == command ) ) {

			// Filter out some matches
			if ( filter ) {
				if ( filter.hasDescription && !cmd.description ) continue
				if ( filter.hasMarkdown && !cmd.markdownString ) continue
				if ( filter.hasParameters && ( !cmd.params || cmd.params.length <= 0 ) ) continue
			}

			matches.push( cmd )
		}
	}

	return matches
}

export function getModule( module: string | undefined = undefined ): BmxModule[] {
	// Find the module
	if ( module ) module = module.toLowerCase()
	let matches: BmxModule[] = []

	for ( let index = 0; index < _modulesList.length; index++ ) {
		const mod = _modulesList[index]
		if ( !module || ( module && mod.match.startsWith( module ) ) ) matches.push( mod )
	}

	return matches
}

export function cacheCommandsAndModulesIfEmpty( showPopup: boolean ): boolean {
	if ( !_commandsList || _commandsList.length <= 0 ) {
		cacheCommands( showPopup )
		cacheModules()
	}
	return _commandsList ? _commandsList.length >= 0 : false
}

// Scan modules folder and store folder names
function cacheModules() {
	console.log( 'Caching BlitzMax module paths' )

	const globalBmxPath = vscode.workspace.getConfiguration( 'blitzmax' ).inspect( 'base.path' )?.globalValue
	const relativePath = '/mod/'
	const absolutePath = vscode.Uri.file( globalBmxPath + relativePath ).fsPath
	let parentPath: string | undefined
	let totalPath: string | undefined

	try {

		_modulesList = []

		// Look for parent module folders
		fs.readdirSync( absolutePath ).forEach( parent => {
			// MUST have the .mod extension
			if ( parent.toLowerCase().endsWith( '.mod' ) ) {
				parentPath = vscode.Uri.file( globalBmxPath + relativePath + '/' + parent ).fsPath

				fs.readdirSync( parentPath ).forEach( child => {

					if ( child.toLowerCase().endsWith( '.mod' ) ) {
						totalPath = vscode.Uri.file( parentPath + '/' + child ).fsPath

						// Make sure the source file exists
						fs.readdirSync( totalPath ).forEach( source => {
							if ( source.toLowerCase().endsWith( '.bmx' ) &&
								source.toLowerCase().slice( 0, -4 ) == child.toLowerCase().slice( 0, -4 ) ) {

								_modulesList.push( {
									path: totalPath ? totalPath : 'undefined',
									parent: parent.slice( 0, -4 ),
									child: child.slice( 0, -4 ),
									name: parent.slice( 0, -4 ) + '.' + child.slice( 0, -4 ),
									match: parent.slice( 0, -4 ).toLowerCase() + '.' + child.slice( 0, -4 ).toLowerCase(),
								} )
							}
						} )
					}
				} )
			}
		} )
	} catch ( err ) {
	}
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
	if ( BlitzMaxPath && showPopup ) {
		if ( !_commandsList || _commandsList.length <= 0 ) {
			// Notify about building docs
			vscode.window.showWarningMessage( 'Documentation not found.\nWould you like to rebuild documentation now?',
				'No', 'Yes' ).then( ( selection ) => {
					if ( selection && selection.toLowerCase() == 'yes' )
						vscode.commands.executeCommand( 'blitzmax.rebuildDoc' )
				} )
		}
	}

	return _commandsList ? _commandsList.length >= 0 : false
}

// Process a line/lines from commands.txt
function addCommand( data: string ) {
	const lines = data.split( '\n' )
	lines.forEach( line => {
		if ( line ) {

			// Trim ugly lines
			line = line.trimEnd()

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
				command.urlLocation = command.urlLocation.slice( 1 ).trim()
			} else {
				command.url = rightSide
			}

			// Track down module
			if ( command.url ) {
				const pathSplits = command.url.split( '/' )

				if ( pathSplits[1].toLowerCase() == 'docs' ) {
					command.moduleParent = pathSplits[4]
					command.moduleChild = pathSplits[5]
				} else if ( pathSplits[1].toLowerCase() == 'mod' ) {
					command.moduleParent = pathSplits[2]
					command.moduleChild = pathSplits[3]
				}

				command.module = command.moduleParent + '/' + command.moduleChild
			}

			// Take care of the description
			if ( leftSide.includes( ' : ' ) ) {
				command.description = leftSide.split( ' : ' )[1]
				leftSide = leftSide.slice( 0, -command.description.length - 3 )
			}

			// Translate old BlitzMax stuff
			// Regex to match stuff outside of strings is crazy...
			const matches = leftSide.match( /((?!\"[\w\s]*[\\"]*[\w\s]*)(\$|\!|\#|\%)(?![\w\s]*[\\"]*[\w\s]*\"))/g )
			if ( matches ) {
				for ( let index = 0; index < matches.length; index++ ) {
					const match = matches[index]

					switch ( match ) {
						case '%':
							leftSide = leftSide.replace( match, ':Int' )
							break

						case '#':
							leftSide = leftSide.replace( match, ':Float' )
							break

						case '!':
							leftSide = leftSide.replace( match, ':Double' )
							break

						case '$':
							leftSide = leftSide.replace( match, ':String' )
							break
					}
				}
			}

			// Figure out if this is a function
			if ( leftSide.includes( '(' ) ) {
				// Is there stuff at the end of the function?
				const closing = leftSide.lastIndexOf( ')' ) + 1
				if ( closing > 0 ) {
					const special = leftSide.substr( closing ).trim()
					if ( special ) {
						if ( special.startsWith( "'" ) ) {
							command.comment = special.slice( 1, 0 ).trim()
						} else {
							command.meta = special
						}
					}
					leftSide = leftSide.substring( 0, closing )
				}

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
				command.shortMarkdownString = new vscode.MarkdownString( undefined, true )
				command.markdownString = new vscode.MarkdownString( undefined, true )

				command.shortMarkdownString.isTrusted = true
				command.markdownString.isTrusted = true

				if ( command.paramsPretty ) {
					let codeBlock = command.realName

					// Construct code block
					if ( command.returns ) codeBlock += ':' + command.returns
					codeBlock += '( ' + command.paramsPretty + ' )'

					// Append
					command.markdownString.appendCodeblock( codeBlock, 'blitzmax'
					)
				}

				if ( command.description ) {
					// Replace some Bmx symbols with Markdown ones
					let fixedDesc: string = ''
					let markdownStart: number = 0
					let endMarkdownString: string | undefined

					function startMarkdown( start: string, end: string, index: number ) {
						fixedDesc += start
						endMarkdownString = end
						markdownStart = index + 1
					}

					function endMarkdown() {
						if ( endMarkdownString ) {
							fixedDesc += endMarkdownString.replace( '$&',
								generateCommandText( 'blitzmax.quickHelp', [fixedDesc.substr( markdownStart )] ) )
							endMarkdownString = undefined
						}
					}

					for ( let index = 0; index < command.description.length; index++ ) {
						const chr = command.description[index]

						switch ( chr ) {
							case ' ':
								endMarkdown()
								fixedDesc += chr
								break

							case '@':
								startMarkdown( '**', '**', index )
								break

							case '#':
								startMarkdown( '[', ']($&)', index )
								break

							default:
								fixedDesc += chr
								break
						}
					}
					endMarkdown()

					command.markdownString.appendMarkdown( fixedDesc )
					command.shortMarkdownString.appendMarkdown( fixedDesc )
				}

				if ( command.module ) {
					let moduleLink: string = ''
					if ( command.url )
						moduleLink = generateCommandText( 'blitzmax.openBmxHtml', [command.url, command.urlLocation] )

					command.markdownString.appendMarkdown( '  \n  \n[$(book)](' + moduleLink + ') ' + command.module )
					command.shortMarkdownString.appendMarkdown( '  \n  \n[$(book)](' + moduleLink + ') ' + command.module )
				}

			}

			// Make pretty insertion text
			if ( command.isFunction ) {
				command.insertText = new vscode.SnippetString( command.realName )
				command.insertText.appendText( '(' )
				if ( command.params ) {
					command.insertText.appendText( ' ' )
					for ( let index = 0; index < command.params.length; index++ ) {
						const param = command.params[index]

						if ( param.default ) {
							command.insertText.appendPlaceholder( param.default )
						} else {
							command.insertText.appendPlaceholder( param.name + ':' + param.type )
						}
						if ( index < command.params.length - 1 ) command.insertText.appendText( ', ' )
					}
					command.insertText.appendText( ' ' )
				}
				command.insertText.appendText( ')' )
			}

			// Done!
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
					/* These are taken care of globally now
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
					*/
					// Okay NOW add to the name
					default:
						if ( chr != ' ' ) param.name += chr
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
						if ( chr != ' ' ) param.type += chr
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
						if ( chr != ' ' ) param.default += chr
					}
				}

				if ( chr == '"' ) inString = !inString
				break
		}
	}

	// Make things pretty!
	cmd.paramsPretty = ''

	for ( let index = 0; index < cmd.params.length; index++ ) {
		const param = cmd.params[index]

		cmd.paramsPretty += param.name + ':' + param.type
		if ( param.default.length > 0 ) cmd.paramsPretty += ' = ' + param.default

		if ( index < cmd.params.length - 1 ) cmd.paramsPretty += ', '
	}
}

export interface BmxModule {
	path: string,
	name: string,
	parent: string,
	child: string,
	match: string
}

export interface BmxCommand {
	realName: string,
	searchName: string
	description?: string,
	comment?: string,
	shortMarkdownString?: vscode.MarkdownString
	markdownString?: vscode.MarkdownString

	isFunction: boolean
	returns?: string,
	meta?: string,
	params?: BmxCommandParam[],
	paramsRaw?: string,
	paramsPretty?: string

	url?: string,
	urlLocation?: string

	module?: string
	moduleParent?: string
	moduleChild?: string

	insertText?: vscode.SnippetString
}

interface BmxCommandParam {
	name: string,
	type: string,
	default: string
}