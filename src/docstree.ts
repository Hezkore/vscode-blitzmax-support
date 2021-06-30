'use strict'

import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { BlitzMaxPath } from './helper'
import { showBmxDocs } from './bmxwebviewer'
import { BmxCommand, getCommand } from './bmxdocs'

export function registerDocsTreeProvider( context: vscode.ExtensionContext ) {
	// Register documentation tree provider
	const bmxDocsTreeProvider = new BmxDocsTreeProvider( context )
	vscode.window.registerTreeDataProvider( 'blitzmax-documentation', bmxDocsTreeProvider )

	vscode.workspace.onDidChangeConfiguration( ( event ) => {
		if ( event.affectsConfiguration( 'tasks' ) ) bmxDocsTreeProvider.refresh()
	} )

	// Related commands
	context.subscriptions.push( vscode.commands.registerCommand( 'blitzmax.openBmxHtml', ( path: string, jumpTo: any ) => {
		showBmxDocs( path, jumpTo )
	} ) )

	vscode.commands.registerCommand( 'blitzmax.refreshDocs', () => bmxDocsTreeProvider.refresh() )
}

export class BmxDocsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {

	private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | null> = new vscode.EventEmitter<vscode.TreeItem | null>()
	readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | null> = this._onDidChangeTreeData.event

	constructor( context: vscode.ExtensionContext ) {
		vscode.window.onDidChangeActiveTextEditor( () => this.onActiveEditorChanged() )
		this.refresh()
	}

	private onActiveEditorChanged(): void {
		this.refresh()
	}

	refresh() {
		this._onDidChangeTreeData.fire( null )
	}

	createChildItem( enabled: boolean, id: string, label: string, tooltip: string, state: string | boolean | undefined, cmd: string = 'blitzmax.toggleBuildOption', cmdArgs: string[] = [] ): vscode.TreeItem {

		let item = new vscode.TreeItem( enabled ? label : '*', vscode.TreeItemCollapsibleState.None )
		item.id = id
		item.description = enabled ? state : label
		item.tooltip = tooltip ? tooltip : 'No information'
		item.contextValue = 'option'
		item.command = enabled ? {
			command: cmd,
			title: 'Toggle ' + label + ' build option',
			arguments: cmdArgs.length > 0 ? cmdArgs : [id]
		} : undefined

		if ( enabled ) {
			if ( typeof ( state ) === 'boolean' ) {
				if ( state == true )
					item.iconPath =
						new vscode.ThemeIcon( 'check',
							new vscode.ThemeColor( 'list.highlightForeground' )
						)
			}
		} else {
			// item.iconPath = new vscode.ThemeIcon( 'dash' )
		}

		return item
	}

	getChildren( element?: vscode.TreeItem ): Thenable<vscode.TreeItem[]> {
		if ( element ) {
			return this.generateDocsCategory( element )
		} else {
			return this.generateDocsRoot()
		}
	}

	cleanWorkbenchRootTaskName( taskName: string ): string {
		if ( taskName.toLowerCase().startsWith( 'blitzmax:' ) )
			taskName = taskName.slice( 9 )

		return taskName.trim()
	}

	generateDocsRoot(): Promise<vscode.TreeItem[]> {

		if ( !BlitzMaxPath ) return Promise.resolve( [] )

		let roots: vscode.TreeItem[] = []

		// Fetch folders with a capital letter from \docs\html\
		const dirPath = path.join( BlitzMaxPath, 'docs', 'html' )
		const files = fs.readdirSync( dirPath )
		if ( !files ) {
			vscode.window.showErrorMessage( 'Unable to scan BlitzMax docs folder' )
			return Promise.resolve( [] )
		}

		files.forEach( function ( file ) {
			// Test if capital
			if ( isValidDocumentationFolder( file, dirPath ) ) {
				let folderRoot = new vscode.TreeItem( file, vscode.TreeItemCollapsibleState.Collapsed )
				folderRoot.tooltip = file + ' help context'
				folderRoot.contextValue = path.join( dirPath, file )
				folderRoot.iconPath = new vscode.ThemeIcon( 'book' )
				folderRoot.command = {
					command: 'blitzmax.openBmxHtml',
					title: `Open help about ${file}`,
					arguments: [path.join( dirPath, file, 'index.html' )]
				}
				roots.push( folderRoot )
			}
		} )

		// Add 'Third party modules', which is an index of all modules outside of brl and pub
		let modulesRoot = new vscode.TreeItem( 'Third party modules', vscode.TreeItemCollapsibleState.Collapsed )
		modulesRoot.tooltip = 'All third party modules available'
		modulesRoot.contextValue = 'third party modules'
		modulesRoot.iconPath = new vscode.ThemeIcon( 'package' )
		roots.push( modulesRoot )

		// Add 'Index', which is an index of all available commands
		let indexRoot = new vscode.TreeItem( 'Index', vscode.TreeItemCollapsibleState.Collapsed )
		indexRoot.tooltip = 'All available commands'
		indexRoot.contextValue = 'index'
		indexRoot.iconPath = new vscode.ThemeIcon( 'list-unordered' )
		roots.push( indexRoot )

		return Promise.resolve( roots )
	}

