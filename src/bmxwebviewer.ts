'use strict'

import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'
import { readFile } from './common'
import { BlitzMaxPath } from './helper'

let webPanel: vscode.WebviewPanel | undefined
let webViewPath: string = ''

export async function showBmxDocs( url: string | undefined, jumpTo: string | undefined = undefined ) {
	// Make sure we have the data we need
	if ( !url || !BlitzMaxPath ) return
	
	// Append BlitzMax path if the file isn't found on first try
	try {
		fs.statSync( url ).isFile()
	} catch (error) {
		url = path.join( BlitzMaxPath, url )
	}

	let htmlSource: BmxConvertedHtmlSource

	htmlSource = await convertBmxWeb( url )
	setupWebPanel()

	// Attempt to display the web panel
	if ( !webPanel ) return
	webPanel.webview.html = htmlSource.source
	webPanel.title = 'BlitzMax Help - ' + htmlSource.title
	if ( jumpTo )
		webPanel.webview.postMessage( { command: 'scrollToBmxCommand', text: jumpTo } )
}

function setupWebPanel() {
	if ( !BlitzMaxPath ) return
	if ( webPanel ) {
		// TODO make 'preserveFocus' a user setting
		webPanel.title = 'BlitzMax Help'
		webPanel.reveal( undefined, true )
		return
	}

	// Create the web panel
	webPanel = vscode.window.createWebviewPanel(
		'blitzmax.help',
		'BlitzMax Help',
		vscode.ViewColumn.One,
		{
			retainContextWhenHidden: true,
			enableScripts: true,
			enableCommandUris: true,
			enableFindWidget: true,
			localResourceRoots: [vscode.Uri.parse( path.join( BlitzMaxPath, 'docs', 'html' ) )]
		}
	)

	// Handle messages from the webview
	webPanel.webview.onDidReceiveMessage( message => {
		const text: string | undefined = message.text
		if ( !text ) return

		switch ( message.command ) {
			case 'alert':
				vscode.window.showErrorMessage( text )
				return

			case 'href':
				// Jump to section in current html
				if ( text.startsWith( '#' ) ) {
					webPanel?.webview.postMessage( { command: 'scrollToBmxCommand', text: text.slice( 1 ) } )
					return
				}

				// Jump to bmx example
				if ( text.toLowerCase().endsWith( '.bmx' ) ) {
					vscode.window.showTextDocument(
						vscode.Uri.file( webViewPath + '/' + text ),
						{ preview: true }
					)
					return
				}

				// Everything else is a link to an external file
				if ( text.includes( '#' ) ) {
					const urlLocation = text.substr( text.lastIndexOf( '#' ) + 1 )
					showBmxDocs( vscode.Uri.file( webViewPath + '/' + text.slice( 0, -urlLocation.length - 1 ) ).fsPath, urlLocation )
				} else {
					showBmxDocs( vscode.Uri.file( webViewPath + '/' + text ).fsPath, undefined )
				}
				return

			default:
				vscode.window.showInformationMessage( text )
				return
		}
	},
		undefined,
		//documentationContext.subscriptions
	)

	webPanel.onDidDispose( () => {
		webPanel = undefined
	},
		undefined,
		//documentationContext.subscriptions
	)
}

interface BmxConvertedHtmlSource {
	source: string
	title: string
}

function convertBmxWeb( url: string ): Promise<BmxConvertedHtmlSource> {
	return new Promise( function ( resolve, reject ) {
		vscode.window.withProgress( {
			location: vscode.ProgressLocation.Window,
			title: 'Loading Documentation',
			cancellable: true
		}, async ( progress, token ) => {

			progress.report( { message: 'Loading HTML', increment: 25 } )
			webViewPath = path.dirname( url )
			let htmlSource = await readFile( url )

			progress.report( { message: 'Converting HTML', increment: 25 } )

			let replaceCSS: boolean = true
			let title: string | undefined
			const htmlLines = htmlSource.split( '\n' )

			for ( let index = 0; index < htmlLines.length; index++ ) {
				const line = htmlLines[index]

				// Find the module name
				if ( !title && line.includes( '<b>' ) ) {
					progress.report( { increment: 25 } )
					title = line.substring( line.lastIndexOf( '<b>' ) + 3, line.lastIndexOf( '</b>' ) - 1 )
				}

				// Replace CSS
				if ( replaceCSS && line.toLowerCase().trim().startsWith( '<link rel=stylesheet' ) ) {
					progress.report( { increment: 25 } )

					// Replace with custom or original?
					if ( vscode.workspace.getConfiguration( 'blitzmax' ).get( 'help.customStyle' ) ) {
						htmlSource = htmlSource.replace( line, `<style>${customCSS}</style>` )
						replaceCSS = false
					} else {
						const split = line.split( line.includes( '"' ) ? '"' : "'" )
						const cssUrl = split[split.length - 2]
						const cssFile = await readFile( vscode.Uri.file( webViewPath + '/' + cssUrl ).fsPath )

						htmlSource = htmlSource.replace( line, `<style>${cssFile}</style>` )

						if ( cssFile ) replaceCSS = false
					}

				}

				// Break free if we're all done
				if ( !replaceCSS && title ) break
			}

			// Did we replace CSS?
			if ( replaceCSS ) vscode.window.showErrorMessage( 'Error while replacing CSS' )

			return resolve( { source: script + htmlSource, title: title ? title : 'No Title' } )
		} )
	} )
}

