'use strict'

import * as vscode from 'vscode'

export function registerTerminalLinkProvider(context: vscode.ExtensionContext) {
	
	vscode.window.registerTerminalLinkProvider({
		provideTerminalLinks: (context: any, token: vscode.CancellationToken) => {
			
			if (!context.line.startsWith('[')) return
			if (!context.line.endsWith(']')) return
			
			return [
				{
					startIndex: 1 ,
					length: context.line.length - 2,
					data: context.line.slice(1, -1)
				}
			]
		},
		handleTerminalLink: (link: any) => {
			// TODO: Make this use editor.action.goToLocations
			let splits = link.data.split(';')
			let file = vscode.Uri.file( splits[0] )
			let range = new vscode.Range(
				new vscode.Position( Number(splits[1]) - 1, 0 ),
				new vscode.Position( Number(splits[1]) - 1, Number(splits[2]) )
			)
			vscode.window.showTextDocument(file, { selection: range, preview: true })
		}
	})
}