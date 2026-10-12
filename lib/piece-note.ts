/**
 * The description worth showing under a piece's name, or "" when it only repeats the name
 * or is the old "isolated locally from the uploaded photo" filler.
 */
export function pieceNote(name: string, description: string) {
  const text = description.trim();
  const plain = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  if (!text || /isolated locally from the uploaded photo/i.test(text)) return "";
  const words = new Set(plain(name).split(" "));
  return plain(text)
    .split(" ")
    .every((word) => words.has(word))
    ? ""
    : text;
}