	generateDocsCategory( element: vscode.TreeItem ): Promise<vscode.TreeItem[]> {

		if ( !element.contextValue || !BlitzMaxPath ) return Promise.resolve( [] )

		let items: vscode.TreeItem[] = []

		// Figure out what this item's about
		if ( element.contextValue.startsWith( 'cmd ' ) ) {
			const cmds = getCommand()
			const regardsCmd = element.contextValue.slice( 4 )

			cmds.forEach( function ( cmd ) {
				if ( BlitzMaxPath && cmd.url && cmd.realName == regardsCmd ) {
					let indexItem = new vscode.TreeItem( cmd.realName, vscode.TreeItemCollapsibleState.None )
					indexItem.tooltip = cmd.markdownString
					indexItem.description = cmd.paramsPretty
					indexItem.iconPath = indexIconFromCmd( cmd )
					indexItem.command = {
						command: 'blitzmax.openBmxHtml',
						title: `Open help about ${cmd.realName}`,
						arguments: [path.join( BlitzMaxPath, cmd.url ), cmd.urlLocation]
					}
					items.push( indexItem )
				}
			} )


		} else if ( element.contextValue == 'third party modules' ) {
			// Third party modules
			const excludeMods = ['brl.mod', 'maxgui.mod', 'dbg.mod', 'pub.mod', 'random.mod']
			const baseModFolders = fs.readdirSync( path.join( BlitzMaxPath, 'mod' ) )

			// Scan mod folder
			baseModFolders.forEach( function ( baseModFolder ) {
				const baseModFolderLower = baseModFolder.toLowerCase()
				if ( BlitzMaxPath &&
					baseModFolderLower.endsWith( '.mod' ) &&
					!excludeMods.includes( baseModFolderLower ) ) {

					// Scan base module folder
					const modFolders = fs.readdirSync( path.join( BlitzMaxPath, 'mod', baseModFolder ) )
					modFolders.forEach( function ( subModFolder ) {
						const subModFolderLower = subModFolder.toLowerCase()
						if ( BlitzMaxPath && subModFolderLower.endsWith( '.mod' ) ) {

							let modItem = new vscode.TreeItem(
								baseModFolder.slice( 0, -4 ) + '.' + subModFolder.slice( 0, -4 ),
								vscode.TreeItemCollapsibleState.None
							)

							let hasDocs: string | undefined
							let docDir: string | undefined

							try {
								// Attempt to find 'doc' folder
								docDir = path.join( BlitzMaxPath, 'mod', baseModFolder, subModFolder, 'doc', 'commands.html' )
								if ( fs.statSync( docDir ).isFile() ) hasDocs = docDir
							} catch ( error ) {
								try {
									// If no doc folder was found, we try 'docs'
									docDir = path.join( BlitzMaxPath, 'mod', baseModFolder, subModFolder, 'docs', 'commands.html' )
									if ( fs.statSync( docDir ).isFile() ) hasDocs = docDir
								} catch ( error ) {
									//console.log( modItem.label + ' has no documentation' )
								}
							}

							if ( hasDocs ) {
								modItem.iconPath = new vscode.ThemeIcon( 'book' )
								modItem.command = {
									command: 'blitzmax.openBmxHtml',
									title: `Open help about ${subModFolder}`,
									arguments: [docDir]
								}
							} else {
								modItem.description = modItem.label?.toString()
								modItem.tooltip = 'Module has no documentation'
								modItem.label = undefined
								modItem.iconPath = new vscode.ThemeIcon( 'question' )
							}
							items.push( modItem )
						}
					} )
				}
			} )

		} else if ( element.contextValue == 'index' ) {
			// Index
			const cmds = getCommand()
			let lastAddedIndexItem: vscode.TreeItem | undefined

			cmds.forEach( function ( cmd ) {
				if ( cmd.url && BlitzMaxPath ) {

					if ( lastAddedIndexItem && lastAddedIndexItem.label == cmd.realName ) {

						lastAddedIndexItem.iconPath = new vscode.ThemeIcon( 'list-unordered' )
						lastAddedIndexItem.description = undefined
						lastAddedIndexItem.tooltip = 'Multiple ' + cmd.realName + ' commands'
						lastAddedIndexItem.contextValue = 'cmd ' + cmd.realName
						lastAddedIndexItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded
					} else {

						let indexItem = new vscode.TreeItem( cmd.realName, vscode.TreeItemCollapsibleState.None )
						indexItem.tooltip = cmd.markdownString
						indexItem.description = cmd.paramsPretty
						indexItem.iconPath = indexIconFromCmd( cmd )
						indexItem.command = {
							command: 'blitzmax.openBmxHtml',
							title: `Open help about ${cmd.realName}`,
							arguments: [path.join( BlitzMaxPath, cmd.url ), cmd.urlLocation]
						}
						items.push( indexItem )
						lastAddedIndexItem = indexItem
					}
				}
			} )

		} else {
			// Folder or documentation item
			const dirPath = path.join( element.contextValue )
			//const modUrlPath = dirPath.substr( BlitzMaxPath.length ).replace( /\\/g, '/' ) + '/index.html'
			const files = fs.readdirSync( dirPath )

			// Folder items
			for ( let index = 0; index < files.length; index++ ) {
				const file = files[index]

				// Test if valid documentation item
				if ( file != 'index.html' && file.endsWith( '.html' ) ) {

					let folderItem = new vscode.TreeItem( file, vscode.TreeItemCollapsibleState.None )
					folderItem.tooltip = file + ' help context'
					folderItem.contextValue = path.join( dirPath, file )
					folderItem.iconPath = new vscode.ThemeIcon( 'book' )
					folderItem.command = {
						command: 'blitzmax.openBmxHtml',
						title: `Open help about ${file}`,
						arguments: [path.join( dirPath, file )]
					}
					items.push( folderItem )
				}

				// Test if folder
				if ( isValidDocumentationFolder( file, dirPath ) ) {

					let hasSubFolders: boolean = false
					let hasSubIndex: boolean = false

					// Test if there are sub folders
					const subDirPath = path.join( dirPath, file )
					const subFiles = fs.readdirSync( subDirPath )

					// Do a simple scan for sub files
					for ( let subFileIndex = 0; subFileIndex < subFiles.length; subFileIndex++ ) {
						const subFile = subFiles[subFileIndex]

						if ( subFile == 'index.html' ) {
							hasSubIndex = true
						} else if ( subFile.toLowerCase().endsWith( '.html' ) ) {
							hasSubFolders = true
						} else if ( isValidDocumentationFolder( subFile, subDirPath ) ) {
							hasSubFolders = true
						}
						if ( hasSubFolders && hasSubIndex ) break
					}

					// Test if any html names are found here before we rule out sub folders
					if ( !hasSubFolders ) {
						const htmlNames = scanNamesFromHtml( path.join( subDirPath, 'index.html' ), 1 )
						hasSubFolders = htmlNames.length > 0
					}

					let folderItem = new vscode.TreeItem( file,
						hasSubFolders
							? vscode.TreeItemCollapsibleState.Collapsed
							: vscode.TreeItemCollapsibleState.None
					)
					folderItem.tooltip = file + ' help context'
					folderItem.contextValue = path.join( dirPath, file )
					if ( hasSubIndex ) {
						folderItem.iconPath = new vscode.ThemeIcon( 'book' )
						folderItem.command = {
							command: 'blitzmax.openBmxHtml',
							title: `Open help about ${file}`,
							arguments: [path.join( dirPath, file, 'index.html' )]
						}
					}
					items.push( folderItem )
				}
			}

			// index.html items
			if ( element.contextValue ) {
				function compare( a: HtmlHref, b: HtmlHref ) {
					if ( a.name < b.name ){
					  return -1
					}
					if ( a.name > b.name ){
					  return 1
					}
					return 0
				 }
				const htmlNames = scanNamesFromHtml( path.join( dirPath, 'index.html' ), undefined ).sort( compare )
				htmlNames.forEach( function ( href ) {

					let exists: boolean = false
					let link = hrefFinalLink( dirPath, href.link )

					function hrefFinalLink( mainDirPath: string, hrefLink: string ): string {

						if ( hrefLink.startsWith( '"' ) ) {
							return path.join( dirPath, href.link.slice( 1, -1 ) )
						} else {
							return path.join( dirPath, 'index.html' )
						}
					}

					for ( let index = 0; index < items.length; index++ ) {
						const item = items[index]
						if ( item.label == href.name
							|| ( item.command && item.command.arguments && item.command.arguments.length <= 1 && item.command.arguments[0] == link ) ) {
							exists = true
							break
						}
					}

					if ( !exists ) {
						let htmlItem = new vscode.TreeItem( href.name, vscode.TreeItemCollapsibleState.None )
						htmlItem.tooltip = href.name + ' help context'
						htmlItem.iconPath = new vscode.ThemeIcon( 'book' )
						htmlItem.command = {
							command: 'blitzmax.openBmxHtml',
							title: `Open help about ${href}`,
							arguments: [link, href.link.slice( 1 )]
						}

						items.push( htmlItem )
					}
				} )
			}
		}

		return Promise.resolve( items )
	}

