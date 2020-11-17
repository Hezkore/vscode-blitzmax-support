'use strict'

import * as vscode from 'vscode'
import * as path from 'path'
import { existsSync } from './common'

let bmxPath: string | undefined

export function registerHelperGuide(context: vscode.ExtensionContext) {
	
	// Make sure we know the BlitzMax path
	bmxPath = vscode.workspace.getConfiguration('blitzmax').get('base.path')
	vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration( 'blitzmax.path' )) {
			bmxPath = vscode.workspace.getConfiguration('blitzmax').get('base.path')
			triggerHelpGuides()
		}
	})
	
	// Quick command to picking a BlitzMax path
	context.subscriptions.push(vscode.commands.registerCommand('blitzmax.pickBlitzMaxPath', () => {
		vscode.window.showOpenDialog({
			title: 'Select your BlitzMax root path', openLabel: 'Select',
			canSelectFiles: false, canSelectFolders: true, canSelectMany: false}).then(async (picked: vscode.Uri[] | undefined) => {
				if (picked && picked[0]) {
					
					// Make sure the picked path actually is root
					if (existsSync(picked[0].fsPath + '/bin/bmk')) {
						await vscode.workspace.getConfiguration('blitzmax').update('base.path', picked[0].fsPath, true)
					} else {
						const altPath = path.resolve(picked[0].fsPath, '..')
						if (existsSync(altPath + '/bin/bmk')) {
							await vscode.workspace.getConfiguration('blitzmax').update('base.path', altPath, true)
						}
					}
					
					// Notify if the path was set
					if (vscode.workspace.getConfiguration('blitzmax').get('base.path')) {
						vscode.window.showInformationMessage('BlitzMax path set')
					} else {
						vscode.window.showErrorMessage('"bin/bmk" was not found', 'Select path').then( picked =>{
							if (picked) vscode.commands.executeCommand('blitzmax.pickBlitzMaxPath')
						})
					}
				}
			})
	}))
	
	triggerHelpGuides()
}

function triggerHelpGuides() {
	// Notify that no BlitzMax path is set
	if (!bmxPath) {
		vscode.window.showWarningMessage('No BlitzMax path configured', 'Select path').then(picked => {
			if (picked) {
				vscode.commands.executeCommand('workbench.action.openSettings', '@ext:hezkore.blitzmax')
				vscode.commands.executeCommand('blitzmax.pickBlitzMaxPath')
			}
		})
	} else {
		// Notify that the BlitzMax path is incorrect
		if (!existsSync(bmxPath + '/bin/bmk')) {
			vscode.window.showErrorMessage('The BlitzMax path is incorrect', 'Select path').then(picked => {
				if (picked) {
					vscode.commands.executeCommand('workbench.action.openSettings', '@ext:hezkore.blitzmax')
					vscode.commands.executeCommand('blitzmax.pickBlitzMaxPath')
				}
			})
		}
	}
}