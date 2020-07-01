'use strict'

import * as vscode from 'vscode'
import { registerBmxLsp } from './lsp/lsp'
import { registerBmxDebugger } from './debug/debug'

export function activate( context: vscode.ExtensionContext ) {

	registerBmxLsp( context )
	registerBmxDebugger( context )
}

export function deactivate() {
	// nothing to do
}