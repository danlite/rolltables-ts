import {Die, DiceRollResult} from './types'

export const rollDice = (dice: Die[]): DiceRollResult => {
  let total = 0
  const rolls = dice.map((die) => {
    const dieRolls = []
    if (typeof die === 'number') {
      dieRolls.push(die)
    } else {
      for (let i = 0; i < die.count; i++) {
        let roll = Math.floor(Math.random() * die.sides) + 1
        roll *= die.multiplier
        dieRolls.push(roll)
      }
    }

    if (die.drop) {
      const limit =
        die.drop.type === 'highest' ? Number.MIN_VALUE : Number.MAX_VALUE
      const comparator = die.drop.type === 'highest' ? Math.max : Math.min

      for (let i = 0; i < die.drop.number; i++) {
        const target = dieRolls.reduce(
          (extreme, n) => comparator(extreme, n),
          limit,
        )
        dieRolls.splice(dieRolls.indexOf(target), 1)
      }
    }
    total += dieRolls.reduce((sum, r) => sum + r, 0)

    return dieRolls
  })

  return {total, rolls}
}

export const formatDice = (dice: Die[]): string => {
  let result = ''
  for (const die of dice) {
    const sign = die.multiplier >= 0 ? '+' : '-'
    if (result.length > 0 || sign === '-') {
      result += sign
    }
    if (die.sides === 1) {
      result += die.count
    } else {
      if (die.count === 1) {
        result += `d${die.sides}`
      } else {
        result += `${die.count}d${die.sides}`
      }
    }
    if (Math.abs(die.multiplier) !== 1) {
      result += `×${Math.abs(die.multiplier)}`
    }
  }
  return result
}
