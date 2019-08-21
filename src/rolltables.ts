import chalk from "chalk"
import {
  isBundle,
  isTable,
  getRollable,
  RegisteredBundle,
  RegisteredRollable,
  RegisteredTable,
} from "./tables"
import {
  DiceRollResult,
  Die,
  EvaluatedTableRow,
  PlaceholderEvaluationResults,
  RollResult,
  Table,
  TableBundle,
  TableRef,
  TableRollOptions,
  TableRow,
  TableRowContext,
  MultiDimensionalTableRow,
  MultiDimensionalTable,
} from "./types"

const parseInteger = (s: string) => parseInt(s, 10)
const parseRollInteger = (s: string) => (s === "00" ? 100 : parseInteger(s))

const parseDie = (text: string): Die | null => {
  const match = text.match(/(-)?(\d*)d(\d+)(?:\*(-?\d+))?/)
  if (match) {
    const multiplierFromSign = match[1] ? -1 : 1
    const extraMultiplier = match[4] ? parseInteger(match[4]) : 1
    return {
      count: parseInteger(match[2]) || 1,
      multiplier: multiplierFromSign * extraMultiplier,
      sides: parseInteger(match[3]),
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
  const diceMatches = text.replace(/\s/g, "").match(pattern)
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

const ROW_SEPARATOR = "|"

export const parseRollTableRows = (
  texts: string | Array<string | TableRef>,
  simple?: boolean,
) => {
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
      if (!prev.meta) prev.meta = []
      prev.meta.push(item)
    }
  }

  return ret
}

const parseRange = (range: string) => {
  const match = range.trim().match(/^(\d+)(?:[^\d](\d+))?$/)

  if (!match) {
    return null
  }

  if (match[2]) {
    return [parseRollInteger(match[1]), parseRollInteger(match[2])]
  }

  return parseRollInteger(match[1])
}

interface Range {
  min: number
  max: number
}

class Range implements Range {
  constructor(...numbers: [number] | [number, number]) {
    this.min = Math.min(...numbers)
    this.max = Math.max(...numbers)
  }

  public multiply(factor: number) {
    return new Range(this.min * factor, this.max * factor)
  }

  public add(range: Range) {
    return new Range(this.min + range.min, this.max + range.max)
  }

  public toString() {
    return `[${this.min},${this.max}]`
  }
}

const getDieRange = (die: Die): Range => {
  if (typeof die === "number") {
    return new Range(die)
  } else {
    const result: Range = new Range(die.count, die.count * die.sides)
    return result.multiply(die.multiplier)
  }
}

const getDiceRange = (dice: Die[]): Range => {
  return dice.reduce((result: Range, die: Die) => {
    return getDieRange(die).add(result)
  }, new Range(0))
}

const validateTable = (table: Table) => {
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
      total += die
      dieRolls.push(die)
    } else {
      for (let i = 0; i < die.count; i++) {
        let roll = Math.floor(Math.random() * die.sides) + 1
        roll *= die.multiplier
        total += roll
        dieRolls.push(roll)
      }
    }
    return dieRolls
  })

  return {total, rolls}
}

const rowForRoll = (table: RegisteredTable, roll: number) => {
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
    throw new Error("bad roll!")
  }
  const evaluatedRow = evaluateRow(row)
  let evaluatedTables: RollResult[][] | undefined
  if (table.autoEvaluate && currentDepth < 10) {
    evaluatedTables = await evaluateRowMeta(
      evaluatedRow,
      table,
      currentDepth + 1,
    )
  }
  return {
    table,
    dice,
    total,
    evaluatedTables,
    row: evaluatedRow,
    extraResults: table.extraResults
      ? evaluatePlaceholders(table.extraResults)
      : undefined,
  }
}

export const evaluateRollResultTables = async (
  rollResult: RollResult,
  currentDepth: number,
) => {
  if (!rollResult.evaluatedTables) {
    rollResult.evaluatedTables = await evaluateRowMeta(
      rollResult.row,
      rollResult.table,
      currentDepth,
    )
  }

  return rollResult.evaluatedTables
}

