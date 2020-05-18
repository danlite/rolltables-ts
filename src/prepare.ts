import {getDiceRange, parseRange} from './range'
import {
  MultiDimensionalTableRow,
  Die,
  MultiDimensionalTable,
  TableRef,
} from './types'
import {TableRow} from './TableRow'
import {parseDice} from './parse'
import {Table} from './RegisteredTable'

const ROW_SEPARATOR = '|'

export const getDimensionIdentifiers = (
  table: Pick<MultiDimensionalTable, 'dimensions'>,
): string[] =>
  table.dimensions.map((dim) =>
    dim
      .toLowerCase()
      .replace(/[^0-9a-zA-Z]/, '-')
      .replace(/--+/, '-'),
  )

const isTableRowArray = (
  input: string | Array<string | TableRow | TableRef>,
): input is TableRow[] =>
  typeof input !== 'string' &&
  typeof input[0] !== 'string' &&
  !('path' in input[0]) &&
  input[0].range !== undefined &&
  input[0].text !== undefined

const parseRollTableRows = (
  texts: string | Array<string | TableRef>,
  simple?: boolean,
): TableRow[] => {
  if (typeof texts === 'string') {
    texts = [texts]
  }

  let ret: TableRow[] = []
  let rowIndex = 1

  for (const item of texts) {
    if (typeof item === 'string') {
      const lines = item.split('\n')
      const rows: TableRow[] = lines
        .map((line) => {
          if (simple) {
            return new TableRow(rowIndex++, line, [])
          }
          const [rangeString, rowText] = line.split(ROW_SEPARATOR, 2)
          const range = parseRange(rangeString)
          if (range === null) {
            return null
          }
          return new TableRow(range, rowText, [])
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
    if (typeof row.range === 'number') {
      rowMin = rowMax = row.range
    } else {
      rowMin = row.range[0]
      rowMax = row.range[1]
    }

    min = Math.min(min, rowMin)
    max = Math.max(max, rowMax)

    for (let i = rowMin; i <= rowMax; i++) {
      if (numbers[i]) {
        console.error(i + ' found more than once')
        return false
      }
      numbers[i] = true
    }
  }

  if (max - min + 1 !== Object.keys(numbers).length) {
    console.error('range covered by rows is non-continuous')
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

export const prepareTable = (
  input: {
    dice?: Die[] | string
    rows: TableRow[] | string | Array<string | TableRef>
  } & Pick<
    Table,
    | 'title'
    | 'extraResults'
    | 'autoEvaluate'
    | 'inputs'
    | 'selectable'
    | 'selectablePrompt'
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
  if (dice === '#' || dice === undefined) {
    dice = undefined
    simple = true
  }
  const parsedRows = isTableRowArray(rows)
    ? rows
    : parseRollTableRows(rows, simple)

  const parsedDice =
    typeof dice === 'string'
      ? parseDice(dice)
      : typeof dice === 'object'
      ? dice
      : parseDice('d' + parsedRows.length)

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
  if (!validateTable(table)) {
    console.error(title)
  }
  return table
}

export const prepareSimpleTable = (
  input: {
    rows: string
  } & Pick<Table, 'title' | 'extraResults' | 'autoEvaluate' | 'inputs'>,
): Table => {
  const {title, extraResults, rows, autoEvaluate, inputs} = input
  const parsedRows: TableRow[] = rows
    .split('\n')
    .map((line, i) => new TableRow(i + 1, line, []))
  const table = {
    title,
    autoEvaluate,
    extraResults,
    inputs,
    rows: parsedRows,
    dice: parseDice('d' + parsedRows.length),
  }
  validateTable(table)
  return table
}

export const prepareMultiDimensionalTable = (
  input: {
    dice: Die[] | string
    rows: MultiDimensionalTableRow[]
  } & Pick<
    MultiDimensionalTable,
    'title' | 'extraResults' | 'autoEvaluate' | 'dimensions' | 'inputs'
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
    throw new Error('no dimensions provided')
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
            const range = parseRange(row.range.split('/')[dimIndex])
            if (range === null) {
              return null
            }
            return new TableRow(range, row.text, row.meta)
          })
          .filter((t: TableRow | null): t is TableRow => t !== null),
      })
    },
  )
}
