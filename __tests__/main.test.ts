import * as cp from 'child_process'
import * as path from 'path'
import {expect, jest, test} from '@jest/globals'
import * as core from '@actions/core'
import main from '../src/main'

jest.mock('@actions/core')

let mockedCore: jest.Mocked<typeof core>

jest.mocked(core.debug).mockImplementation(s => console.log(`DEBUG: ${s}`))
jest.mocked(core.info).mockImplementation(s => console.log(`INFO: ${s}`))
jest.mocked(core.warning).mockImplementation(s => console.log(`WARNING: ${s}`))

function mockInputs(inputs: {[key: string]: string}) {
  jest.mocked(core.getInput).mockImplementation(s => inputs[s] || '')
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
    jest
      .mocked(core.exportVariable)
      .mockImplementation((k, v) => (newSecrets[k] = v))
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
})
