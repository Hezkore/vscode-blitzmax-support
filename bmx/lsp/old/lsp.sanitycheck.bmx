Function LspSanityCheck:Byte(lsp:TLsp)
	
	' First things first...
	If Not lsp Return False
	
	' Does this LSP have even have its JSON ready?
	If Not lsp._jsonHelper Then
		lsp.Log("Tried to execute method from empty JSON", ELogType.Warning)
		Return False
	EndIf
	
	' Okay... and does it have the cached method name?
	If Not lsp.LastMessageMethod Then
		' Apparently not... can we cache it now?
		lsp.LastMessageMethod = lsp._jsonHelper.GetPathString("method").ToLower()
		' Did it work?
		If Not lsp.LastMessageMethod Then
			lsp.Log("Tried to execute empty method", ELogType.Warning)
			Return False
		EndIf
	EndIf
	
	' All seems good, let's go!
	Return True
EndFunction