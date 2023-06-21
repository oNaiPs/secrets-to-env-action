import * as core from '@actions/core'

import {camelCase} from 'camel-case'
import {constantCase} from 'constant-case'
import {pascalCase} from 'pascal-case'
import {snakeCase} from 'snake-case'

const convertTypes: Record<string, (s: string) => string> = {
  lower: s => s.toLowerCase(),
  upper: s => s.toUpperCase(),
  camel: camelCase,
  constant: constantCase,
  pascal: pascalCase,
  snake: snakeCase
}

export default async function run(): Promise<void> {
  let excludeList = [
    // this variable is already exported automatically
    'github_token'
  ]

  try {
    const secretsJson: string = core.getInput('secrets', {
      required: true
    })
    const keyPrefix: string = core.getInput('prefix')
    const includeListStr: string = core.getInput('include')
    const excludeListStr: string = core.getInput('exclude')
    const convert: string = core.getInput('convert')
    const convertPrefixStr = core.getInput('convert_prefix')
    const convertPrefix = convertPrefixStr.length
      ? convertPrefixStr === 'true'
      : true
    const overrideStr: string = core.getInput('override')
    const override = overrideStr.length ? overrideStr === 'true' : true

    let secrets: Record<string, string>
    try {
      secrets = JSON.parse(secretsJson)
    } catch (e) {
      throw new Error(`Cannot parse JSON secrets.
Make sure you add the following to this action:

with:
      secrets: \${{ toJSON(secrets) }}
`)
    }

    let includeList: string[] | null = null
    if (includeListStr.length) {
      includeList = includeListStr.split(',').map(key => key.trim())
    }

    if (excludeListStr.length) {
      excludeList = excludeList.concat(
        excludeListStr.split(',').map(key => key.trim())
      )
    }

    core.debug(`Using include list: ${includeList?.join(', ')}`)
    core.debug(`Using exclude list: ${excludeList.join(', ')}`)

    for (const key of Object.keys(secrets)) {
      if (includeList && !includeList.some(inc => key.match(new RegExp(inc)))) {
        continue
      }

      if (excludeList.some(inc => key.match(new RegExp(inc)))) {
        continue
      }

      let newKey = keyPrefix.length ? `${keyPrefix}${key}` : key

      if (convert.length) {
        if (!convertTypes[convert]) {
          throw new Error(
            `Unknown convert value "${convert}". Available: ${Object.keys(
              convertTypes
            ).join(', ')}`
          )
        }

        if (!convertPrefix) {
          newKey = `${keyPrefix}${convertTypes[convert](
            newKey.replace(keyPrefix, '')
          )}`
        } else {
          newKey = convertTypes[convert](newKey)
        }
      }

      if (process.env[newKey]) {
        if (override) {
          core.warning(`Will re-write "${newKey}" environment variable.`)
        } else {
          core.info(`Skip overwriting secret ${newKey}`)
          continue
        }
      }

      core.exportVariable(newKey, secrets[key])
      core.info(`Exported secret ${newKey}`)
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

if (require.main === module) {
  run()
}
