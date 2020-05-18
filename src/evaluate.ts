import chalk from 'chalk'
import {PlaceholderEvaluationResults} from './types'
import {parseDice, parseInteger} from './parse'
import {rollDice, formatDice} from './dice'
import {rollTableRef} from './rolltables'
import {RegisteredTable} from './RegisteredTable'

interface TextInputModifiers {
  transform?: 'u' | 'l'
  colour?: string
  colourBackground?: string
  index?: number
}

const patternFromKey = (key: string): RegExp =>
  new RegExp(
    '\\[' +
      key +
      '(:c=\\w+)?' +
      '(:cbg=\\w+)?' +
      '(:t=[lu])?' +
      '(:\\[\\d+])?' +
      '\\]',
  )

export const evaluatePlaceholders = (
  text: string,
): {
  text: string
  results: PlaceholderEvaluationResults
} => {
  const results: PlaceholderEvaluationResults = {}

  // [[@key:4d6]]
  let match
  // eslint-disable-next-line no-constant-condition
  while (true) {
    match = text.match(/\[\[@(\w+):([^[\]]+)\]\]/)
    if (match) {
      const dice = parseDice(match[2])
      const diceResult = rollDice(dice)
      results[match[1]] = {dice, result: diceResult}
      const matchedText = match[0]
      const formattedDice = formatDice(dice)
      const formattedTotal = chalk.yellow(
        '(' + diceResult.total.toLocaleString() + ')',
      )
      text = text.replace(
        matchedText,
        formattedDice === diceResult.total.toString()
          ? formattedTotal
          : formattedDice + ' ' + formattedTotal,
      )
    } else {
      break
    }
  }

  interface PercentSection {
    percent: number
    text: string
  }

  const finalTextParts: Array<PercentSection | string> = []
  const percentSections: PercentSection[] = []

  // [[text (50%)]]
  // eslint-disable-next-line no-constant-condition
  while (true) {
    match = text.match(
      /\[\[(?<text1>[^\]]+ \(?(?<number1>\d+)(?:%| percent)\)?)\]\]|\[\[(?<text2>\(?(?<number2>\d+)(?:%| percent)\)? [^\]]+)\]\]/,
    )
    if (match && match.groups) {
      const percent = parseInteger(match.groups.number1 || match.groups.number2)
      const index = match.index as number
      const innerText = match.groups.text1 || match.groups.text2
      const percentSection = {
        percent,
        text: innerText,
      }
      text = text.replace(match[0], innerText)
      // console.log(text)
      finalTextParts.push(text.substring(0, index))
      finalTextParts.push(percentSection)
      percentSections.push(percentSection)
      text = text.substring(index + innerText.length)
    } else {
      finalTextParts.push(text)
      break
    }
  }

  const randomPercent = Math.floor(Math.random() * 100) + 1
  const choosePercent = (rand: number): PercentSection | undefined => {
    let sum = 0
    for (const item of percentSections) {
      sum += item.percent
      if (sum >= rand) {
        return item
      }
    }
  }
  const chosenSection = choosePercent(randomPercent)

  // const colorizeText = (
  //   text: string,
  //   start: number,
  //   length: number,
  //   style: Chalk,
  // ): string => {
  //   return [
  //     text.substring(0, start),
  //     style(text.substring(start, start + length)),
  //     text.substring(start + length),
  //   ].join('')
  // }

  if (chosenSection) {
    let chosenStyle = chalk.green
    const firstWord = chosenSection.text.split(' ')[0].toLowerCase()
    try {
      chosenStyle = chalk.keyword(firstWord)
    } catch {
      // No style
    }

    for (const section of percentSections) {
      const style =
        section === chosenSection
          ? chosenStyle
          : firstWord.match(/^gr[ae]y$/)
          ? (s: string): string => s
          : chalk.gray

      section.text = style(section.text)
    }
  }

  text = finalTextParts
    .map((s) => (typeof s === 'string' ? s : s.text))
    .join('')

  return {
    text,
    results,
  }
}

const modifiersFromTextAndKey = (
  text: string,
  key: string,
): TextInputModifiers => {
  const modifiers: TextInputModifiers = {}

  const pattern = patternFromKey(key)
  const match = text.match(pattern)

  if (!match) {
    return modifiers
  }

  const transform = match[3]
  if (transform) {
    modifiers.transform = transform.split(
      '=',
    )[1] as TextInputModifiers['transform']
  }
  const colour = match[1]
  if (colour) {
    modifiers.colour = colour.split('=')[1]
  }
  const colourBg = match[2]
  if (colourBg) {
    modifiers.colourBackground = colourBg.split('=')[1]
  }
  const resultIndex = match[4]
  if (resultIndex) {
    modifiers.index = parseInt(resultIndex.replace(/[^\d]/g, ''), 10)
  }

  return modifiers
}

/**
 * NOTE: keys must not have special regexp characters
 */
export const applyInputsToText = async (
  text: string,
  table: RegisteredTable,
  existingInputValues?: {[key: string]: string[]},
): Promise<string> => {
  if (!table.inputs) {
    return text
  }
  const requiredInputKeys: string[] = []
  existingInputValues = existingInputValues || {}

  for (const key of Object.keys(table.inputs)) {
    const pattern = patternFromKey(key)
    const match = text.match(pattern)
    if (match) {
      requiredInputKeys.push(key)
    } else {
      continue
    }

    if (key in existingInputValues) {
      continue
    }
    const tableRef = table.inputs[key]
    existingInputValues[key] = (await rollTableRef(tableRef, {}, table)).map(
      (r) => r.row.text,
    )
  }

  for (const key of requiredInputKeys) {
    const value = existingInputValues[key]
    const pattern = patternFromKey(key)
    while (text.match(pattern)) {
      const modifiers: TextInputModifiers = modifiersFromTextAndKey(text, key)

      const index = modifiers?.index ?? 0
      let textValue = typeof value === 'string' ? value : value[index]

      if (modifiers?.transform === 'l') {
        textValue = textValue.toLowerCase()
      } else if (modifiers?.transform === 'u') {
        textValue = textValue.toUpperCase()
      }

      if (modifiers.colour) {
        textValue = chalk.keyword(modifiers.colour)(textValue)
      }
      if (modifiers.colourBackground) {
        textValue = chalk.bgKeyword(modifiers.colourBackground)(textValue)
      }

      text = text.replace(pattern, textValue)
    }
  }

  return text
}
