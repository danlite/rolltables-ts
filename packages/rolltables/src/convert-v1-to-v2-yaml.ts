import * as YAML from 'yaml'
// @ts-ignore
import {strOptions} from 'yaml/types'

strOptions.fold.lineWidth = 120
// @ts-ignore
import {readdirSync, statSync, readFileSync, writeFileSync, mkdirSync} from 'fs'
import {resolve, dirname, basename, extname} from 'path'
import chalk from 'chalk'
import {TableRef} from './types'

// const OUTPUT_ROOT = __dirname + '/tables'
const V1_ROOT = '/Users/dan/rolltables-private/tables'
const IGNORE = ['.git', '.DS_Store']
const YAML_EXT = '.yml'

const processDirectory = (dir: string, indent: number = 0) => {
  for (const entry of readdirSync(dir)) {
    if (IGNORE.includes(entry)) continue
    const entryPath = resolve(dir, entry)
    const stats = statSync(entryPath)
    const style = stats.isDirectory() ? chalk.cyan : chalk.whiteBright
    console.log('  '.repeat(indent) + style(entry))
    if (stats.isDirectory()) processDirectory(entryPath, indent + 1)
    else if (extname(entryPath) !== YAML_EXT) processFile(entryPath)
    // break
  }
}

const processFile = (filePath: string) => {
  const fileContents = readFileSync(filePath, {encoding: 'utf8'})
  // console.log(fileContents)
  const lines = fileContents.split('\n')
  const tableIdentifier = lines.shift() as string
  const headerLine = lines.shift() as string
  let [dice, title, extraResults] = headerLine.split('|')
  if (dice === 'd*') dice = '#'

  type TableRefInput = Omit<TableRef, 'rollCount'> & {
    rollCount?: TableRef['rollCount']
  }

  const rows: Array<string | TableRefInput> = []
  for (let rowLine of lines) {
    rowLine = rowLine.trim()
    if (!rowLine) continue

    let text = rowLine

    const separatorMatches = rowLine.match(/\|/g)
    let relatedText = null
    if (separatorMatches && separatorMatches.length > 1) {
      const relatedSeparatorIndex = text.lastIndexOf('|')
      relatedText = text.substring(relatedSeparatorIndex + 1)
      text = text.substring(0, relatedSeparatorIndex)
    }

    text = text.replace(/(\[\[@\w+)\s/g, '$1:')
    rows.push(text)

    if (relatedText) {
      const relatedEntries = relatedText.split(';')
      for (const relatedEntry of relatedEntries) {
        let rollCount: string | number = 1
        let extraProps: {ignore?: number[] | number; unique?: boolean} = {}
        let [relatedTable, relatedRollText] = relatedEntry.split('.')

        if (dirname(relatedTable) === dirname(tableIdentifier))
          relatedTable = './' + basename(relatedTable)

        if (relatedRollText) {
          const rollCountMatch = relatedRollText.match(/^@?([-a-z0-9]+)/)
          if (rollCountMatch) {
            // Get count
            const stringCount = rollCountMatch[1]
            const numericCount = parseInt(stringCount)
            if (isNaN(numericCount)) rollCount = stringCount
            else rollCount = numericCount

            // Get extra properties
            const extraPropText = relatedRollText
              .substring(rollCountMatch[0].length)
              .trim()
            if (extraPropText) {
              extraProps = JSON.parse(extraPropText)
            }
          }
        }

        const tableRef: TableRefInput = {
          path: relatedTable,
        }
        if (rollCount !== 1) tableRef.rollCount = rollCount
        if ('ignore' in extraProps) tableRef.ignore = extraProps.ignore
        if ('unique' in extraProps) tableRef.unique = extraProps.unique
        rows.push(tableRef)
      }
    }
  }

  const table: any = {title, dice}
  if (extraResults)
    table.extraResults = extraResults.replace(/(\[\[@\w+)\s/g, '$1:')

  table.rows = rows

  const yaml = '---\n' + YAML.stringify(table)
  // console.log(tableIdentifier + '.yml')
  // console.log(YAML.stringify(table))
  // const outputDir = resolve(OUTPUT_ROOT, dirname(tableIdentifier))
  // console.log(outputDir)
  writeFileSync(filePath + YAML_EXT, yaml, {encoding: 'utf8'})
}

processDirectory(V1_ROOT)
// processFile(V1_ROOT + '/test')
// processFile(V1_ROOT + '/dmg/treasure/hoard-1-loot')
// processFile(V1_ROOT + '/spells/level/0')
