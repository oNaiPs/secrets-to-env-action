import * as core from '@actions/core'

let excludeList = [
  // this variable is already exported automatically
  'github_token'
]

async function run(): Promise<void> {
  try {
    const secretsJson: string = core.getInput('secrets', {
      required: true
    })
    const keyPrefix: string = core.getInput('prefix')
    const excludeListStr: string = core.getInput('excludeList')

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

    if (excludeListStr.length) {
      excludeList = excludeList.concat(
        excludeListStr.split(',').map(key => key.trim())
      )
    }

    core.debug(`Using exclude list: ${excludeList.join(', ')}`)

    for (const key of Object.keys(secrets)) {
      if (excludeList.includes(key)) {
        continue
      }

      const newKey = keyPrefix.length ? `${keyPrefix}${key}` : key

      if (process.env[newKey]) {
        core.warning(`Will re-write "${newKey}" environment variable.`)
      }

      core.exportVariable(newKey, secrets[key])
    }

    core.info(`Got Secrets!`)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
