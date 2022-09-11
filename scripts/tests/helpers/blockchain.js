
async function createSnapshot () {
  return new Promise((resolve, reject) =>  {
    web3.currentProvider.send({ 
      jsonrpc: '2.0', 
      method: 'evm_snapshot', 
      params: [], 
      id: new Date().getSeconds()
    }, async (err, res) => {
      if (err) { reject(err); }
      return resolve(res.result);
    });
  });
}

async function revertToSnapshot (snapshot) {
  return new Promise((resolve, reject) =>  {
    web3.currentProvider.send({ 
      jsonrpc: '2.0', 
      method: 'evm_revert', 
      params: [snapshot], 
      id: new Date().getSeconds()
    }, async (err, res) => {
      if (err) { reject(err); }
      return resolve(res);
    });
  });
}

async function mineBlock (blockTimestamp) {
  return new Promise((resolve, reject) =>  {
    web3.currentProvider.send({ 
      jsonrpc: '2.0', 
      method: 'evm_mine', 
      params: [blockTimestamp], 
      id: new Date().getSeconds()
    }, async (err, res) => {
      if (err) { reject(err); }
      return resolve(res);
    });
  });
}

async function getLatestBlockTimestamp () {
  return (await web3.eth.getBlock('latest')).timestamp;
}

/**
* Increase EVM time in ganache-cli to simulate calls in the future
* @param integer Number of seconds to increase time by
*/
async function increaseTime(integer) {
  // First we increase the time
  await web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_increaseTime',
    params: [integer],
    id: 0,
  }, () => {});

  // Then we mine a block to actually get the time change to occurs
  await web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_mine',
    params: [],
    id: 0,
  }, () => { });
} 

module.exports = { 
  createSnapshot,
  revertToSnapshot,
  mineBlock, 
  getLatestBlockTimestamp,
  increaseTime
};
