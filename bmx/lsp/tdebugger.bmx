' Simple way to view some text output
' TODO: Better way of updating the textarea
' TODO: Use string list

SuperStrict

Import MaxGui.Drivers
Import maxgui.win32maxguiex
'Import MaxGUI.MaxGUITextAreaScintilla
Import brl.threads
Import brl.eventqueue
Import brl.linkedlist

Global Debugger:TDebugger = New TDebugger
?debug
	Type TDebugger
		
		Const MENU_SHOWSEND:Byte = 101
		Const MENU_SHOWRECEIVE:Byte = 102
		
		Field _thread:TThread
		Field _msgComboBox:TGadget
		Field _msgTextArea:TGadget
		Field _logTextArea:TGadget
		Field _window:TGadget
		Field _logStack:TList
		Field _messageStack:TList
		Field _mutex:TMutex
		Field _isTerminated:Byte = False
		Field _menu:TGadget
		Field _menuShowSend:TGadget
		Field _menuShowReceive:TGadget
		Field _font:TGuiFont
		Field ShowSend:Byte = True
		Field ShowReceive:Byte = True
		
		Method New()
			
			Self._logStack = CreateList()
			Self._messageStack = CreateList()
			Self._mutex = CreateMutex()
			Self._thread = CreateThread(DebuggerMain, Self)
		EndMethod
		
		Method Log(text:String)
			
			LockMutex(Self._mutex)
			Self._logStack.AddLast(text)
			UnlockMutex(Self._mutex)
		EndMethod
		
		Method StoreMessage(name:String, data:String, sent:Byte)
			
			If Not Self.ShowSend And sent Return
			If Not Self.ShowReceive And Not sent Return
			
			LockMutex(Self._mutex)
			Self._messageStack.AddLast(New TDebuggerMessage( ..
				name, data, sent))
			UnlockMutex(Self._mutex)
		EndMethod
		
		Method Free()
			
			Self._isTerminated = True
		EndMethod
		
		Function DebuggerMain:Object(data:Object)
			
			Local instance:TDebugger = TDebugger(data)
			
			instance._window = CreateWindow("BlitzMax LSP Debug", 0, 8,  ..
				Int(DesktopWidth() * 0.2), Int(DesktopHeight() * 0.75), Desktop(), ..
				WINDOW_RESIZABLE | WINDOW_TOOL | WINDOW_TITLEBAR | WINDOW_MENU)
			
			instance._font = LookupGuiFont(GUIFONT_MONOSPACED, 9, FONT_BOLD)
			
			instance._msgComboBox = CreateComboBox(0, 0,  ..
				ClientWidth(instance._window), 26, instance._window, 0)
			
			instance._msgTextArea = CreateTextArea(0, GadgetHeight(instance._msgComboBox),  ..
				ClientWidth(instance._window), ClientHeight(instance._window) / 2, instance._window,  ..
				TEXTAREA_READONLY)
			SetTextAreaFont(instance._msgTextArea, instance._font)
			
			instance._logTextArea:TGadget = maxgui_driver.CreateGadget(GADGET_TEXTAREA, "", 0,  ..
				GadgetY(instance._msgTextArea) + GadgetHeight(instance._msgTextArea),  ..
				ClientWidth(instance._window),  ..
				ClientHeight(instance._window) - GadgetY(instance._msgTextArea) - GadgetHeight(instance._msgTextArea),  ..
				instance._window, TEXTAREA_READONLY)' | TEXTAREA_WORDWRAP)
			SetTextAreaFont(instance._logTextArea, instance._font)
			SetGadgetLayout(instance._logTextArea, EDGE_ALIGNED, EDGE_ALIGNED, EDGE_ALIGNED, EDGE_ALIGNED)
			
			instance._menu = CreateMenu("&Filter", 0, WindowMenu(instance._window))
			instance._menuShowSend = CreateMenu("Show &sent messages",  ..
				TDebugger.MENU_SHOWSEND, instance._menu)
			instance._menuShowReceive = CreateMenu("Show &received messages",  ..
				TDebugger.MENU_SHOWRECEIVE, instance._menu)
			instance.UpdateMenuChecks()
			UpdateWindowMenu(instance._window)
			
			While Not instance._isTerminated
				
				' Add any log message
				While instance._logStack.Count() > 0
					LockMutex(instance._mutex)
					AddTextAreaText(instance._logTextArea, String(instance._logStack.RemoveFirst()))
					UnlockMutex(instance._mutex)
				Wend
				
				' Add any lsp messages
				While instance._messageStack.Count() > 0
					LockMutex(instance._mutex)
					Local message:TDebuggerMessage = TDebuggerMessage( ..
						instance._messageStack.RemoveFirst())
					If message.Sent Then
						message.Name = message.Name + " > to client"
					Else
						message.Name = message.Name + " < from client"
					EndIf
					AddGadgetItem(instance._msgComboBox, message.Name,  ..
						instance._msgComboBox.ItemCount() <= 0,,, message)
					If instance._msgComboBox.ItemCount() = 1 ..
						instance.UpdateMessageBox()
					UnlockMutex(instance._mutex)
				Wend
				
				While PollEvent()
					Select EventID()
						Case EVENT_GADGETACTION
							If EventSource() = instance._msgComboBox ..
								instance.UpdateMessageBox()
						
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
		
		Method UpdateMessageBox()
			SetGadgetText(Self._msgTextArea,  ..
				TDebuggerMessage(Self._msgComboBox.ItemExtra( ..
					Self._msgComboBox.SelectedItem())).Data)
			TextAreaHighlight(Self._msgTextArea)
		EndMethod
	EndType
?Not Debug
	Type TDebugger
		Field ShowSend:Byte = False
		Field ShowReceive:Byte = False
		Method Log(text:String)
		EndMethod
		Method StoreMessage(name:String, data:String)
		EndMethod
		Method Free()
		EndMethod
	EndType
?

Type TDebuggerMessage
	Field Name:String
	Field Data:String
	Field Sent:Byte
	
	Method New(name:String, data:String, sent:Byte)
		
		Self.Name = name
		Self.Data = data
		Self.Sent = sent
	EndMethod
EndType