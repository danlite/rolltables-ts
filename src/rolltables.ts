/* eslint-disable @typescript-eslint/no-use-before-define */
import chalk from "chalk"
import * as inquirer from "inquirer"
import {
  getRollable,
  isBundle,
  RegisteredBundle,
  RegisteredTable,
} from "./tables"
import {
  DiceRollResult,
  Die,
  EvaluatedTableRow,
  MultiDimensionalTable,
  MultiDimensionalTableRow,
  PlaceholderEvaluationResults,
  RollResult,
  Table,
  TableBundleContext,
  TableRef,
  TableRollOptions,
  TableRow,
  TableRowContext,
} from "./types"
import {parseRange, getDiceRange, Range, rangeMin} from "./range"
import {parseDice, parseInteger} from "./parse"

const ROW_SEPARATOR = "|"

export const parseRollTableRows = (
  texts: string | Array<string | TableRef>,
  simple?: boolean,
): TableRow[] => {
  if (typeof texts === "string") {
    texts = [texts]
  }

  let ret: TableRow[] = []
  let rowIndex = 1

  for (const item of texts) {
    if (typeof item === "string") {
      const lines = item.split("\n")
      const rows: TableRow[] = lines
        .map((line) => {
          if (simple) {
            return {
              range: rowIndex++,
              text: line,
              meta: [],
            }
          }
          const [rangeString, rowText] = line.split(ROW_SEPARATOR, 2)
          const range = parseRange(rangeString)
          if (range === null) {
            return null
          }
          return {
            range,
            text: rowText,
            meta: [],
          }
        })
        .filter(<V>(r: V | null): r is V => r !== null)
      ret = [...ret, ...rows]
    } else {
      // Add this "meta" item to the previous row's `meta` array
      const prev = ret[ret.length - 1]
      if (!prev.meta) {
        prev.meta = []
      }
      prev.meta.push(item)
    }
  }

  return ret
}

const validateTable = (table: Table): boolean => {
  const {rows, dice} = table
  let min = 99999999
  let max = -99999999
  const diceRange = getDiceRange(dice)
  const numbers: {[key: number]: boolean} = {}
  for (const row of rows) {
    let rowMin
    let rowMax
    if (typeof row.range === "number") {
      rowMin = rowMax = row.range
    } else {
      rowMin = row.range[0]
      rowMax = row.range[1]
    }

    min = Math.min(min, rowMin)
    max = Math.max(max, rowMax)

    for (let i = rowMin; i <= rowMax; i++) {
      if (numbers[i]) {
        console.error(i + " found more than once")
        return false
      }
      numbers[i] = true
    }
  }

  if (max - min + 1 !== Object.keys(numbers).length) {
    console.error("range covered by rows is non-continuous")
    return false
  }
  if (max < diceRange.max) {
    console.error(`dice may roll above max (${diceRange.max} vs. ${max})`)
    return false
  }
  if (min < diceRange.min) {
    console.error(`dice may roll below min (${diceRange.min} vs. ${min})`)
    return false
  }

  return true
}

