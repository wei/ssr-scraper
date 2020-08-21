const fs = require('fs')
const readline = require('readline')
const { default: PQueue } = require('p-queue')
const isPortReachable = require('is-port-reachable')

const getServer = require('./get-server')

module.exports = async function checkReachability (input, output) {
  const stats = {
    total: {},
    reachable: {},
    totalCount: 0,
    reachableCount: 0
  }

  const queue = new PQueue({ concurrency: 50 })
  const nodesFileStream = fs.createWriteStream(output, { flags: 'w' })
  const workingFileInterface = readline.createInterface({
    input: fs.createReadStream(input)
  })

  workingFileInterface.on('line', async (line) => {
    if (!line.trim()) return

    try {
      const { host, port, protocol } = getServer(line);

      (async () => {
        await queue.add(async () => {
          const isReachable = await isPortReachable(Number(port), { host, timeout: 5000 })
          console.log(host, port, isReachable ? 'Reachable' : 'Unreachable')

          if (!stats.total[protocol]) {
            stats.total[protocol] = 0
          }
          stats.total[protocol]++
          stats.totalCount++

          if (isReachable) {
            if (!stats.reachable[protocol]) {
              stats.reachable[protocol] = 0
            }
            stats.reachable[protocol]++
            stats.reachableCount++
            nodesFileStream.write(`${line}\n`)
          }
        })
      })()
    } catch (e) {
      console.warn('Error processing node', line, e)
    }
  }).on('end', function () {
    workingFileInterface.close()
  })

  // Wait for file to start populating the queue
  await queue.add(() => new Promise(resolve => {
    setTimeout(() => {
      resolve()
    }, 500)
  }))

  await queue.onIdle()
  nodesFileStream.end()
  return stats
}
