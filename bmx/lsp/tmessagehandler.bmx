' Messages with an ID from the client is something it wants a reponse to
' It's always okay to answer a message with an ID, even if it was canceled
' (canceled messages are filtered out automatically)
' Also, if it's a reponse you're sending, remember to use "result" instead of "param"
' And to also set the ID to the same one you're responding to
' Messages without an ID is called a "notification"

SuperStrict

Import brl.linkedlist
Import brl.system

Import "utils.bmx"
Import "tlsp.bmx"
Import "tconfig.bmx"
Import "tlogger.bmx"
Import "json.helper.bmx"
Import "tdocumentmanager.bmx"
Import "tworkspacemanager.bmx"

Global MessageHandler:TMessageHandler = New TMessageHandler()
Type TMessageHandler
	
	Field _registeredMessages:TList
	Field _sendMessageQueue:TList
	Field _canceledRequests:TList
	Field _capabilities:TList
	
	Method New()
		
		Self._registeredMessages = CreateList()
		Self._sendMessageQueue = CreateList()
		Self._canceledRequests = CreateList()
		Self._capabilities = CreateList()
	EndMethod
	
	Method GetMessage:TLSPMessage(methodName:String)
		
		'Logger.Log("Looking for message ~q" + methodName + "~q")
		
		' Look for the strict exackt name for a match
		For Local m:TLSPMessage = Eachin Self._registeredMessages
			
			If m.MethodName = methodName Then Return m
		Next
		
		' Okay, nothing was found... check for lower case name
		Local methodNameLower:String = methodName.ToLower()
		For Local m:TLSPMessage = Eachin Self._registeredMessages
			
			If m.MethodName.ToLower() = methodNameLower Then Return m
		Next
		
		Logger.Log("Unknown message ~q" + methodName + "~q", ELogType.Warn) ' Error?
	EndMethod
	
	Method SendMessage(methodName:String, id:Int = -1)
		
		' Check if this request has been canceled
		' We should clear this out over time
		If id >= 0 Then
			Local wasCanceled:Byte = False
			For Local c:TLSPCanceledRequest = Eachin Self._canceledRequests
				
				' TODO: Clean out old canceled requests
				'If TimeSince(c.Time) > 1000 * 60 Then
				'	Self._canceledRequests.Remove(c)
				'EndIf
				
				If c.ID = id Then
					wasCanceled = True
					' There's no need to keep these forever
					'Self._canceledRequests.Remove(c)
					Exit
				EndIf
			Next
			If wasCanceled Then
				Logger.Log("Ignoring canceled request " + id)
				Return
			EndIf
		EndIf
		
		Local msg:TLSPMessage = Self.GetMessage(methodName)
		If Not msg Then Return ' Error is reported at GetMessage
		
		' Prepare the JSON here I suppose
		msg.SendJson = New TJSONHelper("{~qjsonrpc~q:~q2.0~q}")
		
		' Make sure the ID is set
		msg.ID = id
		
		' Do the changes needed via OnSend
		msg.OnSend()
		
		' Is ID still set?
		If msg.id >= 0 Then
			' This is a reponse to previous message with this id!
			msg.SendJson.SetPathInteger("id", msg.id)
		Else
			
			' Remember to use msg.MethodName and not Local methodName!!
			msg.SendJson.SetPathString("method", msg.MethodName)
		EndIf
		
		' Add this to the queue and let the data manager deal with it
		Self._sendMessageQueue.AddLast(msg)
	EndMethod
	
	Method CancelRequest(id:Int)
		
		Self._canceledRequests.AddLast( ..
			New TLSPCanceledRequest(id, CurrentTime()))
	EndMethod
EndType

Type TLSPCapability
	Field JSONPath:String
	Field JSONType:ELSPCapabilityJSONType
	Field Value:String
EndType

Enum ELSPCapabilityJSONType
	
	String
	Integer
	Bool
EndEnum

Type TLSPCanceledRequest
	
	Field ID:Int
	Field Time:String
	
	Method New(id:Int, time:String)
		
		Self.ID = id
		Self.Time = time
	EndMethod
EndType

