' The idea here is that the "document manager" will always provide you with
' the newest version of a source file
' That means that if you use the manager to GET source file, it will either be
' from the disk directly, or it will be an opened document in the IDE
' You can also force to get the data from the disk

SuperStrict

Import brl.linkedlist

'Import "utils.bmx"
Import "tlogger.bmx"

Global DocumentHandler:TDocumentManager = New TDocumentManager
Type TDocumentManager
	
	' The root path to the workspace
	Field WorkspacePath:String
	
	' All documents open in the IDE
	' Just a string to compare against
	Field _openedDocuments:TList
	
	Method New()
		
		Self._openedDocuments = CreateList()
	EndMethod
	
	Method Get:String(path:String)
		
		' Attempt to use open documents
		For Local o:TOpenDocument = EachIn Self._openedDocuments
			
			If o.AbsolutePath = path Return o.Text
		Next
		
		' Read directly from disk
		Return Self.GetFromDisk(path)
	EndMethod
	
	Method GetFromDisk:String(path:String)
		Return LoadString(path)
	EndMethod
	
	Method GetFromOpened:String(path:String)
		For Local o:TOpenDocument = EachIn Self._openedDocuments
			If o.AbsolutePath = path Return o.Text
		Next
		Return ""
	EndMethod
	
	Method IsOpened:TOpenDocument(path:String)
		
		For Local o:TOpenDocument = EachIn Self._openedDocuments
			
			If o.AbsolutePath = path Then Return o
		Next
	EndMethod
	
	Method DocumentOpened(path:String, text:String)
		
		' TODO: Check if already opened
		
		Local newDoc:TOpenDocument = New TOpenDocument
		newDoc.AbsolutePath = path
		newDoc.Text = text
		
		'Logger.Log("Text: " + newDoc.Text)
		
		Self._openedDocuments.AddLast(newDoc)
		
		Logger.Log("Opened document ~q" + path + "~q")
	EndMethod
	
	Method DocumentClosed(path:String)
		
		' Is this document even opened?
		Local openDoc:TOpenDocument = Self.IsOpened(path)
		If openDoc Then
			Self._openedDocuments.Remove(openDoc)
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