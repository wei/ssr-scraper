const neek = require('neek')

module.exports = async function dedupeNodes (source, destination) {
  await (new Promise((resolve) => {
    neek.unique(source, destination, function (result) {
      resolve(result)
    })
  }))
}
