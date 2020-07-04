SuperStrict

Import brl.linkedlist

Import "tlsp.bmx"
Import "tconfig.bmx"
Import "tlogger.bmx"
Import "json.helper.bmx"

Global MessageHandler:TMessageHandler = New TMessageHandler()
Type TMessageHandler
	
	Field _registeredMessages:TList
	Field _sendMessageQueue:TList
	
	Method New()
	
		Self._registeredMessages = CreateList()
		Self._sendMessageQueue = CreateList()
	EndMethod
	
	Method GetMessage:TLSPMessage(methodName:String)
		
		'Logger.Log("Looking for message ~q" + methodName + "~q")
		
		' Look for the strict exackt name for a match
		For Local m:TLSPMessage = Eachin Self._registeredMessages
			
			If m.MethodName = methodName Then Return m
		Next
		
		' Okay, nothing was found... check for lower case name
		methodName = methodName.ToLower()
		For Local m:TLSPMessage = Eachin Self._registeredMessages
			
			If m.MethodName.ToLower() = methodName Then Return m
		Next
		
		Logger.Log("Unknown message ~q" + methodName + "~q", ELogType.Warn) ' Error?
	EndMethod
	
	Method SendMessage(methodName:String, id:Int = -1)
		
		Local msg:TLSPMessage = Self.GetMessage(methodName)
		If Not msg Then Return ' Error is reported at GetMessage
		
		' Prepare the JSON here I suppose
		msg.Json = New TJSONHelper("{~qjsonrpc~q:~q2.0~q}")
		
		If id >= 0 Then
			' This is a reponse to previous message with this id!
			msg.Json.SetPathInteger("id", id)
		Else
			
			' Remember to use msg.MethodName and not Local methodName!!
			MSG.Json.SetPathString("method", msg.MethodName)
		EndIf
		
		' Do the changes needed via OnSend
		msg.OnSend()
		
		' Add this to the queue and let the data manager deal with it
		Self._sendMessageQueue.AddLast(msg)
	EndMethod
EndType

Type TLSPMessage Abstract
	
	Field MethodName:String = "noName" ' The name of the message
	Field Json:TJSONHelper
	Field ID:Int = -1
	
	Method OnSend()
		
		Logger.Log( ..
			"Message ~q" + Self.MethodName + "~q cannot be sent")
	EndMethod
	
	Method OnReceive()
		
		Logger.Log( ..
			"Message ~q" + Self.MethodName + "~q cannot be received")
	EndMethod
	
	Method Register()
		
		MessageHandler._registeredMessages.AddLast(Self)
	EndMethod
EndType

' Initialize
' https://microsoft.github.io/language-server-protocol/specifications/specification-current/#initialize
New TLSPMessage_Initialize
Type TLSPMessage_Initialize Extends TLSPMessage
	
	Method New()
		
		MethodName = "initialize"
		
		Self.Register()
	EndMethod
	
	Method OnSend()
		
		' We should insert our capabilities here
		' This message is a reponse (cause it had an ID)
		' That means we don't use 'params'
		' We use 'result'
		' TODO: Add a Self.AddResult/Param(<string path here>)
		Self.Json.SetPathInteger("result/capabilities/textDocumentSync", 1)
		Self.Json.SetPathBool("result/capabilities/completionProvider/resolveProvider", False)
		Self.Json.SetPathString("result/capabilities/completionProvider/triggerCharacters[0]", "/")
		Self.Json.SetPathBool("result/capabilities/hoverProvider", True)
		Self.Json.SetPathBool("result/capabilities/documentSymbolProvider", True)
		Self.Json.SetPathBool("result/capabilities/referencesProvider", True)
		Self.Json.SetPathBool("result/capabilities/definitionProvider", True)
		Self.Json.SetPathBool("result/capabilities/documentHighlightProvider", True)
		Self.Json.SetPathBool("result/capabilities/codeActionProvider", True)
		Self.Json.SetPathBool("result/capabilities/renameProvider", True)
		' "colorProvider": {},
		Self.Json.SetPathBool("result/capabilities/foldingRangeProvider", True)
		
		Self.Json.SetPathString("result/serverInfo/name", "BlitzMax Language Server Protocol")
		Self.Json.SetPathString("result/serverInfo/version", "0.0") ' FIX: Actually use the version here!!
	EndMethod
	
	Method OnReceive()
		
		' When we get this message we need to return the initialize message
		' But with what we actually support
		MessageHandler.SendMessage("initialize", Self.ID)
	EndMethod
EndType

' Initialized
' Okay seems like this is CLIENT ONLY
' So we can ignore this
' https://microsoft.github.io/language-server-protocol/specifications/specification-current/#initialized
New TLSPMessage_Initialized
Type TLSPMessage_Initialized Extends TLSPMessage
	
	Method New()
		
		MethodName = "initialized"
		
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
		
		MethodName = "shutdown"
		
		Self.Register()
	EndMethod
	
	'Method OnSend()
	'EndMethod
	
	Method OnReceive()
		
		Logger.Log("Shutdown requested")
		LSP.Terminate()
	EndMethod
EndType

' Hezkore is cool
' Test of custom notification
New TLSPMessage_HezkoreIsReallyCool
Type TLSPMessage_HezkoreIsReallyCool Extends TLSPMessage
	
	Method New()
		
		MethodName = "hezkore/isReallyCool"
		
		Self.Register()
	EndMethod
	
	'Method OnSend()
	'EndMethod
	
	Method OnReceive()
		
		Logger.Log("Client claims that Hezkore is a cool dude")
	EndMethod
EndType