' Okay a few rules here
' First of all, a big part of this will end up being inside another thread
' Which means you can't just access stuff freely
' Use the Stacks/Queue (well, TList for now) to queue things up
' For example TDataStreamer needs to use Self.Log to log things

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
		
		' Check for incoming messages
		If Self._streamer._messageStack.Count() > 0 Then
			
			' Fetch the next message
			Local nextMsg:TDataMessage = Self.GetNextMessage()
			
			' What exactly is this?
			If nextMsg._method Then
				' Normal message
				Local lspMsg:TLSPMessage = MessageHandler.GetMessage(nextMsg._method)
				If lspMsg Then
					lspMsg.ID = nextMsg._id
					lspMsg.ReceiveJson = nextMsg._json
					lspMsg.OnReceive()
				Else
					Logger.Log("Message content " + nextMsg._json.ToString())
				EndIf
			ElseIf nextMsg._error
				' Error message
				Logger.Log("Error " + nextMsg._error + ..
					" from client (" + nextMsg._errorMessage + ")",  ..
					ELogType.Error)
			Else
				' No idea
				Logger.Log("Unknown message in queue" + nextMsg._json.ToString(),  ..
					ELogType.Error)
			EndIf
			
		EndIf
		
		' Check for outgoing messages (Should be okay as a 'While')
		While MessageHandler._sendMessageQueue.Count() > 0
			
			Self.SendMessage(TLSPMessage(MessageHandler._sendMessageQueue.RemoveFirst()))
		Wend
		
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
	
	Method SendMessage(msg:TLSPMessage)
		
		Logger.Log("Sending " + msg.SendJson.ToString())
		Self._streamer.OnWriteMessage(msg.SendJson.ToStringCompact())
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
	Field _id:Int = -1
	Field _error:Int
	Field _errorMessage:String
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
	Method OnWriteMessage(msg:String) Abstract
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
		
		' Prepare this message
		Local message:TDataMessage = New TDataMessage
		message._json = New TJSONHelper(data)
		message._method = message._json.GetPathString("method")
		
		' Did we get a method name?
		' Otherwise it's probably an error
		If Not message._method Then
			
			message._error = message._json.GetPathInteger("error/code")
			message._errorMessage = message._json.GetPathString("error/message")
		Else
			
			message._id = message._json.GetPathInteger("id")
		EndIf
		
		' We need SOMETHING to push this message...
		If message._method Or message._error Then
			
			Self.PushMessage(message)
		Else
			
			Self.Log("Unknown message " + message._json.ToString(), ELogType.Warn)
		EndIf
		
		' This is important to reset!
		Self._expectedContentLength = 0
	EndMethod
	
	Method CalcContentLength:String(msg:String)
		
		Return "Content-Length: " + msg.Length + Chr(10) + Chr(10)
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
	
	Method OnWriteMessage(msg:String)
		
		' This calculates the length and returns -
		' Content-Length: <length>/r/n/r/n
		StandardIOStream.WriteString(Self.CalcContentLength(msg))
		
		' Now we're free to actually write the message
		StandardIOStream.WriteString(msg)
		
		StandardIOStream.Flush()
	EndMethod
	
	Method OnFree()
		
		' Nothing to do
	EndMethod
EndType

' Read data via TCP
Type TDataStreamer_TCP Extends TDataStreamer
	
	Method OnInit()
		
		' Initialize the server here
		Self.Log("TCP data stream is not yet supported", ELogType.Error)
	EndMethod
	
	Method OnWantsHeader()
		
		' Wait for TCP header data here
	EndMethod
	
	Method OnWantsContent()
		
		' Wait for TCP content data here
	EndMethod
	
	Method OnWriteMessage(msg:String)
		
		' Write TCP data here
	EndMethod
	
	Method OnFree()
		
		' Close the TCP server here
	EndMethod
EndType