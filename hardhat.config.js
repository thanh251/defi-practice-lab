require('dotenv').config();
require('@nomicfoundation/hardhat-ethers');
require('@nomicfoundation/hardhat-chai-matchers');
const { subtask } = require('hardhat/config');
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require('hardhat/builtin-tasks/task-names');
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD).setAction(async ({ solcVersion }, hre, next) => {
  if (solcVersion === '0.8.24') return { compilerPath: require.resolve('solc/soljson.js'), isSolcJs: true, version: solcVersion, longVersion: require('solc').version() };
  return next();
});
module.exports = {
  solidity: { version: '0.8.24', settings: { viaIR: true, optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris' } },
  networks: {
    hardhat: { chainId: 31337 },
    local: { url: process.env.RPC_URL || 'http://127.0.0.1:8545', ...(process.env.PRIVATE_KEY ? { accounts: [process.env.PRIVATE_KEY] } : {}) },
  },
  mocha: { timeout: 180000 },
};
