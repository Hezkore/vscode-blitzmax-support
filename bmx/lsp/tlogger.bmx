SuperStrict

Import brl.system

Import "tdebugger.bmx"

' Enumerator for log message types
Enum ELogType
	
	Info
	Warn
	Error
EndEnum

Global Logger:TLogger
Type TLogger
	
	Field _logPath:String
	Field _logStream:TStream
	Field _lastLogHadNewLine:Byte = True
	
	' Custom private setting for the logger
	Field LogLevel:Byte
	' Bad and slow, only use for panic debugging!
	Field PrintLog:Byte = False
	
	Method New(path:String)
		
		Self._logPath = path
	EndMethod
	
	Method LogDate(text:String)
		
		Self.Log(text + " " + CurrentDate(),, , True)
	EndMethod
	
	Method Log(text:String, logType:ELogType = ELogType.Info, newLine:Byte = True, forceShow:Byte = False)
		
		If Not Self._logStream Then
			
			Self._logStream:TStream = WriteStream(Self._logPath)
			
			' Log the starting time
			Self.LogDate("Log start")
		EndIf
		
		If Self._logStream Then
			
			' Is this a continuation on an existing line?
			If Self._lastLogHadNewLine Then
				
				' Check the log level or if forced message
				If Not forceShow And Self.LogLevel > logType.Ordinal() Then Return
				Self._logStream.WriteString("[")
				Debugger.Log("[")
				' Prepend type of message
				Self._logStream.WriteString(logType.ToString())
				Debugger.Log(logType.ToString())
				
				For Local i:Int = logType.ToString().Length Until 6
					Self._logStream.WriteString(" ")
					Debugger.Log(" ")
				Next
				
				Self._logStream.WriteString("- " + CurrentTime() + "] ")
				Debugger.Log("- " + CurrentTime() + "] ")
			EndIf
			
			' Write the actual message
			Self._logStream.WriteString(text)
			Debugger.Log(text)
			If newLine Then ' New line?
				Self._logStream.WriteString("~r~n")
				Debugger.Log("~r~n")
			EndIf
			
			If Self.PrintLog Print(text)
			
			' Store if this line had a new line
			' and if the next one will be a continuation
			Self._lastLogHadNewLine = newLine
			
			' Always flush
			Self._logStream.Flush()
		EndIf
	EndMethod
	
	Method NotifyLogLevel()
		
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
	
	Method Free()
		
		Self.LogDate("Log end")
		
		If Self._logStream Self._logStream.Close()
		Self._logStream = Null
	EndMethod
EndType