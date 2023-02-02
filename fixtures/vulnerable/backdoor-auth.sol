// tx.origin authorization, laundered through a helper function - the
// helper makes it look reviewed, but a malicious contract the owner
// interacts with can still call kill() as a confused deputy.
pragma solidity 0.8.24;

contract BackdoorAuth {
  address public owner;

  constructor() {
    owner = msg.sender;
  }

  function isOwner() internal view returns (bool) {
    return tx.origin == owner;
  }

  function kill() public {
    require(isOwner(), "not owner");
    selfdestruct(payable(owner));
  }
}
