// Display formatters shared by the old and v4 Spa Details layouts.

export const formatDateSubLabel = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const day = Number(parts[2]);
  const monthIdx = Number(parts[1]) - 1;
  if (!Number.isFinite(day) || !monthNames[monthIdx]) return '';
  return `${day} ${monthNames[monthIdx]}`;
};

// null when the service has no (or a zero) price: the card then shows no price
// instead of the made-up ₹999 it used to.
export const formatServicePrice = (
  price: string | null | number,
  currency: string | null,
): string | null => {
  const numericPrice = Number(price);
  if (!price || !(numericPrice > 0)) return null;
  const formattedPrice = Number.isFinite(numericPrice)
    ? numericPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })
    : price;

  if (!currency || currency.toUpperCase() === 'INR') {
    return `₹${formattedPrice}`;
  }
  return `${currency} ${formattedPrice}`;
};
