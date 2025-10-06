import {confirm, search} from '@inquirer/prompts'
import * as fuzzysort from 'fuzzysort'
import {showMetaTableResults} from './debug'
import {evaluateRollResultTables, rollBundleOrTable} from './rolltables'
import {getRegistryKeys, getRollable, loadAllTables} from './tables'
import {RollResult} from './types'

async function main(): Promise<void> {
  process.env.ROLLTABLE_CLI = 'true'

  await loadAllTables()
  const keys = getRegistryKeys()

  // inquirer.registerPrompt('autocomplete', inquirerAutocomplete)

  const promptTableSearch = async (): Promise<{table: string}> => ({
    table: await search({
      // type: 'autocomplete',
      // name: 'table',
      message: 'Look up a table:',
      // pageSize: 10,
      source: async (input) => {
        // console.log(answersSoFar)
        return fuzzysort.go(input ?? '', keys).map((r) => ({
          name: r.target,
          value: r.target,
          description: r.target,
          separator: false,
        }))
      },
    }),
  })

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
      const expand = await confirm({
        message: 'Expand related tables?',
      })
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
