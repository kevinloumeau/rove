/** What the clothing segmenter found, before the style model names it more precisely. */
export type GarmentKind = "top" | "pants" | "skirt" | "dress" | "shoes" | "accessory";
export type Guess = { label: string; score: number };

type TypeOption = { label: string; noun: string; category?: string; material?: string };

const outerwear = "Outerwear";

/** Candidate garment types for the style model, per segmenter kind. `label` is what CLIP reads. */
export const typeOptions: Record<GarmentKind, TypeOption[]> = {
  top: [
    { label: "t-shirt", noun: "T-shirt" },
    { label: "long-sleeve t-shirt", noun: "long-sleeve tee" },
    { label: "knit sweater", noun: "sweater" },
    { label: "cardigan", noun: "cardigan" },
    { label: "hoodie", noun: "hoodie" },
    { label: "crewneck sweatshirt", noun: "sweatshirt" },
    { label: "button-up shirt", noun: "shirt" },
    { label: "polo shirt", noun: "polo" },
    { label: "tank top", noun: "tank top" },
    { label: "blouse", noun: "blouse" },
    { label: "denim jacket", noun: "denim jacket", category: outerwear, material: "denim" },
    { label: "leather jacket", noun: "leather jacket", category: outerwear, material: "leather" },
    { label: "puffer jacket", noun: "puffer jacket", category: outerwear },
    { label: "blazer", noun: "blazer", category: outerwear },
    { label: "long coat", noun: "coat", category: outerwear },
    { label: "zip-up jacket", noun: "jacket", category: outerwear },
  ],
  pants: [
    { label: "blue jeans", noun: "jeans", material: "denim" },
    { label: "chino pants", noun: "chinos" },
    { label: "dress trousers", noun: "trousers" },
    { label: "sweatpants", noun: "sweatpants" },
    { label: "leggings", noun: "leggings" },
    { label: "cargo pants", noun: "cargo pants" },
    { label: "shorts", noun: "shorts" },
  ],
  skirt: [
    { label: "skirt", noun: "skirt" },
    { label: "denim skirt", noun: "denim skirt", material: "denim" },
    { label: "pleated skirt", noun: "pleated skirt" },
  ],
  dress: [
    { label: "dress", noun: "dress" },
    { label: "maxi dress", noun: "maxi dress" },
    { label: "summer sundress", noun: "sundress" },
    { label: "shirt dress", noun: "shirt dress" },
  ],
  shoes: [
    { label: "sneakers", noun: "sneakers" },
    { label: "boots", noun: "boots" },
    { label: "loafers", noun: "loafers" },
    { label: "sandals", noun: "sandals" },
    { label: "high heels", noun: "heels" },
    { label: "leather dress shoes", noun: "dress shoes" },
    { label: "ballet flats", noun: "flats" },
  ],
  accessory: [],
};

/** Fabric and pattern candidates; `label` is what CLIP reads, `word` is what Rove writes. */
export const materialOptions = [
  { label: "denim", word: "denim" },
  { label: "chunky knit wool", word: "knit" },
  { label: "plain cotton", word: "cotton" },
  { label: "linen", word: "linen" },
  { label: "leather", word: "leather" },
  { label: "shiny silk", word: "silk" },
  { label: "fleece", word: "fleece" },
  { label: "corduroy", word: "corduroy" },
];
export const patternOptions = [
  { label: "a solid color", word: "" },
  { label: "stripes", word: "striped" },
  { label: "a plaid pattern", word: "plaid" },
  { label: "a floral print", word: "floral" },
  { label: "a graphic print or logo", word: "graphic" },
  { label: "polka dots", word: "polka-dot" },
  { label: "a camouflage pattern", word: "camo" },
];

export const TYPE_TEMPLATE = "a product photo of {}";
export const MATERIAL_TEMPLATE = "a piece of clothing made of {}";
export const PATTERN_TEMPLATE = "a piece of clothing with {}";

const TYPE_CONFIDENCE = 0.25;
const MATERIAL_CONFIDENCE = 0.35;
const PATTERN_CONFIDENCE = 0.5;

const warmWeather = new Set(["tank top", "shorts", "sandals", "sundress", "linen"]);
const coldWeather = new Set([
  "sweater",
  "cardigan",
  "hoodie",
  "sweatshirt",
  "puffer jacket",
  "coat",
  "boots",
  "knit",
  "fleece",
  "corduroy",
]);

function best(guesses: Guess[] | undefined, minimum: number) {
  const top = guesses?.reduce<Guess | undefined>((a, b) => (!a || b.score > a.score ? b : a), undefined);
  return top && top.score >= minimum ? top.label : undefined;
}

/**
 * Turns the segmenter's kind, the measured color and the style model's guesses into a name,
 * category, season, description and tags. Without guesses it falls back to the plain noun.
 */
export function describeGarment(input: {
  kind: GarmentKind;
  fallbackNoun: string;
  fallbackCategory: string;
  color: string;
  type?: Guess[];
  material?: Guess[];
  pattern?: Guess[];
}) {
  const typeLabel = best(input.type, TYPE_CONFIDENCE);
  const type = typeOptions[input.kind].find((option) => option.label === typeLabel);
  const noun = type?.noun ?? input.fallbackNoun;
  const category = type?.category ?? input.fallbackCategory;

  const materialLabel = best(input.material, MATERIAL_CONFIDENCE);
  const material = type?.material ?? materialOptions.find((option) => option.label === materialLabel)?.word;
  const pattern = patternOptions.find((option) => option.label === best(input.pattern, PATTERN_CONFIDENCE))?.word;

  const name = [input.color, pattern, noun].filter(Boolean).join(" ");
  const fabric = material && !noun.includes(material) ? material : undefined;
  const phrase = [input.color, pattern, fabric, noun].filter(Boolean).join(" ").toLowerCase();
  const description = `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}.`;

  const season = [noun, material].some((word) => word && coldWeather.has(word))
    ? "Fall / winter"
    : [noun, material].some((word) => word && warmWeather.has(word))
      ? "Spring / summer"
      : "All season";

  const tags = [
    ...new Set([category, noun, input.color, material, pattern].filter(Boolean).map((t) => t!.toLowerCase())),
  ];
  return { name, category, season, description, tags };
}
