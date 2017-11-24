var AccountFactory = artifacts.require("./contracts/AccountFactory.sol");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(AccountFactory);
};
