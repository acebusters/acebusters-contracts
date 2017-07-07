pragma solidity ^0.4.11;

import "./AccountProxy.sol";

contract AccountFactory {

  event AccountCreated(address indexed signer, address proxy);
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

  function create(address _signer, address _lockAddr) {
    if (signerToProxy[_signer] != 0x0) {
      throw;
    }
    address proxy = new AccountProxy(msg.sender, _lockAddr);

    signerToProxy[_signer] = proxy;
    proxyToSigner[proxy] = _signer;
    AccountCreated(_signer, proxy);
  }
  
  function handleRecovery(address _newSigner) {
    address oldSigner = proxyToSigner[msg.sender];
    address proxy = signerToProxy[oldSigner];
    if (proxy == 0x0 || msg.sender != proxy) {
      throw;
    }
    
    delete signerToProxy[oldSigner];
    signerToProxy[_newSigner] = proxy;
    proxyToSigner[msg.sender] = _newSigner;
    AccountRecovered(_newSigner, proxy, oldSigner);
  }
}
