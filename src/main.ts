import * as core from '@actions/core'
import {fileURLToPath} from 'url'

import {camelCase} from 'camel-case'
import {constantCase} from 'constant-case'
import {pascalCase} from 'pascal-case'
import {snakeCase} from 'snake-case'

type SourceType = 'secret' | 'var'
type CollisionStrategy = 'prefer-secrets' | 'prefer-vars' | 'error' | 'warn'

interface ProcessedVariable {
  value: string
  source: SourceType
  originalKey: string
}

interface ProcessingConfig {
  includeList: string[] | null
  excludeList: string[]
  removePrefix: string
  keyPrefix: string
  convert: string
  convertPrefix: boolean
}

const convertTypes: Record<string, (s: string) => string> = {
  lower: s => s.toLowerCase(),
  upper: s => s.toUpperCase(),
  camel: camelCase,
  constant: constantCase,
  pascal: pascalCase,
  snake: snakeCase
}

function processVariables(
  variables: Record<string, string>,
  source: SourceType,
  config: ProcessingConfig
): Map<string, ProcessedVariable> {
  const processed = new Map<string, ProcessedVariable>()

  for (const key of Object.keys(variables)) {
    // Filter by include patterns
    if (
      config.includeList &&
      !config.includeList.some(inc => key.match(new RegExp(inc)))
    ) {
      continue
    }

    // Filter by exclude patterns
    if (config.excludeList.some(exc => key.match(new RegExp(exc)))) {
      continue
    }

    let newKey = key

    // Remove prefix if specified
    if (config.removePrefix.length) {
      const prefixRegex = new RegExp(`^${config.removePrefix}`, 'i')
      if (newKey.match(prefixRegex)) {
        newKey = newKey.replace(prefixRegex, '')
        core.debug(
          `Removed prefix "${config.removePrefix}" from ${key} -> ${newKey}`
        )
      }
    }

    // Add prefix if specified
    newKey = config.keyPrefix.length ? `${config.keyPrefix}${newKey}` : newKey

    // Convert case if specified
    if (config.convert.length) {
      if (!convertTypes[config.convert]) {
        throw new Error(
          `Unknown convert value "${config.convert}". Available: ${Object.keys(
            convertTypes
          ).join(', ')}`
        )
      }

      if (!config.convertPrefix) {
        newKey = `${config.keyPrefix}${convertTypes[config.convert](
          newKey.replace(config.keyPrefix, '')
        )}`
      } else {
        newKey = convertTypes[config.convert](newKey)
      }
    }

    processed.set(newKey, {
      value: variables[key],
      source,
      originalKey: key
    })
  }

  return processed
}

function detectCollisions(
  secretsMap: Map<string, ProcessedVariable>,
  varsMap: Map<string, ProcessedVariable>
): {finalKey: string; secretOriginal: string; varOriginal: string}[] {
  const collisions: {
    finalKey: string
    secretOriginal: string
    varOriginal: string
  }[] = []

  for (const [key, secretVar] of secretsMap.entries()) {
    const varVar = varsMap.get(key)
    if (varVar) {
      collisions.push({
        finalKey: key,
        secretOriginal: secretVar.originalKey,
        varOriginal: varVar.originalKey
      })
    }
  }

  return collisions
}

