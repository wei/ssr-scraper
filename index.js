
if (!process.env.GITHUB_TOKEN) {
  throw new Error('Please set GITHUB_TOKEN environment variable')
}

const fs = require('fs')

const fetchNodes = require('./lib/fetch-nodes')
const dedupeFile = require('./lib/dedupe-file')
const checkReachability = require('./lib/check-reachability')

const NODES_FILE = 'nodes.txt'
const WORKING_FILE = 'pending.tmp'
const STATS_FILE = 'stats.json'

main()

async function main () {
  await fetchNodes(NODES_FILE)
  await dedupeFile(NODES_FILE, WORKING_FILE)
  const stats = await checkReachability(WORKING_FILE, NODES_FILE)
  console.log(stats)
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats))
}
