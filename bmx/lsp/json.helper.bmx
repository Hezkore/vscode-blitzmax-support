SuperStrict

Import Text.Json
Import Brl.StandardIO
Import brl.reflection


Type TJSONHelper
	Field defaultJSON:TJSON
	Field jsonError:TJSONError
	 
	Method New(json:TJSONObject)
		defaultJSON = json
	End Method


	Method New(json:String)
		If Not json 
			defaultJSON = New TJSONObject.Create()
		Else
			defaultJSON = TJSON.Load(json, 0, jsonError)
		EndIf
	End Method
	
	
	Method CreateDefault:TJSONHelper()
		defaultJSON = New TJSONObject.Create()
		Return Self
	End Method
	
	
	Function _GetPathJSON:TJSON(path:String, json:TJSON)
		If Not json Then Return Null
		If Not path Then Return json
		
		Local pathParts:String[] = path.split("/")
		Local currentJSON:TJSON = json

		For Local pathIndex:Int = 0 Until pathParts.length
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
			
			If arrayIndex >= 0
				Local keyWithoutIndex:String = pathParts[pathIndex][.. arrayIndexStart]
				currentJSON = TJSONObject(currentJSON).Get(keyWithoutIndex)
				

				If TJSONArray(currentJSON) And TJSONArray(currentJSON).Size() > arrayIndex
					currentJSON = TJSONArray(currentJSON).Get(arrayIndex)
					'found valid for this path part
'					Exit
				'iterate over keys of a key-value table to find the n-th element
				ElseIf TJSONObject(currentJSON) And TJSONObject(currentJSON).Size() > arrayIndex

					Local childIndex:Int = 0
					Local validChildJSON:TJSON
					For Local childJSON:TJSON = EachIn TJSONObject(currentJSON)
						If childIndex = arrayIndex
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
			
			If currentJSON = Null Then Exit
		Next
			
		Return currentJSON
	End Function
	
	
	Function _HasPath:Int(path:String, json:TJSON)
		Return _GetPathJSON(path, json) <> Null
	End Function

	
	Method GetPathJSON:TJSON(path:String, json:TJSON = Null)
		If Not json Then json = defaultJSON
		Return _GetPathJSON(path, json)
	End Method

	
	Method HasPath:Int(path:String, json:TJSON = Null)
		If Not json Then json = defaultJSON
		Return _HasPath(path, json)
	End Method


	Method GetPathSize:Int(path:String, json:TJSON = Null)
		Local res:TJSON = GetPathJSON(path, json)
		If TJSONArray(res) Then Return TJSONArray(res).Size()
		If TJSONObject(res) Then Return TJSONObject(res).Size()
		Return 0
	End Method
	
	
	Method GetPathInteger:Long(path:String, json:TJSON = Null, defaultValue:Long = 0)
		Local res:TJSON = GetPathJSON(path, json)
		If Not TJSONInteger(res) Then Return defaultValue
		
		Return TJSONInteger(res).Value()
	End Method


	Method GetPathReal:Double(path:String, json:TJSON = Null, defaultValue:Double = 0.0)
		Local res:TJSON = GetPathJSON(path, json)
		If Not TJSONReal(res) Then Return defaultValue
		
		Return TJSONReal(res).Value()
	End Method


	Method GetPathBool:Int(path:String, json:TJSON = Null, defaultValue:Int = False)
		Local res:TJSON = GetPathJSON(path, json)
		If Not TJSONBool(res) Then Return defaultValue
		
		Return TJSONBool(res).isTrue
	End Method


	Method GetPathString:String(path:String, json:TJSON = Null, defaultValue:String = "")
		Local res:TJSON = GetPathJSON(path, json)
		If Not TJSONString(res) Then Return defaultValue
		
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


	Function _SplitArrayIndex2(path:String, key:String Var, index:Int Var)
		index = -1
		key = path
		
		Local arrayIndexStart:Int = path.FindLast("[")
		If arrayIndexStart >= 0 
			Local arrayIndexEnd:Int = path.FindLast("]")
			If arrayIndexStart < arrayIndexEnd
				index = Int(path[arrayIndexStart + 1 ..][.. arrayIndexEnd - arrayIndexStart])
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
		Local lastPath:String
		
		If Not lastJSON Then Throw "invalid JSON object passed to _EnsurePathExistence"

		Local lastIndex:Int = -1
		Local lastKey:String
		Local currentPath:String
		For Local pathPart:String = EachIn path.Split("/")
			Local key:String
			Local index:Int
			Local currentJSON:TJSON
			_SplitArrayIndex2(pathPart, key, index)

			lastPath = currentPath
			If currentPath Then currentPath :+ "/"
			currentPath :+ pathPart
