'use strict'

import * as vscode from 'vscode'
import { registerBmxLSP, deactivateLSP } from './lsp'
import { registerBmxDebugger } from './bmxruntime'
import { registerTaskProvider } from './taskprovider'
import { registerTerminalLinkProvider } from './linkprovider'
import { registerHelperGuide } from './helper'
import { registerBmxBuildTreeProvider } from './buildtree'

export function activate(context: vscode.ExtensionContext) {
	
	registerBmxLSP(context)
	registerHelperGuide(context)
	registerBmxDebugger(context)
	registerTaskProvider(context)
	registerTerminalLinkProvider(context)
	registerBmxBuildTreeProvider(context)
}

export function deactivate() {
	deactivateLSP()
}