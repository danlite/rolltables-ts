import {RegisteredTable} from "./tables"

export interface Drop {
  type: "highest" | "lowest"
  number: number
}

export interface DieStructure {
  count: number
  sides: number
  multiplier: number
  drop?: Drop
}

interface TableRowContext {
  [k: string]: number
}

interface TableBundleContext extends TableRowContext {
  $previousRoll: number
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
  roll: number
  evaluation: PlaceholderEvaluationResults
  evaluatedMeta?: RollResult[][]
}

export interface Table {
  dice: Die[]
  rows: TableRow[]
  title: string
  inputs?: {[key: string]: TableRef}
  extraResults?: string
  autoEvaluate?: boolean
  selectable?: boolean
  selectablePrompt?: string
}

export interface MultiDimensionalTable {
  dice: Die[]
  rows: MultiDimensionalTableRow[]
  title: string
  inputs?: {[key: string]: TableRef}
  extraResults?: string
  autoEvaluate?: boolean
  dimensions: string[]
}

interface TableRef {
  path: string // relative ("./gems" or "../../phb/classes") or absolute ("dmg/dungeons/location")
  title?: string
  rollCount?: number | string // constant number or key from context
  total?: number | string // constant number or key from context
  dice?: string
  unique?: boolean
  ignore?: number | string | Array<number | string>
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

interface TableRollOptions {
  dice?: Die[]
  total?: number
  modifier?: number
  reroll?: number[]
  currentDepth?: number
}
