// The fixed counterpart to fixtures/vulnerable/reentrant-vault.sol:
// state is zeroed before the external call, and the call is guarded by a
// real reentrancy-lock modifier besides.
pragma solidity 0.8.24;

contract VaultGuarded {
  mapping(address => uint256) public balances;
  bool private locked;

  modifier nonReentrant() {
    require(!locked, "reentrant call");
    locked = true;
    _;
    locked = false;
  }

  function deposit() external payable {
    balances[msg.sender] += msg.value;
  }

  function withdraw() external nonReentrant {
    uint256 amount = balances[msg.sender];
    balances[msg.sender] = 0;
    (bool ok, ) = msg.sender.call{value: amount}("");
    require(ok, "transfer failed");
  }
}
