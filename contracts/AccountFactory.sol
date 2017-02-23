pragma solidity ^0.4.7;
import "AccountController.sol";
import "AccountProxy.sol";

contract AccountFactory {

  event AccountCreated(address indexed signer, address proxy, address controller, address recovery);
  event AccountRecovered(address indexed newSigner, address proxy, address oldSigner);
  event Error(uint code);
  // 401 unauthorized
  // 404 not found
  // 409 conflict

  mapping(address => address) public signerToProxy;

  function create(address _signer, address _recovery, uint _timeLock) {
    if (signerToProxy[_signer] != 0x0) {
      Error(409);
      return;
    }
    AccountProxy proxy = new AccountProxy();
    AccountController controller = new AccountController(proxy, _signer, _recovery, uint96(_timeLock));
    proxy.transfer(controller);

    AccountCreated(_signer, proxy, controller, _recovery);
    // TODO(ab): update this when signer is changed in controller.
    signerToProxy[_signer] = proxy;
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
    AccountRecovered(_newSigner, proxy, _oldSigner);
  }
}
