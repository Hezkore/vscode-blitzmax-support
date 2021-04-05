'use strict'

import * as vscode from 'vscode'
import { registerLSP, deactivateLSP } from './lsp'
import { registerDebugger } from './bmxruntime'
import { registerTaskProvider } from './taskprovider'
import { registerTerminalLinkProvider } from './linkprovider'
import { registerHelperGuide } from './helper'
import { registerBuildTreeProvider } from './buildtree'
import { registerBreakpoints } from './breakpoints'
import { registerDocsProvider } from './bmxcommands'
import { registerHoverProvider } from './hoverprovider'
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
	registerBuildTreeProvider( context )
	registerCompletionProvider( context )
	registerTerminalLinkProvider( context )
	registerSignatureHelpProvider( context )
}

export function deactivate() {
	deactivateLSP()
}