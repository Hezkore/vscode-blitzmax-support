'use strict'

import { BmxDebugSession } from './debugger'
import { EOL } from 'os'

export class BmxDebugParser {
	
	debugger: BmxDebugSession
	
	constructor( debug: BmxDebugSession ){
		this.debugger = debug
	}
	
	parse( data: string ){
		const lines: string[] = data.split( EOL )
		
		lines.forEach(line => {
			console.log("FROM APP: " + line)
		})
	}
}