function mergeAndExport(
  secretsMap: Map<string, ProcessedVariable>,
  varsMap: Map<string, ProcessedVariable>,
  strategy: CollisionStrategy,
  override: boolean
): void {
  const merged = new Map<string, ProcessedVariable>()

  if (strategy === 'error') {
    // Detect collisions and throw if any exist
    const collisions = detectCollisions(secretsMap, varsMap)
    if (collisions.length > 0) {
      const collisionDetails = collisions
        .map(
          c =>
            `  - ${c.finalKey} (from secret: ${c.secretOriginal} and var: ${c.varOriginal})`
        )
        .join('\n')
      throw new Error(
        `Collision detected: The following environment variable names would be exported by both secrets and vars after processing:\n${collisionDetails}\n\nThis occurs because the same final environment variable name is produced after applying include/exclude filters, prefix manipulation, and case conversion.\n\nTo resolve:\n1. Use on_collision: 'prefer-secrets' or 'prefer-vars' to choose which source takes precedence\n2. Use on_collision: 'warn' to allow collisions with a warning\n3. Adjust include/exclude/prefix/convert settings to avoid name collisions`
      )
    }
    // No collisions, merge both
    for (const [key, value] of varsMap.entries()) {
      merged.set(key, value)
    }
    for (const [key, value] of secretsMap.entries()) {
      merged.set(key, value)
    }
  } else if (strategy === 'warn') {
    // Detect collisions and log warnings
    const collisions = detectCollisions(secretsMap, varsMap)
    // Merge vars first, then secrets (secrets win)
    for (const [key, value] of varsMap.entries()) {
      merged.set(key, value)
    }
    for (const [key, value] of secretsMap.entries()) {
      merged.set(key, value)
    }
    // Log warnings for collisions
    for (const collision of collisions) {
      core.warning(
        `Collision detected for environment variable "${collision.finalKey}"\n` +
          `  - From secret: ${collision.secretOriginal}\n` +
          `  - From var: ${collision.varOriginal}\n` +
          `Using value from secret (on_collision: warn)`
      )
    }
  } else if (strategy === 'prefer-vars') {
    // Process secrets first, then vars (vars overwrite on collision)
    for (const [key, value] of secretsMap.entries()) {
      merged.set(key, value)
    }
    for (const [key, value] of varsMap.entries()) {
      merged.set(key, value)
    }
  } else {
    // prefer-secrets (default)
    // Process vars first, then secrets (secrets overwrite on collision)
    for (const [key, value] of varsMap.entries()) {
      merged.set(key, value)
    }
    for (const [key, value] of secretsMap.entries()) {
      merged.set(key, value)
    }
  }

  // Export all merged variables
  for (const [key, variable] of merged.entries()) {
    if (process.env[key]) {
      if (override) {
        core.warning(`Will re-write "${key}" environment variable.`)
      } else {
        core.info(`Skip overwriting ${variable.source} ${key}`)
        continue
      }
    }

    core.exportVariable(key, variable.value)
    core.info(`Exported ${variable.source} ${key}`)
  }
}

export default function run(): void {
  let excludeList = [
    // this variable is already exported automatically
    'github_token'
  ]

  try {
    const secretsJson: string = core.getInput('secrets', {
      required: true
    })
    const keyPrefix: string = core.getInput('prefix')
    const removePrefix: string = core.getInput('remove_prefix')
    const includeListStr: string = core.getInput('include')
    const excludeListStr: string = core.getInput('exclude')
    const convert: string = core.getInput('convert')
    const convertPrefixStr = core.getInput('convert_prefix')
    const convertPrefix = convertPrefixStr.length
      ? convertPrefixStr === 'true'
      : true
    const overrideStr: string = core.getInput('override')
    const override = overrideStr.length ? overrideStr === 'true' : true
    const varsJson: string = core.getInput('vars')
    const onCollisionStr: string = core.getInput('on_collision')
    const onCollision: CollisionStrategy =
      (onCollisionStr as CollisionStrategy) || 'prefer-secrets'

    // Validate on_collision value
    const validStrategies: CollisionStrategy[] = [
      'prefer-secrets',
      'prefer-vars',
      'error',
      'warn'
    ]
    if (onCollisionStr && !validStrategies.includes(onCollision)) {
      throw new Error(
        `Invalid on_collision value "${onCollisionStr}". Valid values: ${validStrategies.join(', ')}`
      )
    }

    let secrets: Record<string, string>
    try {
      secrets = JSON.parse(secretsJson) as Record<string, string>
    } catch {
      throw new Error(`Cannot parse JSON secrets.
Make sure you add the following to this action:

with:
      secrets: \${{ toJSON(secrets) }}
`)
    }

    let vars: Record<string, string> = {}
    if (varsJson.length) {
      try {
        vars = JSON.parse(varsJson) as Record<string, string>
      } catch {
        throw new Error(`Cannot parse JSON vars.
Make sure you add the following to this action:

with:
      vars: \${{ toJSON(vars) }}
`)
      }
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

    // Build configuration object
    const config: ProcessingConfig = {
      includeList,
      excludeList,
      removePrefix,
      keyPrefix,
      convert,
      convertPrefix
    }

    // Process secrets and vars
    const secretsMap = processVariables(secrets, 'secret', config)
    const varsMap = processVariables(vars, 'var', config)

    // Merge and export based on collision strategy
    mergeAndExport(secretsMap, varsMap, onCollision, override)
  } catch (error: unknown) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('An unknown error occurred')
    }
  }
}

// ESM equivalent of require.main === module
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1] === fileURLToPath(import.meta.url)
) {
  void run()
}
