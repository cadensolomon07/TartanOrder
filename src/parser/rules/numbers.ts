/**
 * Reads one numeric expression from a token stream. Shared by the quantity guard
 * (which scans the whole utterance) and the ADD matcher (which reads a leading quantity).
 * `integer` carries a value; `decimal` and `vague` never do and must fail closed;
 * `article` is a bare "a"/"an" that means one only in ADD position.
 */
export type NumberReading = {
  readonly value: number;
  readonly length: number;
  readonly form: "integer" | "decimal" | "vague" | "article";
};

const UNITS: Readonly<Record<string, number>> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Readonly<Record<string, number>> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALES: Readonly<Record<string, number>> = { hundred: 100, thousand: 1_000, million: 1_000_000 };
const DOZEN = 12;
const COUPLE = 2;
const HALF_DOZEN = 6;
const ARTICLES: ReadonlySet<string> = new Set(["a", "an"]);
const VAGUE: ReadonlySet<string> = new Set(["few", "several", "some"]);
/** Words an article may introduce as a quantity ("a hundred", "a dozen", "a couple", "a few"). */
const ARTICLE_FOLLOWERS: ReadonlySet<string> = new Set([...Object.keys(SCALES), "dozen", "couple", "few"]);

export const NUMBER_WORDS: ReadonlySet<string> = new Set([
  ...Object.keys(UNITS), ...Object.keys(TENS), ...Object.keys(SCALES), "dozen", "couple", "half", ...VAGUE, "of",
]);

const DIGITS = /^\d+$/;
const THOUSANDS = /^\d{1,3}(?:,\d{3})+$/;
const DECIMAL = /^\d[\d,]*\.\d+$|^\.\d+$/;

function has(table: Readonly<Record<string, number>>, token: string): boolean {
  return Object.hasOwn(table, token);
}

function readDigits(token: string): NumberReading | null {
  if (DIGITS.test(token)) return { value: Number(token), length: 1, form: "integer" };
  if (THOUSANDS.test(token)) return { value: Number(token.replace(/,/g, "")), length: 1, form: "integer" };
  if (DECIMAL.test(token)) return { value: Number.NaN, length: 1, form: "decimal" };
  return null;
}

function readSpecial(tokens: readonly string[], start: number, index: number): NumberReading | null {
  const token = tokens[index];
  if (token === "half" && tokens[index + 1] === "a" && tokens[index + 2] === "dozen") {
    return { value: HALF_DOZEN, length: index + 3 - start, form: "integer" };
  }
  if (VAGUE.has(token)) return { value: Number.NaN, length: index + 1 - start, form: "vague" };
  if (token === "couple") {
    const length = tokens[index + 1] === "of" ? 2 : 1;
    return { value: COUPLE, length: index + length - start, form: "integer" };
  }
  return null;
}

function readWords(tokens: readonly string[], start: number): NumberReading | null {
  let index = start;
  let current = 0;
  let total = 0;
  let sawNumber = false;
  if (ARTICLES.has(tokens[index])) {
    if (!ARTICLE_FOLLOWERS.has(tokens[index + 1] ?? "")) return { value: 1, length: 1, form: "article" };
    current = 1;
    index += 1;
  }
  const special = readSpecial(tokens, start, index);
  if (special) return special;
  while (index < tokens.length) {
    const token = tokens[index];
    if (has(UNITS, token)) current += UNITS[token];
    else if (has(TENS, token)) current += TENS[token];
    else if (token === "hundred") current = (current || 1) * SCALES.hundred;
    else if (token === "thousand" || token === "million") { total += (current || 1) * SCALES[token]; current = 0; }
    else if (token === "dozen") current = (current || 1) * DOZEN;
    else break;
    sawNumber = true;
    index += 1;
  }
  if (!sawNumber) return null;
  return { value: total + current, length: index - start, form: "integer" };
}

export function readNumber(tokens: readonly string[], start: number): NumberReading | null {
  const token = tokens[start];
  if (token === undefined) return null;
  return readDigits(token) ?? readWords(tokens, start);
}
