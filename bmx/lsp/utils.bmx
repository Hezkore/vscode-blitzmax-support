SuperStrict

Import brl.retro

Function UriToPath:String(uri:String)
	
	If uri.Contains("file:///") ..
		Return uri.Split("file:///")[1]
		
	Return uri
EndFunction

Function CurrentUnixTime:Long()
	
	Return time_(Null)
EndFunction

Struct SPosition
	
	Field Line:Int
	Field Character:Int
	Field Length:Int
	
	Method New(character:Int, line:Int, length:Int)
		Self.Line = line
		Self.Character = character
		Self.Length = Length
	EndMethod
EndStruct