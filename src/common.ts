'use strict'

import * as vscode from 'vscode'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'

export function boolToString(bool: boolean | undefined): string | undefined {
	switch (bool) {
		case undefined: return undefined
		case true: return 'true'
		default: return 'false'
	}
}

export function toggleBool(bool: boolean | undefined): boolean | undefined {
	switch (bool) {
		case undefined: return true
		case true: return false
		default: return undefined
	}
}

export function existsSync(file: string): string | undefined {
	
	if (os.platform() == 'win32') file = file.toUpperCase()
	const filePath = path.parse(vscode.Uri.file(file).fsPath)
	let found: string | undefined
	
	try {
		fs.readdirSync(filePath.dir).forEach(f => {
			if (os.platform() == 'win32') {
				f = f.toUpperCase()
				if (f.endsWith('.EXE') && f.slice(0,-4) == filePath.name) {
					found = f
					return
				}
			}
			if (f == filePath.name) {
				found = f
				return
			}
		})
		return found
	} catch (error) {
		return undefined
	}
}