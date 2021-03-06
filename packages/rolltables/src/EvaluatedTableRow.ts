import {TableRow} from './TableRow'
import {RegisteredTable} from './RegisteredTable'
import {
  RollResult,
  PlaceholderEvaluationResults,
  TableRowContext,
} from './types'
import {rollTableRef} from './rolltables'
import {evaluatePlaceholders, applyInputsToText} from './evaluate'

export interface EvaluatedTableRow extends TableRow {
  roll: number
  evaluation: PlaceholderEvaluationResults
  evaluatedMeta?: RollResult[][]
}

export class EvaluatedTableRow extends TableRow implements EvaluatedTableRow {
  private _initialContext: TableRowContext | undefined
  constructor(
    row: TableRow,
    roll: number,
    evaluation: PlaceholderEvaluationResults,
    evaluatedMeta?: RollResult[][],
    context?: TableRowContext,
  ) {
    super(row.range, row.text, row.meta)
    this.roll = roll
    this.evaluation = evaluation
    this.evaluatedMeta = evaluatedMeta
    this._initialContext = context
  }

  static async fromRow(
    row: TableRow,
    roll: number,
    table: RegisteredTable,
    inputValues?: {[key: string]: string[]},
    context?: TableRowContext,
  ): Promise<EvaluatedTableRow> {
    const evaluation = evaluatePlaceholders(row.text)
    const textWithInputs = await applyInputsToText(
      evaluation.text,
      table,
      inputValues,
    )

    const evaluated = new EvaluatedTableRow(
      row,
      roll,
      evaluation.results,
      undefined,
      context,
    )
    evaluated.text = textWithInputs
    return evaluated
  }

  async evaluateMeta(
    table: RegisteredTable,
    currentDepth: number,
  ): Promise<RollResult[][]> {
    if (this.evaluatedMeta) {
      // console.warn('already evaluated meta...')
    }
    const context = this.getContext()
    this.evaluatedMeta = await Promise.all(
      (this.meta || []).map((tableRef) =>
        rollTableRef(tableRef, context, table, currentDepth),
      ),
    )
    return this.evaluatedMeta
  }

  getContext(): TableRowContext {
    const context: TableRowContext = {...this._initialContext, $roll: this.roll}
    for (const identifier of Object.keys(this.evaluation)) {
      context[identifier] = this.evaluation[identifier].result.total
    }
    return context
  }
}
