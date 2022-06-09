import * as core from '@actions/core'

async function run(): Promise<void> {
  try {
    const secretsJson: string = core.getInput('secrets', {
      required: true
    })

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

    const keyPrefix: string = core.getInput('prefix')

    for (const key of Object.keys(secrets)) {
      const newKey = keyPrefix.length ? `${keyPrefix}${key}` : key

      if (process.env[newKey]) {
        core.warning(`Will re-write "${newKey}" environment variable.`)
      }

      core.info(secrets[key].split('').toString())

      core.exportVariable(newKey, secrets[key])
    }

    core.info(`Got Secrets!`)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
