pragma solidity ^0.4.8;

import "./AccountController.sol";
import "./AccountProxy.sol";

contract AccountFactory {

  event AccountCreated(address indexed signer, address proxy, address controller, address recovery);
  event AccountRecovered(address indexed newSigner, address proxy, address oldSigner);
  event Error(uint code);
  // 401 unauthorized
  // 404 not found
  // 409 conflict

  mapping(address => address) public signerToProxy;
  mapping(address => address) public signerToController;

  function create(address _signer, address _recovery, uint _timeLock) {
    if (signerToProxy[_signer] != 0x0) {
      Error(409);
      return;
    }
    AccountProxy proxy = new AccountProxy();
    AccountController controller = new AccountController(proxy, _signer, _recovery, uint96(_timeLock));
    proxy.transfer(controller);

    AccountCreated(_signer, proxy, controller, _recovery);
    signerToProxy[_signer] = proxy;
    signerToController[_signer] = controller;
  }
  
  function register(address _signer, address _proxy, address _controller) {
    if (signerToProxy[_signer] != 0x0) {
      Error(409);
      return;
    }
    if (msg.sender != _proxy) {
      Error(401);
      return;
    }
    signerToProxy[_signer] = _proxy;
    signerToController[_signer] = _controller;
  }
  
  function getAccount(address _signer) constant returns(address, address, uint96) {
      AccountController controller = AccountController(signerToController[_signer]);
      uint96 lastNonce = controller.lastNonce();
      return (signerToProxy[_signer], controller, lastNonce);
  }
  
  function handleRecovery(address _oldSigner, address _newSigner) {
    //msg.sender
    address proxy = signerToProxy[_oldSigner];
    if (proxy == 0x0) {
      Error(404);
      return;
    }
    if (msg.sender != proxy) {
      Error(401);
      return;
    }
    delete signerToProxy[_oldSigner];
    signerToProxy[_newSigner] = proxy;
    signerToController[_newSigner] = signerToController[_oldSigner];
    delete signerToController[_oldSigner];
    AccountRecovered(_newSigner, proxy, _oldSigner);
  }
}
