import * as inquirer from 'inquirer'

import {Die, TableRef, TableRollOptions, RollResult} from './types'
import {TableRow} from './TableRow'
import {getDiceRange, rangeMin} from './range'
import {rollDice} from './dice'
import {applyInputsToText, evaluatePlaceholders} from './evaluate'
import {EvaluatedTableRow} from './EvaluatedTableRow'

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

export interface RegisteredTable extends Table {
  identifier: string
}

const numberMatchesRow = (n: number) => (row: TableRow): boolean => {
  if (typeof row.range === 'number') {
    if (row.range === n) {
      return true
    } else {
      return false
    }
  }
  return row.range[0] <= n && row.range[1] >= n
}

export class RegisteredTable implements RegisteredTable {
  constructor(
    identifier: string,
    dice: Die[],
    rows: TableRow[],
    title: string,
    inputs?: {[key: string]: TableRef},
    extraResults?: string,
    autoEvaluate?: boolean,
    selectable?: boolean,
    selectablePrompt?: string,
  ) {
    this.identifier = identifier
    this.dice = dice
    this.rows = rows
    this.title = title
    this.inputs = inputs
    this.extraResults = extraResults
    this.autoEvaluate = autoEvaluate
    this.selectable = selectable
    this.selectablePrompt = selectablePrompt
  }

  rowForRoll(roll: number): TableRow | undefined {
    const row = this.rows.find(numberMatchesRow(roll))
    const tableRange = getDiceRange(this.dice)
    if (roll < tableRange.min) {
      return this.rows[0]
    } else if (roll > tableRange.max) {
      return this.rows[this.rows.length - 1]
    }
    return row
  }

  async roll(opts: TableRollOptions = {}): Promise<RollResult> {
    let {dice, total, currentDepth} = opts
    if (this.selectable && total === undefined) {
      let selectedTotal = 1
      // TODO: only in context of CLI
      // eslint-disable-next-line no-constant-condition
      if (process.env.ROLLTABLE_CLI) {
        const answer = await inquirer.prompt([
          {
            message: this.selectablePrompt,
            name: 'rowSelection',
            type: 'list',
            choices: this.rows.map((r) => ({
              name: r.text,
              short: r.text,
              value: rangeMin(r),
            })),
          },
        ])
        selectedTotal = answer.rowSelection
      }
      return this.roll({...opts, total: selectedTotal})
    }
    const {modifier, reroll} = opts
    if (currentDepth === undefined) {
      currentDepth = 0
    }
    if (reroll && total !== undefined && reroll.includes(total)) {
      total = undefined
    }
    if (!dice) {
      dice = this.dice
    }
    if (total === undefined) {
      do {
        total = rollDice(dice).total + (modifier || 0)
      } while (reroll !== undefined && reroll.includes(total))
    }
    const row = this.rowForRoll(total)
    if (!row) {
      throw new Error(`bad roll! ${total} on ${this.identifier}`)
    }

    const inputValues: {[key: string]: string[]} = {}
    const evaluatedRow = await EvaluatedTableRow.fromRow(
      row,
      total,
      this,
      inputValues,
    )
    let evaluatedTables: RollResult[][] | undefined
    if (this.autoEvaluate && currentDepth < 10) {
      evaluatedTables = await evaluatedRow.evaluateMeta(this, currentDepth + 1)
    }

    const extraResults = this.extraResults
      ? evaluatePlaceholders(this.extraResults)
      : undefined

    if (extraResults) {
      extraResults.text = await applyInputsToText(
        extraResults.text,
        this,
        inputValues,
      )
    }

    return {
      table: this,
      dice,
      total,
      evaluatedTables,
      row: evaluatedRow,
      extraResults,
    }
  }

  clone(): RegisteredTable {
    return new RegisteredTable(
      this.identifier,
      this.dice,
      this.rows,
      this.title,
      this.inputs,
      this.extraResults,
      this.autoEvaluate,
      this.selectable,
      this.selectablePrompt,
    )
  }
}
