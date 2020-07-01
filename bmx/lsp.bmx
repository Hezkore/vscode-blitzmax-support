SuperStrict

Framework brl.standardio

Global stream:TStream = WriteStream("lsp-output.txt")
OnEnd(CleanUp)

Log("START")

Local count:Int
For Local arg:String = EachIn AppArgs
	Log("ARG" + Count + ": " + Arg)
	Count:+1
Next

Local stdinput:String
While True
	'Local c:String = StandardIOStream.ReadString(1)
	'If c Then Log(c + "(" + Asc(c) + ")")
	'Continue
	stdinput = StandardIOStream.ReadLine()

	If stdinput Then
		Log("GOT: " + stdinput)
		If stdinput.StartsWith("Content-Length: ") Then
			Local contLen:Int = Int(stdinput.Split(": ")[1])
			Local padding:Int = 1 ' There's two CHR(10) and ReadLine (above) stops at the first one, so we need to skip one
			StandardIOStream.ReadString(padding)
			ProcessContent(StandardIOStream.ReadString(contLen))
		EndIf
	EndIf
	Delay(100)
Wend

Function ProcessContent(content:String)
	Log("Processing: " + content)

	Local result:String = "{~qjsonrpc~q:~q2.0~q, ~qid~q:0}" ' Bare minimum repsonse it seems
	ToVSCode(result)
EndFunction

Function ToVSCode(content:String)
	StandardIOStream.WriteString("Content-Length: " + content.Length + Chr(10) + Chr(10))
	Log("SENT: " + "Content-Length: " + content.Length)
	StandardIOStream.WriteString(content)
	Log("Response: " + content)
	StandardIOStream.Flush()
EndFunction

Function CleanUp()
	Log("EOF")
	CloseStream(stream)
EndFunction

Function Log(str:String)
	WriteLine(stream, str)
	stream.Flush()
EndFunction