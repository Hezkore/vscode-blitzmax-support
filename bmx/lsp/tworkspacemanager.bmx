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
			If w.Path = Left(docPath, w.Path.Length) Return w
		Next
	EndMethod
	
	Method UpdateAllRelatedFiles()
		
		For Local w:TWorkspace = EachIn Self._workspaces
			w.UpdateRelatedFiles()
		Next
	EndMethod
EndType

Type TWorkspace
	
	Field _path:String
	Field _name:String
	Field _relatedFiles:TList
	
	Method New(name:String, path:String)
		Self._name = name
		Self._path = path
		Self._relatedFiles = CreateList()
		
		Self.UpdateRelatedFiles()
	EndMethod
	
	Method Path:String()
		Return Self._path
	EndMethod
	
	Method Name:String()
		Return Self._name
	EndMethod
	
	Method UpdateRelatedFiles()
		
		' Sub helper function
		Function AddRecursive(path:String, list:TList)
			Local fType:Int
			Local fPath:String
			Local files:String[] = LoadDir(path)
			For Local s:String = EachIn files
				fPath = path + "/" + s
				fType = FileType(fPath)
				If fType = FILETYPE_FILE
					list.AddLast(fPath)
				ElseIf fType = FILETYPE_DIR
					AddRecursive(fPath, list)
				EndIf
			Next
		EndFunction
		Self._relatedFiles.Clear()
		AddRecursive(Self._path, Self._relatedFiles)
		
		'Rem
		Logger.Log("Related Files: ",, False)
		For Local i:Int = 0 Until Self._relatedFiles.Count()
			If i = Self._relatedFiles.Count() - 1 Then
				Logger.Log(String(Self._relatedFiles.ValueAtIndex(i)))
			Else
				Logger.Log(String(Self._relatedFiles.ValueAtIndex(i)) + ", ",, False)
			EndIf
		Next
		'EndRem
	EndMethod
	
	Method RelatedFiles:String[] ()
		
		' No files, let's try and update it
		If Self._relatedFiles.Count() <= 0 ..
			Self.UpdateRelatedFiles()
		
		' Send what we have
		If Self._relatedFiles.Count() > 0
			Local files:String[Self._relatedFiles.Count()]
			For Local i:Int = 0 Until files.Length
				files[i] = String(Self._relatedFiles.ValueAtIndex(i))
			Next
			Return files
		EndIf
		
		Return New String[0]
	EndMethod
EndType