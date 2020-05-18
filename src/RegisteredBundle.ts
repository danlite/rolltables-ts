import {TableRef, RollResult, TableBundleContext} from './types'
import {rollTableRef} from './rolltables'

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
      }
    }

    return tableResults
  }
}
