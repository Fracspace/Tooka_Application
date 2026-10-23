// Sizes from District's spotlight: the middle card is ~61% of the screen wide,
// side cards are 80% of its size and sit 18pt away, partly off screen.
export const SIDE_SCALE = 0.8;
const CARD_GAP = 18;

export const spotlightSizes = (screenWidth: number) => {
  const cardW = Math.round(screenWidth * 0.607);
  return {
    cardW,
    cardH: Math.round(cardW * 1.34),
    interval: cardW * ((1 + SIDE_SCALE) / 2) + CARD_GAP,
  };
};
