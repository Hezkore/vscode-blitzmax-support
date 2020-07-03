SuperStrict

Import Text.Json
Import Brl.StandardIO


Type TJSONHelper
	Field defaultJSON:TJSON
	Field jsonError:TJSONError
	 
	Method New(json:TJSONObject)
		defaultJSON = json
	End Method


	Method New(json:String)
		if not json then json = "{}"
		defaultJSON = TJSON.Load(json, 0, jsonError)
	End Method
	
	
	Method CreateDefault:TJSONHelper()
		defaultJSON = New TJSONObject.Create()
		Return self
	End Method
	
	
	Function _GetPathJSON:TJSON(path:String, json:TJSON)
		If Not json Then Return Null
		If Not path Then Return json
		
		local pathParts:String[] = path.split("/")
		local currentJSON:TJSON = json

		For local pathIndex:int = 0 until pathParts.length
			'array requested?
			Local arrayIndex:Int = -1
			Local arrayIndexStart:Int = pathParts[pathIndex].find("[")
			If arrayIndexStart >= 0 
				Local arrayIndexEnd:Int = pathParts[pathIndex].find("]")
				If arrayIndexStart < arrayIndexEnd
					arrayIndex = Int( pathParts[pathIndex][arrayIndexStart + 1 ..][.. arrayIndexEnd - arrayIndexStart])
				EndIf
			EndIf

			'print "processing: " + pathParts[pathIndex] +"    arrayIndex="+arrayIndex
			
			if arrayIndex >= 0
				local keyWithoutIndex:String = pathParts[pathIndex][.. arrayIndexStart]
				currentJSON = TJSONObject(currentJSON).Get(keyWithoutIndex)
				

				If TJSONArray(currentJSON) and TJSONArray(currentJSON).Size() > arrayIndex
					currentJSON = TJSONArray(currentJSON).Get(arrayIndex)
					'found valid for this path part
					Exit
				'iterate over keys of a key-value table to find the n-th element
				ElseIf TJSONObject(currentJSON) and TJSONObject(currentJSON).Size() > arrayIndex

					local childIndex:Int = 0
					local validChildJSON:TJSON
					For local childJSON:TJSON = EachIn TJSONObject(currentJSON)
						if childIndex = arrayIndex
							validChildJSON = childJSON
							Exit
						EndIf
						childIndex :+ 1
					Next
					If validChildJSON 
						currentJSON = validChildJSON
						'found valid for this path part
						Exit
					EndIf
				Else
					'cannot obj[x] for non arrays or non key-value lists
					Exit
				EndIf
			Else
				currentJSON = TJSONObject(currentJSON).Get( pathParts[pathIndex] )
			EndIf
			
			If currentJSON = Null Then exit
		Next
			
		return currentJSON
	End Function
	
	
	Function _HasPath:Int(path:String, json:TJSON)
		Return _GetPathJSON(path, json) <> Null
	End Function

	
	Method GetPathJSON:TJSON(path:String, json:TJSON = Null)
		if not json then json = defaultJSON
		Return _GetPathJSON(path, json)
	End Method

	
	Method HasPath:Int(path:String, json:TJSON = Null)
		if not json then json = defaultJSON
		Return _HasPath(path, json)
	End Method


	Method GetPathSize:Int(path:String, json:TJSON = Null)
		Local res:TJSON = GetPathJSON(path, json)
		if TJSONArray(res) Then return TJSONArray(res).Size()
		if TJSONObject(res) Then return TJSONObject(res).Size()
		Return 0
	End Method
	
	
	Method GetPathInteger:Long(path:String, json:TJSON = Null, defaultValue:Long = 0)
		Local res:TJSON = GetPathJSON(path, json)
		If Not TJSONInteger(res) Then return defaultValue
		
		Return TJSONInteger(res).Value()
	End Method


	Method GetPathReal:Double(path:String, json:TJSON = Null, defaultValue:Double = 0.0)
		Local res:TJSON = GetPathJSON(path, json)
		If Not TJSONReal(res) Then return defaultValue
		
		Return TJSONReal(res).Value()
	End Method


	Method GetPathBool:Int(path:String, json:TJSON = Null, defaultValue:Int = False)
		Local res:TJSON = GetPathJSON(path, json)
		If Not TJSONBool(res) Then return defaultValue
		
		Return TJSONBool(res).isTrue
	End Method


	Method GetPathString:String(path:String, json:TJSON = Null, defaultValue:String = "")
		Local res:TJSON = GetPathJSON(path, json)
		If Not TJSONString(res) Then return defaultValue
		
		Return TJSONString(res).Value()
	End Method
	
	
	'split "my/long/path[1]" into "my/long", "path" and "index"
	Function _SplitPath(path:String, base:String var, key:String var, index:Int var)
		Local lastSplit:Int = path.FindLast("/")
		'print "_SplitPath: " + path + "     lastSplit="+lastSplit
		If lastSplit = -1 
			base = path
			index = -1
			Return
		EndIf
		
		base = path[.. lastSplit]
		key = path[lastSplit + 1 ..]
		
		'array requested?
		index = -1

		Local arrayIndexStart:Int = key.find("[")
		If arrayIndexStart >= 0 
			Local arrayIndexEnd:Int = key.find("]")
			If arrayIndexStart < arrayIndexEnd
				index = Int( key[arrayIndexStart + 1 ..][.. arrayIndexEnd - arrayIndexStart])
				
				key = key[.. arrayIndexStart]
			EndIf
		EndIf
	End Function
	

	Function _SplitPathArray:String[](path:String)
		Local i:int
		Local res:String[] = new String[3]
		_SplitPath(path, res[0], res[1], i)
		res[2] = i
		Return res
	End Function
	
	
	Function _CheckPath:TJSON(path:String, json:TJSON, isArray:Int = False, createLastPathElement:Int = True)
		Local pathInfo:String[] = _SplitPathArray(path)
