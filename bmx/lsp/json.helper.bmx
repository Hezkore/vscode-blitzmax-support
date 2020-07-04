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
		if not json 
			defaultJSON = New TJSONObject.Create()
		else
			defaultJSON = TJSON.Load(json, 0, jsonError)
		EndIf
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

	
	'splits "key[index]" into [key, index]
	Function _SplitArrayIndex:String[](path:String)
		Local result:String[2]
		result[1] = -1
		
		Local arrayIndexStart:Int = path.FindLast("[")
		If arrayIndexStart >= 0 
			Local arrayIndexEnd:Int = path.FindLast("]")
			If arrayIndexStart < arrayIndexEnd
				result[1] = path[arrayIndexStart + 1 ..][.. arrayIndexEnd - arrayIndexStart]
				result[0] = path[.. arrayIndexStart]
			EndIf
		EndIf
		Return Result
	End Function


	Function _SplitArrayIndex2(path:String, key:String var, index:Int var)
		index = -1
		key = path
		
		Local arrayIndexStart:Int = path.FindLast("[")
		If arrayIndexStart >= 0 
			Local arrayIndexEnd:Int = path.FindLast("]")
			If arrayIndexStart < arrayIndexEnd
				index = int(path[arrayIndexStart + 1 ..][.. arrayIndexEnd - arrayIndexStart])
				key = path[.. arrayIndexStart]
			EndIf
		EndIf
	End Function
	
	
	Function _SplitPathAndKey:String[](path:String)
		Local result:String[2]
		Local lastSplit:Int = path.FindLast("/")
		'print "_SplitPath: " + path + "     lastSplit="+lastSplit
		If lastSplit = -1
			result[0] = path
			result[1] = ""
			Return result
		EndIf
		result[0] = path[.. lastSplit]
		result[1] = path[lastSplit + 1 ..]
		
		Return result
	End Function


	'paths are elements whose last "part" is a container (jsonarray or jsonobject) 
	Function _EnsurePathExistence:TJSON(path:String, json:TJSON)
		Local lastJSON:TJSON = json
		local lastPath:String
		
		If not lastJSON Then Throw "invalid JSON object passed to _EnsurePathExistence"

		local lastIndex:Int = -1
		local lastKey:String
		local currentPath:String
		For local pathPart:String = EachIn path.Split("/")
			local key:String
			local index:Int
			local currentJSON:TJSON
			_SplitArrayIndex2(pathPart, key, index)

			lastPath = currentPath
			if currentPath Then currentPath :+ "/"
			currentPath :+ pathPart

			'check if element exists already
			If TJSONObject(lastJSON)
				currentJSON = TJSONObject(lastJSON).Get(key)
			ElseIf TJSONArray(lastJSON)
				currentJSON = TJSONArray(lastJSON).Get(index)
			EndIf

			If not currentJSON
				'current will be an array?
				If index >= 0
					currentJSON = new TJSONArray.Create()
					'print "element not existing. Path="+currentPath + "   created array."
				Else
					currentJSON = new TJSONObject.Create()
					'print "element not existing. Path="+currentPath + "   created obj."
				EndIf
				
				If TJSONObject(lastJSON)
					If TJSONObject(lastJSON).Set(key, currentJSON) = -1
						Throw "Failed to set new child element"
					EndIf
				ElseIf TJSONArray(lastJSON)
					If TJSONArray(lastJSON).Insert(lastIndex, currentJSON) = -1
						Throw "Failed to insert new array element at index="+lastIndex
					EndIf
				EndIf
				
			EndIf

'			print "lastPath :" + lastPath
'			print "lastJSON :" + lastJSON.SaveString()
'			print "    JSON :" + json.SaveString()
'			print "---------"

			'either -1 or the index used in this loop
			lastIndex = index
			lastKey = key
			
			lastJSON = currentJSON
		Next

		Return lastJSON
	End Function
	

	Method EnsurePathExistence:TJSON(path:String, json:TJSON = Null)
		if not json then json = defaultJSON
		Return _EnsurePathExistence(path, json)
	End Method

	
	Function _SetJSONElement(path:String, element:TJSON, json:TJSON)
		Local pathSplit:String[] = _SplitPathAndKey(path)
		'first level entries
		if not pathSplit[1]
			pathSplit[1] = pathsplit[0]
			pathSplit[0] = ""
		endif

		Local parentPath:String = pathSplit[0]
		Local key:String
		Local index:Int


		_SplitArrayIndex2(pathSplit[1], key, index)
			


		local parentKey:String
		Local parentIndex:Int
		_SplitArrayIndex2(parentPath, parentKey, parentIndex)

		'check path and create if required
		If parentPath
			json = _EnsurePathExistence(parentPath, json)
		EndIf

		'assign new value
		If index >= 0 'array?
			'create/fetch array node first
			local arrayJSON:TJSON
			if TJSONObject(json)
				arrayJSON = TJSONObject(json).Get(key)
				if not arrayJSON then arrayJSON = new TJSONArray.Create()
				TJSONObject(json).Set(key, arrayJSON)
			elseif TJSONArray(json)
				arrayJSON = TJSONArray(json).Get(parentIndex)
				if not arrayJSON then arrayJSON = new TJSONArray.Create()
				if TJSONArray(json).Get(parentIndex)
					TJSONArray(json).Set(parentIndex, arrayJSON)
				else
					TJSONArray(json).Insert(parentIndex, arrayJSON)
				endif
			else
				Throw "Trying to add to unsupported json type"
			EndIf
			json = arrayJSON


			'assign value to either object or array
			If TJSONObject(json)
				TJSONObject(json).Set(key, element)
			ElseIf TJSONArray(json)
				'either set or insert depending on existence
				if TJSONArray(json).Get(index)
					TJSONArray(json).Set(index, element)
				else
					TJSONArray(json).Insert(index, element)
				endif
			EndIf
		Else
			If TJSONObject(json)
				TJSONObject(json).Set(key, element)
'				print "  add to object: key="+key
			ElseIf TJSONArray(json)
				if parentIndex
					local arrayJSON:TJSON = TJSONArray(json).Get(parentIndex)
					if not arrayJSON then Throw "array not found"
					if TJSONArray(json).Get(parentIndex)
						TJSONArray(json).Set(parentIndex, arrayJSON)
					else
						TJSONArray(json).Insert(parentIndex, arrayJSON)
					endif
				else
					TJSONArray(json).Append(element)
				endif
'				print "  append to array"
			Else
				Throw "Cannot add child element to non-array and non-object json nodes."
			EndIf
'			print "  => object json value="+json.SaveString()
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

	Method ToStringCompact:String()
		if defaultJSON Then Return defaultJSON.SaveString(JSON_COMPACT, 0)
		Return "" 
	End Method
End Type