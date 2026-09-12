/**
 * Reads one numeric expression from a token stream. Shared by the quantity guard
 * (which scans the whole utterance) and the clause matchers (leading ADD quantity,
 * "make that N"). Words must follow English cardinal grammar —
 * `[a] [n] million [n] thousand [n]` where each n is `[unit] hundred [tens] [unit]` —
 * plus "a dozen", "half a dozen" and "a couple (of)"; adjacent numbers are never summed.
 * `integer` carries a value (negative when signed); `decimal`, `vague` and `malformed`
 * never do and must fail closed; `article` is a bare "a"/"an" that means one only in ADD position.
 */
export type NumberReading = {
  readonly value: number;
  readonly length: number;
  readonly form: "integer" | "decimal" | "vague" | "article" | "malformed";
};

type Span = { readonly value: number; readonly next: number };

const ONES: Readonly<Record<string, number>> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
};
const TEENS: Readonly<Record<string, number>> = {
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Readonly<Record<string, number>> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
/** Scales that may each appear once, largest first. */
const SCALES: Readonly<Record<string, number>> = { million: 1_000_000, thousand: 1_000 };
const HUNDRED = 100;
const DOZEN = 12;
const COUPLE = 2;
const HALF_DOZEN = 6;
const ARTICLES: ReadonlySet<string> = new Set(["a", "an"]);
const VAGUE: ReadonlySet<string> = new Set(["few", "several", "some"]);
/** A spoken sign negates the whole number that follows ("negative two", "minus one"). */
const SIGN_WORDS: ReadonlySet<string> = new Set(["negative", "minus"]);
/** Words an article may introduce as a quantity ("a hundred", "a dozen", "a couple", "a few"). */
const ARTICLE_FOLLOWERS: ReadonlySet<string> = new Set(["hundred", ...Object.keys(SCALES), "dozen", "couple", "few"]);

const DIGITS = /^\d+$/;
const THOUSANDS = /^\d{1,3}(?:,\d{3})+$/;
const DECIMAL = /^\d[\d,]*\.\d+$|^\.\d+$/;

function has(table: Readonly<Record<string, number>>, token: string | undefined): token is string {
  return token !== undefined && Object.hasOwn(table, token);
}

/** A digit token, optionally carrying the "-" sign that normalization preserved at token start. */
function readDigits(token: string): NumberReading | null {
  const negative = token.startsWith("-");
  const digits = negative ? token.slice(1) : token;
  const sign = negative ? -1 : 1;
  if (DIGITS.test(digits)) return { value: sign * Number(digits), length: 1, form: "integer" };
  if (THOUSANDS.test(digits)) return { value: sign * Number(digits.replace(/,/g, "")), length: 1, form: "integer" };
  if (DECIMAL.test(digits)) return { value: Number.NaN, length: 1, form: "decimal" };
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
  if (token === "dozen") return { value: DOZEN, length: index + 1 - start, form: "integer" };
  return null;
}

/** zero | unit | teen | tens [unit] */
function readBelow100(tokens: readonly string[], index: number): Span | null {
  const token = tokens[index];
  if (token === "zero") return { value: 0, next: index + 1 };
  if (has(ONES, token)) return { value: ONES[token], next: index + 1 };
  if (has(TEENS, token)) return { value: TEENS[token], next: index + 1 };
  if (!has(TENS, token)) return null;
  const unit = tokens[index + 1];
  if (has(ONES, unit)) return { value: TENS[token] + ONES[unit], next: index + 2 };
  return { value: TENS[token], next: index + 1 };
}

/** [unit] hundred [below100] | below100; `articled` lets a bare "hundred" mean one hundred ("a hundred"). */
function readBelow1000(tokens: readonly string[], index: number, articled: boolean): Span | null {
  const token = tokens[index];
  const unitHundreds = has(ONES, token) && tokens[index + 1] === "hundred";
  const hundreds: Span | null = unitHundreds
    ? { value: ONES[token] * HUNDRED, next: index + 2 }
    : articled && token === "hundred" ? { value: HUNDRED, next: index + 1 } : null;
  const rest = readBelow100(tokens, hundreds?.next ?? index);
  if (!hundreds) return rest;
  if (!rest) return hundreds;
  return { value: hundreds.value + rest.value, next: rest.next };
}

/** [n] million [n] thousand [n]; a bare scale is only a number after an article ("a thousand"). */
function readCardinal(tokens: readonly string[], start: number, articled: boolean): Span | null {
  let index = start;
  let total = 0;
  let scales = Object.keys(SCALES);
  for (;;) {
    const group = readBelow1000(tokens, index, articled && index === start);
    const at = group?.next ?? index;
    const scale = tokens[at];
    const position = scale === undefined ? -1 : scales.indexOf(scale);
    const bareScaleAllowed = articled && index === start;
    if (position < 0 || (!group && !bareScaleAllowed)) {
      if (group) { total += group.value; index = at; }
      break;
    }
    total += (group?.value ?? 1) * SCALES[scale];
    index = at + 1;
    scales = scales.slice(position + 1);
  }
  return index === start ? null : { value: total, next: index };
}

function readWords(tokens: readonly string[], start: number): NumberReading | null {
  const articled = ARTICLES.has(tokens[start]);
  if (articled && !ARTICLE_FOLLOWERS.has(tokens[start + 1] ?? "")) return { value: 1, length: 1, form: "article" };
  const index = articled ? start + 1 : start;
  const special = readSpecial(tokens, start, index);
  if (special) return special;
  const cardinal = readCardinal(tokens, index, articled);
  if (!cardinal) return null;
  const dozens = tokens[cardinal.next] === "dozen";
  const next = dozens ? cardinal.next + 1 : cardinal.next;
  return { value: dozens ? cardinal.value * DOZEN : cardinal.value, length: next - start, form: "integer" };
}

function readUnsigned(tokens: readonly string[], start: number): NumberReading | null {
  const token = tokens[start];
  if (token === undefined) return null;
  return readDigits(token) ?? readWords(tokens, start);
}

/** "negative two" / "minus one": the sign is only meaningful before a number with a value. */
function readSignedWords(tokens: readonly string[], start: number): NumberReading | null {
  if (!SIGN_WORDS.has(tokens[start])) return null;
  const magnitude = readUnsigned(tokens, start + 1);
  if (!magnitude || magnitude.form === "article") return null;
  if (magnitude.form !== "integer") return { ...magnitude, length: magnitude.length + 1 };
  return { value: -magnitude.value, length: magnitude.length + 1, form: "integer" };
}

/** Two numbers back to back ("one two", "2 two", "two 2") are malformed, never summed. */
function rejectAdjacent(tokens: readonly string[], start: number, reading: NumberReading): NumberReading {
  const next = start + reading.length;
  const following = readSignedWords(tokens, next) ?? readUnsigned(tokens, next);
  if (!following) return reading;
  return { value: Number.NaN, length: reading.length + following.length, form: "malformed" };
}

export function readNumber(tokens: readonly string[], start: number): NumberReading | null {
  const reading = readSignedWords(tokens, start) ?? readUnsigned(tokens, start);
  return reading ? rejectAdjacent(tokens, start, reading) : null;
}
