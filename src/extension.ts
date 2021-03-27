'use strict'

import * as vscode from 'vscode'
import { registerLSP, deactivateLSP } from './lsp'
import { registerDebugger } from './bmxruntime'
import { registerTaskProvider } from './taskprovider'
import { registerTerminalLinkProvider } from './linkprovider'
import { registerHelperGuide } from './helper'
import { registerBuildTreeProvider } from './buildtree'
import { registerBreakpoints } from './breakpoints'

export function activate( context: vscode.ExtensionContext ) {

	registerLSP( context )
	registerDebugger( context )
	registerBreakpoints( context )
	registerHelperGuide( context )
	registerTaskProvider( context )
	registerBuildTreeProvider( context )
	registerTerminalLinkProvider( context )
}

export function deactivate() {
	deactivateLSP()
}