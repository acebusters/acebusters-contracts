require('babel-register');
require('babel-polyfill');
var HDWalletProvider = require("truffle-hdwallet-provider");

var mochaConfig = {};

if (process.env.CI_BUILD) {
  // Solcover executes in a temporary coverageEnv directory which is being deleted after run
  // Let's escape from that
  var resultDir = process.cwd().endsWith('coverageEnv') ? '../' : './';

  // Shippable CI likes test results in xunit format
  mochaConfig = {
    reporter: 'xunit',
    reporterOptions: {
      output: resultDir + 'xunit_testresults.xml'
    }
  };
}

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*" // Match any network id
    },
    rinkeby: {
      provider: function() {
        return new HDWalletProvider(process.env.RINKEBY_MNEMONIC || "", "https://rinkeby.infura.io", process.env.RINKEBY_ACCOUNT_INDEX || 0);
      },
      gasPrice: 10000000000, // 10 gwei
      gas: 5000000,
      network_id: 4
    },
    mainnet: {
      provider: function() {
        return new HDWalletProvider(process.env.MAINNET_MNEMONIC || "", "https://mainnet.infura.io:443", process.env.MAINNET_ACCOUNT_INDEX || 0);
      },
      gasPrice: 2000000000, // 2 gwei
      network_id: "*"
    },
    coverage: {
      host: "localhost",
      network_id: "*",
      port: 8555,
      gas: 0xfffffffffff,
      gasPrice: 0x01
    }
  },
  mocha: mochaConfig
};
