SuperStrict

Import brl.map
Import brl.vector

Import "tmessagehandler.bmx"
Import "utils.bmx"
Import "tlogger.bmx"
Import "tdocumentmanager.bmx"

Function OnDidChangeHook(msg:TLSPMessage)
	
	If msg.IsSending Return
	
	BmxParser.Parse( ..
		UriToPath(msg.GetParamString( ..
			"textDocument/uri")))
EndFunction

Global BmxParser:TBmxParser = New TBmxParser
Type TBmxParser
	
	Field _parsed:TStringMap
	Field _parsingQueue:TList
	Field _parsingThreads:TList
	Field _maxParsingThreads:Int = 2
	Field _mutex:TMutex
	
	Field _itemParsers:TList
	
	Method New()
		
		Self._parsed = New TStringMap
		Self._parsingQueue = CreateList()
		Self._parsingThreads = CreateList()
		Self._mutex = CreateMutex()
		Self._itemParsers = CreateList()
		MessageHandler.RegisterHook("textDocument/didChange", OnDidChangeHook)
	EndMethod
	
	Method Parse(path:String)
		
		' Oh god, I'm in no position to do this
		
		' Is this already in the queue?
		For Local p:TParseQueueRequest = EachIn Self._parsingQueue
			
			If p.Path = path Then
				Logger.Log("File already in parse queue: " + path)
				Return
			EndIf
		Next
		
		' Find if already parsed
		Local parsed:TParsedBmx = Self.GetParsed(path)
		' If not parsed; we try to load a cached version from disk
		If Not parsed Then parsed = Self.LoadParsed(path)
		
		' Has it actually been changed?
		If parsed Then
			If parsed.ParseTime = ..
				DocumentManager.GetModifyDate(path) Then
				Logger.Log("Parsed file is already up to date: " + path)
				Return
			EndIf
		EndIf
		
		' Okay, all attempts failed!
		' Guess we need to parse this file
		Self._parse(path)
	EndMethod
	
	Method _parse(path:String)
		
		' Is this item already being parsed?
		Self._mutex.Lock()
		For Local p:TParseThread = EachIn Self._parsingThreads
			
			If p.CanRestart And p.Path = path Then
				
				p.WantsRestart = True
				Logger.Log("Parsing process will restart for: " + path)
				Return
			EndIf
		Next
		Self._mutex.Unlock()
		
		Local parseRequest:TParseQueueRequest = New TParseQueueRequest
		parseRequest.Path = path
		Self._parsingQueue.AddLast(parseRequest)
	EndMethod
	
	Method Update()
		
		' Check for threads that are done
		For Local p:TParseThread = EachIn Self._parsingThreads
			If Not p.Thread.Running Then
				' Grab all the data we got and remove
				
				Self._parsed.Insert(p.Path, p.Result)
				Self._parsingThreads.Remove(p)
			EndIf
		Next
		
		
		' Do we have space for another parse job?
		If Self._parsingThreads.Count() >= Self._maxParsingThreads ..
			Return
		
		' Looks like we do!
		' Grab the first job from the queue
		If Self._parsingQueue.Count() > 0 Then
			Self._mutex.Lock()
			Local parseThread:TParseThread = New TParseThread(TParseQueueRequest(Self._parsingQueue.RemoveFirst()).Path)
			Self._parsingThreads.AddLast(parseThread)
			parseThread.Thread = CreateThread(TParseThread.Main, parseThread)
			Self._mutex.Unlock()
		EndIf
	EndMethod
	
	Method GetParsed:TParsedBmx(path:String)
		
		Return TParsedBmx(Self._parsed.ValueForKey(path))
	EndMethod
	
	Method LoadParsed:TParsedBmx(path:String)
		
		Return Null
	EndMethod
	
	Method SaveParsed(parsed:TParsedBmx, path:String)
		
	EndMethod
EndType

Type TParseQueueRequest
	
	Field Path:String
EndType

