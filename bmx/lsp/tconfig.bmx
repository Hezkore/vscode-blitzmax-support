SuperStrict

Import brl.map
Import brl.collections

Import "tlogger.bmx"

Global Config:TConfig = New TConfig
Type TConfig
	
	Field _supportedConfigItems:TStack < TConfigItem >= New TStack < TConfigItem >
	Field _configuration:TMap = CreateMap()
	
	' TODO
	Method ProcessConfigFile(path:string)
		
	EndMethod
	
	Method ProcessAppArgs()
				
		' Go through all the app args and look for config items
		Local arg:String
		Local match:TConfigItem
		
		For Local i:Int = 1 Until AppArgs.Length
			If AppArgs[i].Length <= 2 Continue
			arg = AppArgs[i].ToLower()
			match = null
			
			' Aight, check against the config items
			For Local c:TConfigItem = Eachin Self._supportedConfigItems
				
				' Check if something matches the launch argument
				If arg.StartsWith("--") Then
					
					' Compare against the full/key name
					If c.KeyName = arg[2..] Then
						match = c
						Exit
					EndIf
				ElseIf arg.StartsWith("-") Then
					
					' Compare against the arg name
					If c.ArgName = arg[1..] Then
						match = c
						Exit
					EndIf
				Else
					
					' What is this?!
					Logger.Log("Expected argument but got ~q" + AppArgs[i] + "~q")
				EndIf
			Next
			
			' We found a match, now set it!
			If match Then
				
				' Is this just a trigger item?
				If match.HasValue Then
					' FIX: There needs to be a check here
					' to see if the next arg exists
					' DO NOT ASSUME IT EXISTS!
					
					match.OnArg(AppArgs[i + 1]) ' Oh, and trigger OnArg
					Self.Set(match.KeyName, AppArgs[i + 1])
					i:+1
				Else
					
					match.OnArg(Null)
				EndIf
			Else
				' Okay, no match was found
				' Skip its value and continue!
				Logger.Log("Unknown argument ~q" + AppArgs[i] + "~q", ELogType.Warn)
				i:+1
			EndIf
		Next
	EndMethod
	
	Method PrintConfigItems()
	
		Logger.Log("Printing usage information")
		
		Print("usage: " + AppArgs[0])
		Local text:String
		For Local c:TConfigItem = Eachin Self._supportedConfigItems
			
			text = ""
			Print(text)
			text:+"-" + c.ArgName
			If c.KeyName <> c.ArgName Then text:+"~t--" + c.KeyName
			text:+"~n~t" + c.Description
			Print(text)
		Next
	EndMethod
	
	Method Get:String(key:String)
		
		If Not Self._configuration.Contains(key) Return Null
		Return Self._configuration.ValueForKey(key.ToLower()).ToString()
	EndMethod
	
	Method Set:String(key:String, value:String, log:Byte = True)
		
		' Notify the config item if it's about to change
		key = key.ToLower()
		Local foundMath:Byte = False
		For Local c:TConfigItem = Eachin Self._supportedConfigItems
			If c.KeyName = key Then
				If c.Value <> value Then
					Logger.Log("Config ~q" + c.KeyName + "~q changed from " + ..
						c.Value + " to " + value)
					c.OnChange(value)
					c.Value = value
				EndIf
				foundMath = True
			EndIf
		Next
		If Not foundMath And log Then
			Logger.Log("Unknown setting - " + key, ELogType.Warn)
		EndIf
		
		Self._configuration.Insert(key, value)
	EndMethod
	
	Method Free()
		
	EndMethod
EndType

Type TConfigItem Abstract
	
	'Field Instance:TConfigItem
	
	Field KeyName:String = "Unknown" ' The KEY in configuration map
	Field ArgName:String ' Name the user can use to modify it via the AppArgs (blank for no change)
	Field Description:String = "Undefined config item" ' Short description
	Field DefaultValue:String ' Starting value if not set
	Field Value:String
	Field HasValue:Byte = True
	
	Method OnChange(newValue:String) Abstract
	Method OnArg(value:String) Abstract
	
	Method Register() Final
		
		Self.Value = Self.DefaultValue
		Self.KeyName = Self.KeyName.ToLower()
		Self.ArgName = Self.ArgName.ToLower()
		
		'Logger.Log("Registering config item - " + Self.KeyName + " (arg: " + Self.ArgName + ")")
		
		Config._supportedConfigItems.Push(Self)
		Config.Set(Self.KeyName, Self.DefaultValue)
	EndMethod
EndType

' LogLevel
' Filters out som log messages
New TConfigItem_LogLevel
Type TConfigItem_LogLevel Extends TConfigItem
	
	Method New()
		
		Self.Description = "0 Debug, Warn, Error | 1 Warn, Error | 2 Error"
		
		Self.KeyName = "loglevel"
		Self.ArgName = "loglevel"
		Self.DefaultValue = 0
		
		Self.Register()
	EndMethod
	
	Method OnChange(newValue:String)
		
		Logger.LogLevel = Byte(newValue)
	EndMethod
	
	Method OnArg(value:String)
	EndMethod
EndType

' Activate LSP
' Actually starts the LSP
New TConfigItem_StartLSP
Type TConfigItem_StartLSP Extends TConfigItem
	
	Method New()
		
		Self.Description = "Starts the language server"
		
		Self.KeyName = "lsp"
		Self.ArgName = "start"
		Self.HasValue = False
		
		Self.Register()
	EndMethod
	
	Method OnChange(newValue:String)
	EndMethod
	
	Method OnArg(value:String)
		
		Logger.Log("Starting LSP server")
		Config.Set("islsp", True, False)
	EndMethod
EndType

' LSP mode
' Use stdio.. or TCP in the future?
New TConfigItem_LSPMode
Type TConfigItem_LSPMode Extends TConfigItem
	
	Method New()
		
		Self.Description = "stdio | tcp(TODO)"
		
		Self.KeyName = "lspmode"
		Self.ArgName = "mode"
		Self.DefaultValue = "stdio"
		
		Self.Register()
	EndMethod
	
	Method OnChange(newValue:String)
	EndMethod
	
	Method OnArg(value:String)
	EndMethod
EndType

' Data stream thread idle time
' Let the CPU rest for a bit
New TConfigItem_DataStreamIdle
Type TConfigItem_DataStreamIdle Extends TConfigItem
	
	Method New()
		
		Self.Description = "Data stream thread idle time"
		
		Self.KeyName = "datastreamidle"
		Self.ArgName = "dsidle"
		Self.DefaultValue = 25
		
		Self.Register()
	EndMethod
	
	Method OnChange(newValue:String)
	EndMethod
	
	Method OnArg(value:String)
	EndMethod
EndType