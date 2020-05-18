import * as fuzzysort from 'fuzzysort'
import * as inquirer from 'inquirer'
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
import * as inquirerAutocomplete from 'inquirer-autocomplete-prompt'
import {showMetaTableResults} from '.'
import {evaluateRollResultTables, rollBundleOrTable} from './rolltables'
import {getRegistryKeys, loadAllTables, getRollable} from './tables'
import {RollResult} from './types'

async function main(): Promise<void> {
  const sorter = fuzzysort.new({allowTypo: true})

  await loadAllTables()
  const keys = getRegistryKeys()

  inquirer.registerPrompt('autocomplete', inquirerAutocomplete)

  const promptTableSearch = async (): Promise<{table: string}> =>
    inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'table',
        message: 'Look up a table:',
        // pageSize: 10,
        source: (_: unknown, input: string): unknown => {
          // console.log(answersSoFar)
          return new Promise((resolve) =>
            resolve(sorter.go(input, keys).map((r) => r.target)),
          )
        },
      },
    ])

  const processResults = async (
    rollResults: RollResult[][],
  ): Promise<RollResult[][] | null> => {
    const resultsToExpand = rollResults
      .reduce((sum, tableResults) => sum.concat(tableResults), [])
      .filter(
        (r) =>
          r.row.evaluatedMeta === undefined &&
          r.row.meta &&
          r.row.meta.length > 0,
      )
    let otherResults: null | RollResult[][] = null

    if (resultsToExpand.length > 0) {
      console.log({resultsToExpand})
      const expand = (
        await inquirer.prompt({
          type: 'confirm',
          name: 'expand',
          message: 'Expand related tables?',
        })
      ).expand
      if (expand) {
        otherResults = (
          await Promise.all(
            resultsToExpand.map((r) => evaluateRollResultTables(r, 0)),
          )
        ).reduce((acc, r) => acc.concat(r), [])
      }
    }

    await showMetaTableResults(rollResults)

    return otherResults
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const results = await promptTableSearch()
      .then((answers) => getRollable(answers.table))
      .then((b) => rollBundleOrTable(b))

    await processResults(results)

    // let otherResults = await processResults(results)
    // console.log({otherResults: otherResults && otherResults.length})
    // while (otherResults) {
    //   otherResults = await processResults(otherResults)
    // }

    console.log()
  }
}

main().then()
