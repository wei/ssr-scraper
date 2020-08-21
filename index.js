
if (!process.env.GITHUB_TOKEN) {
  throw new Error('Please set GITHUB_TOKEN environment variable')
}

const fs = require('fs')
const readline = require('readline')
const Octokit = require('./lib/app-octokit')
const fetch = require('node-fetch')
const neek = require('neek')
const isPortReachable = require('is-port-reachable')

const NODES_FILE = 'nodes.txt'
const WORKING_FILE = 'pending.tmp'

main()

async function main () {
  await fetchNodes()
  await dedupeNodes()
  await checkConnectivity()
}

async function fetchNodes () {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })

  console.log('Fetching forks...')
  const forks = await octokit.paginate(
    'GET /repos/devtip/ssr_subscrible_tool/forks',
    {
      per_page: 100
    },
    (response) =>
      response.data.map((fork) => {
        const {
          full_name,
          default_branch
        } = fork

        return {
          full_name,
          default_branch
        }
      })
  )

  const nodesFileStream = fs.createWriteStream(NODES_FILE, { flags: 'a' })
  for (const { full_name, default_branch } of forks) {
    try {
      console.log(`Fetching nodes from ${full_name}`)
      const resp = await fetch(`https://raw.githubusercontent.com/${full_name}/${default_branch}/node.txt`)
      const data = await resp.text()
      for (const line of data.split('\n')) {
        if (line && line.includes('://')) { nodesFileStream.write(`${line.replace(/\s+/, '\n').trim()}\n`) }
      }
    } catch (e) {
      console.warn(`Failed to fetch nodes from ${full_name}`, e)
    }
  }

  nodesFileStream.end()
}

let uniqueLines = 0

async function dedupeNodes () {
  await (new Promise((resolve) => {
    neek.unique(NODES_FILE, WORKING_FILE, function (result) {
      console.log(result)
      uniqueLines = result.unique
      resolve()
    })
  }))
}

async function checkConnectivity () {
  const nodesFileStream = fs.createWriteStream(NODES_FILE, { flags: 'w' })
  const workingFileInterface = readline.createInterface({
    input: fs.createReadStream(WORKING_FILE)
  })

  let counter = 0
  workingFileInterface.on('line', async (line) => {
    try {
      const split = (line || '').replace(/[?#].*/g, '').split('://')
      if (split.length === 2) {
        const decodedConnectionString = Buffer.from(split[1], 'base64').toString('utf-8')
        let host = ''
        let port = ''

        if (split[1].includes('@')) {
          const components = split[1].match(/@([^:]+):(\d+)/)
          host = components && components[1]
          port = components && components[2]
        } else if (split[0] === 'vmess') {
          try {
            const vmessJson = JSON.parse(decodedConnectionString)
            host = vmessJson.add
            port = vmessJson.port
          } catch (e) {
            const components = decodedConnectionString.match(/@([^:]+):(\d+)/)
            host = components && components[1]
            port = components && components[2]
          }
        } else {
          if (decodedConnectionString.includes('@')) {
            const components = decodedConnectionString.match(/@([^:]+):(\d+)/)
            host = components && components[1]
            port = components && components[2]
          } else {
            const components = decodedConnectionString.split(':')
            host = components[0]
            port = components[1]
          }
        }

        if (host.match(/[^A-Za-z0-9\-.]/)) {
          throw new Error(`Host is invalid: ${host}`)
        }
        if (port.match(/[^\d]/)) {
          throw new Error(`Port is invalid: ${host}`)
        }

        const isReachable = await isPortReachable(Number(port), { host, timeout: 3000 })
        console.log(host, port, isReachable ? 'Reachable' : 'Unreachable')

        if (isReachable) nodesFileStream.write(`${line}\n`)
      }
    } catch (e) {
      console.warn('Error processing node', line, e)
    }

    counter++
    if (counter === uniqueLines) {
      nodesFileStream.end()
      process.exit()
    }

    counter++
  })
}
