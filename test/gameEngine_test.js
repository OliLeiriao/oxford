const CardGame = require('../gameEngine');

const game = new CardGame();
console.log('Initial deck length:', game.deck.length);

for (let i = 0; i < 5; i++) {
  const card = game.drawCard('player');
  console.log(`Draw ${i + 1}:`, card);
}

console.log('Player hand length:', game.playerHand.length);
console.log('Deck remaining:', game.deck.length);
