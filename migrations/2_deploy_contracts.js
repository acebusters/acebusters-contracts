module.exports = function(deployer) {
  deployer.deploy(Token);
  deployer.deploy(Table);
  deployer.deploy(Power);
  deployer.deploy(Owned);
  deployer.deploy(AccountProxy);
  deployer.deploy(AccountController);
  deployer.deploy(AccountFactory);
};
