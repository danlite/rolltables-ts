import chalk from 'chalk'
import {getRollable, isBundle} from './tables'
import {
  RollResult,
  TableBundleContext,
  TableRef,
  TableRollOptions,
  TableRowContext,
} from './types'
import {getDiceRange, Range} from './range'
import {parseDice} from './parse'
import {RegisteredTable} from './RegisteredTable'
import {RegisteredBundle} from './RegisteredBundle'

const rangeForResultOnTable = (
  result: number,
  table: RegisteredTable,
): number[] => {
  const row = table.rowForRoll(result)
  if (row) {
    const range =
      typeof row.range === 'number'
        ? new Range(row.range)
        : new Range(row.range[0], row.range[1])

    return range.members()
  }
  return []
}

export const evaluateRollResultTables = async (
  rollResult: RollResult,
  currentDepth: number,
): Promise<RollResult[][]> => {
  if (!rollResult.evaluatedTables) {
    rollResult.evaluatedTables = await rollResult.row.evaluateMeta(
      rollResult.table,
      currentDepth,
    )
  }

  return rollResult.evaluatedTables
}

const valueInContext = (
  value: string | number | undefined,
  context: TableRowContext,
  defaultValue = 0,
): number => {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string' && value in context) {
    return context[value] || defaultValue
  }
  return defaultValue
}

export const rollBundleOrTable = async (
  rollable: RegisteredBundle | RegisteredTable,
  opts: TableRollOptions = {},
): Promise<RollResult[][]> => {
  const currentDepth = opts.currentDepth || 0
  const context: TableBundleContext = {$previousRoll: 0}

  if (isBundle(rollable)) {
    return await rollable.roll(context, currentDepth)
  } else {
    return [[await rollable.roll({currentDepth})]]
  }
}

export const rollTableRef = async (
  tableRef: TableRef,
  context: TableRowContext,
  relativeToTable?: RegisteredTable | string,
  currentDepth = 0,
): Promise<RollResult[]> => {
  let results: RollResult[] = []
  const otherRollable = await getRollable(
    tableRef.path,
    typeof relativeToTable === 'string'
      ? relativeToTable
      : relativeToTable?.identifier,
  )
  const rollCount = valueInContext(tableRef.rollCount, context, 1)
  const modifier = valueInContext(tableRef.modifier, context, 0)
  const reroll: number[] = Array.isArray(tableRef.ignore)
    ? tableRef.ignore.map((i): number => valueInContext(i, context))
    : [valueInContext(tableRef.ignore, context, 99999)]

  const rollOptions: TableRollOptions = {currentDepth}
  if (tableRef.dice) {
    rollOptions.dice = parseDice(tableRef.dice)
  }
  if (tableRef.total) {
    rollOptions.total = valueInContext(tableRef.total, context)
  }

  for (let i = 0; i < rollCount; i++) {
    if (isBundle(otherRollable)) {
      results = results.concat(
        ...(await rollBundleOrTable(otherRollable, rollOptions)),
      )
    } else if (otherRollable) {
      const customizedRollable = otherRollable.clone()
      if (tableRef.title) {
        customizedRollable.title = tableRef.title
      }
      const result = await customizedRollable.roll({
        ...rollOptions,
        modifier,
        reroll,
      })
      results.push(result)
      if (tableRef.unique) {
        reroll.push(...rangeForResultOnTable(result.total, otherRollable))
      }
    }
  }
  return results
}

export const testTable = async (table: RegisteredTable): Promise<void> => {
  const tableRange = getDiceRange(table.dice)
  let showedExtraResults = false
  console.log()
  console.log(chalk.gray(table.identifier))
  console.log(chalk.greenBright(table.title))
  for (let r = tableRange.min; r <= tableRange.max; r++) {
    const result = await table.roll({dice: table.dice, total: r})
    if (!showedExtraResults) {
      if (result.extraResults) {
        console.log(chalk.keyword('orange')(result.extraResults.text))
      }
      showedExtraResults = true
    }
    console.log(
      chalk.whiteBright(r.toString()) + ': ' + chalk.white(result.row.text),
    )
    const related = await result.row.evaluateMeta(table, 0)
    let displayedTitle: string | null = null
    for (const refResults of related) {
      for (const refResult of refResults) {
        if (refResult.table.title !== displayedTitle) {
          console.log(chalk.blueBright('  ' + refResult.table.title + ': '))
          displayedTitle = refResult.table.title
        }
        console.log('  - ' + refResult.row.text)
      }
    }
  }
}
