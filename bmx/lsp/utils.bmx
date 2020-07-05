SuperStrict

Import brl.retro

Function UriToPath:String(uri:String)
	
	If uri.Contains("file:///") ..
		Return uri.Split("file:///")[1]
		
	Return uri
EndFunction