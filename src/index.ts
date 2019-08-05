import chalk from "chalk"
import {basename} from "path"
import {
  evaluateRowMeta,
  rollBundleOrTable,
  rollOnTable,
  testTable,
} from "./rolltables"
import * as tables from "./tables"
import {RollResult, TableBundle} from "./types"

const hoard = async () => {
  const table = await tables.loadTable("dmg/treasure/hoard-1-loot")
  let result
  do {
    result = await rollOnTable(table)
  } while (!result.row || result.row.meta.length === 0)

  if (result.extraResults) {
    console.log(result.extraResults.text)
  }
  console.log(result.row.text)
  console.log()
  console.log(
    (await evaluateRowMeta(result.row, table, 0))
      .map((t) =>
        t
          .map(
            (r) =>
              r.row.text +
              (r.evaluatedTables
                ? r.evaluatedTables.map((x) => x.map((y) => " - " + y.row.text))
                : ""),
          )
          .join("\n"),
      )
      .join("\n\n"),
  )
  console.log("\n")
}

const cantrip = async () => {
  console.log("Cantrip:")
  const spells = await tables.loadTable("spells/level/0")
  const result = await rollOnTable(spells)
  console.log(result.row.text)
  console.log("\n")
}

const sylvan = async () => {
  console.log("Sylvan forest encounter:")
  const table = await tables.loadTable("dmg/sylvan-forest")
  const result = await rollOnTable(table) // , sylvan.dice, 8)
  console.log(result.row.text)
  console.log("\n")
}

const villain = async () => {
  console.log("Villain objective:")
  const table = await tables.loadTable("dmg/villains/objective")
  // console.log(table)
  const result = await rollOnTable(table)
  console.log(result.row.text)
  console.log(
    (await evaluateRowMeta(result.row, table, 0))
      .map((t) =>
        t
          .map(
            (r) =>
              r.row.text +
              (r.evaluatedTables
                ? r.evaluatedTables.map((x) => x.map((y) => " - " + y.row.text))
                : ""),
          )
          .join("\n"),
      )
      .join("\n\n"),
  )
  console.log("\n")
}

const randomTableRoll = async () => {
  const table = tables.randomTable()
  // const table = await tables.loadTable('dmg/dungeons/random/chamber-exit-type')
  console.log(table.title)
  const result = await rollOnTable(table)
  console.log(result.row.text)
  console.log(
    (await evaluateRowMeta(result.row, table, 0))
      .map((referencedTable) =>
        referencedTable
          .map(
            (rollResult) =>
              "- " +
              rollResult.table.title +
              ": " +
              rollResult.row.text +
              (rollResult.evaluatedTables
                ? rollResult.evaluatedTables.map((x) =>
                    x.map((y) => " - " + y.table.title + ": " + y.row.text),
                  )
                : ""),
          )
          .join("\n"),
      )
      .join("\n"),
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

export const showRollResult = (result: RollResult) => {
  console.log(
    (result.extraResults
      ? chalk.magenta(result.extraResults.text) + "\n"
      : "") +
      chalk.cyan(`(${result.total}) `) +
      chalk.white(result.row.text),
  )

  if (result.row.evaluatedMeta) {
    console.group()
    showMetaTableResults(result.row.evaluatedMeta)
    console.groupEnd()
  }
}

export const showMetaTableResults = (metaTableResults: RollResult[][]) => {
  metaTableResults.forEach((r) => showTableResults(r))
}

const showTableResults = (tableResults: RollResult[]) => {
  let shownTitle: boolean = false
  for (const result of tableResults) {
    if (!shownTitle) {
      console.log(chalk.keyword("orange")(result.table.title))
      shownTitle = true
    }
    console.group()
    showRollResult(result)
    console.groupEnd()
  }
}

const dwarves = async () => {
  const table = await tables.loadTable("mtof/dwarves/group/composition")
  const result = await rollOnTable(table)
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

const rollFamilyHome = async () => {
  const bundles: TableBundle[] = [
    {
      identifier: "/xgte/life/home",
      title: "Family Lifestyle and Childhood Home",
      tables: [
        {path: "/xgte/life/origins/family-lifestyle"},
        {
          path: "/xgte/life/origins/childhood-home",
          modifier: "mod",
        },
      ],
    },
    {
      identifier: "/gos/random-ship",
      title: "Random Ship",
      tables: [
        {path: "/gos/random-ships/type"},
        {path: "/gos/random-ships/name-adjective"},
        {path: "/gos/random-ships/name-noun"},
        {path: "/gos/random-ships/purpose"},
      ],
    },
    {
      identifier: "/phb/backgrounds/acolyte",
      title: "Acolyte Background",
      tables: [
        {
          path: "/phb/backgrounds/acolyte/personality-trait",
          rollCount: 2,
          unique: true,
        },
        {path: "/phb/backgrounds/acolyte/ideal"},
        {path: "/phb/backgrounds/acolyte/bond"},
        {path: "/phb/backgrounds/acolyte/flaw"},
      ],
    },
  ]
  for (const bundle of bundles) {
    console.log(chalk.blue(bundle.title || ""))
    const results = await rollBundleOrTable(bundle)
    showMetaTableResults(results)
  }
}

const charlatan = async () => {
  const bundle = await tables.loadTableBundle(
    "/phb/backgrounds/charlatan/charlatan.bundle",
  )
  console.log(chalk.redBright(bundle.title || ""))
  const results = await rollBundleOrTable(bundle)
  showMetaTableResults(results)
}

const backgrounds = async () => {
  const multiBundle = await tables.loadMultiBundle(
    "/phb/backgrounds/backgrounds",
  )
  const bundle = await tables.loadTableBundle(
    "/phb/backgrounds/guild-artisan/guild-artisan",
  )
  // console.log(JSON.stringify(multiBundle, undefined, 2))
  console.log(
    chalk.redBright(
      bundle.title ||
        basename(bundle.identifier)
          .replace(/(?:^|\s|-)(.)/g, (l) => l.toUpperCase())
          .replace("-", " "),
    ),
  )
  const results = await rollBundleOrTable(bundle)
  showMetaTableResults(results)
}

if (require.main === module) {
  Promise.resolve()
    .then(tables.loadAllTables)
    .then(tables.tablesInDirectory("/homebrew"))
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
