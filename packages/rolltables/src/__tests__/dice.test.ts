import chalk from 'chalk'
import {evaluatePlaceholders} from '../evaluate'
import {parseDice} from '../parse'

describe('parse dice strings', () => {
  test('implied 1 count', () => {
    expect(parseDice('d8')).toEqual([
      {
        count: 1,
        multiplier: 1,
        sides: 8,
      },
    ])
    expect(parseDice('-d8')).toEqual([
      {
        count: 1,
        multiplier: -1,
        sides: 8,
      },
    ])
  })

  test('count and sides', () => {
    expect(parseDice('8d6')).toEqual([
      {
        count: 8,
        multiplier: 1,
        sides: 6,
      },
    ])
    expect(parseDice('-8d6')).toEqual([
      {
        count: 8,
        multiplier: -1,
        sides: 6,
      },
    ])
  })

  test('constant number', () => {
    expect(parseDice('12')).toEqual([
      {
        count: 12,
        multiplier: 1,
        sides: 1,
      },
    ])
    expect(parseDice('-12')).toEqual([
      {
        count: 12,
        multiplier: -1,
        sides: 1,
      },
    ])
  })

  test('constant zero', () => {
    expect(parseDice('0')).toEqual([
      {
        count: 0,
        multiplier: 1,
        sides: 1,
      },
    ])
  })

  test('keep/drop', () => {
    expect(parseDice('4d6k3')).toEqual([
      {
        count: 4,
        multiplier: 1,
        sides: 6,
        drop: {
          type: 'lowest',
          number: 1,
        },
      },
    ])
    expect(parseDice('4d6d3')).toEqual([
      {
        count: 4,
        multiplier: 1,
        sides: 6,
        drop: {
          type: 'lowest',
          number: 3,
        },
      },
    ])
    expect(parseDice('4d6kl3')).toEqual([
      {
        count: 4,
        multiplier: 1,
        sides: 6,
        drop: {
          type: 'highest',
          number: 1,
        },
      },
    ])
    expect(parseDice('4d6dh3')).toEqual([
      {
        count: 4,
        multiplier: 1,
        sides: 6,
        drop: {
          type: 'highest',
          number: 3,
        },
      },
    ])
  })

  test('chained', () => {
    expect(parseDice('d8+4d6-10')).toEqual([
      {
        count: 1,
        multiplier: 1,
        sides: 8,
      },
      {
        count: 4,
        multiplier: 1,
        sides: 6,
      },
      {
        count: 10,
        multiplier: -1,
        sides: 1,
      },
    ])
  })

  test('die with extra multiplier', () => {
    expect(parseDice('2d4*100')).toEqual([
      {
        count: 2,
        multiplier: 100,
        sides: 4,
      },
    ])
  })

  test('chained with extra multipliers', () => {
    expect(parseDice('d8*5-2d4*10')).toEqual([
      {
        count: 1,
        multiplier: 5,
        sides: 8,
      },
      {
        count: 2,
        multiplier: -10,
        sides: 4,
      },
    ])
  })
})

describe('evaluate placeholders', () => {
  test('simple', () => {
    chalk.enabled = false
    const evaluated = evaluatePlaceholders('There are [[@name:d4+1]] things')
    expect(evaluated.text).toMatch(/There are d4\+1 \([2-5]\) things/)
    expect(evaluated.results.name).toBeTruthy()
  })

  test('multipliers', () => {
    const cp = evaluatePlaceholders('[[@cp:6d6*100]]').results.cp
    expect(cp).toBeTruthy()
    expect(cp.dice).toEqual([
      {
        count: 6,
        sides: 6,
        multiplier: 100,
      },
    ])
  })
})