'print "pathPart:" + pathPart + "  key="+key
			'check if element exists already
			If TJSONObject(lastJSON)
				'requesting a specific object index?
				If key = "" 
					If index >= 0
						Local subIndex:Int = 0
						For Local subJSON:TJSON = EachIn TJSONObject(lastJSON)
							If subIndex = index 
								currentJSON = subJSON
								Exit
							EndIf
							subIndex :+ 1
						Next
					Else
						currentJSON = Null
					EndIf
				Else
					currentJSON = TJSONObject(lastJSON).Get(key)
				EndIf
			ElseIf TJSONArray(lastJSON)
				currentJSON = TJSONArray(lastJSON).Get(index)
			EndIf

			If Not currentJSON
				'current will be an array?
				If index >= 0 And key <> ""
					currentJSON = New TJSONArray.Create()
					'print "element not existing. Path="+currentPath + "   created array."
				Else
					currentJSON = New TJSONObject.Create()
					'print "element not existing. Path="+currentPath + "   created obj."
				EndIf
				
				If TJSONObject(lastJSON)
					If TJSONObject(lastJSON).Set(key, currentJSON) = -1
						Throw "Failed to set new child element"
					EndIf
				ElseIf TJSONArray(lastJSON)
					If TJSONArray(lastJSON).Insert(index, currentJSON) = -1
						Throw "Failed to insert new array element at index="+index
					'else
					'	Print "Inserted new array element at ~q" + currentPath + "~q."
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
		If Not json Then json = defaultJSON
		Return _EnsurePathExistence(path, json)
	End Method
	
	
	Function _ArrObjSet:TJSON(obj:TJSON, key:String  = "", index:Int = -1, value:TJSON)
		If TJSONObject(obj) 
			TJSONObject(obj).Set(key, value)
		ElseIf TJSONArray(obj) 
			If TJSONArray(obj).Size() > index
				' simple set() does only work if the array slot existed 
				' already and "null" slots seem to not be possible
				TJSONArray(obj).Set(index, value)
			Else
				' we cannot "precreate" empty (null) array entries
				' they just get automatically skipped
				' so any index request > array size +1 (append) cannot
				' be fulfilled
				If TJSONArray(obj).Size() < index
					Throw "Cannot set new entry to array exceeding array size + 1. size="+TJSONArray(obj).Size() + "  index="+index
				EndIf

				TJSONArray(obj).Append(value)
			EndIf
		EndIf
		Return value
	End Function


	Function _ArrObjNew:TJSON(obj:TJSON, key:String = "", index:Int = -1, jsonPathType:Int)
		' create the new object
		Local newObj:TJSON
		Select jsonPathType
			Case  TJSONPathToken.JSON_ARRAY
				newObj = New TJSONArray.Create()
			Case  TJSONPathToken.JSON_OBJECT
				newObj = New TJSONObject.Create()
			Default
				Throw "_ArrObjNew cannot create new json type with pathType " + jsonPathType
		End Select


		' set the new object to its parent 
		If TJSONObject(obj) 
			TJSONObject(obj).Set(key, newObj)
		ElseIf TJSONArray(obj) 
			' if we add something to an array we need to ensure having a 
			' valid index. Without index we append...
			If index = -1 Then index = TJSONArray(obj).Size()
			
			If TJSONArray(obj).Size() > index
				' simple set() does only work if the array slot existed 
				' already and "null" slots seem to not be possible
				TJSONArray(obj).Set(index, newObj)
			Else
				' we cannot "precreate" empty (null) array entries
				' they just get automatically skipped
				' so any index request > array size +1 (append) cannot
				' be fulfilled
				If TJSONArray(obj).Size() < index
					Throw "Cannot add new entry to array exceeding array size + 1."
				EndIf

				TJSONArray(obj).Append(newObj)
			EndIf
		EndIf
		
		Return newObj
	End Function


	Function _ArrObjGet:TJSON(obj:TJSON, key:String = "", index:Int = -1)
		If TJSONObject(obj) 
			Return TJSONObject(obj).Get(key)
		ElseIf TJSONArray(obj)
			Return TJSONArray(obj).Get(index)
		EndIf
	End Function

		
	Function _SetJSONElement:TJSON(path:String, element:TJSON, json:TJSON)
		Local jsonPath:TJSONPath = New TJSONPath(path)
		Local currentJSON:TJSON = json

		' iterate over all path tokens and check if they exist 
		' if not, create them
		' reaching a value field just assigns the given element
		Local totalPath:String
		For Local tokenNum:Int = 0 Until jsonPath.token.length
			Local t:TJSONPathToken = jsonPath.token[tokenNum]

		
			If totalPath Then totalPath :+ "/"
			totalPath :+ t.GetPath()
