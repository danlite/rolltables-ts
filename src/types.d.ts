import {RegisteredTable} from "./tables"

export interface DieStructure {
  count: number
  sides: number
  multiplier: number
}

interface TableRowContext {
  [k: string]: number
}

export type Die = DieStructure

export interface TableRow {
  range: number[] | number
  text: string
  meta?: TableRef[]
}

export interface MultiDimensionalTableRow {
  range: string
  text: string
  meta?: TableRef[]
}

interface PlaceholderEvaluationResults {
  [k: string]: {dice: Die[]; result: DiceRollResult}
}

type EvaluatedTableRow = TableRow & {
  evaluation: PlaceholderEvaluationResults
  evaluatedMeta?: RollResult[][]
}

export interface Table {
  dice: Die[]
  rows: TableRow[]
  title: string
  extraResults?: string
  autoEvaluate?: boolean
}

export interface MultiDimensionalTable {
  dice: Die[]
  rows: MultiDimensionalTableRow[]
  title: string
  extraResults?: string
  autoEvaluate?: boolean
  dimensions: string[]
}

interface TableRef {
  path: string // relative ("./gems" or "../../phb/classes") or absolute ("dmg/dungeons/location")
  rollCount?: number | string // constant number or key from context
  unique?: boolean
  ignore?: number | number[]
  modifier?: number | string
}
type RowMetaFunction = (t: TableRowContext) => Promise<RollResult[]>

interface DiceRollResult {
  total: number
  rolls: number[][]
}

interface RollResult {
  table: RegisteredTable
  dice: Die[]
  total: number
  row: EvaluatedTableRow
  extraResults?: {
    text: string
    results: PlaceholderEvaluationResults
  }
  evaluatedTables?: RollResult[][]
}

interface TableBundle {
  identifier: string
  tables: TableRef[]
  title?: string
}
