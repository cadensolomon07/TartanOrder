import { LIMITS, type CoreCode, type ParseResult } from "@/contracts";
import { MENU } from "@/contracts/menu";

export type Rejection = Extract<ParseResult, { kind: "reject" }>;

function listLabels(labels: readonly string[]): string {
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

const MENU_LIST = listLabels(Object.values(MENU).map((item) => item.label));

/** User-facing copy. Every message is a constant: it never echoes the transcript. */
export const MESSAGES = {
  blank: "Tell me what you'd like to order.",
  unsupported: "Sorry, I didn't catch that. Try: a burger, fries and lemonade; make the burger a double; remove the fries; or undo.",
  offMenu: `Sorry, that's not on the menu. We have ${MENU_LIST}.`,
  quantityLimit: `Quantities must be between 1 and ${LIMITS.quantity} per item; quantities are never rounded.`,
  quantityVague: `Please say an exact number from 1 to ${LIMITS.quantity}.`,
  quantityDecimal: `Please use a whole number from 1 to ${LIMITS.quantity}.`,
  quantityMalformed: `I heard more than one number in a row. Please say a single quantity from 1 to ${LIMITS.quantity}.`,
  injection: "I can only take menu orders.",
  stutter: "I heard the same item repeated. Please say the order once, with a number if you want more than one.",
  undoAlone: "Say 'undo' on its own to reverse the last change.",
  tooManyOps: `Please make up to ${LIMITS.operations} changes at a time.`,
  review: "To review or confirm your order, tap the Review button.",
  nothingLeft: "Nothing left to order after that correction. Tell me what you'd like.",
  nothingToScratch: "There's nothing to scratch yet. To reverse your last change, say 'undo'.",
  unfinished: "It sounded like you were about to change something. Please say the full order again.",
  noItem: "To take something off, say 'remove the …'. To skip onions, say 'no onions'.",
  phoneticMany: "I couldn't make out those items. Please repeat the order.",
  invalidSchema: "The parser produced an invalid result. Please try again.",
} as const;

export function deferralMessage(topic: string): string {
  return `No problem — tell me ${topic} whenever you're ready.`;
}

export function reject(code: CoreCode, message: string): Rejection {
  return { kind: "reject", code, message };
}
