SuperStrict

Import "tlogger.bmx"

Global LSP:TLsp
Type TLsp
	
	Field _wantTerminate:Byte
		
	Method New()
		
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