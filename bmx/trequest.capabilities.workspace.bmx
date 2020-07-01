SuperStrict

Type TRequestCapabilitiesWorkspace
	Field _applyEdit:Byte { serializedName = "applyEdit" }
	Field _configuration:Byte { serializedName = "configuration" }
	Field _workspaceFolders:Byte { serializedName = "workspaceFolders" }
	
	Field _workspaceEdit:TRequestCapabilitiesWorkspaceEdit { serializedName = "workspaceEdit" }
	Field _didChangeConfiguration:TRequestCapabilitiesWorkspaceDidChangeConfiguration { serializedName = "didChangeConfiguration" }
	Field _didChangeWatchedFiles:TRequestCapabilitiesWorkspaceDidChangeWatchedFiles { serializedName = "didChangeWatchedFiles" }
	Field _symbol:TRequestCapabilitiesWorkspaceSymbol { serializedName = "symbol" }
	Field _executeCommand:TRequestCapabilitiesWorkspaceExecuteCommand { serializedName = "executeCommand" }
EndType

Type TRequestCapabilitiesWorkspaceEdit
	Field _documentChanges:Byte { serializedName = "documentChanges" }
	Field _failureHandling:String { serializedName = "failureHandling" }
	
	Field _resourceOperations:String[] { serializedName = "resourceOperations" }
EndType

Type TRequestCapabilitiesWorkspaceDidChangeWatchedFiles
	
	Field _dynamicRegistration:Byte { serializedName = "dynamicRegistration" }
EndType

Type TRequestCapabilitiesWorkspaceDidChangeConfiguration
	
	Field _dynamicRegistration:Byte { serializedName = "dynamicRegistration" }
EndType

Type TRequestCapabilitiesWorkspaceSymbol
	
	Field _dynamicRegistration:Byte { serializedName = "dynamicRegistration" }
	
	Field _symbolKind:TRequestCapabilitiesWorkspaceSymbolKind { serializedName = "symbolKind" }
EndType

Type TRequestCapabilitiesWorkspaceSymbolKind
	
	Field _valueSet:Int[] { serializedName = "valueSet" }
EndType

Type TRequestCapabilitiesWorkspaceExecuteCommand
	
	Field _dynamicRegistration:Byte { serializedName = "dynamicRegistration" }
EndType