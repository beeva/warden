// ecrecover's result is used directly in an authorization check with no
// zero-address guard anywhere in the function - a malformed signature
// recovers to address(0) instead of reverting, which this silently
// relies on never mattering rather than ruling out.
pragma solidity 0.8.24;

contract UncheckedEcrecover {
  address public owner;

  function isOwnerSignature(bytes32 hash, uint8 v, bytes32 r, bytes32 s) public view returns (bool) {
    address signer = ecrecover(hash, v, r, s);
    return signer == owner;
  }
}
