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
	
	Field x:Int
	Field y:Int
	Field length:Int
	
	Method New(x:Int, y:Int, length:Int)
		Self.x = x
		Self.y = y
		Self.length = length
	EndMethod
EndStruct