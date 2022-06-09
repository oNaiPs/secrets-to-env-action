import * as core from '@actions/core'

async function run(): Promise<void> {
  try {
    const secretsJson: string = core.getInput('secrets', {
      // required: true
    })

    const secrets: Record<string, string> = JSON.parse(secretsJson)

    const prefix: string = core.getInput('prefix')

    for (const key of Object.keys(secrets)) {
      const newKey = prefix.length ? `${prefix}${key}` : key

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