Type TLSPMessage Abstract
	
	Field MethodName:String = "noName" ' The name of the message
	Field ReceiveJson:TJSONHelper
	Field SendJson:TJSONHelper
	Field ID:Int = -1
	
	Method OnSend()
		
		Logger.Log( ..
			"Message ~q" + Self.MethodName + ..
			"~q cannot be sent")
	EndMethod
	
	Method OnReceive()
		
		Logger.Log( ..
			"Message ~q" + Self.MethodName + ..
			"~q cannot be received")
	EndMethod
	
	Method Register()
		
		MessageHandler._registeredMessages.AddLast(Self)
	EndMethod
	
	Method AddCapability(path:String, value:Int)
		
		Local newCapability:TLSPCapability = New TLSPCapability
		newCapability.JSONPath = path
		newCapability.JSONType = ELSPCapabilityJSONType.Integer
		newCapability.Value = value
		MessageHandler._capabilities.AddLast(newCapability)
	EndMethod
	
	Method AddCapability(path:String, value:String)
		
		Local newCapability:TLSPCapability = New TLSPCapability
		newCapability.JSONPath = path
		newCapability.JSONType = ELSPCapabilityJSONType.String
		newCapability.Value = value
		MessageHandler._capabilities.AddLast(newCapability)
	EndMethod
	
	Method AddCapability(path:String, value:Byte)
		
		Local newCapability:TLSPCapability = New TLSPCapability
		newCapability.JSONPath = path
		newCapability.JSONType = ELSPCapabilityJSONType.Bool
		newCapability.Value = value
		MessageHandler._capabilities.AddLast(newCapability)
	EndMethod
	
	Method Respond()
		
		MessageHandler.SendMessage(Self.MethodName, Self.ID)
	EndMethod
	
	Method Cancel()
		
		MessageHandler.SendMessage("$/cancelRequest", Self.ID)
	EndMethod
	
	' Quick methods for getting received JSON params
	Method GetParamString:String(path:String)
		
		Return Self.ReceiveJson.GetPathString("params/" + path)
	EndMethod
	
	Method GetParamInteger:Int(path:String)
		
		Return Self.ReceiveJson.GetPathInteger("params/" + path)
	EndMethod
	
	Method GetParamBool:Byte(path:String)
		
		Return Self.ReceiveJson.GetPathBool("params/" + path)
	EndMethod
	
	' Quick methods for setting sent JSON params
	Method SetParamString(path:String, value:String)
		
		Self.SendJson.SetPathString("params/" + path, value)
	EndMethod
	
	Method SetParamInteger(path:String, value:Long)
		
		Self.SendJson.SetPathInteger("params/" + path, value)
	EndMethod
	
	Method SetParamBool(path:String, value:Byte)
		
		Self.SendJson.SetPathBool("params/" + path, value)
	EndMethod
	
	' Quick method for setting send JSON results
	Method SetResultString(path:String, value:String)
		
		Self.SendJson.SetPathString("result/" + path, value)
	EndMethod
	
	Method SetResultInteger(path:String, value:Long)
		
		Self.SendJson.SetPathInteger("result/" + path, value)
	EndMethod
	
	Method SetResultBool(path:String, value:Byte)
		
		Self.SendJson.SetPathBool("result/" + path, value)
	EndMethod
EndType

