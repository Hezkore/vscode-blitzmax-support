'use strict'

import * as vscode from 'vscode'
import { registerHelperGuide } from './helper'
import { registerDebugger } from './bmxruntime'
import { registerLSP, deactivateLSP } from './lsp'
import { registerBreakpoints } from './breakpoints'
import { registerDocsProvider } from './bmxcommands'
import { registerTaskProvider } from './taskprovider'
import { registerBmxCliRequests } from './bmxrequest'
import { registerHoverProvider } from './hoverprovider'
import { registerColorProvider } from './colorprovider'
import { registerBuildTreeProvider } from './buildtree'
import { registerSymbolProvider } from './symbolprovider'
import { registerFormatterProvider } from './formatterprovider'
import { registerTerminalLinkProvider } from './linkprovider'
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
	registerBuildTreeProvider( context )
	registerFormatterProvider( context )
	registerCompletionProvider( context )
	registerTerminalLinkProvider( context )
	registerSignatureHelpProvider( context )
}

export function deactivate() {
	deactivateLSP()
}