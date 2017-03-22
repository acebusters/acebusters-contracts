var Owned = artifacts.require('../contracts/Owned.sol');

contract("Owned", (accounts) => {

  it("Is owned by creator", (done) => {
    var owned;
    Owned.new().then((contract) => {
      owned = contract;
      return owned.isOwner.call(accounts[0]);
    }).then((isOwner) => {
      assert.isTrue(isOwner, "Owner should be owner");
      return owned.isOwner.call(accounts[1])
    }).then((isOwner) => {
      assert.isFalse(isOwner, "Non-owner should not be owner");
      done();
    }).catch(done);
  });

  it("Non-owner can't change owner", (done) => {
    var owned;
    Owned.new().then((contract) => {
      owned = contract;
      return owned.transfer(accounts[1], {from: accounts[1]});
    }).then(() => {
      return owned.isOwner.call(accounts[1])
    }).then((isOwner) => {
      assert.isFalse(isOwner, "Owner should not be canged");
      done();
    }).catch(done);
  })

  it("Owner can change owner", (done) => {
    var owned;
    Owned.new().then((contract) => {
      owned = contract;
      return owned.transfer(accounts[1], {from: accounts[0]});
    }).then(() => {
      return owned.isOwner.call(accounts[1])
    }).then((isOwner) => {
      assert.isTrue(isOwner, "Owner should be changed");
      done();
    }).catch(done);
  })

});