' Initialize
' https://microsoft.github.io/language-server-protocol/specifications/specification-current/#initialize
New TLSPMessage_Initialize
Type TLSPMessage_Initialize Extends TLSPMessage
	
	Method New()
		
		Self.MethodName = "initialize"
		
		Self.Register()
	EndMethod
	
	Method OnSend()
		
		' We should insert our capabilities here
		' This message is a reponse (cause it had an ID)
		' That means we don't use 'params'
		' We use 'result'
		
		' This is always a must?
		Self.SetResultInteger("capabilities/textDocumentSync", 1)
		
		' Some basic info about the server
		Self.SetResultString("serverInfo/name", "BlitzMax Language Server Protocol")
		Self.SetResultString("serverInfo/version", "0.0") ' FIX: Actually use the version here!!
		
		' Report every capability
		For Local c:TLSPCapability = Eachin MessageHandler._capabilities
			
			Select c.JSONType
				Case ELSPCapabilityJSONType.Integer
					Self.SetResultInteger("capabilities/" + c.JSONPath, Long(c.Value))
				
				Case ELSPCapabilityJSONType.Bool
					Self.SetResultBool("capabilities/" + c.JSONPath, Byte(c.Value))
				
				Default
					Self.SetResultString("capabilities/" + c.JSONPath, c.Value)
			EndSelect
		Next
		
		'Self.SetResultBool("capabilities/completionProvider/resolveProvider", False)
		'Self.SetResultString("capabilities/completionProvider/triggerCharacters[0]", "/")
		'Self.SetResultString("capabilities/completionProvider/triggerCharacters[1]", ".")
		rem
		Self.SendJson.SetPathBool("result/capabilities/hoverProvider", True)
		Self.SendJson.SetPathBool("result/capabilities/documentSymbolProvider", True)
		Self.SendJson.SetPathBool("result/capabilities/referencesProvider", True)
		Self.SendJson.SetPathBool("result/capabilities/definitionProvider", True)
		Self.SendJson.SetPathBool("result/capabilities/documentHighlightProvider", True)
		Self.SendJson.SetPathBool("result/capabilities/codeActionProvider", True)
		Self.SendJson.SetPathBool("result/capabilities/renameProvider", True)
		' "colorProvider": {},
		Self.SendJson.SetPathBool("result/capabilities/foldingRangeProvider", True)
		endrem
	EndMethod
	
	Method OnReceive()
		
		' When we get this message we need to return the initialize message
		' But with what we actually support
		
		' Store some workspace info
		WorkspaceManager.ClearWorkspaces()
		Local workspaceCount:Int = Self.ReceiveJson.GetPathSize( ..
			"params/workspaceFolders")
		For Local i:Int = 0 Until workspaceCount
			Local workspaceJson:TJSONObject = TJSONObject( ..
				Self.ReceiveJson.GetPathJSON("params/workspaceFolders[" + i + "]"))
			
			If workspaceJson WorkspaceManager.OpenWorkspace( ..
				workspaceJson.GetString("name"),  ..
				UriToPath(workspaceJson.GetString("uri")))
		Next
		
		'MessageHandler.SendMessage(Self.MethodName, Self.ID) ' This
		Self.Respond() ' Is the same as this
	EndMethod
EndType

' Initialized
' Okay seems like this is CLIENT ONLY
' So we can ignore this
' https://microsoft.github.io/language-server-protocol/specifications/specification-current/#initialized
New TLSPMessage_Initialized
Type TLSPMessage_Initialized Extends TLSPMessage
	
	Method New()
		
		Self.MethodName = "initialized"
		
		Self.Register()
	EndMethod
	
	'Method OnSend()
	'EndMethod
	
	Method OnReceive()
		
		Logger.Log("Client is " + Self.MethodName)
	EndMethod
EndType

' Shutdown
' https://microsoft.github.io/language-server-protocol/specifications/specification-current/#shutdown
New TLSPMessage_Shutdown
Type TLSPMessage_Shutdown Extends TLSPMessage
	
	Method New()
		
		Self.MethodName = "shutdown"
		
		Self.Register()
	EndMethod
	
	'Method OnSend()
	'EndMethod
	
	Method OnReceive()
		
		Logger.Log("Shutdown requested")
		LSP.Terminate()
	EndMethod
EndType

' $/cancelRequest
' https://microsoft.github.io/language-server-protocol/specifications/specification-current/#cancelRequest
New TLSPMessage_CancelRequest
Type TLSPMessage_CancelRequest Extends TLSPMessage
	
	Method New()
		
		Self.MethodName = "$/cancelRequest"
		
		Self.Register()
	EndMethod
	
	Method OnSend()
		
		'Logger.Log("Asking for cancel of ID " + Self.ID)
		Self.SetParamInteger("id", Self.ID)
		Self.ID = -1 ' Is a reponse, sent as notification
	EndMethod
	
	Method OnReceive()
		
		MessageHandler.CancelRequest(Int(Self.GetParamInteger("id")))
	EndMethod
EndType

