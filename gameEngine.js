class CardGame {
  constructor() {
    this.players = []; // array of player objects: { hand:[], faceUp:[], faceDown:[] }
    this.pile = [];
    this.discardPile = [];
    this.deck = [];
    this.currentPlayer = 0; // index
    this.numPlayers = 0;
    this.sevenMode = false; // when true, next must play lower than 7 unless more 7s played
  }

  // Create n decks (one deck per 4 players)
  createDeck(numDecks = 1) {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];

    for (let d = 0; d < numDecks; d++) {
      for (const suit of suits) {
        for (const rank of ranks) {
          deck.push({ suit, rank });
        }
      }
    }

    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
  }

  // Initialize the game for n players
  initGame(nPlayers) {
    this.numPlayers = nPlayers;
    const numDecks = Math.max(1, Math.ceil(nPlayers / 4));
    this.deck = this.createDeck(numDecks);
    this.pile = [];
    this.discardPile = [];
    this.players = [];

    for (let i = 0; i < nPlayers; i++) {
      this.players.push({ hand: [], faceUp: [], faceDown: [] });
    }

    this.deal();
    this.currentPlayer = Math.floor(Math.random() * nPlayers);
    this.sevenMode = false;
  }

  // Deal cards: for each player: 3 facedown, 3 faceup, 3 hand
  deal() {
    // ensure deck has enough cards
    for (const p of this.players) {
      // facedown
      p.faceDown = [];
      for (let i = 0; i < 3; i++) {
        p.faceDown.push(this.deck.pop());
      }
      // faceup
      p.faceUp = [];
      for (let i = 0; i < 3; i++) {
        p.faceUp.push(this.deck.pop());
      }
      // hand
      p.hand = [];
      for (let i = 0; i < 3; i++) {
        p.hand.push(this.deck.pop());
      }
    }
  }

  // Allow player to swap some faceUp cards with cards from their hand before game starts
  // swaps: array of objects { faceUpIndex, handIndex }
  replaceFaceUp(playerIndex, swaps = []) {
    const p = this.players[playerIndex];
    if (!p) return false;
    for (const s of swaps) {
      const { faceUpIndex, handIndex } = s;
      if (faceUpIndex < 0 || faceUpIndex >= p.faceUp.length) continue;
      if (handIndex < 0 || handIndex >= p.hand.length) continue;
      [p.faceUp[faceUpIndex], p.hand[handIndex]] = [p.hand[handIndex], p.faceUp[faceUpIndex]];
    }
    return true;
  }

  // Helper: map rank to numeric value
  rankValue(rank) {
    if (rank === 'A') return 14;
    if (rank === 'J') return 11;
    if (rank === 'Q') return 12;
    if (rank === 'K') return 13;
    return parseInt(rank, 10);
  }

  // Get effective top card of pile (ignore 9s since they are invisible)
  getEffectiveTop() {
    for (let i = this.pile.length - 1; i >= 0; i--) {
      if (!this.pile[i]) continue;
      if (this.pile[i].rank === '9') continue;
      return this.pile[i];
    }
    return null;
  }

  // Check if a proposed play (array of cards) is legal for playerIndex
  isLegalPlay(playerIndex, cards) {
    if (!Array.isArray(cards) || cards.length === 0) return false;
    // all same rank
    const rank = cards[0].rank;
    if (!cards.every(c => c && c.rank === rank)) return false;

    const effectiveTop = this.getEffectiveTop();

    // If a 2 was played last, reset allows any following play
    if (this.lastWasTwo) return true;

    // special cards (2,3,9,10) can be played anytime (except 7 needs legal)
    if (rank === '2' || rank === '3' || rank === '9' || rank === '10') return true;

    // 7: must be played as a legal move (top <= 7) - if pile empty, allowed
    if (rank === '7') {
      if (!effectiveTop) return true;
      return this.rankValue(effectiveTop.rank) <= 7;
    }

    // otherwise, need to compare against effective top
    if (!effectiveTop) return true;

    // if there is an active seven mode (previous player played 7(s)), requirement is lower-than-7
    if (this.sevenMode) {
      // cards must be numeric and less than 7
      return this.rankValue(rank) < 7;
    }

    // normal: card rank must be >= effective top rank
    return this.rankValue(rank) >= this.rankValue(effectiveTop.rank);
  }

  // Draw until player has `count` cards, default 3
  drawToCount(playerIndex, count = 3) {
    const p = this.players[playerIndex];
    if (!p) return;
    while (this.deck.length > 0 && p.hand.length < count) {
      p.hand.push(this.deck.pop());
    }
  }

  // Player picks up the pile into their hand
  pickUpPile(playerIndex) {
    const p = this.players[playerIndex];
    if (!p) return false;
    p.hand.push(...this.pile);
    this.pile = [];
    this.sevenMode = false;
    return true;
  }

  // Internal: check if top four cards are same rank and clear pile to discard
  checkFourOfKindClear() {
    if (this.pile.length < 4) return false;
    const last4 = this.pile.slice(-4);
    const rank = last4[0].rank;
    if (last4.every(c => c.rank === rank)) {
      this.discardPile.push(...this.pile);
      this.pile = [];
      this.sevenMode = false;
      return true;
    }
    return false;
  }

  // Play cards from player's hand (or faceUp if hand empty and deck empty). options may contain target for 3.
  playCards(playerIndex, cards, options = {}) {
    const p = this.players[playerIndex];
    if (!p) return { success: false, reason: 'no player' };
    if (!Array.isArray(cards) || cards.length === 0) return { success: false, reason: 'no cards' };

    // Determine source: prefer hand, but if hand empty and deck empty and faceUp exists, use faceUp
    let source = 'hand';
    if (p.hand.length === 0 && this.deck.length === 0 && p.faceUp.length > 0) source = 'faceUp';

    // Ensure all cards exist in the chosen source
    const srcArr = source === 'hand' ? p.hand : p.faceUp;
    for (const card of cards) {
      const idx = srcArr.findIndex(c => c.rank === card.rank && c.suit === card.suit);
      if (idx === -1) return { success: false, reason: 'card not in source' };
    }

    // Validate legal play
    if (!this.isLegalPlay(playerIndex, cards)) return { success: false, reason: 'illegal play' };

    // Remove cards from source and add to pile
    const played = [];
    for (const card of cards) {
      const idx = srcArr.findIndex(c => c.rank === card.rank && c.suit === card.suit);
      const [removed] = srcArr.splice(idx, 1);
      played.push(removed);
    }
    this.pile.push(...played);

    // Handle special cards effects (based on rank of played card)
    const rank = played[0].rank;

    // 9: invisible, no change to requirements
    if (rank === '9') {
      // nothing changes except draw below
    }

    // 2: resets requirement (we represent by clearing pile's effective top by pushing a marker)
    if (rank === '2') {
      // reset: next player can play any rank; we can model by clearing pile's effective top
      // Implementation: set pileReset flag by pushing a sentinel; but simpler: set a flag
      this.sevenMode = false;
      // We'll mark that effective top is reset by leaving pile as-is but interpreting getEffectiveTop accordingly.
      // For simplicity, set a property lastWasTwo
      this.lastWasTwo = true;
    } else {
      this.lastWasTwo = false;
    }

    // 3: force pickup of chosen target. options.targetIndex should be provided
    if (rank === '3') {
      const target = typeof options.targetIndex === 'number' ? options.targetIndex : null;
      if (target !== null && this.players[target]) {
        // allow target to respond with a 3: if they have a 3 in hand they may choose to play it
        // We'll not auto-handle the response here; the caller should invoke playCards on target if they choose to play a 3.
        // If not played, target must pick up
        // For now, immediately force pickup
        this.pickUpPile(target);
        this.currentPlayer = target; // the player who picks up begins the new pile
      }
    }

    // 7: sets sevenMode so next player must play lower than 7
    if (rank === '7') {
      this.sevenMode = true;
    } else if (rank !== '9') {
      // if played non-9 and non-7, sevenMode ends
      this.sevenMode = false;
    }

    // 10: discard pile
    if (rank === '10') {
      // move pile to discard
      this.discardPile.push(...this.pile);
      this.pile = [];
      this.sevenMode = false;
      // the player who played 10 draws to 3 then starts new pile (we'll let caller handle turn progression)
    }

    // After play, check for four-of-a-kind clear
    this.checkFourOfKindClear();

    // After playing, draw to 3
    this.drawToCount(playerIndex, 3);

    return { success: true, played };
  }

  // When a player has no hand and deck is empty, they pick up their faceUp into hand
  pickupFaceUpIfNeeded(playerIndex) {
    const p = this.players[playerIndex];
    if (!p) return;
    if (p.hand.length === 0 && this.deck.length === 0 && p.faceUp.length > 0) {
      p.hand.push(...p.faceUp);
      p.faceUp = [];
    }
  }

  // Play one facedown card (used when player has no hand and no faceUp)
  playFaceDown(playerIndex) {
    const p = this.players[playerIndex];
    if (!p) return { success: false, reason: 'no player' };
    if (p.faceDown.length === 0) return { success: false, reason: 'no facedown' };
    // reveal top facedown card
    const card = p.faceDown.pop();
    // if legal, it is played; otherwise player must pick up pile and the revealed card goes into their hand
    if (this.isLegalPlay(playerIndex, [card])) {
      this.pile.push(card);
      // handle specials similarly to playCards
      if (card.rank === '10') {
        this.discardPile.push(...this.pile);
        this.pile = [];
      }
      if (card.rank === '7') this.sevenMode = true;
      else if (card.rank !== '9') this.sevenMode = false;
      this.checkFourOfKindClear();
      return { success: true, played: [card] };
    } else {
      // illegal: player picks up pile and the revealed card goes into their hand
      p.hand.push(card);
      this.pickUpPile(playerIndex);
      return { success: false, reason: 'revealed facedown illegal, picked up' };
    }
  }

  // Advance to next player index
  nextPlayerIndex(fromIndex = this.currentPlayer) {
    return (fromIndex + 1) % this.numPlayers;
  }

  // Check for winner: player with no cards in hand, faceUp, and faceDown
  checkWinCondition() {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.hand.length === 0 && p.faceUp.length === 0 && p.faceDown.length === 0) return i;
    }
    return null;
  }
}

module.exports = CardGame;