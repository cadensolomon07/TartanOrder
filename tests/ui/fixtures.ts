// Named screen states for the Kiosk. Every one is a plain OrderView.
import type { OrderView } from "@/contracts";
import { EMPTY, THREE_LINES } from "./fakeController";

export const editingThree: OrderView = {
  ...EMPTY,
  revision: 1,
  phase: "editing",
  lines: THREE_LINES,
  lastLineId: "u1:2",
  totalCents: 1350,
};

export const clarifyingBurgers: OrderView = {
  ...EMPTY,
  revision: 3,
  phase: "clarifying",
  lines: [
    { lineId: "u1:0", itemId: "burger", qty: 1, modifiers: ["double"] },
    { lineId: "u1:1", itemId: "fries", qty: 1, modifiers: [] },
    { lineId: "u1:2", itemId: "lemonade", qty: 1, modifiers: [] },
    { lineId: "u2:0", itemId: "burger", qty: 1, modifiers: [] },
  ],
  lastLineId: "u2:0",
  totalCents: 2400,
  pending: {
    id: "p1",
    question: "Which burger should I remove?",
    choices: [
      { id: "c1", label: "The first burger (double)", ops: [{ type: "REMOVE", ref: { by: "line", lineId: "u1:0" } }] },
      { id: "c2", label: "The second burger", ops: [{ type: "REMOVE", ref: { by: "line", lineId: "u2:0" } }] },
    ],
  },
};

export const reviewingThree: OrderView = {
  ...editingThree,
  revision: 2,
  phase: "reviewing",
  review: { id: "s1:2", revision: 2, lines: THREE_LINES, totalCents: 1350 },
};

export const committedThree: OrderView = {
  ...reviewingThree,
  phase: "committed",
  receipt: { id: "r-s1-2", reviewId: "s1:2", lines: THREE_LINES, totalCents: 1350, simulated: true },
};
