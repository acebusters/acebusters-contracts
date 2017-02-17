contract("AccountFactory", (accounts) => {
  var accountFactory;
  var proxy;
  var controller;

  before(() => {
    accountFactory = AccountFactory.deployed();
    proxy = AccountProxy.deployed();
    controller = AccountController.deployed();
  });

  it("Correctly creates proxy, and controller", (done) => {
    var event = accountFactory.AccountCreated()
    event.watch((error, result) => {
      event.stopWatching();

      assert.equal(web3.eth.getCode(result.args.proxy),
                   web3.eth.getCode(proxy.address),
                   "Created proxy should have correct code");
      assert.equal(web3.eth.getCode(result.args.controller),
                   web3.eth.getCode(controller.address),
                   "Created controller should have correct code");
      assert.equal(result.args.recovery, accounts[2],
                   "Create event should have correct recovery address");
      // Check that the mapping has correct proxy address
      accountFactory.signerToProxy.call(accounts[1]).then((proxyAddr) => {
        assert.equal(proxyAddr, result.args.proxy, 
          "Mapping should have the same address as event");
        done();
      }).catch(done);
    });
    accountFactory.create(accounts[1], accounts[2], 0);
  });

  it("Created proxy should have correct state", (done) => {
    proxy.owner.call().then((createdControllerAddress) => {
      assert.equal(createdControllerAddress, standardController.address);
      done();
    }).catch(done);
  });

  it("Created controller should have correct state", (done) => {
    standardController.proxy().then((_proxyAddress) => {
      assert.equal(_proxyAddress, proxy.address);
      return standardController.userKey();
    }).then((userKey) => {
      assert.equal(userKey, user1);
      return standardController.recoveryKey();
    }).then((recoveryKey) => {
      assert.equal(recoveryKey, recoveryQuorumAddress);
      done();
    }).catch(done);
  });

  it("Created ID should have the following behavior", (done) => {
    var event = identityFactory.IdentityCreated({creator: nobody})
    event.watch((error, result) => {
      event.stopWatching();
      proxy = Proxy.at(result.args['proxy']);
      controller = StandardController.at(result.args['controller']);
      quorum = RecoveryQuorum.at(result.args['recoveryQuorum']);
      quorum.signUserChange(recoveryUser2, {from: user1}).then(() => {
        return controller.userKey();
      }).then((userKey) => {
        assert.equal(userKey, user1, "non delegate signs -> userKey shouldnt change");
        return quorum.collectedSignatures.call(recoveryUser2)
      }).then((collectedSigs) => {
        assert.equal(collectedSigs.toNumber(), 0, "non delegate signs -> collectedSigs shouldnt increment");
        return quorum.replaceDelegates([], [delegate2], {from: user1})
      }).then(() => {
        return quorum.signUserChange(recoveryUser2, {from: delegate2})
      }).then(() => {
        return quorum.delegates.call(delegate2)
      }).then((delegate) => {
        assert.approximately(delegate[delegatePendingUntil].toNumber(), Date.now()/1000 + longTimeLock, 2, "added delegate has the correct state");
        assert.equal(delegate[delegateProposedUserKey], recoveryUser2, "added delegate has the correct state");
        return quorum.collectedSignatures.call(recoveryUser2)
      }).then((collectedSigs) => {
        assert.equal(collectedSigs.toNumber(), 0, "pending delegate signs -> collectedSigs shouldnt reflect that yet");
        return quorum.changeUserKey(recoveryUser2, {from: nobody})
      }).then(() => {
        return controller.userKey()
      }).then((userKey) => {
        assert.equal(userKey, user1, "changeUserKey has no affect until the pendingDelegate has waited");
        return wait(longTimeLock + 1)
      }).then(() => {
        return quorum.delegates.call(delegate2)
      }).then((delegate) => {
        assert.equal(delegate[delegateProposedUserKey], recoveryUser2);
        assert.isBelow(delegate[delegatePendingUntil].toNumber(), Date.now()/1000);
        assert.equal(delegate[delegateProposedUserKey], recoveryUser2);
        //some sort of caching issue unless I call collectedSignatures *as a transaction* first
        return quorum.collectedSignatures(recoveryUser2, {from: nobody})
      }).then(() => {
        return quorum.collectedSignatures.call(recoveryUser2)
      }).then((collectedSigs) => {
        assert.equal(collectedSigs.toNumber(), 1, "after timeLock period collectedSigs should reflect the vote");
        return quorum.signUserChange(recoveryUser2, {from: delegate1})
      }).then(() => {
        return controller.userKey()
      }).then((userKey) => {
        assert.equal(userKey, recoveryUser2, "changeUserKey should affect userKey after delegate has waited long enough")
        return quorum.collectedSignatures.call(recoveryUser2)
      }).then((collectedSigs) => {
        assert.equal(collectedSigs.toNumber(), 0, "after the recovery, signatures reset");
        done();
      }).catch(done);
    })

    identityFactory.CreateProxyWithControllerAndRecovery(
      user1,//userKey
      [delegate1, delegate3],//delegates
      longTimeLock, 
      shortTimeLock, 
      {from: nobody}
    );
  });

  it("Created ID should have the following behavior", (done) => {
    var event = identityFactory.IdentityCreated({creator: nobody})
    event.watch((error, result) => {
      event.stopWatching();
      proxy = Proxy.at(result.args['proxy']);
      controller = StandardController.at(result.args['controller']);
      quorum = RecoveryQuorum.at(result.args['recoveryQuorum']);
      quorum.replaceDelegates([], [delegate5, delegate6], {from: user1}).then(() => {})
      .then(() => {return quorum.signUserChange(recoveryUser2, {from:delegate5})})//pending
      .then(() => {return quorum.signUserChange(recoveryUser2, {from:delegate6})})//pending
      .then(() => {return quorum.collectedSignatures.call(recoveryUser2)})
      .then((collectedSigs) => {
        assert.equal(collectedSigs.toNumber(), 0, "pending delegate votes dont count yet")
        return quorum.signUserChange(recoveryUser2, {from:delegate1})})//OG delegate
      .then(() => {return quorum.signUserChange(recoveryUser2, {from:delegate2})})//OG delegate
      .then(() => {return quorum.changeUserKey(recoveryUser2, {from:nobody})})
      .then(() => {return controller.userKey()})
      .then((userKey) => {
        assert.equal(userKey, user1, "shouldnt change because 2 of the votes are pending")
        return quorum.collectedSignatures.call(recoveryUser2)})
      .then((collectedSigs) => {
        assert.equal(collectedSigs.toNumber(), 2, "because 2 of the 4 votes are pending")
        return quorum.signUserChange(recoveryUser2, {from:delegate1})})//delegate1 signing twice
      .then(() => {return controller.userKey()})
      .then((userKey) => {
        assert.equal(userKey, user1, "shouldnt change because delegate1 already signed")
        return quorum.collectedSignatures.call(recoveryUser2)})
      .then((collectedSigs) => {
        assert.equal(collectedSigs.toNumber(), 2, "shoudnt change either, delegate1 already signed")
        return quorum.signUserChange(recoveryUser1, {from:delegate1})})//delegate1 changes vote
      .then(() => {return quorum.signUserChange(recoveryUser2, {from:delegate3})})//all votes have reset at this point
      .then(() => {return wait(longTimeLock + 1)})
      .then(() => {return quorum.collectedSignatures(recoveryUser2, {from: nobody})})//web3 caching hack
      .then(() => {return quorum.collectedSignatures.call(recoveryUser2)})
      .then((collectedSigs) => {
        assert.equal(collectedSigs.toNumber(), 4, "the votes from delegates 2, 3, 5 and 6. timelock are now over on 5 and 6")
        return quorum.changeUserKey(recoveryUser1, {from:nobody})//recovUser has 1 vote only
      })
      .then(() => {return controller.userKey()})
      .then((userKey) => {
        assert.equal(userKey, user1, "shouldnt change because recoveryUser1 only has 1 vote (recoveryUser2 has 3)")
        return quorum.changeUserKey(recoveryUser2, {from:nobody})//userKey changes, all votes reset
      })
      .then(() => {return controller.userKey()})
      .then((userKey) => {
        assert.equal(userKey, recoveryUser2, "works this time, because recoveryUser2 has 3 votes")
        return quorum.collectedSignatures(recoveryUser2)})//
      .then(() => {return quorum.signUserChange(recoveryUser1, {from:delegate5})})//all votes have reset at this point
      .then(() => {return quorum.signUserChange(recoveryUser1, {from:delegate6})})//2nd vote for recoveryUser1
      .then(() => {return quorum.collectedSignatures.call(recoveryUser1)})
      .then((collectedSigs) => {
        assert.equal(collectedSigs.toNumber(), 2, "only 2 because the votes (particulary delegate1's) get reset after a recovery")
        return quorum.changeUserKey(recoveryUser2, {from:nobody})})//not enough votes
      .then(() => {return controller.userKey()})
      .then((userKey) => {
        assert.equal(userKey, recoveryUser2, "still recoveryUser2 from above. Votes reset after a recovery. Only 2 votes (not enough)")
        //lets say recoveryUser2 is now stolen. theif tries to delete people before delegates can recover account
        return quorum.replaceDelegates([delegate1, delegate2, delegate5, delegate6], [], {from:recoveryUser2})})//removing
      .then(() => {return quorum.signUserChange(recoveryUser1, {from:delegate2})})
      .then(() => {return quorum.signUserChange(recoveryUser1, {from:delegate1})})//the last signature needed, triggers change
      .then(() => {return controller.userKey()})
      .then((userKey) => {
        assert.equal(userKey, recoveryUser1, "recovery still goes through. theif cant remove delegates immediately ")
        done();
      }).catch(done);
    })

    identityFactory.CreateProxyWithControllerAndRecovery(
      user1,//userKey
      delegates,// #1,2,3, and 4
      longTimeLock, 
      shortTimeLock, 
      {from: nobody}
    );
  });
});

  





