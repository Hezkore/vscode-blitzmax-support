SuperStrict

Import brl.linkedlist

Import "tlsp.bmx"
Import "tconfig.bmx"
Import "tlogger.bmx"
Import "json.helper.bmx"

Global MessageHandler:TMessageHandler = New TMessageHandler()
Type TMessageHandler
	
	Field _registeredMessages:TList
	
	Method New()
	
		Self._registeredMessages = CreateList()
	EndMethod
	
	Method GetMessage:TLSPMessage(methodName:String)
		
		methodName = methodName.ToLower()
		'Logger.Log("Looking for message ~q" + methodName + "~q")
		
		For Local m:TLSPMessage = Eachin Self._registeredMessages
			
			If m.MethodName = methodName Then Return m
		Next
		
		Logger.Log("Unknown message ~q" + methodName + "~q")
	EndMethod
EndType

Type TLSPMessage Abstract
	
	Field MethodName:String = "noName" ' The name of the message
	Field Json:TJSONHelper
	
	Method Send() Abstract
	Method Receive() Abstract
	
	Method Register()
		
		Self.MethodName = Self.MethodName.ToLower()
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
	
	Method Send()
		
	EndMethod
	
	Method Receive()
		
		Logger.Log("Okay, we got the initialization message. But we're not ready!")
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
	
	Method Send()
		
	EndMethod
	
	Method Receive()
		
		LSP.Terminate()
	EndMethod
EndType