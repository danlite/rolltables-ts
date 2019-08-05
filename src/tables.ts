import chalk from "chalk"
import * as fs from "fs"
import {basename, dirname, extname, resolve} from "path"
import * as YAML from "yaml"
import {formatDice, prepareTable} from "./rolltables"
import {Table, TableBundle, TableRef} from "./types"

const DEBUG = false
const TABLE_ROOT = "/Users/dan/rolltables-private/tables"
const YAML_EXT = ".yml"

interface Registered {
  identifier: string
}

export type RegisteredTable = Table & Registered
export type RegisteredBundle = TableBundle & Registered
export type RegisteredRollable = RegisteredTable | RegisteredBundle

export const isBundle = (obj: RegisteredRollable): obj is RegisteredBundle => {
  return "tables" in obj && obj.tables !== undefined
}

export const isTable = (obj: RegisteredRollable): obj is RegisteredTable => {
  return "rows" in obj && obj.rows !== undefined
}

const registry: {[path: string]: RegisteredRollable} = {}
export const showRegistry = () => {
  console.log(
    Object.values(registry)
      .map((rollable) =>
        YAML.stringify({
          identifier: rollable.identifier,
          title: rollable.title,
          dice: isTable(rollable) ? formatDice(rollable.dice) : undefined,
        }),
      )
      .join("\n"),
  )
}

export const getRegistry = () => registry
export const getRegistryKeys = () => Object.keys(registry)

export const loadTable = async (
  path: string,
  relativeTo?: RegisteredRollable | string,
) => {
  const rollable = await loadRollable(path, relativeTo)
  if (!isTable(rollable)) {
    throw new Error("not a table!")
  }
  return rollable
}

export const loadTableBundle = async (
  path: string,
  relativeTo?: RegisteredRollable | string,
) => {
  const rollable = await loadRollable(path, relativeTo)
  if (!isBundle(rollable)) {
    throw new Error("not a bundle!")
  }
  return rollable
}

export const loadMultiBundle = async (identifier: string) => {
  const contents = fs.readFileSync(
    resolve(TABLE_ROOT, "." + identifier + ".multibundle" + YAML_EXT),
    {
      encoding: "utf8",
    },
  )

  const yml: {
    bundles: {[key: string]: {relative?: string; bundle: TableBundle}},
  } = YAML.parse(contents, {merge: true})

  const output: {[key: string]: RegisteredRollable} = {}
  for (const bundleKey of Object.keys(yml.bundles)) {
    const bundleRef = yml.bundles[bundleKey]
    const bundleIdentifier = resolve(
      dirname(identifier),
      bundleRef.relative ? bundleRef.relative : "",
      bundleKey,
    )
    output[bundleKey] = registerRollable(bundleRef.bundle, bundleIdentifier)
  }

  return output
}

export const loadRollable = async (
  path: string,
  relativeTo?: RegisteredRollable | string,
) => {
  if (path.startsWith(".")) {
    if (!relativeTo) {
      throw new Error("trying to get relative table without reference")
    }
    const referencePath = resolve(
      "/",
      typeof relativeTo === "string"
        ? dirname(relativeTo)
        : dirname(relativeTo.identifier),
    )
    path = resolve(referencePath, path)
  } else if (!path.startsWith("/")) {
    path = "/" + path
  }
  if (path in registry) {
    return registry[path]
  }
  console.debug(`loading ${path}`)
  const localPath = "." + path
  let table
  try {
    table = await importTable(localPath)
  } catch (e) {
    table = importTableFromYAML(localPath)
  }
  return registerRollable(table, path)
}

const importTable = async (path: string) => (await import(path)).default

const importTableFromYAML = (path: string) => {
  // console.log(resolve(__dirname, path + YAML_EXT))
  const contents = fs.readFileSync(resolve(TABLE_ROOT, path + YAML_EXT), {
    encoding: "utf8",
  })
  // console.log(contents)
  const yml = YAML.parse(contents)
  // console.log(yml)

  let rollable: Table | TableBundle
  if (isBundle(yml)) {
    rollable = yml
  } else if (isTable(yml)) {
    rollable = prepareTable(yml)
  } else {
    // throw new Error("not proper format for table/bundle")
    return null
  }

  return rollable
}

export const makeTableRef = (
  path: string,
  count?: number | string,
): TableRef => ({
  path,
  rollCount: count === undefined ? 1 : count,
})

const registerRollable = (
  table: Table | TableBundle,
  identifier: string,
): RegisteredRollable => {
  if (!identifier.startsWith("/")) {
    throw new Error('identifier must be absolute (start with "/")')
  }
  const registeredRollable = {
    ...table,
    identifier,
  }
  registry[identifier] = registeredRollable
  return registeredRollable
}

const registerTableFromYaml = (filePath: string) => {
  let identifierPath = dirname(filePath.replace(TABLE_ROOT, ""))
  if (!identifierPath.endsWith("/")) {
    identifierPath += "/"
  }
  const identifier = identifierPath + basename(filePath, YAML_EXT)
  const contents = fs.readFileSync(filePath, {
    encoding: "utf8",
  })
  const yml = YAML.parse(contents)

  let rollable: Table | TableBundle
  if (isBundle(yml)) {
    rollable = yml
  } else if (isTable(yml)) {
    rollable = prepareTable(yml)
  } else {
    // throw new Error("not proper format for table/bundle")
    return null
  }

  return registerRollable(rollable, identifier)
}

const loadTablesInDirectory = async (dir: string, indent: number = 0) => {
  for (const entry of fs.readdirSync(dir)) {
    const entryPath = resolve(dir, entry)
    const stats = fs.statSync(entryPath)
    if (stats.isDirectory()) {
      if (DEBUG) {
        console.debug("  ".repeat(indent) + chalk.cyan(entry))
      }
      loadTablesInDirectory(entryPath, indent + 1)
    } else if (
      extname(entryPath) === YAML_EXT &&
      basename(entryPath, YAML_EXT).endsWith(".multibundle")
    ) {
      if (DEBUG) {
        console.debug("  ".repeat(indent) + chalk.magenta(entry))
      }
      // console.log(entryPath.split(TABLE_ROOT)[1].split(".multibundle")[0])
      await loadMultiBundle(
        entryPath.split(TABLE_ROOT)[1].split(".multibundle")[0],
      )
    } else if (extname(entryPath) === YAML_EXT) {
      if (DEBUG) {
        console.debug("  ".repeat(indent) + chalk.whiteBright(entry))
      }
      registerTableFromYaml(entryPath)
    }
  }
}

export const loadAllTables = async () => {
  await loadTablesInDirectory(TABLE_ROOT)
  return Object.values(registry)
}

export const tablesInDirectory = (dir: string) => () =>
  Object.values(registry).filter((t) => t.identifier.startsWith(dir))

export const randomTable = () => {
  const rollables = Object.values(registry)
  while (true) {
    const rollable = rollables[Math.floor(Math.random() * rollables.length)]
    if (isTable(rollable)) {
      return rollable
    }
  }
}
