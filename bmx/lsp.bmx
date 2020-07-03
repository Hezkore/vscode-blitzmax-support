' BlitzMax LSP
' Specs: https://microsoft.github.io/language-server-protocol/specifications/specification-current

SuperStrict

Framework brl.standardio

Import "tlsp.bmx"

' Setup LSP
Local myLsp:TLsp = New TLsp()

' Main loop
While myLsp.Running()
	
	myLsp.Update()
Wend

' Exit
If Not myLsp.WasTerminated myLsp.Terminate()
End