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
})
