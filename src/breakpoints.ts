'use strict'

import * as vscode from 'vscode'

enum BreakpointChange {
	Added,
	Removed,
	Changed
}

export function registerBreakpoints(context: vscode.ExtensionContext) {
	
	vscode.debug.onDidChangeBreakpoints(async e => {
		if (e.added.length > 0) await updateBreakpoints(e.added, BreakpointChange.Added)
		if (e.removed.length > 0) await updateBreakpoints(e.removed, BreakpointChange.Removed)
		if (e.changed.length > 0) await updateBreakpoints(e.changed, BreakpointChange.Changed)
	})
	
	vscode.workspace.onDidOpenTextDocument(e => {
		updateBreakpointsInRange(getDirtyDocumentVersion(e))
	})
	
	vscode.workspace.onDidChangeTextDocument(e => {
		e.contentChanges.forEach(change => {
			updateBreakpointsInRange(getDirtyDocumentVersion(e.document), change.range)
		})
	})
}

function getDirtyDocumentVersion( document: vscode.TextDocument ): vscode.TextDocument {
	
	const realFilePath = stripGitExtension(document.uri.fsPath)
	for (let index = 0; index < vscode.window.visibleTextEditors.length; index++) {
		const textEditor = vscode.window.visibleTextEditors[index]
		if (textEditor.document.uri.fsPath == realFilePath) {
			
			return textEditor.document
		}
	}
	
	return document
}

function stripGitExtension( uri: string ): string {
	if (uri.endsWith('.git')) return uri.slice(0,-4)
	return uri
}

function updateBreakpointsInRange(document: vscode.TextDocument, range?: vscode.Range) {
	
	// If no range is defined, we'll use the entire document
	if (!range){ range = new vscode.Range(
		new vscode.Position(0, 0),
		document.lineAt(document.lineCount - 1).range.end
	)}
	
	const pureDocumentPath = stripGitExtension(document.uri.fsPath)
	
	// Scan through the range (lines) and see if we can find 'DebugStop'
	for (let index = range.start.line; index <= range.end.line; index++) {
		const line = document.lineAt(index)
		
		const isDebugStopLine = lineIsDebugStop(line)
		let existingBreakpoint: vscode.SourceBreakpoint | undefined
		let disabledBreakpoint: vscode.SourceBreakpoint | undefined
		
		for (let bi = 0; bi < vscode.debug.breakpoints.length; bi++) {
			const bps = <vscode.SourceBreakpoint>(vscode.debug.breakpoints[bi])
			if (bps.location.uri.fsPath !== pureDocumentPath) continue
			
			if (bps.location.range.start.line == line.lineNumber) {
				if (bps.enabled) {
					existingBreakpoint = bps
				} else {
					disabledBreakpoint = bps
				}
				break
			}
		}
		
		if (isDebugStopLine) {
			if (!existingBreakpoint && !disabledBreakpoint) {
				vscode.debug.addBreakpoints([
					new vscode.SourceBreakpoint(
						new vscode.Location(vscode.Uri.file(pureDocumentPath),
							new vscode.Range(
								new vscode.Position(line.lineNumber, 0),
								new vscode.Position(line.lineNumber, 0)
							)
						)
					)
				])
			}
		} else {
			if (existingBreakpoint && !disabledBreakpoint) {
				vscode.debug.removeBreakpoints([existingBreakpoint])
			}
		}
	}
}

function lineIsDebugStop(line: vscode.TextLine): boolean {
	if (line.isEmptyOrWhitespace) return false
	if (line.text[line.firstNonWhitespaceCharacterIndex].toLowerCase() != 'd') return false
	if (line.text.substr(line.firstNonWhitespaceCharacterIndex, 9).toLowerCase() != 'debugstop') return false
	
	if (line.text.length <= line.firstNonWhitespaceCharacterIndex + 9 ||
		line.text[line.firstNonWhitespaceCharacterIndex + 9] == ';' ||
		line.text[line.firstNonWhitespaceCharacterIndex + 9] == ' ' ||
		line.text[line.firstNonWhitespaceCharacterIndex + 9] == '\t'
		) return true
	
	return false
}

async function updateBreakpoints(arr: ReadonlyArray<vscode.Breakpoint>, change: BreakpointChange) {
	return new Promise<void>(async (resolve) => {
		
		for (let index = 0; index < arr.length; index++) {
			const breakpoint = <vscode.SourceBreakpoint>(arr[index])
			
			let document: vscode.TextDocument | undefined
			const realFilePath = stripGitExtension(breakpoint.location.uri.fsPath)
			for (let ti = 0; ti < vscode.window.visibleTextEditors.length; ti++) {
				const textEditor = vscode.window.visibleTextEditors[ti]
				if (textEditor.document.uri.fsPath == realFilePath) {
					
					document = textEditor.document
					break
				}
			}
			
			if (!document) document = await vscode.workspace.openTextDocument(breakpoint.location.uri)
			if (!document) continue
			
			const line = document.lineAt(breakpoint.location.range.start.line)
			const workEdits = new vscode.WorkspaceEdit()
			
			// Do the thing!
			switch (change) {
				case BreakpointChange.Added:
					if (lineIsDebugStop(line)) continue
						workEdits.insert(document.uri,
							new vscode.Position(breakpoint.location.range.start.line, 0),
							line.isEmptyOrWhitespace ? 'DebugStop' : 'DebugStop;'
						)
					break
				
				case BreakpointChange.Removed:
					if (!lineIsDebugStop(line)) continue
					workEdits.delete(document.uri,
						new vscode.Range(
							new vscode.Position(breakpoint.location.range.start.line, line.firstNonWhitespaceCharacterIndex),
							new vscode.Position(breakpoint.location.range.start.line, line.firstNonWhitespaceCharacterIndex + line.text[line.firstNonWhitespaceCharacterIndex + 10] == ';' ? 11 : 10)
						)
					)
					break
					
				default:
					if (!breakpoint.enabled) {
						if (lineIsDebugStop(line)) {
							workEdits.delete(document.uri,
								new vscode.Range(
									new vscode.Position(breakpoint.location.range.start.line, line.firstNonWhitespaceCharacterIndex),
									new vscode.Position(breakpoint.location.range.start.line, line.firstNonWhitespaceCharacterIndex + line.text[line.firstNonWhitespaceCharacterIndex + 10] == ';' ? 11 : 10)
								)
							)
						}
					} else {
						if (!lineIsDebugStop(line)) {
							workEdits.insert(document.uri,
								new vscode.Position(breakpoint.location.range.start.line, 0),
								line.isEmptyOrWhitespace ? 'DebugStop' : 'DebugStop;'
							)
						}
					}
					break
			}
			
			await vscode.workspace.applyEdit(workEdits)
		}
		
		resolve()
	})
}