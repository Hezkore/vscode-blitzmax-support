' BlitzMax LSP
' Specs: https://microsoft.github.io/language-server-protocol/specifications/specification-current

SuperStrict

Framework brl.standardio

Import "tconfig.bmx"
Import "tlsp.bmx"
Import "tlogger.bmx"
Import "tdatamanager.bmx"
Import "tmessagehandler.bmx"
Import "tdebugger.bmx"
Import "tbmxparser.bmx"
Import "tcompletionmanager.bmx"
Import "utils.bmx"
Import "tblitzmax.bmx"

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

' Setup the messager handler

' Setup BlitzMax
Logger.Log("BlitzMax Path: " + BlitzMax.Path)

' Setup LSP
LSP = New TLsp()

' Main loop
While lsp.Running()
	Try
		lsp.Update()
		DataManager.Update()
		BmxParser.Update()
		CompletionManager.Update()
	Catch ex:Object
		' Just log any crazyness we might encouter and continue
		' Only works in debug?
		Logger.Log("BlitzMax Error ~q" + ex.ToString() + "~q", ELogType.Error)
	EndTry
Wend

' Exit
Config.Free()
DataManager.Free()
'MessageHandler.Free()
'LSP.Free()
Logger.Free()
Debugger.Free()
End