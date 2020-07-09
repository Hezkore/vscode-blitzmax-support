' The idea here is that the "document manager" will always provide you with
' the newest version of a source file
' That means that if you use the manager to GET source file, it will either be
' from the disk directly, or it will be an opened document in the IDE
' You can also force to get the data from the disk

SuperStrict

Import brl.collections
Import brl.linkedlist

Import "utils.bmx"
Import "tlogger.bmx"

Global DocumentManager:TDocumentManager = New TDocumentManager
Type TDocumentManager
	
	' The root path to the workspace
	Field WorkspacePath:String
	
	' All documents open in the IDE
	' Just a string to compare against
	Field _openedDocuments:TStringMap
	
	' All known modify dates for files
	Field _modifyDates:TStringMap
	
	Method New()
		
		Self._openedDocuments = New TStringMap
		Self._modifyDates = New TStringMap
	EndMethod
	
	Method GetModifyDate:Long(path:String)
		
		' FIX: This "Long to String" stuff
		' Do we already know this modify date?
		If _modifyDates.Contains(path) ..
			Return Long(Self._modifyDates.ValueForKey(path).ToString())
		
		' Fetch the date
		Self.SetModifyDate(path, FileTime(path, FILETIME_MODIFIED))
	EndMethod
	
	Method SetModifyDate(path:String, time:Long)
		
		' FIX: Ugly Long to String
		Self._modifyDates.Insert(path, String(time))
	EndMethod
	
	' Tries to get text from open document
	' Otherwise reads from disk
	Method GetTextFromAny:String(path:String)
		
		' Attempt to use open documents
		If Self.IsOpened(path) ..
			Return Self.GetTextFromOpened(path)
		
		' Read directly from disk
		Return Self.GetTextFromDisk(path)
	EndMethod
	
	' Only from disk
	Method GetTextFromDisk:String(path:String)
		If FileSize(path) <= 0 Return ""
		Return LoadString(path)
	EndMethod
	
	' Only from opened
	Method GetTextFromOpened:String(path:String)
		
		Return TOpenDocument( ..
			Self._openedDocuments.ValueForKey(path)).Text
	EndMethod
	
	Method IsOpened:TOpenDocument(path:String)
		
		Return TOpenDocument( ..
			Self._openedDocuments.ValueForKey(path))
	EndMethod
	
	Method DocumentOpened(path:String, text:String)
		
		If Self.IsOpened(path) Then
			Logger.Log("Document already open ~q" + path + "~q")
			Return
		EndIf
		
		Local newDoc:TOpenDocument = New TOpenDocument
		newDoc.AbsolutePath = path
		newDoc.Text = text
		
		Self._openedDocuments.Insert(path, newDoc)
		
		Logger.Log("Opened document ~q" + path + "~q")
	EndMethod
	
	Method DocumentClosed(path:String)
		
		' Is this document even opened?
		If Self.IsOpened(path) Then
			Self._openedDocuments.Remove(path)
			Logger.Log("Closed document ~q" + path + "~q")
			Return
		EndIf
		
		' It wasn't, what happened?!
		Logger.Log("Requested close of nonexistent document ~q" + ..
			path + "~q", ELogType.Error)
	EndMethod
	
	Method DocumentChanged(path:String, changes:String[])
		
		' Is this document even opened?
		Local openDoc:TOpenDocument = Self.IsOpened(path)
		If openDoc Then
			Self._modifyDates.Insert(path, String(CurrentUnixTime()))
			'Logger.Log("Changes " + changes.Length)
			For Local i:Int = 0 Until changes.Length
				'Logger.Log("Text: " + changes[i])
				If i <= 0 Then
					openDoc.Text = changes[i]
				Else
					openDoc.Text:+changes[i]
				EndIf
			Next
			
			'Logger.Log("Text: " + openDoc.Text)
			Return
		EndIf
		
		' It wasn't, what happened?!
		Logger.Log("Requested change of nonexistent document ~q" + ..
			path + "~q", ELogType.Error)
	EndMethod
EndType

Type TOpenDocument
	
	Field AbsolutePath:String
	Field Text:String
EndType