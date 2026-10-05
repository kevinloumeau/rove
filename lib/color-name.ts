/** Swatch for every color name Rove assigns, used by colorSwatch(). */
export const colorSwatches: Record<string, string> = {
  Black: "rgb(26, 27, 29)",
  Charcoal: "#36383a",
  Gray: "rgb(128, 130, 132)",
  "Light gray": "rgb(196, 198, 200)",
  White: "rgb(235, 235, 230)",
  Cream: "rgb(229, 218, 188)",
  Beige: "rgb(201, 183, 145)",
  Tan: "rgb(176, 141, 98)",
  Brown: "rgb(108, 72, 50)",
  Navy: "rgb(31, 48, 79)",
  Blue: "rgb(55, 102, 171)",
  "Light blue": "rgb(150, 182, 214)",
  Red: "rgb(180, 45, 42)",
  Burgundy: "rgb(110, 30, 42)",
  Pink: "rgb(219, 128, 153)",
  Purple: "rgb(113, 76, 145)",
  Green: "rgb(67, 119, 76)",
  Olive: "rgb(107, 108, 58)",
  Yellow: "rgb(220, 187, 55)",
  Orange: "rgb(210, 112, 43)",
  Multicolor: "conic-gradient(#d0463b, #e0b23a, #4b8f5a, #3e6fc4, #d0463b)",
};

/**
 * Names the average color of a garment. Works on hue, saturation and lightness rather than
 * distance to a few reference colors, so a light-wash denim reads as light blue, not gray.
 */
export function colorName(red: number, green: number, blue: number) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const chroma = max - min;
  const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (chroma > 0) {
    if (max === r) hue = ((g - b) / chroma + 6) % 6;
    else if (max === g) hue = (b - r) / chroma + 2;
    else hue = (r - g) / chroma + 4;
    hue *= 60;
  }

  if (lightness < 0.13) return "Black";
  // Faint tints near white or black read as neutrals.
  if (chroma < 0.08 || saturation < 0.12) {
    if (lightness > 0.86) return "White";
    if (lightness > 0.66) return "Light gray";
    if (lightness > 0.3) return "Gray";
    return "Charcoal";
  }

  if (hue >= 15 && hue < 50) {
    if (lightness > 0.82) return "Cream";
    if (saturation < 0.45 && lightness > 0.6) return "Beige";
    if (lightness < 0.4) return "Brown";
    if (saturation < 0.55) return "Tan";
    return "Orange";
  }
  if (hue >= 50 && hue < 70) {
    if (lightness > 0.8 && saturation < 0.6) return "Cream";
    if (lightness < 0.4 || saturation < 0.35) return "Olive";
    return "Yellow";
  }
  if (hue >= 70 && hue < 170) return lightness < 0.35 && saturation < 0.4 ? "Olive" : "Green";
  if (hue >= 170 && hue < 255) {
    if (lightness < 0.3) return "Navy";
    if (lightness > 0.6) return "Light blue";
    return "Blue";
  }
  if (hue >= 255 && hue < 290) return "Purple";
  if (hue >= 290 && hue < 345) return lightness < 0.35 ? "Purple" : "Pink";
  // Reds wrap around 0°.
  if (lightness > 0.65) return "Pink";
  if (lightness < 0.3) return "Burgundy";
  return "Red";
}
