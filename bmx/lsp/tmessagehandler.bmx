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
		' Remember to use msg.MethodName and not Local methodName!!
		msg.Json = New TJSONHelper( ..
			"{~qjsonrpc~q:~q2.0~q,~qmethod~q:~q" + ..
			msg.MethodName + ..
			"~q}")
		If id >= 0 Then msg.Json.SetPathInteger("id", id)
		
		' Do the changes needed via OnSend
		msg.OnSend()
		
		' Add this to the queue and let the data manager deal with it
		Self._sendMessageQueue.AddLast(msg)
	EndMethod
EndType

Type TLSPMessage Abstract
	
	Field MethodName:String = "noName" ' The name of the message
	Field Json:TJSONHelper
	
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
		' TODO: Add a Self.AddParam(<string path here>)
		Self.Json.SetPathInteger("params/capabilities/textDocumentSync", 1)
		Self.Json.SetPathBool("params/capabilities/completionProvider/resolveProvider", False)
		Self.Json.SetPathString("params/capabilities/completionProvider/triggerCharacters[0]", "/")
		Self.Json.SetPathBool("params/capabilities/hoverProvider", True)
		Self.Json.SetPathBool("params/capabilities/documentSymbolProvider", True)
		Self.Json.SetPathBool("params/capabilities/referencesProvider", True)
		Self.Json.SetPathBool("params/capabilities/definitionProvider", True)
		Self.Json.SetPathBool("params/capabilities/documentHighlightProvider", True)
		Self.Json.SetPathBool("params/capabilities/codeActionProvider", True)
		Self.Json.SetPathBool("params/capabilities/renameProvider", True)
		' "colorProvider": {},
		Self.Json.SetPathBool("params/capabilities/foldingRangeProvider", True)
	EndMethod
	
	Method OnReceive()
		
		' When we get this message we need to return the initialize message
		' But with what we actually support
		MessageHandler.SendMessage("initialize", 0)
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
	
	'Method OnReceive()
	'EndMethod
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