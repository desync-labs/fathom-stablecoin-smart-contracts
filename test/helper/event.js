const { expect } = require('chai');

async function getEvent(contract, blockNumber, eventName) {
  const filter = {
    address: contract.address,
    topics: [contract.interface.getEventTopic(eventName)],
  }
  const event = (await contract.queryFilter(filter, blockNumber, blockNumber))[0]
  return event
}

function expectEmit(event, ...args) {
  event.args?.forEach((arg, i) => {
    expect(arg).to.be.equal(args[i])
  })
}

module.exports = {getEvent, expectEmit}
