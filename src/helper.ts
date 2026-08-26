'use strict'

import * as vscode from 'vscode'
import * as path from 'path'
import { existsSync } from './common'
import { cacheCommandsAndModulesIfEmpty } from './bmxdocs'

export let BlitzMaxPath: string | undefined
const bmxNoPathMessage = `No BlitzMax path configured!

The BlitzMax extension needs to know your BlitzMax location.
Please select the root of your BlitzMax folder.

This can be changed in settings later.`

export function registerHelperGuide( context: vscode.ExtensionContext ) {

	// Make sure we know the BlitzMax path
	BlitzMaxPath = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'base.path' )
	vscode.workspace.onDidChangeConfiguration( ( event ) => {
		if ( event.affectsConfiguration( 'blitzmax.base.path' ) ) {
			BlitzMaxPath = vscode.workspace.getConfiguration( 'blitzmax' ).get( 'base.path' )
			triggerBmxInstallHelp()
		}
	} )
	
	
	// Open BlitzMax settings
	context.subscriptions.push( vscode.commands.registerCommand( 'blitzmax.settings', () => {
		vscode.commands.executeCommand( 'workbench.action.openSettings', '@ext:hezkore.blitzmax' )
	} ) )
	
	// Visit BlitzMax.org command
	context.subscriptions.push( vscode.commands.registerCommand( 'blitzmax.homepage', () => {
		vscode.env.openExternal( vscode.Uri.parse( 'https://blitzmax.org/') )
	} ) )

	// Quick command to picking a BlitzMax path
	context.subscriptions.push( vscode.commands.registerCommand( 'blitzmax.pickBlitzMaxPath', () => {
		vscode.window.showOpenDialog( {
			title: 'Select your BlitzMax root path', openLabel: 'Select',
			canSelectFiles: false, canSelectFolders: true, canSelectMany: false
		} ).then( async ( picked: vscode.Uri[] | undefined ) => {
			if ( picked && picked[0] ) {

				// Make sure the picked path actually is root
				if ( existsSync( picked[0].fsPath + '/bin/bmk' ) ) {
					await vscode.workspace.getConfiguration( 'blitzmax' ).update( 'base.path', picked[0].fsPath, true )
				} else {
					const altPath = path.resolve( picked[0].fsPath, '..' )
					if ( existsSync( altPath + '/bin/bmk' ) ) {
						await vscode.workspace.getConfiguration( 'blitzmax' ).update( 'base.path', altPath, true )
					}
				}

				// Notify if the path was set
				if ( vscode.workspace.getConfiguration( 'blitzmax' ).get( 'base.path' ) ) {
					vscode.window.showInformationMessage( 'BlitzMax path set' )
				} else {
					vscode.window.showErrorMessage( '"bin/bmk" was not found', 'Select path' ).then( picked => {
						if ( picked ) vscode.commands.executeCommand( 'blitzmax.pickBlitzMaxPath' )
					} )
				}
			}
		} )
	} ) )

	// Quick command to picking the BlitzMax formatter path
	context.subscriptions.push( vscode.commands.registerCommand( 'blitzmax.pickBlitzMaxFormatterPath', () => {
		vscode.window.showOpenDialog( {
			title: 'Select your BlitzMax formatter executable', openLabel: 'Select',
			canSelectFiles: true, canSelectFolders: false, canSelectMany: false
		} ).then( async ( picked: vscode.Uri[] | undefined ) => {
			if ( picked && picked[0] ) {

				await vscode.workspace.getConfiguration( 'blitzmax' ).update( 'formatter.path', picked[0].fsPath, true )
				vscode.window.showInformationMessage( 'BlitzMax formatter path set' )
			}
		} )
	} ) )

	triggerBmxInstallHelp()
}

// bfm is the BlitzMax NG formatter, and the extension already looks for it in
// bin next to bls
// Flip this to true once the repository is public and the button below starts
// pointing people straight at it instead of at a search
const BFM_IS_PUBLIC: boolean = false
const BFM_URL: string = 'https://github.com/Hezkore/blitzmax-formatter'

// What to look for on GitHub when there is nothing better to offer
const FORMATTER_SEARCH: string = 'https://github.com/search?q=topic%3ABlitzMax+topic%3Aformatter'

// Help with BlitzMax external formatter
export function triggerBmxFormatterHelp() {

	const getLabel = BFM_IS_PUBLIC ? 'Get bfm' : 'Download'
	const message = BFM_IS_PUBLIC
		? 'No BlitzMax formatter found. Drop bfm into your BlitzMax NG bin folder and it is picked up on its own.'
		: 'No BlitzMax formatter found.'

	vscode.window.showWarningMessage(
		message,
		'Select Path',
		getLabel
	).then( selection => {
		if ( selection ) {
			if ( selection === getLabel ) {

				vscode.env.openExternal( vscode.Uri.parse( BFM_IS_PUBLIC ? BFM_URL : FORMATTER_SEARCH ) )
			} else {

				// Pick path
				vscode.commands.executeCommand( 'workbench.action.openSettings', '@ext:hezkore.blitzmax formatter' )
				vscode.commands.executeCommand( 'blitzmax.pickBlitzMaxFormatterPath' )
			}
		}
	} )
}

// Help with BlitzMax install
function triggerBmxInstallHelp() {
	
	vscode.commands.executeCommand( 'setContext', 'blitzmax:ready', false )
	
	// Notify that no BlitzMax path is set
	if ( !BlitzMaxPath ) {
		vscode.window.showWarningMessage( bmxNoPathMessage, { modal: true }, 'Select path' ).then( picked => {
			if ( picked ) {
				vscode.commands.executeCommand( 'workbench.action.openSettings', '@ext:hezkore.blitzmax' )
				vscode.commands.executeCommand( 'blitzmax.pickBlitzMaxPath' )
			}
		} )
	} else {
		// Notify that the BlitzMax path is incorrect
		if ( !existsSync( BlitzMaxPath + '/bin/bmk' ) ) {
			BlitzMaxPath = undefined
			vscode.window.showErrorMessage( 'The BlitzMax path is incorrect', 'Select path' ).then( picked => {
				if ( picked ) {
					vscode.commands.executeCommand( 'workbench.action.openSettings', '@ext:hezkore.blitzmax' )
					vscode.commands.executeCommand( 'blitzmax.pickBlitzMaxPath' )
				}
			} )
		} else {
			vscode.commands.executeCommand( 'setContext', 'blitzmax:ready', true )
			cacheCommandsAndModulesIfEmpty( true )
		}
	}
}