'print "_CheckPath: " + path
'print "    pathInfo[0]="+pathInfo[0]
'print "    pathInfo[1]="+pathInfo[1]
'print "    pathInfo[2]="+pathInfo[2]

		'ensure base path exists
		local basePath:String
		local baseJSON:TJSON = json
		local pathParts:String[] = pathInfo[0].split("/")
		For local pathPart:String = EachIn pathParts
			If basePath
				basePath :+ "/" + pathPart
			Else
				basePath :+ pathPart
			EndIf
			
			if pathPart.Find("[") >= 0 and pathPart.Find("]") >= 0
				_CheckPath(basePath, json, isArray, createlastPathElement)
			Endif

			if not _HasPath(basePath, json)
				If not TJSONObject(baseJSON) Then Throw "Base json object fail"

				local newElement:TJSON = new TJSONObject.Create()
				TJSONObject(baseJSON).Set(pathPart, newElement)
				baseJSON = newElement
			else
				If not TJSONObject(baseJSON) Then Throw "Base json object fail"
				baseJSON = TJSONObject(baseJSON).Get(pathPart)
			endif
		Next
		
		'ensure actual element exists
		If pathInfo[1] and createLastPathElement
			If not _HasPath(basePath + "/" + pathInfo[1], json)
				local newElement:TJSON
				If isArray
					newElement = new TJSONArray.Create()
				Else
					newElement = new TJSONObject.Create()
				EndIf

				If TJSONObject(baseJSON)
					TJSONObject(baseJSON).Set(pathInfo[1], newElement)
				ElseIf TJSONArray(baseJSON)
					TJSONArray(baseJSON).Set(int(pathInfo[2]), newElement)
				Else
					TJSONObject(baseJSON).Set(pathInfo[1], newElement)
				EndIf
				baseJSON = newElement
			EndIf
		EndIf

		Return baseJSON
	End Function

	
	'createLastPathElement : set to True if the last "path element" will
	'                        become an object/array node containing child
	'                        elements later on
	Method CheckPath:TJSON(path:String, json:TJSON = Null, isArray:Int = False, createLastPathElement:Int = False)
		if not json then json = defaultJSON
		Return _CheckPath(path, json, isArray)
	End Method

	
	Function _SetJSONElement(path:String, element:TJSON, json:TJSON)
		Local pathInfo:String[] = _SplitPathArray(path)

		'assign new value
		If pathInfo[2] >= 0 'array?
			'check path and create if required
			'print pathInfo[0] + "/" + pathInfo[1]
			json = _CheckPath(pathInfo[0], json, True, False)
			
			'create/fetch array node first
			if TJSONObject(json) 
				local arrayJSON:TJSON = TJSONObject(json).Get(pathInfo[1])
				if not arrayJSON
					'print "creating array"
					arrayJSON = new TJSONArray.Create()
					TJSONObject(json).Set(pathInfo[1], arrayJSON)
				EndIf
				json = arrayJSON
			EndIf


			If TJSONObject(json)
				TJSONObject(json).Set(pathInfo[1], element)
			ElseIf TJSONArray(json)
				if TJSONArray(json).Get(int(pathInfo[2]))
					TJSONArray(json).Set(int(pathInfo[2]), element)
				else
					TJSONArray(json).Insert(int(pathInfo[2]), element)
				endif
			EndIf
		Else
			json = _CheckPath(pathInfo[0] + "/" + pathInfo[1], json, False, False)
			If TJSONObject(json)
'print "  assign child to object: key="+pathInfo[1] +  " object value="+json.SaveString()
				TJSONObject(json).Set(pathInfo[1], element)
			ElseIf TJSONArray(json)
				TJSONArray(json).Set(Int(pathInfo[2]), element)
			Else
				Throw "Cannot add child element to non-array and non-object json nodes."
			EndIf
		EndIf
	End Function
	

	Method SetPathString:Int(path:String, value:String, json:TJSON = Null)
		if not json then json = defaultJSON
		_SetJSONElement(path, New TJSONString.Create(value), json)
	End Method


	Method SetPathInteger:Int(path:String, value:Long, json:TJSON = Null)
		if not json then json = defaultJSON
		_SetJSONElement(path, New TJSONInteger.Create(value), json)
	End Method


	Method SetPathBool:Int(path:String, value:Int, json:TJSON = Null)
		if not json then json = defaultJSON
		_SetJSONElement(path, New TJSONBool.Create(value), json)
	End Method


	Method SetPathBoolString:Int(path:String, value:String, json:TJSON = Null)
		if not json then json = defaultJSON
		if value.ToLower() = "true" or value = "1"
			_SetJSONElement(path, New TJSONBool.Create(true), json)
		else
			_SetJSONElement(path, New TJSONBool.Create(false), json)
		endif
	End Method

		
	Method ToString:String()
		if defaultJSON Then Return defaultJSON.SaveString(0, 2)
		Return "" 
	End Method
End Type