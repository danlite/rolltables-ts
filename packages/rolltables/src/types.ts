import {EvaluatedTableRow} from './EvaluatedTableRow'
import {RegisteredTable} from './RegisteredTable'

export interface Drop {
  type: 'highest' | 'lowest'
  number: number
}

export interface DieStructure {
  count: number
  sides: number
  multiplier: number
  drop?: Drop
}

export interface TableRowContext {
  [k: string]: number
}

export interface TableBundleContext extends TableRowContext {
  $previousRoll: number
}

export type Die = DieStructure

export interface MultiDimensionalTableRow {
  range: string
  text: string
  meta?: TableRef[]
}

export interface PlaceholderEvaluationResults {
  [k: string]: {dice: Die[]; result: DiceRollResult}
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

export interface TableRef {
  path: string // relative ("./gems" or "../../phb/classes") or absolute ("dmg/dungeons/location")
  title?: string
  rollCount?: number | string // constant number or key from context
  total?: number | string // constant number or key from context
  dice?: string
  unique?: boolean
  ignore?: number | string | Array<number | string>
  modifier?: number | string
  store?: {
    [key: string]: '$roll' | `@${string}`
  }
}

export interface DiceRollResult {
  total: number
  rolls: number[][]
}

export interface RollResult {
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

export interface TableRollOptions {
  dice?: Die[]
  total?: number
  modifier?: number
  reroll?: number[]
  currentDepth?: number
  context?: TableRowContext
}