const customCSS = `
body{
	color: var(--vscode-tab-activeForeground);
	background: var(--vscode-editorGroupHeader-tabsBackground);
	font: 9pt;
}
body.navbar{
	color: red;
	background: red;
	font: 10pt;
	padding: 2px;
}
h1{
	font: 14pt;
	font-weight: bold;
}
h2{
	font: 12pt;
	font-weight: bold;
}
h3{
	font: 10pt;
	font-weight: bold;
}

table{
	background: var(--vscode-editorGroupHeader-tabsBorder);
	font: 10pt;
	border-collapse: collapse;
	border: 1px solid var(--vscode-editorGroupHeader-tabsBorder);
}

th{
	padding: 4px;
	color: var(--vscode-button-foreground);
	background: var(--vscode-button-background);
	border: 1px solid var(--vscode-editorGroup-border);
	text-align: left;
}
td{
	padding: 4px;
	color: var(--vscode-button-secondaryForeground);
	background: var(--vscode-button-secondaryBackground);
	border: 1px solid var(--vscode-editorGroup-border);
}
td.blank{
	padding: 0px;
	background: blue;
	border: none;
}
td.small{
	padding: 2px;
	color: var(--vscode-statusBar-foreground);
	background: var(--vscode-statusBar.backgroun);
	border: none;
	border-bottom: 1px solid var(--vscode-statusBar-border);
	font: 8pt;
}

td.doctop{
	padding: 10px;
	color: var(--vscode-button-foreground);
	background: var(--vscode-button-background);
	border-bottom: 1px solid var(--vscode-editorGroup-border);
	font: 10pt;
	vertical-align: text-top;
	font-weight: bold;
}
td.docleft{
	padding: 10px;
	color: var(--vscode-dropdown-foreground);
	background: var(--vscode-dropdown-background);
	border-bottom: 1px solid var(--vscode-editorGroup-border);
	font: 8pt;
	vertical-align: text-top;
	width: 10%;
}
td.docright{
	padding:10px;
	color: var(--vscode-dropdown-foreground);
	background: var(--vscode-dropdown-background);
	border-bottom: 1px solid var(--vscode-editorGroup-border);
	font: 10pt;
	vertical-align: text-top;
	width: 90%;
}

pre{
	font: 10pt courier;
	color: var(--vscode-textPreformat-foreground);
	background: var(--vscode-textCodeBlock-background);
	padding: 8px;
}
blockquote{
	color: red;
}
font.token{
	font-weight: bold;
}
font.syntax{
	color: #005555;
}
div.ref{
	border: 1px solid #000000;
}
div.indent{
	padding-left: 8px;
}
div.syntax{
	color: #005555;
	padding: 8px;
}

a{
	color: var(--vscode-textLink-foreground);
	font: 10pt;
	text-decoration: underline;
}
a.navbig{
	color: var(--vscode-textLink-activeForeground);
	font: 9pt;
	text-decoration: none;
}
a.navsmall{
	color: var(--vscode-textLink-activeForeground);
	font: 8pt;
	text-decoration: none;
}
a:hover{
	color: var(--vscode-textLink-activeForeground);
}
a.small{
	color: var(--vscode-textLink-activeForeground);
	font: 8pt;
}
a.token{
	color: var(--vscode-textLink-activeForeground);
	text-decoration: underline;
}
a.null{
	text-decoration: none;
}
div.entries{
	display: none;
}`

const script = `<script>
const vscode = acquireVsCodeApi();

document.addEventListener('click', event => {
    let node = event && event.target;
    while (node) {
        if (node.tagName && node.tagName === 'A' && node.href) {
            vscode.postMessage({
							command: 'href',
							text: node.getAttribute("href")
						});
            event.preventDefault();
            return;
        }
        node = node.parentNode;
    }
}, true);


function scrollToBmxCommand(cmd) {
	var element = document.getElementsByName(cmd)[0];
	if (!element) element = document.getElementById(cmd);
	if (element) element.scrollIntoView();
}

window.addEventListener('message', event => {
		const message = event.data;
		switch (message.command) {
				case 'scrollToBmxCommand':
					scrollToBmxCommand(message.text);
					break;
		}
});
</script>`