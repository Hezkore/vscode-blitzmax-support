SuperStrict

Import brl.threads
Import brl.linkedlist

Import "tlogger.bmx"
Import "tconfig.bmx"
Import "json.helper.bmx"
Import "tmessagehandler.bmx"

Global DataManager:TDataManager
Type TDataManager
	
	Field _streamer:TDataStreamer
	
	Method New()
		
		Select Config.Get("lspmode").ToLower()
			
			Case "stdio" Self._streamer = New TDataStreamer_STDIO
			Case "tcp" Self._streamer = New TDataStreamer_TCP
			'Case ' Erm, what else can be read from? 
			
			Default
				Logger.Log("Unknown data mode ~q" + Config.Get("lspmode") + "~q",  ..
					ELogType.Error)
		EndSelect
		
		If Self._streamer Then
			
			Self._streamer._thread = CreateThread(Self._streamer.Main, Self._streamer)

		Else
			
			Logger.Log("No data streamer available", ELogType.Error)
		EndIf
	EndMethod
	
	Method Update()
		
		' Check for log messages
		If Self._streamer._logStack.Count() > 0 Then
			
			Local dataLog:TDataLog = TDataLog(Self._streamer._logStack.RemoveFirst())
			
			Self._streamer._mutex.Lock()
			Logger.Log(dataLog.Text,dataLog.LogType,dataLog.NewLine,dataLog.ForceShow)
			Self._streamer._mutex.Unlock()
		EndIf
		
		' Check for data message
		If Self._streamer._messageStack.Count() > 0 Then
						
			MessageHandler.GetMessage(GetNextMessage()._method).Receive()
		EndIf
		
	EndMethod
	
	Method PeekNextMessage:TDataMessage()
		
		Local message:TDataMessage = New TDataMessage
		
		Self._streamer._mutex.Lock()
		message = TDataMessage(Self._streamer._messageStack.First())
		Self._streamer._mutex.Unlock()
			
		Return message
	EndMethod
	
	Method GetNextMessage:TDataMessage()
		
		Local message:TDataMessage = New TDataMessage
		
		Self._streamer._mutex.Lock()
		message = TDataMessage(Self._streamer._messageStack.RemoveFirst())
		Self._streamer._mutex.Unlock()
		
		Return message
	EndMethod
	
	Method Free()
		
		If Self._streamer Then
			
			Self._streamer._wantTerminate = True
			Self._streamer._thread = Null
		EndIf
	EndMethod
EndType

Type TDataMessage
	
	Field _method:String
	Field _json:TJSONHelper
EndType

Type TDataLog
	Field Text:String
	Field LogType:ELogType = ELogType.Info
	Field NewLine:Byte = True
	Field ForceShow:Byte = False
EndType

