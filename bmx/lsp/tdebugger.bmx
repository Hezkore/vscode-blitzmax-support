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
		
		Const MENU_SHOWSEND:Byte = 101
		Const MENU_SHOWRECEIVE:Byte = 102
		
		Field _thread:TThread
		Field _textArea:TGadget
		Field _window:TGadget
		Field _logStack:TList
		Field _mutex:TMutex
		Field _isTerminated:Byte = False
		Field _menu:TGadget
		Field _menuShowSend:TGadget
		Field _menuShowReceive:TGadget
		Field ShowSend:Byte = True
		Field ShowReceive:Byte = True
		
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
				Int(DesktopWidth() * 0.2), Int(DesktopHeight() * 0.75), Desktop(), ..
				WINDOW_RESIZABLE | WINDOW_TOOL | WINDOW_TITLEBAR | WINDOW_MENU)
			
			instance._textarea:TGadget = CreateTextArea( ..
				0, 0, ClientWidth(instance._window), ClientHeight(instance._window), instance._window,..
				TEXTAREA_READONLY)'|TEXTAREA_WORDWRAP)
			SetGadgetLayout(instance._textarea, EDGE_ALIGNED, EDGE_ALIGNED, EDGE_ALIGNED, EDGE_ALIGNED)
			
			instance._menu = CreateMenu("&Filter", 0, WindowMenu(instance._window))
			instance._menuShowSend = CreateMenu("Show &sent messages",  ..
				TDebugger.MENU_SHOWSEND, instance._menu)
			instance._menuShowReceive = CreateMenu("Show &received messages",  ..
				TDebugger.MENU_SHOWRECEIVE, instance._menu)
			instance.UpdateMenuChecks()
			UpdateWindowMenu(instance._window)
			
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
						Case EVENT_MENUACTION
							Select EventSource()
								Case instance._menuShowSend
									instance.ShowSend = Not instance.ShowSend
								Case instance._menuShowReceive
									instance.ShowReceive = Not instance.ShowReceive
							EndSelect
							instance.UpdateMenuChecks()
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
		
		Method UpdateMenuChecks()
			If Self.ShowSend CheckMenu(Self._menuShowSend)..
				Else UncheckMenu(Self._menuShowSend)
			If Self.ShowReceive CheckMenu(Self._menuShowReceive) ..
				Else UncheckMenu(Self._menuShowReceive)
		EndMethod
	EndType
?Not Debug
	Type TDebugger
		Field ShowSend:Byte = False
		Field ShowReceive:Byte = False
		Method Log(text:String)
		EndMethod
		Method Free()
		EndMethod
	EndType
?