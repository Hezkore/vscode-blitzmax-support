'use strict'

import * as vscode from 'vscode'
import { registerBmxLsp, deactivateLsp } from './lsp'
import { registerBmxDebugger } from './debugger'
import { registerTaskProvider } from './taskprovider'
import { registerTerminalLinkProvider } from './linkprovider'
import { registerHelperGuide } from './helper'

export function activate(context: vscode.ExtensionContext) {
	
	registerBmxLsp(context)
	registerHelperGuide(context)
	registerBmxDebugger(context)
	registerTaskProvider(context)
	registerTerminalLinkProvider(context)
}

export function deactivate() {
	deactivateLsp()
}