import {Die} from './types'
import {parseRollInteger} from './parse'
import {TableRow} from './TableRow'

export const parseRange = (range: string): [number, number] | number | null => {
  const match = range.trim().match(/^(\d+)(?:[^\d](\d+))?$/)

  if (!match) {
    return null
  }

  if (match[2]) {
    return [parseRollInteger(match[1]), parseRollInteger(match[2])]
  }

  return parseRollInteger(match[1])
}

export interface Range {
  min: number
  max: number
}

export class Range implements Range {
  public min: number
  public max: number

  constructor(...numbers: [number] | [number, number]) {
    this.min = Math.min(...numbers)
    this.max = Math.max(...numbers)
  }

  public multiply(factor: number): Range {
    return new Range(this.min * factor, this.max * factor)
  }

  public add(range: Range): Range {
    return new Range(this.min + range.min, this.max + range.max)
  }

  public members(): number[] {
    const members: number[] = []
    for (let i = this.min; i <= this.max; i++) {
      members.push(i)
    }
    return members
  }

  public toString(): string {
    return `[${this.min},${this.max}]`
  }
}

const getDieRange = (die: Die): Range => {
  if (typeof die === 'number') {
    return new Range(die)
  } else {
    const dropped = die.drop ? die.drop.number : 0
    const count = die.count - dropped
    const result: Range = new Range(count, count * die.sides)
    return result.multiply(die.multiplier)
  }
}

export const getDiceRange = (dice: Die[]): Range => {
  return dice.reduce((result: Range, die: Die) => {
    return getDieRange(die).add(result)
  }, new Range(0))
}

export const rangeMin = (row: TableRow): number => {
  if (typeof row.range === 'number') {
    return row.range
  } else {
    return row.range[0]
  }
}

export const rangeMax = (row: TableRow): number => {
  if (typeof row.range === 'number') {
    return row.range
  } else {
    return row.range[row.range.length - 1]
  }
}
