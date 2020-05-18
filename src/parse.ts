import {Die, Drop} from './types'

export const parseInteger = (s: string): number => parseInt(s)
export const parseRollInteger = (s: string): number =>
  s === '00' ? 100 : parseInteger(s)
const parseKeepDrop = (s: string | undefined, numDice: number): Drop => {
  const res: Drop = {
    type: 'lowest',
    number: 0,
  }
  const match = s ? s.match(/([kd])([hl])?(\d+)/) : null
  if (!match) {
    return res
  }

  res.number = parseInt(match[3], 10)

  const action = match[1] as 'k' | 'd'
  let cohort: 'h' | 'l' =
    (match[2] as 'h' | 'l' | undefined) || (action === 'k' ? 'h' : 'l')

  if (action === 'k') {
    cohort = cohort === 'h' ? 'l' : 'h'
    res.number = Math.max(0, numDice - res.number)
  }
  res.type = cohort === 'l' ? 'lowest' : 'highest'

  return res
}

const parseDie = (text: string): Die | null => {
  // Optional negative: (-)?
  // Optional number of dice: (\d*)
  // The letter D: d
  // Die sides: (\d+)
  // Keep/drop: ([kd][hl]?\d+)?
  // Optional multiplier: (?:\*(-?\d+))?
  const match = text.match(/(-)?(\d*)d(\d+)([kd][hl]?\d+)?(?:\*(-?\d+))?/)
  if (match) {
    const multiplierFromSign = match[1] ? -1 : 1
    const count = parseInteger(match[2]) || 1
    const keepDrop = parseKeepDrop(match[4], count)
    const extraMultiplier = match[5] ? parseInteger(match[5]) : 1
    return {
      count,
      multiplier: multiplierFromSign * extraMultiplier,
      sides: parseInteger(match[3]),
      drop: keepDrop.number ? keepDrop : undefined,
    }
  }

  const constant = parseInteger(text)
  if (isNaN(constant)) {
    return null
  }
  return {
    count: Math.abs(constant),
    multiplier: constant === 0 ? 1 : constant / Math.abs(constant),
    sides: 1,
  }
}

export const parseDice = (text: string): Die[] => {
  const pattern = /(^|[-+])[^-+]+/g
  const diceMatches = text.replace(/\s/g, '').match(pattern)
  if (!diceMatches) {
    return []
  }
  const dice: Die[] = []
  diceMatches.forEach((matchText) => {
    const die = parseDie(matchText)
    if (die !== null) {
      dice.push(die)
    }
  })
  return dice
}