' FIX: All of the above needs a custom LOG method!
' (do we even need to log from here?)
Type TParseThread
	
	Field Thread:TThread
	Field Path:String
	Field CanRestart:Byte = True
	Field WantsRestart:Byte = False
	Field Result:TParsedBmx
	
	Function Main:Object(data:Object)
		
		Local instance:TParseThread = TParseThread(data)
		Logger.Log("Parsing: " + instance.path)
		
		Repeat
			If instance.WantsRestart ..
				Logger.Log("Re-parsing: " +instance.Path)
			instance.WantsRestart = False
			instance.Parse(DocumentManager.GetTextFromAny(instance.path))
		Until Not instance.WantsRestart
		
		
		Logger.Log("Parsing complete")
	EndFunction
	
	Method New(path:String)
		
		Self.Path = path
	EndMethod
	
	Method Parse(text:String)
		
		Self.Result = New TParsedBmx(Self.Path)
		Self.Result.Text = text
		
		Local InString:Byte
		Local LineNr:Long
		Local Char:String
		Local Word:TStringBuilder = New TStringBuilder
		Local LineWords:TList = CreateList()
		Local WordStart:Long
		Local WordSeparators:String[] = [" ", ".", "(", ")", "[", "]", "{", "}"]
		Local WordSeparator:String
		For Local i:Long = 0 Until text.Length
			Char = Chr(text[i])
			
			' Is this the end of a line?
			If Char = "~r" Continue
			If Char = "~n" Then
				If Word.Length > 0 Then
					'Logger.Log(Word.ToString())
					LineWords.AddLast(New TItemWord(Word.ToString(), WordStart, LineNr))
					Word = New TStringBuilder
				EndIf
				Self.ParseLine(TItemWord[] (LineWords.ToArray()), LineNr)
				LineWords.Clear()
				'Logger.Log("NEW LINE")
				LineNr:+1
				Continue
			EndIf
			
			' Is this a word separator?
			For WordSeparator = EachIn WordSeparators
				If Char = WordSeparator Then
					If Word.Length > 0 Then
						'Logger.Log(Word.ToString())
						LineWords.AddLast(New TItemWord(Word.ToString(), WordStart, LineNr))
						Word = New TStringBuilder
					EndIf
					Continue
				EndIf
			Next
			
			' Looks like it's just a character!
			If Word.Length <= 0 WordStart = i
			Word.AppendChar(text[i])
		Next
		If Word.Length > 0 Then LineWords.AddLast(New TItemWord(Word.ToString(), WordStart, LineNr))
		If LineWords.Count() > 0 Self.ParseLine(TItemWord[] (LineWords.ToArray()), LineNr)
		
	EndMethod
	
	Method ParseLine(words:TItemWord[], lineNr:Long)
		
		If words.Length <= 0 Return
		
		'Logger.Log("Finding match for line: ",, False)
		'For Local w:TItemWord = EachIn Words
		'	Logger.Log(w.Word,, False)
		'Next
		'Logger.Log("")
		
		For Local i:TItemParser = EachIn BmxParser._itemParsers
			
			' Just try each and every one until we get a Return True
			If i.OnLine(words, Self.Result) Then Return
		Next
		
		'Logger.Log("Unknown line at " + lineNr + ": ", ELogType.Warn, False)
		'For Local w:TItemWord = EachIn words	
		'	Logger.Log(w.Word + " ",, False)
		'Next
		'Logger.Log("",, True)
	EndMethod
EndType

Type TParsedBmx
	
	Field ParseTime:Long
	Field Path:String
	Field Text:String
	Field Items:TList
	Field Imports:TList
	Field Includes:TList
	
	Method New(path:String)
		
		Self.Path = path
		Self.Items = CreateList()
		Self.Imports = CreateList()
		Self.Includes = CreateList()
	EndMethod
	
	Method AddItem(name:String, bmxType:EBmxItemType, position:SPosition)
		
		Self.Items.AddLast(New TParsedBmxItem(name, bmxType, position))
	EndMethod
EndType

Type TParsedBmxItem
	
	Field BmxType:EBmxItemType
	Field Name:String
	Field Position:SPosition
	
	Method New(name:String, bmxType:EBmxItemType, position:SPosition)
		
		Self.Name = name
		Self.BmxType = bmxType
		Self.Position = position
	EndMethod
EndType

Type TItemWord
	
	Field Word:String
	Field Position:SPosition
	
	Method New(word:String, character:Long, line:Long)
		
		Self.Word = word
		Self.Position.Character = character
		Self.Position.Line = line
	EndMethod
EndType

Enum EBmxItemType
	
	DefineFunction
EndEnum

Type TItemParser Abstract
	
	Method OnLine:Byte(words:TItemWord[], bmx:TParsedBmx) Abstract
	
	Method New()
		Self.Register()
	EndMethod
	
	Method Register()
		
		BmxParser._itemParsers.AddLast(Self)
	EndMethod
EndType

New TItemParser_DefineFunction
Type TItemParser_DefineFunction Extends TItemParser
	
	Method OnLine:Byte(words:TItemWord[], bmx:TParsedBmx)
		
		' If the first word is Function, we know it's a definition
		If words[0].Word.ToLower() = "function" Then
			
			bmx.AddItem(words[1].Word, EBmxItemType.DefineFunction, words[0].Position)
			
			' Report that we're done
			Return True
		EndIf
	EndMethod
EndType