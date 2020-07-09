SuperStrict

Import "tmessagehandler.bmx"
Import "tbmxparser.bmx"
Import "tlogger.bmx"
Import "utils.bmx"

Function OnCompletionHook(msg:TLSPMessage)
	
	If msg.IsSending Return
	
	BmxParser.Parse( ..
		UriToPath(msg.GetParamString( ..
			"textDocument/uri")))
	CompletionManager.RequestFromMessage(msg)
EndFunction

Global CompletionManager:TCompletionManager = New TCompletionManager
Type TCompletionManager
	
	Field Message:TLSPMessage
	Field Path:String
	Field Trigger:String
	Field Position:SPosition
	
	Field CompletionList:TList
	
	Field MaxCompletionItems:Int = 50
	
	Method New()
		
		MessageHandler.RegisterHook("textDocument/completion", OnCompletionHook)
		CompletionList = CreateList()
	EndMethod
	
	Method RequestFromMessage(message:TLSPMessage)
		
		Self.Message = message
		Self.Path = UriToPath(message.GetParamString("textDocument/uri"))
		Self.Position = New SPosition(Int(message.GetParamString("position/character")),  ..
		Int(message.GetParamString("position/line")), 0)
		Self.Trigger = message.GetParamString("context/triggerCharacter")
	EndMethod
	
	Method Update()
		
		' Do we even have any requests?
		If Path.Length <= 0 Return
		
		' Are we actually clear to provide a completion list?
		If BmxParser._parsingThreads.Count() > 0 Return
		If BmxParser._parsingQueue.Count() > 0 Return
		
		CompletionList.Clear()
		
		' Get items directly from the file itself
		Local parsed:TParsedBmx = BmxParser.GetParsed(Self.Path)
		If Not parsed Then
			Message.Cancel()
			Self.Path = Null
			Self.Message = Null
			Return
		EndIf
		'Logger.Log("Providing completion for: " + parsed.Path)
		
		For Local i:TParsedBmxItem = EachIn parsed.Items
			
			Self.AddItemFromBmxItem(i)
			If Self.ReachedMaxItems() Exit
		Next
		
		' Get items from files this file imports
		If Not Self.ReachedMaxItems() Then
			For Local s:String = EachIn parsed.Includes
				
				parsed = BmxParser.GetParsed(s)
				If parsed Then
					For Local i:TParsedBmxItem = EachIn parsed.Items
						
						Self.AddItemFromBmxItem(i)
						If Self.ReachedMaxItems() Exit
					Next
				EndIf
			Next
			For Local s:String = EachIn parsed.Imports
				
				parsed = BmxParser.GetParsed(s)
				If parsed Then
					For Local i:TParsedBmxItem = EachIn parsed.Items
						
						Self.AddItemFromBmxItem(i)
						If Self.ReachedMaxItems() Exit
					Next
				EndIf
			Next
		EndIf
		
		' Get items from files that imports this file
		' NOPE!
		
		Self.Message.SetResultBool("isIncomplete", Self.ReachedMaxItems())
		
		' Add all items to message
		Self.CompletionListToMessage()
		Self.Message.Respond()
		Self.Path = Null
		Self.Message = Null
	EndMethod
	
	Method ReachedMaxItems:Byte()
		If Self.CompletionList.Count() >=..
			Self.MaxCompletionItems Return True
		Return False
	EndMethod
	
	Method AddItemFromBmxItem(item:TParsedBmxItem)
		
		AddItem(item.Name, "This is the detail for " + item.Name)
	EndMethod
	
	Method AddItem(label:String, detail:String)
		
		Self.CompletionList.AddLast(New TCompletionItem(label, detail))
	EndMethod
	
	Method CompletionListToMessage()
		
		Local index:Long
		For Local i:TCompletionItem = EachIn Self.CompletionList
			
			Self.Message.SetResultString("items[" + index + "]/label", i.Label)
			Self.Message.SetResultString("items[" + index + "]/detail", i.Detail)
			index:+1
		Next
	EndMethod
EndType

Type TCompletionItem
	
	Field Label:String
	Field Detail:String
	
	Method New(label:String, detail:String)
		
		Self.Label = label
		Self.Detail = detail
	EndMethod
EndType