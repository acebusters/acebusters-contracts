var Token = artifacts.require("./Token.sol");
var Power = artifacts.require("./Power.sol");
var Owned = artifacts.require("./Owned.sol");
var AccountProxy = artifacts.require("./AccountProxy.sol");
var AccountController = artifacts.require("./AccountController.sol");
var AccountFactory = artifacts.require("./AccountFactory.sol");

module.exports = function(deployer) {
  deployer.deploy(Token);
  deployer.deploy(Power);
  deployer.deploy(Owned);
  deployer.deploy(AccountProxy);
  deployer.deploy(AccountController);
  deployer.deploy(AccountFactory);
};
