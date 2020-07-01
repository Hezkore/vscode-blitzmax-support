SuperStrict

Import "trequest.capabilities.workspace.bmx"
Import "trequest.capabilities.textdocument.bmx"
Import "trequest.capabilities.window.bmx"

Type TRequest
	Field _jsonrpc:String { serializedName = "jsonrpc" }
	Field _id:Int { serializedName = "id" }
	Field _method:String { serializedName = "method" }
	
	Field _params:TRequestParams { serializedName = "params" }
EndType

Type TRequestParams
    Field _processId:Int { serializedName = "processId" }
	Field _rootPath:String { serializedName = "rootPath" }
	Field _rootUri:String { serializedName = "rootUri" }
	Field _trace:Byte { serializedName = "trace" }
	
	Field _clientInfo:TRequestClientInfo { serializedName = "clientInfo" }
	Field _capabilities:TRequestCapabilities { serializedName = "capabilities" }
	Field _workspaceFolders:TRequestWorkspaceFolders[] { serializedName = "workspaceFolders" }
EndType

Type TRequestClientInfo
	Field _name:String { serializedName = "name" }
	Field _version:String { serializedName = "version" }
EndType

Type TRequestWorkspaceFolders
	Field _uri:String { serializedName = "uri" }
	Field _name:String { serializedName = "name" }
EndType

Type TRequestCapabilities
	Field _workspace:TRequestCapabilitiesWorkspace { serializedName = "workspace" }
	Field _textDocument:TRequestCapabilitiesTextDocument { serializedName = "textDocument" }
	Field _window:TRequestCapabilitiesWindow { serializedName = "window" }
EndType