'use strict'

import * as fs from 'fs'

export function existsSync(path: string): boolean {
	try {
		fs.accessSync(path, fs.constants.F_OK)
		return true
	} catch (err) {
		if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
			return false
		} else {
			throw Error(err.code)
		}
	}
}