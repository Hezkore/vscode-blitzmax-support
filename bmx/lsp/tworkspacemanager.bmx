SuperStrict

Import brl.linkedlist

Import "utils.bmx"
Import "tlogger.bmx"
Import "tdocumentmanager.bmx"

Global WorkspaceManager:TWorkspaceManager = New TWorkspaceManager
Type TWorkspaceManager
	
	Field _workspaces:TList
	
	Method New()
		
		Self._workspaces = CreateList()
	EndMethod
	
	Method OpenWorkspace(name:String, path:String)
		' Is this even a workspace..?
		If name.Length <= 0 Or path.Length <= 0 Then
			Logger.Log("Cannot open empty workspace ~q" + name + "~q (" + path + ")", ELogType.Error)
			Return
		EndIf
		
		' Does this workspace already exist?
		If Self.GetWorkspace(name, path) Then
			
			Logger.Log("Workspace already exists ~q" + path + "~q", ELogType.Error)
			Return
		EndIf
		
		Self._workspaces.AddLast(New TWorkspace(name, path))
		
		Logger.Log("Opened workspace ~q" + name + "~q (" + path + ")")
	EndMethod
	
	Method CloseWorkspace(name:String = Null, path:String = Null)
		
		' Do we have this workspace?
		Local workspace:TWorkspace = Self.GetWorkspace(name, path)
		If Not workspace Then
			Logger.Log("Requested close of nonexistent workspace ~q" + path + "~q", ELogType.Error)
			Return
		EndIf
		
		Logger.Log("Closed workspace ~q" + name + "~q (" + path + ")")
	EndMethod
	
	Method ClearWorkspaces()
		If Self._workspaces.Count() <= 0 Return
		Self._workspaces.Clear()
		Logger.Log("All workspaces cleared")
	EndMethod
	
	Method GetWorkspace:TWorkspace(name:String = Null, path:String = Null)
		
		For Local w:TWorkspace = EachIn Self._workspaces
			
			If w.Name = name Return w
			If w.Path = path Return w
		Next
	EndMethod
	
	' Check if a document is part of any workspace
	' Returns the workspace it's part of
	Method DocumentPartOfWorkspace:TWorkspace(documentPath:String)
		
		Local docPath:String = ExtractDir(documentPath)
		For Local w:TWorkspace = EachIn Self._workspaces
			
			If w.Path = docPath Return w
		Next
	EndMethod
EndType

Type TWorkspace
	
	Field _path:String
	Field _name:String
	
	Method New(name:String, path:String)
		Self._name = name
		Self._path = path
	EndMethod
	
	Method Path:String()
		Return Self._path
	EndMethod
	
	Method Name:String()
		Return Self._name
	EndMethod
EndType