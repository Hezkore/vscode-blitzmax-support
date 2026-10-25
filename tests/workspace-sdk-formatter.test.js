'use strict'

const assert = require('assert')
const fs = require('fs')
const Module = require('module')
const os = require('os')
const path = require('path')

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blitzmax-workspace-formatter-'))
const sdkA = path.join(root, 'sdk-a')
const sdkB = path.join(root, 'sdk-b')
fs.mkdirSync(path.join(sdkA, 'bin'), { recursive: true })
fs.mkdirSync(path.join(sdkB, 'bin'), { recursive: true })
fs.writeFileSync(path.join(sdkA, 'bin', 'bfm'), '')

const folderA = { uri: { fsPath: path.join(root, 'project-a') } }
const folderB = { uri: { fsPath: path.join(root, 'project-b') } }
let activeFolder = folderA
let editorChanged
let lspChanged
let serverFormats = false
let registered = 0
let disposed = 0
const vscode = {
	EventEmitter: class { constructor() { this.event = () => ({ dispose() {} }) } dispose() {} },
	Uri: { file: fsPath => ({ fsPath }) },
	languages: {
		registerDocumentFormattingEditProvider: () => register(),
		registerDocumentRangeFormattingEditProvider: () => register(),
		registerOnTypeFormattingEditProvider: () => register()
	},
	window: {
		get activeTextEditor() { return { document: { uri: { fsPath: path.join(activeFolder.uri.fsPath, 'main.bmx') } } } },
		onDidChangeActiveTextEditor: listener => { editorChanged = listener; return { dispose() {} } }
	},
	workspace: {
		getWorkspaceFolder: uri => uri.fsPath.startsWith(folderA.uri.fsPath) ? folderA : folderB,
		getConfiguration: (_, folder) => ({ get: key => key === 'formatter.path' ? './bin/bfm' : folder === folderB ? sdkB : sdkA }),
		onDidChangeConfiguration: () => ({ dispose() {} })
	}
}

function register() {
	registered++
	return { dispose() { disposed++ } }
}

const originalLoad = Module._load
Module._load = function(request, parent, isMain) {
	if (request === 'vscode') return vscode
	if (request === './lsp') return { lspFormats: () => serverFormats, onLspChanged: listener => { lspChanged = listener; return { dispose() {} } } }
	if (request === './bmxdocs') return {}
	return originalLoad.apply(this, arguments)
}

try {
	const formatter = require('../out/formatterprovider')
	formatter.registerFormatterProvider({ subscriptions: [] })
	assert.strictEqual(registered, 3)
	assert.strictEqual(disposed, 0)

	activeFolder = folderB
	editorChanged()
	assert.strictEqual(disposed, 0)
	assert.strictEqual(registered, 3)

	activeFolder = folderA
	editorChanged()
	assert.strictEqual(registered, 3)
	serverFormats = true
	lspChanged()
	assert.strictEqual(disposed, 3)
	assert.strictEqual(registered, 3, 'a server formatter avoids registering a competing external provider')
	console.log('LSP formatter priority and legacy fallback passed')
} finally {
	Module._load = originalLoad
	fs.rmSync(root, { recursive: true, force: true })
}
