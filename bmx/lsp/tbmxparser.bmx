SuperStrict

Import brl.map
Import brl.vector

Import "utils.bmx"
Import "tlogger.bmx"
Import "tdocumentmanager.bmx"

Global BmxParser:TBmxParser = New TBmxParser
Type TBmxParser
	
	Field _parsed:TStringMap
	Field _parsingQueue:TList
	Field _parsingThreads:TList
	Field _maxParsingThreads:Int = 2
	Field _mutex:TMutex
	
	Method New()
		
		Self._parsed = New TStringMap
		Self._parsingQueue = CreateList()
		Self._parsingThreads = CreateList()
		Self._mutex = CreateMutex()
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
		
		Self.Result = New TParsedBmx
		
		For Local i:Int = 0 Until text:String
			
		Next
		
		' Just add random stuff for now
		AddBmxItem("MyFunction", EBmxItemType.BmxFunction, New SPosition(0, 0, 0))
	EndMethod
	
	Method AddBmxItem(name:String, bmxType:EBmxItemType, position:SPosition)
		
		Result.Items.AddLast(New TParsedBmxItem(name, bmxType, position))
	EndMethod
EndType

Type TParsedBmx
	
	Field ParseTime:Long
	Field Path:String
	Field Items:TList
	
	Method New()
		
		Self.Items = CreateList()
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

Enum EBmxItemType
	
	BmxFunction
	BmxMethod
EndEnum