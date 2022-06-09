import * as core from '@actions/core'

async function run(): Promise<void> {
  try {
    const secretsJson: string = core.getInput('secrets', {
      required: true
    })

    core.info('1')

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

    core.info('2')

    const prefix: string = core.getInput('prefix')

    core.info('3')

    for (const key of Object.keys(secrets)) {
      const newKey = prefix.length ? `${prefix}${key}` : key

      if (process.env[newKey]) {
        core.warning(`Will re-write "${newKey}" environment variable.`)
      }

      core.exportVariable(newKey, secrets[key])
    }

    core.info('4')

    core.info(`Got Secrets!`)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
