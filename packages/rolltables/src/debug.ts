/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
import chalk from 'chalk'
import {basename} from 'path'
import {rollBundleOrTable, testTable} from './rolltables'
import * as tables from './tables'
import {RollResult} from './types'

const hoard = async () => {
  const table = await tables.getRollable('dmg/treasure/hoard-1-loot')
  if (!tables.isTable(table)) {
    return
  }
  let result
  do {
    result = await table.roll()
  } while (
    !result.row ||
    result.row.meta === undefined ||
    result.row.meta.length === 0
  )

  if (result.extraResults) {
    console.log(result.extraResults.text)
  }
  console.log(result.row.text)
  console.log()
  console.log(
    (await result.row.evaluateMeta(table, 0))
      .map((t) =>
        t
          .map(
            (r) =>
              r.row.text +
              (r.evaluatedTables
                ? r.evaluatedTables.map((x) => x.map((y) => ' - ' + y.row.text))
                : ''),
          )
          .join('\n'),
      )
      .join('\n\n'),
  )
  console.log('\n')
}

const cantrip = async () => {
  console.log('Cantrip:')
  const spells = await tables.getRollable('spells/level/0')
  if (!tables.isTable(spells)) {
    return
  }
  const result = await spells.roll()
  console.log(result.row.text)
  console.log('\n')
}

const sylvan = async () => {
  console.log('Sylvan forest encounter:')
  const table = await tables.getRollable('dmg/sylvan-forest')
  if (!tables.isTable(table)) {
    return
  }
  const result = await table.roll() // , sylvan.dice, 8)
  console.log(result.row.text)
  console.log('\n')
}

const villain = async () => {
  console.log('Villain objective:')
  const table = await tables.getRollable('dmg/villains/objective')
  if (!tables.isTable(table)) {
    return
  }
  // console.log(table)
  const result = await table.roll()
  console.log(result.row.text)
  console.log(
    (await result.row.evaluateMeta(table, 0))
      .map((t) =>
        t
          .map(
            (r) =>
              r.row.text +
              (r.evaluatedTables
                ? r.evaluatedTables.map((x) => x.map((y) => ' - ' + y.row.text))
                : ''),
          )
          .join('\n'),
      )
      .join('\n\n'),
  )
  console.log('\n')
}

const randomTableRoll = async () => {
  const table = tables.randomTable()
  // const table = await tables.loadTable('dmg/dungeons/random/chamber-exit-type')
  console.log(table.title)
  const result = await table.roll()
  console.log(result.row.text)
  console.log(
    (await result.row.evaluateMeta(table, 0))
      .map((referencedTable) =>
        referencedTable
          .map(
            (rollResult) =>
              '- ' +
              rollResult.table.title +
              ': ' +
              rollResult.row.text +
              (rollResult.evaluatedTables
                ? rollResult.evaluatedTables.map((x) =>
                    x.map((y) => ' - ' + y.table.title + ': ' + y.row.text),
                  )
                : ''),
          )
          .join('\n'),
      )
      .join('\n'),
  )
}

// export const showRollResults = (tableResults: RollResult[][]) => {
//   console.group()
//   // const INDENT = " ".repeat(indent)
//   // const NL = "\n"
//   tableResults.forEach((referencedTable) =>
//     referencedTable.forEach((rollResult) => {
//       chalk.cyan(`(${rollResult.total}) `) +
//         "- " +
//         rollResult.table.title +
//         ": " +
//         (rollResult.extraResults
//           ? chalk.blueBright(rollResult.extraResults.text) + "\n"
//           : "") +
//         chalk.greenBright(rollResult.row.text) +
//         (rollResult.evaluatedTables
//           ? rollResult.evaluatedTables.map((x) =>
//               x.map(
//                 (y) =>
//                   "\n" +
//                   y.table.title +
//                   ": " +
//                   chalk.keyword("orange")(y.row.text),
//               ),
//             )
//           : "")
//     }),
//   )

//   // console.log(output)
//   console.groupEnd()
//   return tableResults
// }

const showTableResults = (tableResults: RollResult[]) => {
  let shownTitle = ''
  for (const result of tableResults) {
    if (shownTitle !== result.table.title) {
      console.log(chalk.keyword('orange')(result.table.title))
      shownTitle = result.table.title
    }
    console.group()
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    showRollResult(result)
    console.groupEnd()
  }
}

export const showMetaTableResults = (metaTableResults: RollResult[][]) => {
  metaTableResults.forEach((r) => showTableResults(r))
}

export const showRollResult = (result: RollResult) => {
  console.log(
    (result.extraResults
      ? chalk.magenta(result.extraResults.text) + '\n'
      : '') +
      chalk.cyan(`(${result.total}) `) +
      chalk.white(result.row.text),
  )

  if (result.row.evaluatedMeta) {
    console.group()
    showMetaTableResults(result.row.evaluatedMeta)
    console.groupEnd()
  }
}

const dwarves = async () => {
  const table = await tables.getRollable('mtof/dwarves/group/composition')
  if (!tables.isTable(table)) {
    return
  }
  const result = await table.roll()
  console.log(result.extraResults && result.extraResults.text)
  console.log(result.row.text)
}

// const randomTableTest = async () => testTable(tables.randomTable())
const testAllTables = async (tableList: tables.RegisteredRollable[]) => {
  for (const table of tableList) {
    if (tables.isTable(table)) {
      await testTable(table)
    } else {
      rollBundleOrTable(table)
    }
  }
}

const charlatan = async () => {
  const bundle = await tables.getRollable(
    '/phb/backgrounds/charlatan/charlatan.bundle',
  )
  if (!tables.isBundle(bundle)) {
    return
  }
  console.log(chalk.redBright(bundle.title || ''))
  const results = await rollBundleOrTable(bundle)
  showMetaTableResults(results)
}

const backgrounds = async () => {
  const multiBundle = await tables.loadMultiBundle(
    '/phb/backgrounds/backgrounds',
  )
  const bundle = await tables.getRollable(
    '/phb/backgrounds/guild-artisan/guild-artisan',
  )
  if (!tables.isBundle(bundle)) {
    return
  }
  // console.log(JSON.stringify(multiBundle, undefined, 2))
  console.log(
    chalk.redBright(
      bundle.title ||
        basename(bundle.identifier)
          .replace(/(?:^|\s|-)(.)/g, (l) => l.toUpperCase())
          .replace('-', ' '),
    ),
  )
  const results = await rollBundleOrTable(bundle)
  showMetaTableResults(results)
}

if (require.main === module) {
  Promise.resolve()
    .then(() => tables.loadAllTables())
    // .then(tables.tablesInDirectory('/skt'))
    .then(testAllTables)
  // .then(charlatan)
  // .then(backgrounds)
  // .then(rollFamilyHome)
  // .then(dwarves)
  // .then(randomTableTest)
  // .then(randomTableRoll)
  // .then(tables.showRegistry)

  // .then(sylvan)
  // .then(hoard)
  // .then(cantrip)
  // .then(villain)
}
