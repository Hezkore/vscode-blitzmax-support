SuperStrict

Import BRL.System

Import "json.helper.bmx"
Include "lsp.executemessage.bmx"

Type TLsp

	' Logging
	Field _logStream:TStream
	' LogLevel filters out some messages
	' 0 Info, Warn, Error
	' 1 Warn, Error
	' 2 Error
	Field LogLevel:Byte = 0
	Field _lastLogHadNewLine:Byte = True
	Field PrintLog:Byte = False ' Bad and slow, only use for panic debugging!
	
	' Looping
	Field _isTerminated:Byte = False
	
	' Header & Content
	Field _lastStdioLine:String
	Field _expectedContentLength:Int
	Field _expectedContentType:String = "application/vscode-jsonrpc; charset=utf-8"
	Field _lastContentString:String
	Field LastMessageMethod:String
	
	' Memory management
	Field _manageMemory:Byte = True
	' Set this to 0 if we've done nothing
	' Set this to 1 to collect a little
	' Set this to 2 for a big collect
	Field _needsGarbageCollection:Byte
	' Incremented once for every lsp update loop
	Field _memoryUpdateLoops:Byte
	' Loop count to collect garbage
	Field _memoryUpdateLoopMax:Byte = 2
	Field _memoryCollected:Int
	Field _reportMemoryCollected:Byte = True
	
	' CPU love
	Field IdleTimer:Int = 10
	
	' JSON
	Field _jsonHelper:TJSONHelper
	
	Method New()
		
		' Are we handling the memory ourselves?
		If Self._manageMemory GCSetMode(2)
		
		Self._processAppArgs()
		
		' Setup the json helper
		' Apparently we have to re-create this each time we use it?
		'Self._jsonHelper = New TJSONHelper()
		
		' Log the starting time
		Self.Log("Log start " + CurrentDate() + " " + CurrentTime(),, , True)
		
		' Limit log level
		Self.LogLevel = Min(Self.LogLevel, ELogType.Values().Length - 1)
		
		' Inform what messages we're showing
		Self.Log("Log Level: " + Self.LogLevel + " (",, False, True)
		For Local i:Int = Self.LogLevel Until ELogType.Values().Length
			Self.Log(ELogType.Values()[i].ToString(),, False)
			If i < ELogType.Values().Length - 1 Then
				Self.Log(", ",, False)
			Else
				Self.Log(")")
			EndIf
		Next
	EndMethod
	
	Method _processAppArgs()
		
		' TODO: check if logging is requested at a specific location
		' Also check args for log level
		' Check args for if manual memory management is suggested
		' Check args for update loop count before memory clean
		' Check args for CPU idle time between loops
		For Local i:Int = 1 Until AppArgs.Length
			
			
		Next
		
		' DEBUG: Always enable logging to lsp-output.txt
		Self._logStream:TStream = WriteStream("lsp-output.txt")
	EndMethod
	
	Method Running:Byte()
		
		' Are we allowed to keep running?
		Return Not Self._isTerminated
	EndMethod
	
	Method Update()
		
		' Expect header info or content data
		Try
			If Self._expectedContentLength <= 0 Then
				
				Self._readHeaderFromStdio()
			Else
				
				Self._readContentFromStido()
			EndIf
		Catch ex:Object
			' Just log any crazyness we might encouter and continue
			' Only works in debug?
			Self.Log(ex.ToString(), ELogType.Error)
		EndTry
		
		' Do we need memory garbage collection?
		If Self._manageMemory Then
			
			If Self._memoryUpdateLoops >= Self._memoryUpdateLoopMax Then
				Select Self._needsGarbageCollection
					Case 0 ' No cleaning :)
					Case 1
						Self._memoryCollected = GCCollectALittle()
					Default
						Self._memoryCollected = GCCollect()
				EndSelect
				Self._needsGarbageCollection = 0
				Self._memoryUpdateLoops = 0
				' Do we report this?
				If Self._reportMemoryCollected And Self._memoryCollected Then
					Self.Log("Memory Collected - " + Self._memoryCollected + " bytes")
				EndIf
			EndIf
			
			Self._memoryUpdateLoops:+1
		EndIf
		
		' Let the poor CPU rest!
		Delay(IdleTimer)
	EndMethod
	
	Method _readHeaderFromStdio()
		
		' Read an entire line
		' NOTICE: BLOCKING
		' Meaning we'll pause here until a line exists
		' Do we want to fix that? It's a good pause...
		Self._lastStdioLine = StandardIOStream.ReadLine()
		
		' Did we get any data?
		If Self._lastStdioLine Then
			
			Self._processStdioHeader()
			Self._needsGarbageCollection = 2
		EndIf
	EndMethod
	
	Method _readContentFromStido()
		
		' Attempt to read with the expected length
		' NOTICE: BLOCKING
		' Meaning we'll pause here until a line exists
		' Do we want to fix that? It's a good pause...
		Self._lastContentString = StandardIOStream.ReadString(Self._expectedContentLength)
		
		If Self._lastContentString Then
			
			Self._processContent()
			Self._needsGarbageCollection = 2
		EndIf
	EndMethod
	
	Method _processStdioHeader(line:String = Null) ' line for any custom header line
		
		' Did we want to process a custom line?
		If Not line line = Self._lastStdioLine ' Use last stdio line
		If Not line Return ' Looks like we didn't want to do anything!
		
		'Self.Log("Processing header line - " + line)
		
		Local headerKey:String
		Local headerValue:String
		Local foundSeparator:Byte = False ' Is always a :
		
		' Go through each letter of the line and separate the key from the value
		For Local i:Int = 0 Until line.Length
			
			' Processing key or value?
			If foundSeparator Then
				
				' Value
				headerValue:+Chr(line[i])
			Else
				
				' Key
				If line[i] = ":"[0] Then ' Is this the separator?
					foundSeparator = True
					i:+1 ' Progress one letter to account for the space
				Else
					headerKey:+Chr(line[i])
				EndIf
			EndIf
		Next
		
		Self._processHeaderData(headerKey, headerValue)
	EndMethod
	
	Method _processHeaderData(key:String, value:String)
		
		' Check the header key - in lower case!
		Select key.ToLower()
			Case "content-length"
				' This tells us how much content to expect
				Self._expectedContentLength = Int(value)
			
			Case "content-type"
				' TODO: Support other types of data?
				'Self._expectedContentType = value
				' Function here to switch content type
				' For now we just notify that nothing else is supported
				If value.ToLower() <> Self._expectedContentType Then
					Self.Log( ..
						"Content-type ~q" + value + "~q is not supported! Only ~q" ..
						+ Self._expectedContentType + "~q is currently supported",  ..
						ELogType.Error ..
					)
				EndIf
				
			Default
				' Report that we don't know what the heck this is
				Self.Log("Unknown header - ~q" + key + "~q", ELogType.Warning)
		EndSelect
		
		' Skip the extra new line feed
		If StandardIOStream.ReadString(1)[0] <> 10 Self.Log( ..
			"Expected line feed after " + key + " was omitted!",  ..
			ELogType.Error)
	EndMethod
	
	Method _processContent(content:string = Null) ' content for any custom content
		
		' Did we want process custom content?
		If Not content content = Self._lastContentString ' Use last content string
		If Not content Return ' Looks like we didn't want to do anything!
		
		
		'Setup the JSON helper
		Self._jsonHelper:TJSONHelper = New TJSONHelper(content)
		
		' Cache the method name, in lower case!
		Self.LastMessageMethod = Self._jsonHelper.GetPathString("method").ToLower()
		Self.Log("Got message method - " + Self.LastMessageMethod)
		
		ExecuteLspMessage(Self)
		'Self._executeMessageFromJsonHelper()
		
		' Do NOT forget to reset this variable
		' Otherwise the update loop will not continue
		Self._expectedContentLength = Null ' This is important!
		Self._lastStdioLine = Null ' This is just to keep clean
	EndMethod
	
	Method Log(text:String, logType:ELogType = ELogType.Info, newLine:Byte = True, forceShow:Byte = False)
		
		' Only actually log stuff if we have the stream for it
		If Self._logStream Then
			
			' Is this a continuation on an existing line?
			If Self._lastLogHadNewLine Then
				
				' Check the log level or if forced message
				If Not forceShow And Self.LogLevel > logType.Ordinal() Then Return
				If Not forceShow Or forceShow And logType.Ordinal() > 0 Then
					' Prepend type of message
					Self._logStream.WriteString(logType.ToString() + ": ")
				EndIf
			EndIf
			
			' Write the actual message
			Self._logStream.WriteString(text)
			If newLine Self._logStream.WriteString("~r~n") ' New line?
			If Self.PrintLog Print(text)
			
			' Store if this line had a new line
			' and if the next one will be a continuation
			Self._lastLogHadNewLine = newLine
			
			' Always flush
			Self._logStream.Flush()
		EndIf
	EndMethod
	
	Method WasTerminated:Byte()
		
		Return Self._isTerminated
	EndMethod
	
	Method Terminate()
		
		Self._isTerminated = True
		
		' Log the ending time
		Self.Log("Log end " + CurrentDate() + " " + CurrentTime(),, , True)
		
		' Cleaning!
		'If Self._jsonHelper Self._jsonHelper.Delete()
		Self._jsonHelper = Null
		
		If Self._logStream Self._logStream.Close()
		Self._logStream = Null
		
		GCCollect()
	EndMethod
EndType

' Enumerator for log message types
Enum ELogType
	
	Info	' Rename to debug?
	Warning
	Error
EndEnum