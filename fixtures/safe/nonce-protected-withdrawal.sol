// The fixed counterpart to fixtures/vulnerable/replayable-withdrawal.sol:
// a used-signature mapping stops the same signature being submitted
// twice.
pragma solidity 0.8.24;

contract NonceProtectedWithdrawal {
  mapping(address => uint256) public balances;
  mapping(bytes32 => bool) public used;

  function withdraw(uint256 amount, bytes32 hash, bytes32 r, bytes32 s, uint8 v) public {
    require(!used[hash], "already used");
    address signer = ecrecover(hash, v, r, s);
    require(signer != address(0), "bad signature");
    used[hash] = true;
    balances[signer] -= amount;
  }
}
