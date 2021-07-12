'use strict'

import * as vscode from 'vscode'
import { registerHelperGuide } from './helper'
import { registerDebugger } from './bmxruntime'
import { registerDocsProvider } from './bmxdocs'
import { registerLSP, deactivateLSP } from './lsp'
import { registerBreakpoints } from './breakpoints'
import { registerTaskProvider } from './taskprovider'
import { registerBmxCliRequests } from './bmxrequest'
import { registerHoverProvider } from './hoverprovider'
import { registerColorProvider } from './colorprovider'
import { registerDocsTreeProvider } from './docstree'
import { registerBuildTreeProvider } from './buildtree'
import { registerSymbolProvider } from './symbolprovider'
import { registerTerminalLinkProvider } from './linkprovider'
import { registerFormatterProvider } from './formatterprovider'
import { registerDefinitionProvider } from './definitionprovider'
import { registerCompletionProvider } from './completionprovider'
import { registerSignatureHelpProvider } from './signaturehelpprovider'

export function activate( context: vscode.ExtensionContext ) {
	registerLSP( context )
	registerDebugger( context )
	registerBreakpoints( context )
	registerHelperGuide( context )
	registerDocsProvider( context )
	registerTaskProvider( context )
	registerHoverProvider( context )
	registerColorProvider( context )
	registerBmxCliRequests( context )
	registerSymbolProvider( context )
	registerDocsTreeProvider( context )
	registerBuildTreeProvider( context )
	registerFormatterProvider( context )
	registerDefinitionProvider( context )
	registerCompletionProvider( context )
	registerTerminalLinkProvider( context )
	registerSignatureHelpProvider( context )
}

export function deactivate() {
	deactivateLSP()
}