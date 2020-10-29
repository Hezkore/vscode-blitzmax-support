'use strict'

import * as vscode from 'vscode'
import { registerBmxLsp } from './lsp/lsp'
import { registerBmxDebugger } from './debugger/debugger'

export function activate( context: vscode.ExtensionContext ) {

	registerBmxLsp( context )
	registerBmxDebugger( context )
}

export function deactivate() {
	// nothing to do
}