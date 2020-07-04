' Simple way to view some text output
' TODO: Better way of updating the textarea
' TODO: Use string list

SuperStrict

Import MaxGui.Drivers
Import brl.threads
Import brl.eventqueue
Import brl.linkedlist

Global Debugger:TDebugger = New TDebugger
?debug
	Type TDebugger
		
		Field _thread:TThread
		Field _textArea:TGadget
		Field _window:TGadget
		Field _logStack:TList
		Field _mutex:TMutex
		Field _isTerminated:Byte = False
		
		Method New()
			
			Self._logStack = CreateList()
			Self._mutex = CreateMutex()
			Self._thread = CreateThread(DebuggerMain, Self)
		EndMethod
		
		Method Log(text:String)
			
			LockMutex(Self._mutex)
			_logStack.AddLast(text)
			UnlockMutex(Self._mutex)
		EndMethod
		
		Method Free()
			
			Self._isTerminated = True
		EndMethod
		
		Function DebuggerMain:Object(data:Object)
			
			Local instance:TDebugger = TDebugger(data)
			
			instance._window = CreateWindow("BlitzMax LSP Debug", 0, 0,  ..
				Int(DesktopWidth() * 0.2), Int(DesktopHeight() * 0.75))
			
			instance._textarea:TGadget = CreateTextArea( ..
				0, 0, ClientWidth(instance._window), ClientHeight(instance._window), instance._window,..
				TEXTAREA_READONLY)'|TEXTAREA_WORDWRAP)
			SetGadgetLayout(instance._textarea, EDGE_ALIGNED, EDGE_ALIGNED, EDGE_ALIGNED, EDGE_ALIGNED)
			
			While Not instance._isTerminated
				
				If instance._logStack.Count() > 0 Then
					LockMutex(instance._mutex)
					SetGadgetText(instance._textArea, GadgetText(instance._textArea) + ..
						String(instance._logStack.RemoveFirst()))
					UnlockMutex(instance._mutex)
					SelectTextAreaText(instance._textArea, instance._textArea.GetText().Length)
				EndIf
				
				While PollEvent()
					Select EventID()
						Case EVENT_WINDOWCLOSE
							'End
						Case EVENT_APPTERMINATE
							'End
					EndSelect
				Wend
				
				Delay(5)
			Wend
			
			End
		EndFunction
	EndType
?Not Debug
	Type TDebugger
		Method Log(text:String)
		EndMethod
		Method Free()
		EndMethod
	EndType
?