import {
  expect,
  jest,
  test,
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it
} from '@jest/globals'

const mockCore = {
  debug: jest.fn((s: string) => console.log(`DEBUG: ${s}`)),
  info: jest.fn((s: string) => console.log(`INFO: ${s}`)),
  warning: jest.fn((s: string | Error) => console.log(`WARNING: ${s}`)),
  getInput: jest.fn(),
  exportVariable: jest.fn(),
  setFailed: jest.fn()
}

jest.unstable_mockModule('@actions/core', () => mockCore)

const main = (await import('../src/main.js')).default

function mockInputs(inputs: {[key: string]: string}): void {
  mockCore.getInput.mockImplementation(((s: string) => inputs[s] || '') as any)
}

describe('secrets-to-env-action', () => {
  let inputSecrets: {[key: string]: string}
  let newSecrets: {[key: string]: string}

  beforeEach(() => {
    inputSecrets = {
      MY_SECRET_1: 'VALUE_1',
      MY_SECRET_2: 'VALUE_2',
      my_low_secret_1: 'low_value_1'
    }

    newSecrets = {}
    mockCore.exportVariable.mockImplementation(((k: string, v: string) => {
      newSecrets[k] = v
    }) as any)
  })

  it('exports all variables', () => {
    mockInputs({
      secrets: JSON.stringify(inputSecrets)
    })
    main()
    expect(newSecrets).toEqual(inputSecrets)
  })

  it('excludes variables (single)', () => {
    mockInputs({
      secrets: JSON.stringify(inputSecrets),
      exclude: 'MY_SECRET_1'
    })
    main()
    delete inputSecrets.MY_SECRET_1
    expect(newSecrets).toEqual(inputSecrets)
  })

  it('excludes variables (array)', () => {
    mockInputs({
      secrets: JSON.stringify(inputSecrets),
      exclude: 'MY_SECRET_1,MY_SECRET_2,ignore'
    })
    main()
    delete inputSecrets.MY_SECRET_1
    delete inputSecrets.MY_SECRET_2
    expect(newSecrets).toEqual(inputSecrets)
  })

  it('excludes variables (regex)', () => {
    mockInputs({
      secrets: JSON.stringify(inputSecrets),
      exclude: 'MY_SECRET_*,ignore'
    })
    main()
    delete inputSecrets.MY_SECRET_1
    delete inputSecrets.MY_SECRET_2
    expect(newSecrets).toEqual(inputSecrets)
  })

  it('includes variables (single)', () => {
    mockInputs({
      secrets: JSON.stringify(inputSecrets),
      include: 'MY_SECRET_1'
    })
    main()

    expect(newSecrets).toEqual({
      MY_SECRET_1: inputSecrets.MY_SECRET_1
    })
  })

  it('includes variables (array)', () => {
    mockInputs({
      secrets: JSON.stringify(inputSecrets),
      include: 'MY_SECRET_1, MY_SECRET_2, ignore'
    })
    main()

    expect(newSecrets).toEqual({
      MY_SECRET_1: inputSecrets.MY_SECRET_1,
      MY_SECRET_2: inputSecrets.MY_SECRET_2
    })
  })

  it('includes variables (regex)', () => {
    mockInputs({
      secrets: JSON.stringify(inputSecrets),
      include: 'MY_SECRET_*'
    })
    main()

    expect(newSecrets).toEqual({
      MY_SECRET_1: inputSecrets.MY_SECRET_1,
      MY_SECRET_2: inputSecrets.MY_SECRET_2
    })
  })

  it('adds a prefix', () => {
    mockInputs({
      secrets: JSON.stringify(inputSecrets),
      prefix: 'PREF_',
      include: 'MY_SECRET_1, MY_SECRET_2'
    })
    main()

    expect(newSecrets).toEqual({
      PREF_MY_SECRET_1: inputSecrets.MY_SECRET_1,
      PREF_MY_SECRET_2: inputSecrets.MY_SECRET_2
    })
  })

  it('converts key (lower)', () => {
    mockInputs({
      secrets: JSON.stringify(inputSecrets),
      include: 'MY_SECRET_1, MY_SECRET_2',
      convert: 'lower'
    })
    main()

    expect(newSecrets).toEqual({
      my_secret_1: inputSecrets.MY_SECRET_1,
      my_secret_2: inputSecrets.MY_SECRET_2
    })
  })

  it('converts key (camel)', () => {
    mockInputs({
      secrets: JSON.stringify(inputSecrets),
      include: 'MY_SECRET_1, MY_SECRET_2',
      convert: 'camel'
    })
    main()

    expect(newSecrets).toEqual({
      mySecret_1: inputSecrets.MY_SECRET_1,
      mySecret_2: inputSecrets.MY_SECRET_2
    })
  })

  it('converts key (pascal)', () => {
    mockInputs({
      secrets: JSON.stringify(inputSecrets),
      include: 'MY_SECRET_1, MY_SECRET_2',
      convert: 'pascal'
    })
    main()

    expect(newSecrets).toEqual({
      MySecret_1: inputSecrets.MY_SECRET_1,
      MySecret_2: inputSecrets.MY_SECRET_2
    })
  })

  it('converts key (snake)', () => {
    mockInputs({
      secrets: JSON.stringify(inputSecrets),
      include: 'MY_SECRET_1, MY_SECRET_2',
      convert: 'snake'
    })
    main()

    expect(newSecrets).toEqual({
      my_secret_1: inputSecrets.MY_SECRET_1,
      my_secret_2: inputSecrets.MY_SECRET_2
    })
  })

  it('converts prefix', () => {
    mockInputs({
      secrets: JSON.stringify(inputSecrets),
      include: 'MY_SECRET_1, MY_SECRET_2',
      prefix: 'PREFIX_',
      convert: 'snake',
      convert_prefix: 'true'
    })
    main()

    expect(newSecrets).toEqual({
      prefix_my_secret_1: inputSecrets.MY_SECRET_1,
      prefix_my_secret_2: inputSecrets.MY_SECRET_2
    })
  })

  it('does not convert prefix', () => {
    mockInputs({
      secrets: JSON.stringify(inputSecrets),
      include: 'MY_SECRET_1, MY_SECRET_2',
      prefix: 'PREFIX_',
      convert: 'snake',
      convert_prefix: 'false'
    })
    main()

    expect(newSecrets).toEqual({
      PREFIX_my_secret_1: inputSecrets.MY_SECRET_1,
      PREFIX_my_secret_2: inputSecrets.MY_SECRET_2
    })
  })

  it('overrides variables', () => {
    process.env = {
      MY_SECRET_1: 'OVERRIDE'
    }

    mockInputs({
      secrets: JSON.stringify(inputSecrets),
      override: 'true'
    })
    main()

    expect(newSecrets).toEqual(inputSecrets)
  })

  it('does not override variables', () => {
    process.env = {
      MY_SECRET_1: 'DONT_OVERRIDE'
    }

    mockInputs({
      secrets: JSON.stringify(inputSecrets),
      override: 'false'
    })
    main()

    const filteredNewSecrets = Object.assign({}, newSecrets)
    delete filteredNewSecrets.MY_SECRET_1

    expect(newSecrets).toEqual(filteredNewSecrets)
  })

  it('removes prefix from secret names', () => {
    const prefixedSecrets = {
      MY_PREFIXED_SECRET_1: 'VALUE_1',
      MY_PREFIXED_SECRET_2: 'VALUE_2',
      OTHER_SECRET: 'VALUE_3'
    }

    mockInputs({
      secrets: JSON.stringify(prefixedSecrets),
      remove_prefix: 'MY_PREFIXED_'
    })
    main()

    expect(newSecrets).toEqual({
      SECRET_1: 'VALUE_1',
      SECRET_2: 'VALUE_2',
      OTHER_SECRET: 'VALUE_3'
    })
  })

  it('removes prefix case-insensitively', () => {
    const prefixedSecrets = {
      my_prefixed_SECRET_1: 'VALUE_1',
      MY_PREFIXED_SECRET_2: 'VALUE_2'
    }

    mockInputs({
      secrets: JSON.stringify(prefixedSecrets),
      remove_prefix: 'MY_PREFIXED_'
    })
    main()

    expect(newSecrets).toEqual({
      SECRET_1: 'VALUE_1',
      SECRET_2: 'VALUE_2'
    })
  })

  it('removes prefix and adds new prefix', () => {
    const prefixedSecrets = {
      OLD_PREFIX_SECRET_1: 'VALUE_1',
      OLD_PREFIX_SECRET_2: 'VALUE_2'
    }

    mockInputs({
      secrets: JSON.stringify(prefixedSecrets),
      remove_prefix: 'OLD_PREFIX_',
      prefix: 'NEW_PREFIX_'
    })
    main()

    expect(newSecrets).toEqual({
      NEW_PREFIX_SECRET_1: 'VALUE_1',
      NEW_PREFIX_SECRET_2: 'VALUE_2'
    })
  })

  it('removes prefix and converts case', () => {
    const prefixedSecrets = {
      MY_PREFIXED_SECRET_ONE: 'VALUE_1',
      MY_PREFIXED_SECRET_TWO: 'VALUE_2'
    }

    mockInputs({
      secrets: JSON.stringify(prefixedSecrets),
      remove_prefix: 'MY_PREFIXED_',
      convert: 'lower'
    })
    main()

    expect(newSecrets).toEqual({
      secret_one: 'VALUE_1',
      secret_two: 'VALUE_2'
    })
  })

  it('removes prefix, adds new prefix, and converts case', () => {
    const prefixedSecrets = {
      OLD_PREFIX_SECRET_ONE: 'VALUE_1',
      OLD_PREFIX_SECRET_TWO: 'VALUE_2'
    }

    mockInputs({
      secrets: JSON.stringify(prefixedSecrets),
      remove_prefix: 'OLD_PREFIX_',
      prefix: 'NEW_',
      convert: 'camel'
    })
    main()

    expect(newSecrets).toEqual({
      newSecretOne: 'VALUE_1',
      newSecretTwo: 'VALUE_2'
    })
  })

  it('keeps original name when prefix not found', () => {
    const prefixedSecrets = {
      DIFFERENT_SECRET_1: 'VALUE_1',
      MY_SECRET_2: 'VALUE_2'
    }

    mockInputs({
      secrets: JSON.stringify(prefixedSecrets),
      remove_prefix: 'MY_PREFIXED_'
    })
    main()

    expect(newSecrets).toEqual(prefixedSecrets)
  })

  // Vars-only scenarios
  describe('vars support', () => {
    it('exports vars only when secrets is empty', () => {
      const inputVars = {
        VAR_1: 'VAR_VALUE_1',
        VAR_2: 'VAR_VALUE_2'
      }

      mockInputs({
        secrets: JSON.stringify({}),
        vars: JSON.stringify(inputVars)
      })
      main()

      expect(newSecrets).toEqual(inputVars)
    })

    it('applies filters to vars', () => {
      const inputVars = {
        INCLUDE_VAR_1: 'VALUE_1',
        INCLUDE_VAR_2: 'VALUE_2',
        EXCLUDE_VAR: 'VALUE_3'
      }

      mockInputs({
        secrets: JSON.stringify({}),
        vars: JSON.stringify(inputVars),
        include: 'INCLUDE_*'
      })
      main()

      expect(newSecrets).toEqual({
        INCLUDE_VAR_1: 'VALUE_1',
        INCLUDE_VAR_2: 'VALUE_2'
      })
    })

    it('applies prefix and conversion to vars', () => {
      const inputVars = {
        MY_VAR: 'VALUE_1'
      }

      mockInputs({
        secrets: JSON.stringify({}),
        vars: JSON.stringify(inputVars),
        prefix: 'TEST_',
        convert: 'lower'
      })
      main()

      expect(newSecrets).toEqual({
        test_my_var: 'VALUE_1'
      })
    })
  })

  // Secrets and vars together without collision
  describe('secrets and vars together', () => {
    it('exports both when no overlap', () => {
      const secrets = {SECRET_1: 'SECRET_VALUE_1'}
      const vars = {VAR_1: 'VAR_VALUE_1'}

      mockInputs({
        secrets: JSON.stringify(secrets),
        vars: JSON.stringify(vars)
      })
      main()

      expect(newSecrets).toEqual({
        SECRET_1: 'SECRET_VALUE_1',
        VAR_1: 'VAR_VALUE_1'
      })
    })

    it('applies different filters to demonstrate independence', () => {
      const secrets = {
        INCLUDE_SECRET: 'SECRET_1',
        EXCLUDE_SECRET: 'SECRET_2'
      }
      const vars = {INCLUDE_VAR: 'VAR_1', EXCLUDE_VAR: 'VAR_2'}

      mockInputs({
        secrets: JSON.stringify(secrets),
        vars: JSON.stringify(vars),
        include: 'INCLUDE_*'
      })
      main()

      expect(newSecrets).toEqual({
        INCLUDE_SECRET: 'SECRET_1',
        INCLUDE_VAR: 'VAR_1'
      })
    })

    it('different prefixes result in no collision', () => {
      const secrets = {KEY: 'SECRET_VALUE'}
      const vars = {KEY: 'VAR_VALUE'}

      mockInputs({
        secrets: JSON.stringify(secrets),
        vars: JSON.stringify(vars),
        prefix: 'MY_'
      })
      main()

      // Both export but with different original names, same final name
      // Default strategy is prefer-secrets
      expect(newSecrets).toEqual({
        MY_KEY: 'SECRET_VALUE'
      })
    })

    it('case conversion with different results', () => {
      const secrets = {secret_key: 'SECRET_VALUE'}
      const vars = {VAR_KEY: 'VAR_VALUE'}

      mockInputs({
        secrets: JSON.stringify(secrets),
        vars: JSON.stringify(vars),
        convert: 'upper'
      })
      main()

      expect(newSecrets).toEqual({
        SECRET_KEY: 'SECRET_VALUE',
        VAR_KEY: 'VAR_VALUE'
      })
    })
  })

  // Collision scenarios
  describe('collision handling', () => {
    it('prefer-secrets: secret overwrites var', () => {
      const secrets = {MY_KEY: 'SECRET_VALUE'}
      const vars = {MY_KEY: 'VAR_VALUE'}

      mockInputs({
        secrets: JSON.stringify(secrets),
        vars: JSON.stringify(vars),
        on_collision: 'prefer-secrets'
      })
      main()

      expect(newSecrets).toEqual({MY_KEY: 'SECRET_VALUE'})
    })

    it('prefer-secrets is default', () => {
      const secrets = {MY_KEY: 'SECRET_VALUE'}
      const vars = {MY_KEY: 'VAR_VALUE'}

      mockInputs({
        secrets: JSON.stringify(secrets),
        vars: JSON.stringify(vars)
      })
      main()

      expect(newSecrets).toEqual({MY_KEY: 'SECRET_VALUE'})
    })

    it('prefer-vars: var overwrites secret', () => {
      const secrets = {MY_KEY: 'SECRET_VALUE'}
      const vars = {MY_KEY: 'VAR_VALUE'}

      mockInputs({
        secrets: JSON.stringify(secrets),
        vars: JSON.stringify(vars),
        on_collision: 'prefer-vars'
      })
      main()

      expect(newSecrets).toEqual({MY_KEY: 'VAR_VALUE'})
    })

    it('error: collision throws error', () => {
      const secrets = {MY_KEY: 'SECRET_VALUE'}
      const vars = {MY_KEY: 'VAR_VALUE'}

      mockInputs({
        secrets: JSON.stringify(secrets),
        vars: JSON.stringify(vars),
        on_collision: 'error'
      })

      main()
      expect(mockCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Collision detected')
      )
    })

    it('error: no collision does not throw', () => {
      const secrets = {SECRET_KEY: 'SECRET_VALUE'}
      const vars = {VAR_KEY: 'VAR_VALUE'}

      mockInputs({
        secrets: JSON.stringify(secrets),
        vars: JSON.stringify(vars),
        on_collision: 'error'
      })
      main()

      expect(newSecrets).toEqual({
        SECRET_KEY: 'SECRET_VALUE',
        VAR_KEY: 'VAR_VALUE'
      })
    })

    it('warn: collision logs warning and exports correct value', () => {
      const secrets = {MY_KEY: 'SECRET_VALUE'}
      const vars = {MY_KEY: 'VAR_VALUE'}

      mockInputs({
        secrets: JSON.stringify(secrets),
        vars: JSON.stringify(vars),
        on_collision: 'warn'
      })
      main()

      expect(mockCore.warning).toHaveBeenCalledWith(
        expect.stringContaining('Collision detected')
      )
      expect(newSecrets).toEqual({MY_KEY: 'SECRET_VALUE'})
    })

    it('warn: tracks correct original names in warning', () => {
      const secrets = {SAME_KEY: 'SECRET_VALUE'}
      const vars = {SAME_KEY: 'VAR_VALUE'}

      mockInputs({
        secrets: JSON.stringify(secrets),
        vars: JSON.stringify(vars),
        on_collision: 'warn'
      })
      main()

      const warningCall = mockCore.warning.mock.calls[0][0] as string
      expect(warningCall).toContain('SAME_KEY')
      expect(warningCall).toContain('From secret: SAME_KEY')
      expect(warningCall).toContain('From var: SAME_KEY')
    })

    it('multiple collisions in error mode shows all conflicts', () => {
      const secrets = {KEY_1: 'SECRET_1', KEY_2: 'SECRET_2'}
      const vars = {KEY_1: 'VAR_1', KEY_2: 'VAR_2'}

      mockInputs({
        secrets: JSON.stringify(secrets),
        vars: JSON.stringify(vars),
        on_collision: 'error'
      })
      main()

      expect(mockCore.setFailed).toHaveBeenCalledWith(
        expect.stringMatching(/KEY_1[\s\S]*KEY_2/)
      )
    })
  })

  // Collision after processing
  describe('collision after transformations', () => {
    it('different original names, same after prefix removal', () => {
      const secrets = {PREFIX_MY_KEY: 'SECRET_VALUE'}
      const vars = {PREFIX_MY_KEY: 'VAR_VALUE'}

      mockInputs({
        secrets: JSON.stringify(secrets),
        vars: JSON.stringify(vars),
        remove_prefix: 'PREFIX_',
        on_collision: 'prefer-vars'
      })
      main()

      expect(newSecrets).toEqual({MY_KEY: 'VAR_VALUE'})
    })

    it('different original names, same after case conversion', () => {
      const secrets = {my_key: 'SECRET_VALUE'}
      const vars = {MY_KEY: 'VAR_VALUE'}

      mockInputs({
        secrets: JSON.stringify(secrets),
        vars: JSON.stringify(vars),
        convert: 'upper',
        on_collision: 'prefer-secrets'
      })
      main()

      expect(newSecrets).toEqual({MY_KEY: 'SECRET_VALUE'})
    })

    it('different original names, same after prefix addition', () => {
      const secrets = {KEY: 'SECRET_VALUE'}
      const vars = {KEY: 'VAR_VALUE'}

      mockInputs({
        secrets: JSON.stringify(secrets),
        vars: JSON.stringify(vars),
        prefix: 'TEST_',
        on_collision: 'prefer-vars'
      })
      main()

      expect(newSecrets).toEqual({TEST_KEY: 'VAR_VALUE'})
    })

    it('complex: same after remove_prefix + add_prefix + convert', () => {
      const secrets = {OLD_my_secret: 'SECRET_VALUE'}
      const vars = {OLD_MY_SECRET: 'VAR_VALUE'}

      mockInputs({
        secrets: JSON.stringify(secrets),
        vars: JSON.stringify(vars),
        remove_prefix: 'OLD_',
        prefix: 'NEW_',
        convert: 'lower',
        on_collision: 'prefer-secrets'
      })
      main()

      expect(newSecrets).toEqual({new_my_secret: 'SECRET_VALUE'})
    })
  })

  // Edge cases
  describe('edge cases', () => {
    it('empty vars with secrets works normally', () => {
      mockInputs({
        secrets: JSON.stringify(inputSecrets),
        vars: JSON.stringify({})
      })
      main()

      expect(newSecrets).toEqual(inputSecrets)
    })

    it('empty secrets with vars exports only vars', () => {
      const vars = {VAR_1: 'VALUE_1'}

      mockInputs({
        secrets: JSON.stringify({}),
        vars: JSON.stringify(vars)
      })
      main()

      expect(newSecrets).toEqual(vars)
    })

    it('both empty results in no exports', () => {
      mockInputs({
        secrets: JSON.stringify({}),
        vars: JSON.stringify({})
      })
      main()

      expect(newSecrets).toEqual({})
    })

    it('invalid on_collision value throws error', () => {
      mockInputs({
        secrets: JSON.stringify(inputSecrets),
        vars: JSON.stringify({}),
        on_collision: 'invalid-strategy'
      })
      main()

      expect(mockCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Invalid on_collision value')
      )
    })
  })

  // Integration with existing features
  describe('vars integration with existing features', () => {
    it('vars respect override setting', () => {
      const vars = {EXISTING_VAR: 'NEW_VALUE'}
      process.env.EXISTING_VAR = 'OLD_VALUE'

      mockInputs({
        secrets: JSON.stringify({}),
        vars: JSON.stringify(vars),
        override: 'false'
      })
      main()

      expect(newSecrets).toEqual({})
      delete process.env.EXISTING_VAR
    })

    it('vars respect exclude patterns', () => {
      const vars = {EXCLUDE_VAR: 'VALUE_1', INCLUDE_VAR: 'VALUE_2'}

      mockInputs({
        secrets: JSON.stringify({}),
        vars: JSON.stringify(vars),
        exclude: 'EXCLUDE_*'
      })
      main()

      expect(newSecrets).toEqual({INCLUDE_VAR: 'VALUE_2'})
    })

    it('vars respect include patterns', () => {
      const vars = {INCLUDE_VAR: 'VALUE_1', OTHER_VAR: 'VALUE_2'}

      mockInputs({
        secrets: JSON.stringify({}),
        vars: JSON.stringify(vars),
        include: 'INCLUDE_*'
      })
      main()

      expect(newSecrets).toEqual({INCLUDE_VAR: 'VALUE_1'})
    })
  })
})
