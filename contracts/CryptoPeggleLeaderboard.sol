// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CryptoPeggleLeaderboard {
    uint256 public constant MAX_SCORE   = 999_999;
    uint256 public constant MAX_LEVEL   = 999;
    uint256 public constant MAX_PLAYERS = 10_000; // prevent unbounded array growth

    struct Entry {
        uint256 score;
        uint256 level;
        uint256 timestamp;
    }

    mapping(address => Entry) public best;
    address[] public players;
    uint256 public totalSubmissions; // counts all attempts, not only personal bests

    event ScoreSubmitted(address indexed player, uint256 score, uint256 level);

    function submitScore(uint256 score, uint256 level) external {
        require(score > 0 && score <= MAX_SCORE, "invalid score");
        require(level > 0 && level <= MAX_LEVEL, "invalid level");

        if (best[msg.sender].score == 0 && players.length < MAX_PLAYERS) {
            players.push(msg.sender);
        }

        if (score > best[msg.sender].score) {
            best[msg.sender] = Entry(score, level, block.timestamp);
        }

        totalSubmissions++;
        emit ScoreSubmitted(msg.sender, score, level);
    }

    function playerCount() external view returns (uint256) {
        return players.length;
    }

    function getEntry(address player) external view returns (uint256 score, uint256 level, uint256 timestamp) {
        Entry memory e = best[player];
        return (e.score, e.level, e.timestamp);
    }
}