' textDocument/completion
' For now, we just return some random stuff
' Very that you can see what triggered it!
' https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_completion
New TLSPMessage_TextDocument_Completion
Type TLSPMessage_TextDocument_Completion Extends TLSPMessage
	
	Field SupportedTriggers:String[]
	Field CurrentTrigger:String
	Field LookingForTrigger:String
	
	Method New()
		
		Self.MethodName = "textDocument/completion"
		
		' Register your triggers here
		Local triggers:String[] = ["/", "."]
		
		' Automatically add all triggers to capabilities
		For Local i:Int = 0 Until triggers.Length
			Self.AddCapability( ..
				"completionProvider/triggerCharacters[" + i + "]",  ..
				triggers[i])
		Next
		
		' Store these triggers for later
		Self.SupportedTriggers = triggers
		
		Self.Register()
	EndMethod
	
	Method OnSend()
		
		Self.SetResultBool("isIncomplete", True)
		
		If Self.CurrentTrigger = "/"
			
			Self.SetResultString("items[0]//label", "Hezkore")
			Self.SetResultString("items[1]//label", "Ron")
			Self.SetResultString("items[2]//label", "Brucey")
		Else
			
			Self.SetResultString("items[0]//label", "standardio")
			Self.SetResultString("items[0]/[0]/detail", "Lots of text stuff")
			
			Self.SetResultString("items[1]//label", "linkedlist")
			Self.SetResultString("items[1]/[1]/detail", "TList!")
		EndIf
	EndMethod
	
	Method OnReceive()
		
		' Is this a trigger we support?
		Self.LookingForTrigger = Self.GetParamString("context/triggerCharacter")
		For Self.CurrentTrigger = EachIn Self.SupportedTriggers
			If Self.LookingForTrigger = Self.CurrentTrigger Then
				' Yep!
				Self.Respond()
				Return
			EndIf
		Next
		
		' Nope!
		Self.Cancel()
	EndMethod
EndType

' textDocument/didOpen
' 
New TLSPMessage_TextDocument_DidOpen
Type TLSPMessage_TextDocument_DidOpen Extends TLSPMessage
	
	Method New()
		
		Self.MethodName = "textDocument/didOpen"
		
		Self.Register()
	EndMethod
	
	'Method OnSend()
	'EndMethod
	
	Method OnReceive()
		
		DocumentHandler.DocumentOpened( ..
			UriToPath(Self.GetParamString("textDocument/uri")),  ..
			Self.GetParamString("textDocument/text"))
		
		' Check what workspace it's part of, just for fun
		Local workspace:TWorkspace = WorkspaceManager.DocumentPartOfWorkspace( ..
			UriToPath(Self.GetParamString("textDocument/uri")))
		If workspace Then
			Logger.Log("Document part of workspace ~q" + workspace.Name + "~q")
		Else
			Logger.Log("Document is not part of any workspace")
		EndIf
	EndMethod
EndType

' textDocument/didClose
' 
New TLSPMessage_TextDocument_DidClose
Type TLSPMessage_TextDocument_DidClose Extends TLSPMessage
	
	Method New()
		
		Self.MethodName = "textDocument/didClose"
		
		Self.Register()
	EndMethod
	
	'Method OnSend()
	'EndMethod
	
	Method OnReceive()
		
		DocumentHandler.DocumentClosed( ..
			UriToPath(Self.GetParamString("textDocument/uri")))
	EndMethod
EndType

' textDocument/didChange
' 
New TLSPMessage_TextDocument_DidChange
Type TLSPMessage_TextDocument_DidChange Extends TLSPMessage
	
	Method New()
		
		Self.MethodName = "textDocument/didChange"
		
		Self.Register()
	EndMethod
	
	'Method OnSend()
	'EndMethod
	
	Method OnReceive()
		
		Local arrSize:Int = Self.ReceiveJson.GetPathSize("params/contentChanges")
		
		Local changes:String[arrSize]
		For Local i:Int = 0 Until changes.Length
			Local contentJson:TJSONObject = TJSONObject( ..
				Self.ReceiveJson.GetPathJSON("params/contentChanges[" + i + "]"))
			
			If contentJson changes[i] = contentJson.GetString("text")
		Next
		
		DocumentHandler.DocumentChanged( ..
			UriToPath(Self.GetParamString("textDocument/uri")), changes)
	EndMethod
EndType

' Hezkore is cool
' Test of custom notification
New TLSPMessage_HezkoreIsReallyCool
Type TLSPMessage_HezkoreIsReallyCool Extends TLSPMessage
	
	Method New()
		
		Self.MethodName = "hezkore/isReallyCool"
		
		Self.Register()
	EndMethod
	
	'Method OnSend()
	'EndMethod
	
	Method OnReceive()
		
		Logger.Log("Client claims that Hezkore is a cool dude (" + ..
			Self.GetParamString("really") + ")")
		
		'Logger.Log(Self.Json.ToString())
	EndMethod
EndType