	getTreeItem( element: vscode.TreeItem ): vscode.TreeItem {
		return element
	}
}

function isValidDocumentationFolder( fileName: string, dirPath: string ): boolean {
	if ( fileName.charCodeAt( 0 ) >= 65 && fileName.charCodeAt( 0 ) <= 90 &&
		fs.statSync( path.join( dirPath, fileName ) ).isDirectory() ) return true
	return false
}

function indexIconFromCmd( cmd: BmxCommand ): vscode.ThemeIcon {

	if ( cmd.isFunction ) return new vscode.ThemeIcon( 'symbol-function' )
	if ( !cmd.isFunction && cmd.returns ) return new vscode.ThemeIcon( 'symbol-constant' )

	return new vscode.ThemeIcon( 'symbol-keyword' )
}

interface HtmlHref {
	name: string
	link: string
}

function scanNamesFromHtml( htmlPath: string, maxCount: number = 0 ): HtmlHref[] {

	let names: HtmlHref[] = []
	let htmlSource: string | undefined

	try {
		htmlSource = fs.readFileSync( htmlPath, 'utf8' )
	} catch ( error ) {
		htmlSource = undefined
		console.log( error )
	}

	if ( htmlSource ) {

		const lines = htmlSource.trim().split( '\n' )
		//let inDocTable: boolean = false

		for ( let lineNr = 0; lineNr < lines.length; lineNr++ ) {
			const line = lines[lineNr].trim()
			if ( !line || line.length <= 3 ) continue

			if ( line.toLowerCase().startsWith( '<tr><td class=docleft width=1%> <a href=' ) ) {
				names.push( {
					name: line.substring( line.indexOf( '>', 40 ) + 1, line.indexOf( '<', 40 ) ),
					link: line.substring( 40, line.indexOf( '>', 40 ) )
				} )
			}

			/*
			if ( !inDocTable ) {
				if (line.toLowerCase().startsWith('<table class=doc')) {
					inDocTable = true
				} else {
					inDocTable = line.toLowerCase().split( '<table class=doc' ).length > 1
				}
					
				if (inDocTable) continue
			} else {
				if (line.toLowerCase().startsWith('</table')) {
					inDocTable = false
				} else if ( line.toLowerCase().split( '</table' ).length > 1 ) {
					inDocTable = false
				}
				
				if (!inDocTable) continue

				const hrefPos = line.toLowerCase().indexOf( '<a href=' )
				const tableClassPos = line.toLowerCase().indexOf( '<td class=docleft' )
				if ( hrefPos > 0 && tableClassPos > 0 ) {
					const href = line.substr( hrefPos + 8 )
					if ( href ) {
						names.push( {
							name: href.substring( href.indexOf( '>' ) + 1, href.indexOf( '<' ) ),
							link: href.substring( 0, href.indexOf( '>' ) )
						} )
					}
				}
			}
			*/
			if ( maxCount > 0 && names.length >= maxCount ) return names
		}
	}

	return names
}