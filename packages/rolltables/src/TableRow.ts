import {TableRef} from './types'

export interface TableRow {
  range: number[] | number
  text: string
  meta?: TableRef[]
}

export class TableRow implements TableRow {
  constructor(range: number[] | number, text: string, meta?: TableRef[]) {
    this.range = range
    this.text = text
    this.meta = meta
  }
}