const rollDice = (dice: Die[]): DiceRollResult => {
  let total = 0
  const rolls = dice.map((die) => {
    const dieRolls = []
    if (typeof die === "number") {
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
        die.drop.type === "highest" ? Number.MIN_VALUE : Number.MAX_VALUE
      const comparator = die.drop.type === "highest" ? Math.max : Math.min

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

const rowForRoll = (
  table: RegisteredTable,
  roll: number,
): TableRow | undefined => {
  const row = table.rows.find(numberMatchesRow(roll))
  const tableRange = getDiceRange(table.dice)
  if (roll < tableRange.min) {
    return table.rows[0]
  } else if (roll > tableRange.max) {
    return table.rows[table.rows.length - 1]
  }
  return row
}

// export const rollOn = async(rollable: RegisteredRollable) => {
//   if (isTable(rollable)) {
//     return rollOnTable(rollable)
//   }
//   return rollBundle(rollable)
// }

export const rollOnTable = async (
  table: RegisteredTable,
  opts: TableRollOptions = {},
): Promise<RollResult> => {
  let {dice, total, currentDepth} = opts
  if (table.selectable && total === undefined) {
    let selectedTotal = 1
    // TODO: only in context of CLI
    // eslint-disable-next-line no-constant-condition
    if (true) {
      const answer = await inquirer.prompt([
        {
          message: table.selectablePrompt,
          name: "rowSelection",
          type: "list",
          choices: table.rows.map((r) => ({
            name: r.text,
            short: r.text,
            value: rangeMin(r),
          })),
        },
      ])
      selectedTotal = answer.rowSelection
    }
    return rollOnTable(table, {...opts, total: selectedTotal})
  }
  const {modifier, reroll} = opts
  if (currentDepth === undefined) {
    currentDepth = 0
  }
  if (reroll && total !== undefined && reroll.includes(total)) {
    total = undefined
  }
  if (!dice) {
    dice = table.dice
  }
  if (total === undefined) {
    do {
      total = rollDice(dice).total + (modifier || 0)
    } while (reroll !== undefined && reroll.includes(total))
  }
  const row = rowForRoll(table, total)
  if (!row) {
    throw new Error(`bad roll! ${total} on ${table.identifier}`)
  }

  const inputValues: {[key: string]: string[]} = {}
  const evaluatedRow = await evaluateRow(row, total, table, inputValues)
  let evaluatedTables: RollResult[][] | undefined
  if (table.autoEvaluate && currentDepth < 10) {
    evaluatedTables = await evaluateRowMeta(
      evaluatedRow,
      table,
      currentDepth + 1,
    )
  }

  const extraResults = table.extraResults
    ? evaluatePlaceholders(table.extraResults)
    : undefined

  if (extraResults) {
    extraResults.text = await applyInputsToText(
      extraResults.text,
      table,
      inputValues,
    )
  }

  return {
    table,
    dice,
    total,
    evaluatedTables,
    row: evaluatedRow,
    extraResults,
  }
}

export const evaluateRollResultTables = async (
  rollResult: RollResult,
  currentDepth: number,
): Promise<RollResult[][]> => {
  if (!rollResult.evaluatedTables) {
    rollResult.evaluatedTables = await evaluateRowMeta(
      rollResult.row,
      rollResult.table,
      currentDepth,
    )
  }

  return rollResult.evaluatedTables
}

interface TextInputModifiers {
  transform?: "u" | "l"
  colour?: string
  colourBackground?: string
  index?: number
}

const patternFromKey = (key: string): RegExp =>
  new RegExp(
    "\\[" +
      key +
      "(:c=\\w+)?" +
      "(:cbg=\\w+)?" +
      "(:t=[lu])?" +
      "(:\\[\\d+])?" +
      "\\]",
  )

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
      "=",
    )[1] as TextInputModifiers["transform"]
  }
  const colour = match[1]
  if (colour) {
    modifiers.colour = colour.split("=")[1]
  }
  const colourBg = match[2]
  if (colourBg) {
    modifiers.colourBackground = colourBg.split("=")[1]
  }
  const resultIndex = match[4]
  if (resultIndex) {
    modifiers.index = parseInt(resultIndex.replace(/[^\d]/g, ""), 10)
  }

  return modifiers
}

/**
 * NOTE: keys must not have special regexp characters
 */
const applyInputsToText = async (
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
      let textValue = typeof value === "string" ? value : value[index]

      if (modifiers?.transform === "l") {
        textValue = textValue.toLowerCase()
      } else if (modifiers?.transform === "u") {
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

const evaluateRow = async (
  row: TableRow,
  roll: number,
  table: RegisteredTable,
  inputValues?: {[key: string]: string[]},
): Promise<EvaluatedTableRow> => {
  const evaluation = evaluatePlaceholders(row.text)
  const textWithInputs = await applyInputsToText(
    evaluation.text,
    table,
    inputValues,
  )

  return {
    ...row,
    roll,
    text: textWithInputs,
    evaluation: evaluation.results,
  }
}

export const evaluateRowMeta = async (
  row: EvaluatedTableRow,
  table: RegisteredTable,
  currentDepth: number,
): Promise<RollResult[][]> => {
  if (row.evaluatedMeta) {
    // console.warn('already evaluated meta...')
  }
  const context = contextFromEvaluatedRow(row)
  row.evaluatedMeta = await Promise.all(
    (row.meta || []).map((tableRef) =>
      rollTableRef(tableRef, context, table, currentDepth),
    ),
  )
  return row.evaluatedMeta
}

const contextFromEvaluatedRow = (row: EvaluatedTableRow): TableRowContext => {
  const context: TableRowContext = {$roll: row.roll}
  for (const identifier of Object.keys(row.evaluation)) {
    context[identifier] = row.evaluation[identifier].result.total
  }
  return context
}

const valueInContext = (
  value: string | number | undefined,
  context: TableRowContext,
  defaultValue = 0,
): number => {
  if (typeof value === "number") {
    return value
  }
  if (typeof value === "string" && value in context) {
    return context[value] || defaultValue
  }
  return defaultValue
}

const rollTableRef = async (
  tableRef: TableRef,
  context: TableRowContext,
  relativeToTable?: RegisteredTable | string,
  currentDepth = 0,
): Promise<RollResult[]> => {
  let results: RollResult[] = []
  const otherRollable = await getRollable(tableRef.path, relativeToTable)
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
      const customizedRollable = {...otherRollable}
      if (tableRef.title) {
        customizedRollable.title = tableRef.title
      }
      const result = await rollOnTable(customizedRollable, {
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

const numberMatchesRow = (n: number) => (row: TableRow): boolean => {
  if (typeof row.range === "number") {
    if (row.range === n) {
      return true
    } else {
      return false
    }
  }
  return row.range[0] <= n && row.range[1] >= n
}

const isTableRowArray = (
  input: string | Array<string | TableRow | TableRef>,
): input is TableRow[] =>
  typeof input !== "string" &&
  typeof input[0] !== "string" &&
  !("path" in input[0]) &&
  input[0].range !== undefined &&
  input[0].text !== undefined

export const getDimensionIdentifiers = (
  table: Pick<MultiDimensionalTable, "dimensions">,
): string[] =>
  table.dimensions.map((dim) =>
    dim
      .toLowerCase()
      .replace(/[^0-9a-zA-Z]/, "-")
      .replace(/--+/, "-"),
  )

export const prepareMultiDimensionalTable = (
  input: {
    dice: Die[] | string
    rows: MultiDimensionalTableRow[]
  } & Pick<
    MultiDimensionalTable,
    "title" | "extraResults" | "autoEvaluate" | "dimensions" | "inputs"
  >,
): Table[] => {
  const {
    dimensions,
    extraResults,
    rows,
    dice,
    title,
    autoEvaluate,
    inputs,
  } = input
  if (!dimensions) {
    throw new Error("no dimensions provided")
  }
  return dimensions.map(
    (dimTitle, dimIndex): Table => {
      return prepareTable({
        title: `${title} (${dimTitle})`,
        autoEvaluate,
        dice,
        extraResults,
        inputs,
        rows: rows
          .map((row): TableRow | null => {
            const range = parseRange(row.range.split("/")[dimIndex])
            if (range === null) {
              return null
            }
            return {
              ...row,
              range,
            }
          })
          .filter((t: TableRow | null): t is TableRow => t !== null),
      })
    },
  )
}

export const prepareTable = (
  input: {
    dice?: Die[] | string
    rows: TableRow[] | string | Array<string | TableRef>
  } & Pick<
    Table,
    | "title"
    | "extraResults"
    | "autoEvaluate"
    | "inputs"
    | "selectable"
    | "selectablePrompt"
  >,
): Table => {
  const {
    title,
    extraResults,
    rows,
    inputs,
    selectable,
    selectablePrompt,
  } = input
  const autoEvaluate =
    input.autoEvaluate === undefined ? true : input.autoEvaluate
  let {dice} = input
  let simple = false
  if (dice === "#" || dice === undefined) {
    dice = undefined
    simple = true
  }
  const parsedRows = isTableRowArray(rows)
    ? rows
    : parseRollTableRows(rows, simple)

  const parsedDice =
    typeof dice === "string"
      ? parseDice(dice)
      : typeof dice === "object"
      ? dice
      : parseDice("d" + parsedRows.length)

  const table = {
    title,
    autoEvaluate,
    extraResults,
    inputs,
    selectable,
    selectablePrompt,
    dice: parsedDice,
    rows: parsedRows,
  }
  validateTable(table)
  return table
}

export const prepareSimpleTable = (
  input: {
    rows: string
  } & Pick<Table, "title" | "extraResults" | "autoEvaluate" | "inputs">,
): Table => {
  const {title, extraResults, rows, autoEvaluate, inputs} = input
  const parsedRows = rows.split("\n").map((line, i) => ({
    range: i + 1,
    text: line,
    meta: [],
  }))
  const table = {
    title,
    autoEvaluate,
    extraResults,
    inputs,
    rows: parsedRows,
    dice: parseDice("d" + parsedRows.length),
  }
  validateTable(table)
  return table
}

export const formatDice = (dice: Die[]): string => {
  let result = ""
  for (const die of dice) {
    const sign = die.multiplier >= 0 ? "+" : "-"
    if (result.length > 0 || sign === "-") {
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
        "(" + diceResult.total.toLocaleString() + ")",
      )
      text = text.replace(
        matchedText,
        formattedDice === diceResult.total.toString()
          ? formattedTotal
          : formattedDice + " " + formattedTotal,
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
    const firstWord = chosenSection.text.split(" ")[0].toLowerCase()
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
    .map((s) => (typeof s === "string" ? s : s.text))
    .join("")

  return {
    text,
    results,
  }
}

export const testTable = async (table: RegisteredTable): Promise<void> => {
  const tableRange = getDiceRange(table.dice)
  let showedExtraResults = false
  console.log()
  console.log(chalk.gray(table.identifier))
  console.log(chalk.greenBright(table.title))
  for (let r = tableRange.min; r <= tableRange.max; r++) {
    const result = await rollOnTable(table, {dice: table.dice, total: r})
    if (!showedExtraResults) {
      if (result.extraResults) {
        console.log(chalk.keyword("orange")(result.extraResults.text))
      }
      showedExtraResults = true
    }
    console.log(
      chalk.whiteBright(r.toString()) + ": " + chalk.white(result.row.text),
    )
    const related = await evaluateRowMeta(result.row, table, 0)
    let displayedTitle: string | null = null
    for (const refResults of related) {
      for (const refResult of refResults) {
        if (refResult.table.title !== displayedTitle) {
          console.log(chalk.blueBright("  " + refResult.table.title + ": "))
          displayedTitle = refResult.table.title
        }
        console.log("  - " + refResult.row.text)
      }
    }
  }
}

export const rollBundleOrTable = async (
  rollable: RegisteredBundle | RegisteredTable,
  opts: TableRollOptions = {},
): Promise<RollResult[][]> => {
  const currentDepth = opts.currentDepth || 0
  let context: TableBundleContext = {$previousRoll: 0}
  const tableResults: RollResult[][] = []
  if (isBundle(rollable)) {
    for (const tableRef of rollable.tables) {
      const results = await rollTableRef(
        tableRef,
        context,
        rollable.identifier,
        currentDepth,
      )
      tableResults.push(results)
      for (const result of results) {
        // TODO: figure out how/why we'd merge the contexts from several rolls of the same table
        context = Object.assign(context, contextFromEvaluatedRow(result.row), {
          $previousRoll: result.total,
        })
      }
    }
  } else {
    const results = await rollOnTable(rollable, {currentDepth})
    tableResults.push([results])
  }
  return tableResults
}

const rangeForResultOnTable = (
  result: number,
  table: RegisteredTable,
): number[] => {
  const row = rowForRoll(table, result)
  if (row) {
    const range =
      typeof row.range === "number"
        ? new Range(row.range)
        : new Range(row.range[0], row.range[1])

    return range.members()
  }
  return []
}
