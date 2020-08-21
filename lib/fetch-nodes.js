const fs = require('fs')
const fetch = require('node-fetch')
const { default: PQueue } = require('p-queue')
const Octokit = require('./app-octokit')

module.exports = async function fetchNodes (destination) {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })
  const queue = new PQueue({ concurrency: 50 })
  const nodesFileStream = fs.createWriteStream(destination, { flags: 'a' })

  console.log('Fetching forks...')
  await octokit.paginate(
    'GET /repos/devtip/ssr_subscrible_tool/forks',
    {
      per_page: 100
    },
    (response) =>
      response.data.forEach((fork) => {
        const {
          full_name,
          default_branch
        } = fork;

        (async () => {
          await queue.add(async () => {
            const url = `https://raw.githubusercontent.com/${full_name}/${default_branch}/node.txt`
            await downloadNodesFile(url, nodesFileStream)
          })
        })()
      })
  )

  await queue.onIdle()
  nodesFileStream.end()
}

async function downloadNodesFile (url, nodesFileStream) {
  try {
    console.log(`Fetching nodes from ${url}`)
    const resp = await fetch(url)
    const data = await resp.text()
    for (const l of data.split('\n')) {
      const line = l.trim()
      if (line && !line.startsWith('#') && line.includes('://')) {
        nodesFileStream.write(`${line.replace(/\s+/, '\n').trim()}\n`)
      }
    }
  } catch (e) {
    console.warn(`Failed to fetch nodes from ${url}`, e)
  }
}