const evaluateRow = (row: TableRow): EvaluatedTableRow => {
  const evaluation = evaluatePlaceholders(row.text)
  return {
    ...row,
    text: evaluation.text,
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
  const context: TableRowContext = {}
  for (const identifier of Object.keys(row.evaluation)) {
    context[identifier] = row.evaluation[identifier].result.total
  }
  return context
}

const rollTableRef = async (
  tableRef: TableRef,
  context: TableRowContext,
  relativeToTable?: RegisteredTable | string,
  currentDepth: number = 0,
) => {
  let results: RollResult[] = []
  const otherRollable = await getRollable(tableRef.path, relativeToTable)

  const rawCount = tableRef.rollCount
  const rollCount =
    typeof rawCount === "number"
      ? rawCount
      : typeof rawCount === "string" && rawCount in context
      ? context[rawCount]
      : 1

  const rawModifier = tableRef.modifier
  const modifier =
    typeof rawModifier === "number"
      ? rawModifier
      : typeof rawModifier === "string" && rawModifier in context
      ? context[rawModifier]
      : 0

  const reroll =
    typeof tableRef.ignore === "number"
      ? [tableRef.ignore]
      : tableRef.ignore || []

  const rollOptions: TableRollOptions = {currentDepth}
  if (tableRef.dice) {
    rollOptions.dice = parseDice(tableRef.dice)
  }

  for (let i = 0; i < rollCount; i++) {
    if (isBundle(otherRollable)) {
      results = results.concat(
        ...(await rollBundleOrTable(otherRollable, rollOptions)),
      )
    } else if (otherRollable) {
      const result = await rollOnTable(otherRollable, {
        ...rollOptions,
        modifier,
        reroll,
      })
      results.push(result)
      if (tableRef.unique) {
        // TODO: reroll.push(<all numbers that match `result`>)
        reroll.push(result.total)
      }
    }
  }
  return results
}

const numberMatchesRow = (n: number) => (row: TableRow) => {
  if (typeof row.range === "number") {
    if (row.range === n) {
      return true
    } else {
      return false
    }
  }
  return row.range[0] <= n && row.range[1] >= n
}

const isTableRowArray = (input: string | any[]): input is TableRow[] =>
  typeof input !== "string" &&
  input[0].range !== undefined &&
  input[0].text !== undefined

export const getDimensionIdentifiers = (
  table: Pick<MultiDimensionalTable, "dimensions">,
) =>
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
    "title" | "extraResults" | "autoEvaluate" | "dimensions"
  >,
): Table[] => {
  const {dimensions, extraResults, rows, dice, title, autoEvaluate} = input
  if (!dimensions) throw "no dimensions provided"
  return dimensions.map(
    (dimTitle, dimIndex): Table => {
      return prepareTable({
        title: `${title} (${dimTitle})`,
        autoEvaluate,
        dice,
        extraResults,
        rows: rows
          .map(
            (row): TableRow | null => {
              const range = parseRange(row.range.split("/")[dimIndex])
              if (range === null) return null
              return {
                ...row,
                range,
              }
            },
          )
          .filter(<TableRow>(t: TableRow | null): t is TableRow => t !== null),
      })
    },
  )
}

export const prepareTable = (
  input: {
    dice?: Die[] | string
    rows: TableRow[] | string | Array<string | TableRef>
  } & Pick<Table, "title" | "extraResults" | "autoEvaluate">,
): Table => {
  const {title, extraResults, rows} = input
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
    dice: parsedDice,
    rows: parsedRows,
  }
  validateTable(table)
  return table
}

export const prepareSimpleTable = (
  input: {
    rows: string
  } & Pick<Table, "title" | "extraResults" | "autoEvaluate">,
): Table => {
  const {title, extraResults, rows, autoEvaluate} = input
  const parsedRows = rows.split("\n").map((line, i) => ({
    range: i + 1,
    text: line,
    meta: [],
  }))
  const table = {
    title,
    autoEvaluate,
    extraResults,
    rows: parsedRows,
    dice: parseDice("d" + parsedRows.length),
  }
  validateTable(table)
  return table
}

export const formatDice = (dice: Die[]) => {
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

export const evaluatePlaceholders = (text: string) => {
  const results: PlaceholderEvaluationResults = {}

  // [[@key:4d6]]
  let match
  while (true) {
    match = text.match(/\[\[@(\w+):([^\[\]]+)\]\]/)
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
  while (true) {
    match = text.match(
      /\[\[(?<text1>[^\]]+ \(?(?<number1>\d+)(?:%| percent)\)?)\]\]|\[\[(?<text2>\(?(?<number2>\d+)(?:%| percent)\)? [^\]]+)\]\]/,
    )
    if (match && match.groups) {
      const percent = parseInteger(
        match.groups["number1"] || match.groups["number2"],
      )
      const index = match.index as number
      const innerText = match.groups["text1"] || match.groups["text2"]
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
          ? (s: string) => s
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

export const testTable = async (table: RegisteredTable) => {
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
) => {
  const currentDepth = opts.currentDepth || 0
  let context: TableRowContext = {}
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
        context = Object.assign(context, contextFromEvaluatedRow(result.row))
      }
    }
  } else {
    const results = await rollOnTable(rollable, {currentDepth})
    tableResults.push([results])
  }
  return tableResults
}
