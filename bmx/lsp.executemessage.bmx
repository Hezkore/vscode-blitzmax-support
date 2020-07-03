Include "lsp.sanitycheck.bmx"

Function ExecuteLspMessage(lsp:TLsp)
	
	' Make sure everything is okay
	If Not LspSanityCheck(lsp) Return
	
	' Okay, do stuff depending on the message
	Select lsp.LastMessageMethod
		Case "initialize"
			' Right, this one's the big one!
			' But we're not quite there yet...
			lsp.Log("Yes, hello initialize message! We're not ready yet")
		
		Case "shutdown"
			' The client requestd a shutdown
			lsp.Log("Shutdown requested")
			lsp.Terminate()
		
		Default
			' We don't know what this is
			lsp.Log( ..
				"Unknown message method - " + lsp.LastMessageMethod,  ..
				ELogType.Warning)
	EndSelect
EndFunction