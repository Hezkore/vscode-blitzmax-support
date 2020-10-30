'use strict'

import * as vscode from 'vscode'
import { registerBmxLsp, deactivateLsp } from './lsp/lsp'
import { registerBmxDebugger } from './debugger/debugger'

export function activate( context: vscode.ExtensionContext ) {

	registerBmxLsp( context )
	registerBmxDebugger( context )
}

export function deactivate() {
	deactivateLsp()
}