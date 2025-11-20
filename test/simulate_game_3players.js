const fs = require('fs');
const path = require('path');
const CardGame = require('../gameEngine');

const game = new CardGame();
game.initGame(3);

// Prepare logs directory and file
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const now = new Date();
const timestamp = now.toISOString().replace(/:/g, '-').replace(/T/, '_').split('.')[0];
const logFile = path.join(logsDir, `simulate_game_3players_${timestamp}.log`);

function writeLog(...args) {
  const line = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  console.log(line);
  try {
    fs.appendFileSync(logFile, line + '\n');
  } catch (err) {
    console.error('Failed to write log:', err.message);
  }
}

writeLog('--- Starting 3-player simulation ---');
writeLog('Initial deck cards:', game.deck.length);
for (let i = 0; i < game.players.length; i++) {
  const p = game.players[i];
  console.log(`Player ${i} hand:`, p.hand);
  writeLog(`Player ${i} hand:`, p.hand);
  console.log(`Player ${i} faceUp:`, p.faceUp);
  writeLog(`Player ${i} faceUp:`, p.faceUp);
  console.log(`Player ${i} faceDown:`, p.faceDown);
  writeLog(`Player ${i} faceDown:`, p.faceDown);
}

let turns = 0;
const MAX_TURNS = 5000;
let winner = null;

function handSummary(arr) {
  return arr.map(c => `${c.rank}${c.suit[0].toUpperCase()}`).join(',');
}

function pileSummary() {
  if (game.pile.length === 0) return '(empty)';
  return game.pile.map(c => `${c.rank}${c.suit[0].toUpperCase()}`).join('|');
}

while (turns < MAX_TURNS) {
  turns++;
  const playerIndex = game.currentPlayer;
  const p = game.players[playerIndex];

  // Ensure faceUp pickup if needed
  game.pickupFaceUpIfNeeded(playerIndex);

  // If no hand but has faceDown and deck empty and no faceUp, play facedown
  if (p.hand.length === 0 && p.faceUp.length === 0 && p.faceDown.length > 0) {
    const res = game.playFaceDown(playerIndex);
    if (res.success) {
      writeLog(`Turn ${turns}: Player ${playerIndex} revealed facedown and played ${handSummary(res.played)}`);
    } else {
      writeLog(`Turn ${turns}: Player ${playerIndex} revealed facedown and picked up pile`);
    }
    // advance unless engine changed currentPlayer
    const prev = playerIndex;
    if (game.currentPlayer === prev) game.currentPlayer = game.nextPlayerIndex(prev);
    // check winner
    const w = game.checkWinCondition();
    if (w !== null) { winner = w; break; }
    continue;
  }

  // Build playable groups in hand
  const ranksMap = {};
  for (const card of p.hand) {
    ranksMap[card.rank] = ranksMap[card.rank] || [];
    ranksMap[card.rank].push(card);
  }

  // find non-special legal ranks
  const nonSpecials = Object.keys(ranksMap).filter(r => !['2','3','7','9','10'].includes(r));
  // sort by rankValue (lowest first)
  nonSpecials.sort((a,b) => game.rankValue(a) - game.rankValue(b));

  let playedResult = null;
  let actionDesc = '';

  // try lowest non-special
  let triedPlay = false;
  for (const rank of nonSpecials) {
    const cardsToPlay = ranksMap[rank];
    // attempt to play all of that rank
    if (game.isLegalPlay(playerIndex, cardsToPlay)) {
      playedResult = game.playCards(playerIndex, cardsToPlay);
      actionDesc = `played ${cardsToPlay.length}x ${rank}`;
      triedPlay = true;
      break;
    }
  }

  // if none, try special cards present in hand
  if (!triedPlay) {
    const specialOrder = ['10','2','9','7','3'];
    for (const s of specialOrder) {
      if (ranksMap[s]) {
        const cardsToPlay = ranksMap[s];
        // For 3, choose the next player as target
        const options = {};
        if (s === '3') options.targetIndex = game.nextPlayerIndex(playerIndex);
        if (game.isLegalPlay(playerIndex, [cardsToPlay[0]])) {
          playedResult = game.playCards(playerIndex, [cardsToPlay[0]], options);
          actionDesc = `played special ${s}`;
          triedPlay = true;
          break;
        }
      }
    }
  }

  // If still nothing playable, pick up pile and then play lowest available card to start new pile
  if (!triedPlay) {
    const picked = game.pickUpPile(playerIndex);
    actionDesc = 'picked up pile';
    writeLog(`Turn ${turns}: Player ${playerIndex} ${actionDesc}. Hand now: ${handSummary(p.hand)}`);
    // after picking up, attempt to play lowest non-special if possible
    // rebuild ranksMap
    const ranksMap2 = {};
    for (const card of p.hand) {
      ranksMap2[card.rank] = ranksMap2[card.rank] || [];
      ranksMap2[card.rank].push(card);
    }
    const nonSpecials2 = Object.keys(ranksMap2).filter(r => !['2','3','7','9','10'].includes(r));
    nonSpecials2.sort((a,b) => game.rankValue(a) - game.rankValue(b));
    if (nonSpecials2.length > 0) {
      const rank = nonSpecials2[0];
      const cardsToPlay = ranksMap2[rank];
      if (game.isLegalPlay(playerIndex, cardsToPlay)) {
        playedResult = game.playCards(playerIndex, cardsToPlay);
        actionDesc = `after pickup played ${cardsToPlay.length}x ${rank}`;
      }
    } else {
      // if still cannot play, just end turn
      const prev = playerIndex;
      if (game.currentPlayer === prev) game.currentPlayer = game.nextPlayerIndex(prev);
      const w = game.checkWinCondition();
      if (w !== null) { winner = w; break; }
      continue;
    }
  }

  if (playedResult && playedResult.success) {
    writeLog(`Turn ${turns}: Player ${playerIndex} ${actionDesc}. Played: ${playedResult.played.map(c=>c.rank+c.suit[0].toUpperCase()).join(',')}`);
  } else if (playedResult && !playedResult.success) {
    writeLog(`Turn ${turns}: Player ${playerIndex} attempted ${actionDesc} but failed: ${playedResult.reason}`);
  }

  writeLog(`   Pile: ${pileSummary()}`);

  // advance turn unless engine changed currentPlayer (e.g., 3 forced pickup changed it)
  const prev = playerIndex;
  if (game.currentPlayer === prev) game.currentPlayer = game.nextPlayerIndex(prev);

  // check winner
  const w = game.checkWinCondition();
  if (w !== null) { winner = w; break; }
}

if (winner !== null) {
  writeLog(`\nGame over. Winner: Player ${winner}`);
} else {
  writeLog('\nGame ended in a draw or max turns reached.');
}

  writeLog('Turns:', turns);
  writeLog('Final pile:', pileSummary());
for (let i=0;i<game.players.length;i++) writeLog(`Player ${i} remaining: hand=${handSummary(game.players[i].hand)} faceUp=${handSummary(game.players[i].faceUp)} faceDown=${game.players[i].faceDown.length}`);
writeLog(`Log saved to: ${logFile}`);
