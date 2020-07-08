SuperStrict

Import "tmessagehandler.bmx"
Import "tlogger.bmx"

Function OnShutdownHook(msg:TLSPMessage)
	
	Logger.Log("Shutdown requested")
	LSP.Terminate()
EndFunction

Global LSP:TLsp
Type TLsp
	
	Field _wantTerminate:Byte
		
	Method New()
		
		MessageHandler.RegisterHook("shutdown", OnShutdownHook)
	EndMethod
	
	Method Update()
		
	EndMethod
	
	Method Running:Byte()
		
		Return Not Self._wantTerminate
	EndMethod
	
	Method Terminate()
		
		Self._wantTerminate = True
	EndMethod
EndType