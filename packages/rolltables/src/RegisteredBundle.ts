import {rollTableRef} from './rolltables'
import {RollResult, TableBundleContext, TableRef} from './types'

export interface TableBundle {
  tables: TableRef[]
  title?: string
}

export interface RegisteredBundle extends TableBundle {
  identifier: string
}

export class RegisteredBundle implements RegisteredBundle {
  constructor(identifier: string, tables: TableRef[], title?: string) {
    this.identifier = identifier
    this.tables = tables
    this.title = title
  }

  async roll(
    context: TableBundleContext,
    depth: number,
  ): Promise<RollResult[][]> {
    const tableResults: RollResult[][] = []
    for (const tableRef of this.tables) {
      const results = await rollTableRef(
        tableRef,
        context,
        this.identifier,
        depth,
      )
      tableResults.push(results)
      for (const result of results) {
        // TODO: figure out how/why we'd merge the contexts from several rolls of the same table
        context = Object.assign(context, result.row.getContext(), {
          $previousRoll: result.total,
        })

        if (tableRef.store) {
          for (const [key, valueRef] of Object.entries(tableRef.store)) {
            let contextKey: string = valueRef
            if (valueRef.startsWith('@')) {
              contextKey = valueRef.slice(1)
            }
            context = Object.assign(context, {[key]: context[contextKey]})
          }
        }
      }
    }

    return tableResults
  }
}
