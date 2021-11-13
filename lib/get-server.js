module.exports = function getServer (line) {
  const split = (line || '').replace(/[?#].*/g, '').split('://')
  if (split.length === 2) {
    const protocol = split[0]
    if (!['ssr', 'vmess', 'ss', 'trojan', 'snell'].includes(protocol)) {
      throw new Error(`Protocol is not in whitelist: ${protocol}`)
    }

    const decodedConnectionString = Buffer.from(split[1], 'base64').toString('utf-8')
    let host = ''
    let port = ''

    if (split[1].includes('@')) {
      const components = split[1].match(/@([^:]+):(\d+)/)
      host = components && components[1]
      port = components && components[2]
    }

    if (!host || !port) {
      if (protocol === 'vmess') {
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
    }

    if (!host.includes('.') || host.match(/[^A-Za-z0-9_\-.]/)) {
      throw new Error(`Host is invalid: ${host}`)
    }
    if (String(port).match(/[^\d]/)) {
      throw new Error(`Port is invalid: ${port}`)
    }

    return { host, port, protocol }
  } else {
    throw new Error('Server information is not found')
  }
}
