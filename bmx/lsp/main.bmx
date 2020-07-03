' BlitzMax LSP
' Specs: https://microsoft.github.io/language-server-protocol/specifications/specification-current

SuperStrict

Framework brl.standardio

Import "tconfig.bmx"
Import "tlsp.bmx"
Import "tlogger.bmx"
Import "tdatamanager.bmx"

' Version
Global Version:String = "0.1"

' Setup the logger
Logger = New TLogger("lsp-output.txt")

' Read config
Config.ProcessConfigFile("lsp-config.ini") ' JSON?
Config.ProcessAppArgs()

' Is this a LSP session or do we just print info?
If Not Config.Get("islsp") Then
	Print("BlitzMax NG Language Server Protocol")
	Print("Version " + Version)
	Print()
	Config.PrintConfigItems()
	
	Logger.Free()
	Config.Free()
	
	Delay(500)
	End
EndIf

' Just announce what we'll be logging
Logger.NotifyLogLevel()

' Setup the data manager
DataManager = New TDataManager()

' Setup LSP
Local lsp:TLsp = New TLsp()

' Main loop
While lsp.Running()
	
	lsp.Update()
	DataManager.Update()
	
	Local testMsg:TDataMessage = DataManager.GetNextMessage()
	If testMsg Then
		Logger.Log("Got message - " + testMsg._method)
	EndIf
Wend

' Exit
'If Not lsp.WasTerminated() lsp.Terminate()
End