'print "handling ~q"+totalPath+"~q"
'if totalPath = "results{}/arr[0]/obj{}" Then Debugstop
			'if previous token was an array, ensure we defined as so
			Local parentIndex:Int = -1
			If tokenNum > 0 And jsonPath.token[tokenNum-1].jsonType = TJSONPathToken.JSON_ARRAY
				parentIndex = jsonPath.token[tokenNum-1].index
			EndIf


			If t.jsonType = TJSONPathToken.JSON_ARRAY Or t.jsonType = TJSONPathToken.JSON_OBJECT
				Local existingObj:TJSON
				If TJSONObject(currentJSON) 
					existingObj = TJSONObject(currentJSON).Get(t.value)
				ElseIf TJSONArray(currentJSON)
					existingObj = TJSONArray(currentJSON).Get(parentIndex)
				EndIf

				'wrong types?
				'remove the old stuff (eg a wrapper array element)
				if existingObj
					if (t.jsonType = TJSONPathToken.JSON_ARRAY and not TJSONArray(existingObj)) or ..
					   (t.jsonType = TJSONPathToken.JSON_OBJECT and not TJSONObject(existingObj))

						If TJSONObject(currentJSON) 
							TJSONObject(currentJSON).Del(t.value)
						ElseIf TJSONArray(currentJSON)
							TJSONArray(currentJSON).Remove(parentIndex)
						EndIf

						existingObj = null
					endif
				endif

					
				'create base
				if not existingObj
					existingObj = _ArrObjNew(currentJSON, t.value, t.index, t.jsonType)
				'	print "  created base"
				'else
				'	print "  existing base"
				endif

				'check for specific array element?
				If t.index >= 0 and TJSONArray(existingObj)
					local arrayElement:TJSON = TJSONArray(existingObj).Get(t.index)

					if not arrayElement ' and tokenNum <= jsonPath.token.length-1
						arrayElement = _ArrObjNew(existingObj, t.value, t.index, t.jsonType)
						'print "    created array entry " + t.index
						
					'	existingObj = arrayElement
					EndIf
				endif

				currentJSON = existingObj
			EndIf
			
			'set value to last one or value fields
			If t.jsonType = TJSONPathToken.JSON_VALUE Or tokenNum = jsonPath.token.length -1
				if TJSONArray(currentJSON) and t.index = -1 and t.value and parentIndex >= 0
					local wrap:TJSONObject = TJSONObject(TJSONArray(currentJSON).Get(parentIndex))
					if not wrap 
						wrap = new TJSONObject.Create()
						TJSONArray(currentJSON).Set(parentIndex, wrap)
					endif
					wrap.Set(t.value, element)
				else
					_ArrObjSet(currentJSON, t.value, t.index, element)
				EndIf

			EndIf
		Next
	End Function
	

	Method SetPathString:TJSON(path:String, value:String, json:TJSON = Null)
		If Not json Then json = defaultJSON
		Return _SetJSONElement(path, New TJSONString.Create(value), json)
	End Method


	Method SetPathInteger:TJSON(path:String, value:Long, json:TJSON = Null)
		If Not json Then json = defaultJSON
		Return _SetJSONElement(path, New TJSONInteger.Create(value), json)
	End Method


	Method SetPathBool:TJSON(path:String, value:Int, json:TJSON = Null)
		If Not json Then json = defaultJSON
		Return _SetJSONElement(path, New TJSONBool.Create(value), json)
	End Method


	Method SetPathBoolString:TJSON(path:String, value:String, json:TJSON = Null)
		If Not json Then json = defaultJSON
		If value.ToLower() = "true" Or value = "1"
			Return _SetJSONElement(path, New TJSONBool.Create(True), json)
		Else
			Return _SetJSONElement(path, New TJSONBool.Create(False), json)
		EndIf
	End Method

		
	Method ToString:String()
		If defaultJSON Then Return defaultJSON.SaveString(0, 2)
		Return "" 
	End Method

	Method ToStringCompact:String()
		If defaultJSON Then Return defaultJSON.SaveString(JSON_COMPACT, 0)
		Return "" 
	End Method
