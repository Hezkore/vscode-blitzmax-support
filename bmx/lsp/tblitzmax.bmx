SuperStrict

Import "tconfig.bmx"
Import brl.maxutil

Global BlitzMax:TBlitzMax = New TBlitzMax
Type TBlitzMax
	
	Field _path:String
	
	Method New()
	EndMethod
	
	Method Path:String()
		
		If Not Self._path Then Self._setPath(Config.Get("BmxPath"))
		If Not Self._path Then
			Try
				Self._setPath(BlitzMaxPath())
			Catch ex:Object
				Self._setPath(CurrentDir() + "/../")
			EndTry
		EndIf
		
		Return Self._path
	EndMethod
	
	Method _setPath(path:String)
		Self._path = path
		If Not Self._path.EndsWith("/") Self._path:+"/"
	EndMethod
	
	Method ModPath:String()
			
		Return Self.Path() + "mod/"
	EndMethod
EndType

' BlitzMax Path
' Set the BlitzMax path manually
New TConfigItem_BlitzMaxPath
Type TConfigItem_BlitzMaxPath Extends TConfigItem
	
	Method New()
		
		Self.Description = "BlitzMax path"
		
		Self.KeyName = "BmxPath"
		Self.ArgName = "bmx"
		
		Self.Register()
	EndMethod
	
	Method OnChange(newValue:String)
		
		BlitzMax._setPath(newValue)
	EndMethod
	
	Method OnArg(value:String)
	EndMethod
EndType