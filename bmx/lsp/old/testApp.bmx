SuperStrict

Framework brl.standardio
Import brl.linkedlist



Type MyTestType
	Field someField:Int = 50
	Field stringArray:String[] = ["one", "two", "three"]
	Field arrayOfArrays:String[][] = [["one"], ["two"], ["three"]]
	Field MultiDimArray:Int[2,2]
	Field list:TList = CreateList()
	
	Method SomeMethod()
		MultiDimArray[0,0] = 0
		MultiDimArray[1,0] = 1
		MultiDimArray[0,1] = 3
		MultiDimArray[1,1] = 4
		list.AddLast( "Hello" )
		list.AddLast( "World" )
		DebugStop()
	EndMethod
EndType

Local testValue:Int = 100
Function hellur()
	Local funcValue:Float = 1.5
	Local typeTest:MyTestType = New MyTestType
	typeTest.SomeMethod()
	Print( "Okay, good" )
EndFunction
Print( "Hello world" )
Print( "This is a random string" )
Print( "Now let's do a debug stop!" )
hellur()
Print( "Now pause..." )
Delay(5000)
Print( "We're all done here!" )