'use strict'

import * as vscode from 'vscode'
import { registerBmxLsp, deactivateLsp } from './lsp'
import { registerBmxDebugger } from './debugger'
import { registerTaskProvider } from './taskprovider'
import { registerTerminalLinkProvider } from './linkprovider'
import { registerHelperGuide } from './helper'
import { registerBmxBuildTreeProvider } from './buildtree'

export function activate(context: vscode.ExtensionContext) {
	
	registerBmxLsp(context)
	registerHelperGuide(context)
	registerBmxDebugger(context)
	registerTaskProvider(context)
	registerTerminalLinkProvider(context)
	registerBmxBuildTreeProvider(context)
}

export function deactivate() {
	deactivateLsp()
}