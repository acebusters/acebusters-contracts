pragma solidity ^0.4.11;

import "./AccountProxy.sol";

contract AccountRegistry {

  event AccountRegistered(address indexed signer, address proxy);
  event AccountRecovered(address indexed newSigner, address proxy, address oldSigner);

  mapping(address => address) signerToProxy;
  mapping(address => address) proxyToSigner;

  function getAccount(address _signer) constant returns(address, address, bool) {
      address proxyAddr = signerToProxy[_signer];
      var proxy = AccountProxy(proxyAddr);
      return (proxyAddr, proxy.getOwner(), proxy.isLocked());
  }

  function getSigner(address _proxy) constant returns(address) {
      return proxyToSigner[_proxy];
  }

  function register(address _signer) {
    assert(signerToProxy[_signer] == 0x0);

    signerToProxy[_signer] = msg.sender;
    proxyToSigner[msg.sender] = _signer;
    AccountRegistered(_signer, msg.sender);
  }

  function handleRecovery(address _newSigner) {
    address oldSigner = proxyToSigner[msg.sender];
    address proxy = signerToProxy[oldSigner];
    assert(proxy != 0x0 && msg.sender == proxy);

    delete signerToProxy[oldSigner];
    signerToProxy[_newSigner] = proxy;
    proxyToSigner[msg.sender] = _newSigner;
    AccountRecovered(_newSigner, proxy, oldSigner);
  }
}