End Type




Type TJSONPath
	Field token:TJSONPathToken[]
	Field path:String
	
	Method New(path:String)
		Local parts:String[] = path.split("/")
		token = New TJSONPathToken[ parts.length ]

		For Local i:Int = 0 Until parts.length
			Local index:Int = -1
			Local value:String = parts[i]
			Local jsonType:Int

			Local arrayIndexStart:Int = parts[i].FindLast("[")
			If arrayIndexStart >= 0 
				Local arrayIndexEnd:Int = parts[i].FindLast("]")
				If arrayIndexStart < arrayIndexEnd
					index = Int(parts[i][arrayIndexStart + 1 ..][.. arrayIndexEnd - arrayIndexStart])
					value = parts[i][.. arrayIndexStart]
				EndIf
			EndIf
			Local objectIndexStart:Int = parts[i].FindLast("{")
			If objectIndexStart >= 0 
				Local objectIndexEnd:Int = parts[i].FindLast("}")
				If objectIndexStart < objectIndexEnd
					index = Int(parts[i][objectIndexStart + 1 ..][.. objectIndexEnd - objectIndexStart])
					value = parts[i][.. objectIndexStart]
				EndIf
			EndIf
			
			If arrayIndexStart >= 0
				jsonType = TJSONPathToken.JSON_ARRAY
			ElseIf i < parts.length -1 Or objectIndexStart >= 0
				jsonType = TJSONPathToken.JSON_OBJECT
			Else
				jsonType = TJSONPathToken.JSON_VALUE
			EndIf

			If i = 0
				token[i] = New TJSONPathToken(parts[i], value, index, jsonType, Null)
			Else
				token[i] = New TJSONPathToken(parts[i], value, index, jsonType, token[i-1])
			EndIf
		Next
		
		Self.path = path
	End Method
	
	
	Method ToString:String()
		Local tokenS:String
		Local typeS:String
		For Local t:TJSONPathToken = EachIn token
			If tokenS Then tokenS :+ " / "
			If typeS Then typeS :+ " / "
			
			Local tokenPath:String = t.GetPath()
			
			If Not tokenPath
				tokenS :+ " . "
			Else
				tokenS :+ tokenPath[.. Max(3, tokenPath.length)]
			EndIf
			Select t.jsonTYPE
				Case TJSONPathToken.JSON_OBJECT	typeS :+ "OBJ"[.. Max(3, tokenPath.length)]
				Case TJSONPathToken.JSON_ARRAY	typeS :+ "ARR"[.. Max(3, tokenPath.length)]
				Case TJSONPathToken.JSON_VALUE	typeS :+ "VAL"[.. Max(3, tokenPath.length)]
			End Select
		Next
		Return tokenS + "~n" + typeS
	End Method
End Type




Type TJSONPathToken
	Field jsonType:Int 'JSON_OBJECT, JSON_ARRAY, JSON_VALUE
	Field value:String
	Field index:Int = -1
	Field path:String
	Field previousToken:TJSONPathToken
	
	Const JSON_OBJECT:Int = 1
	Const JSON_ARRAY:Int = 2
	Const JSON_VALUE:Int = 3
	

	Method New(path:String, value:String, index:Int, jsonType:Int, previousToken:TJSONPathToken)
		Self.path = path
		Self.value = value
		Self.index = index
		Self.jsonType = jsonType
		Self.previousToken = previousToken
	End Method
	
	
	Method GetPath:String()
		Select jsonType
			Case JSON_OBJECT	Return value + "{}"
			Case JSON_ARRAY		Return value + "[" + index + "]"
			Default				Return value
		End Select
	End Method
End Type