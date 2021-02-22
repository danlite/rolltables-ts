import {getRegistry, loadAllTables} from './tables'

if (require.main === module) {
  loadAllTables().then(() => {
    console.log(JSON.stringify(getRegistry(), undefined, 2))
  })
}