Type TDataStreamer Abstract
	
	Field _thread:TThread
	Field _mutex:TMutex
	Field _messageStack:TList ' I wanted this as a stack, but it crashes on compile
	Field _logStack:TList ' Same here
	Field _wantTerminate:Byte
	
	Field _expectedContentType:String = "application/vscode-jsonrpc; charset=utf-8"
	Field _expectedContentLength:Int
	Field _lastHeader:String
	Field _lastContent:String
	
	Function Main:Object(data:Object)
	
		Local streamer:TDataStreamer = TDataStreamer(data)
		streamer.Log("Data streaming thread started")
		streamer.OnInit()
		
		Local idleTime:Int = Int(Config.Get("datastreamidle"))
		
		While Not streamer._wantTerminate
			
			If streamer._expectedContentLength <= 0 Then
				streamer.OnWantsHeader()
			Else
				streamer.OnWantsContent()
			EndIf
			
			Delay(idleTime)
		WEnd
		
		streamer.Log("Data streaming thread ended")
	EndFunction
	
	Method New()
		
		Self._mutex = CreateMutex()
		Self._messageStack = CreateList()
		Self._logStack = CreateList()
	EndMethod
	
	Method OnWantsHeader() Abstract
	Method OnWantsContent() Abstract
	Method OnInit() Abstract
	Method OnFree() Abstract
	
	Method PushMessage(message:TDataMessage)
		
		_mutex.Lock()
		Self._messageStack.AddLast(message)
		_mutex.Unlock()
	EndMethod
	
	Method Log(text:String, logType:ELogType = ELogType.Info, newLine:Byte = True, forceShow:Byte = False)
	
		Local newDataLog:TDataLog = New TDataLog
		newDataLog.Text = text
		newDataLog.LogType = logType
		newDataLog.NewLine = newLine
		newDataLog.ForceShow = forceShow
		
		_mutex.Lock()
		Self._logStack.AddLast(newDataLog)
		_mutex.Unlock()
	EndMethod
	
	Method ProcessHeaderData(data:String)
		
		Local headerKey:String
		Local headerValue:String
		Local foundSeparator:Byte = False ' Is always a :
		
		' Go through each letter of the line and separate the key from the value
		For Local i:Int = 0 Until data.Length
			
			' Processing key or value?
			If foundSeparator Then
				
				' Value
				headerValue:+Chr(data[i])
			Else
				
				' Key
				If data[i] = ":"[0] Then ' Is this the separator?
					foundSeparator = True
					i:+1 ' Progress one letter to account for the space
				Else
					headerKey:+Chr(data[i])
				EndIf
			EndIf
		Next
		
		' Check the header key - in lower case!
		Select headerKey.ToLower()
			Case "content-length"
				' This tells us how much content to expect
				Self._expectedContentLength = Int(headerValue)
			
			Case "content-type"
				' TODO: Support other types of data?
				'Self._expectedContentType = value
				' Function here to switch content type
				' For now we just notify that nothing else is supported
				If headerValue.ToLower() <> Self._expectedContentType Then
					Self.Log( ..
						"Content-type ~q" + headerValue + "~q is not supported! Only ~q" ..
						+ Self._expectedContentType + "~q is currently supported",  ..
						ELogType.Error ..
					)
				EndIf
				
			Default
				' Report that we don't know what the heck this is
				Self.Log("Unknown header ~q" + headerKey + "~q", ELogType.Warn)
		EndSelect
		
		' Skip the extra new line feed
		If StandardIOStream.ReadString(1)[0] <> 10 Self.Log( ..
			"Expected line feed after " + headerKey + " was omitted!",  ..
			ELogType.Error)
			
		Self._lastHeader = Null
	EndMethod
	
	Method ProcessContentData(data:String)
		
		Local message:TDataMessage = New TDataMessage
		
		message._json = New TJSONHelper(data)
		message._method = message._json.GetPathString("method").ToLower()
		
		Self.PushMessage(message)
		
		Self._expectedContentLength = 0
	EndMethod
EndType

' Read data from STDIO
Type TDataStreamer_STDIO Extends TDataStreamer

	Method OnInit()
		
		' Nothing to do
	EndMethod
	
	Method OnWantsHeader()
		
		Self._lastHeader = StandardIOStream.ReadLine()
		Self.ProcessHeaderData(Self._lastHeader)
	EndMethod
	
	Method OnWantsContent()
		
		Self._lastContent = StandardIOStream.ReadString(Self._expectedContentLength)
		Self.ProcessContentData(Self._lastContent)
	EndMethod
	
	Method OnFree()
		
		' Nothing to do
	EndMethod
EndType

' Read data via TCP
Type TDataStreamer_TCP Extends TDataStreamer
	
	Method OnInit()
		
		' Initialize the server here
	EndMethod
	
	Method OnWantsHeader()
		
		' Wait for TCP header data here
	EndMethod
	
	Method OnWantsContent()
		
		' Wait for TCP content data here
	EndMethod
	
	Method OnFree()
		
		' Close the TCP server here
	EndMethod
EndType