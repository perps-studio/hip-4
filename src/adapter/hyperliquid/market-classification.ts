// ---------------------------------------------------------------------------
// HIP-4 Market Classification
//
// Classifies raw HLOutcome objects into typed HIP4Market variants:
//   defaultBinary   - description parses as class:priceBinary (recurring)
//   multiOutcome    - outcome belongs to a question group
//   labelledBinary  - everything else (standalone, any side labels)
//
// Detection priority:
//   1. priceBinary description parse → defaultBinary
//   2. In a question's namedOutcomes or fallbackOutcome → multiOutcome
//   3. Fallthrough → labelledBinary
// ---------------------------------------------------------------------------

import type { HLOutcome, HLQuestion } from "./types";
import type {
  HIP4Market,
  DefaultBinaryMarket,
  LabelledBinaryMarket,
  MultiOutcomeMarket,
  MarketSide,
} from "../../types/hip4-market";
import { parseDescription } from "./market-discovery";

const PREDICTION_ASSET_OFFSET = 100_000_000;

// ---------------------------------------------------------------------------
// Side builder
// ---------------------------------------------------------------------------

function buildSides(outcome: HLOutcome): [MarketSide, MarketSide] {
  return [
    {
      name: outcome.sideSpecs[0]?.name ?? "Side 0",
      coinNum: outcome.outcome * 10,
      coin: `#${outcome.outcome * 10}`,
      asset: PREDICTION_ASSET_OFFSET + outcome.outcome * 10,
    },
    {
      name: outcome.sideSpecs[1]?.name ?? "Side 1",
      coinNum: outcome.outcome * 10 + 1,
      coin: `#${outcome.outcome * 10 + 1}`,
      asset: PREDICTION_ASSET_OFFSET + outcome.outcome * 10 + 1,
    },
  ];
}

// ---------------------------------------------------------------------------
// Question lookup index
// ---------------------------------------------------------------------------

interface QuestionIndex {
  /** outcomeId → { question, isFallback } */
  byOutcome: Map<number, { question: HLQuestion; isFallback: boolean }>;
}

function buildQuestionIndex(questions: HLQuestion[]): QuestionIndex {
  const byOutcome = new Map<number, { question: HLQuestion; isFallback: boolean }>();

  for (const q of questions) {
    for (const id of q.namedOutcomes) {
      byOutcome.set(id, { question: q, isFallback: false });
    }
    byOutcome.set(q.fallbackOutcome, { question: q, isFallback: true });
  }

  return { byOutcome };
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Classify a single HLOutcome into a typed HIP4Market.
 *
 * Detection priority:
 *   1. Description parses as class:priceBinary → defaultBinary
 *   2. Outcome is in a question → multiOutcome
 *   3. Everything else → labelledBinary
 */
export function classifyOutcome(
  outcome: HLOutcome,
  questions: HLQuestion[],
): HIP4Market {
  const sides = buildSides(outcome);
  const index = buildQuestionIndex(questions);

  // 1. Try priceBinary
  const parsed = parseDescription(outcome.description);
  if (parsed) {
    const market: DefaultBinaryMarket = {
      type: "defaultBinary",
      outcomeId: outcome.outcome,
      name: `${parsed.underlying} > $${parsed.targetPrice} (${parsed.period})`,
      description: `Will ${parsed.underlying} be above $${parsed.targetPrice} by expiry?`,
      sides,
      raw: outcome,
      underlying: parsed.underlying,
      targetPrice: parsed.targetPrice,
      expiry: parsed.expiry,
      period: parsed.period,
    };
    return market;
  }

  // 2. Check if in a question
  const questionEntry = index.byOutcome.get(outcome.outcome);
  if (questionEntry) {
    const market: MultiOutcomeMarket = {
      type: "multiOutcome",
      outcomeId: outcome.outcome,
      name: outcome.name,
      description: outcome.description,
      sides,
      raw: outcome,
      questionId: questionEntry.question.question,
      questionName: questionEntry.question.name,
      questionDescription: questionEntry.question.description,
      isFallback: questionEntry.isFallback,
      rawQuestion: questionEntry.question,
    };
    return market;
  }

  // 3. Fallthrough  - labelledBinary
  const market: LabelledBinaryMarket = {
    type: "labelledBinary",
    outcomeId: outcome.outcome,
    name: outcome.name,
    description: outcome.description,
    sides,
    raw: outcome,
  };
  return market;
}

/**
 * Classify all outcomes in one pass.
 * Builds the question index once and reuses it.
 */
export function classifyAllOutcomes(
  outcomes: HLOutcome[],
  questions: HLQuestion[],
): HIP4Market[] {
  const index = buildQuestionIndex(questions);
  return outcomes.map((outcome) => {
    const sides = buildSides(outcome);
    const parsed = parseDescription(outcome.description);

    if (parsed) {
      return {
        type: "defaultBinary",
        outcomeId: outcome.outcome,
        name: `${parsed.underlying} > $${parsed.targetPrice} (${parsed.period})`,
        description: `Will ${parsed.underlying} be above $${parsed.targetPrice} by expiry?`,
        sides,
        raw: outcome,
        underlying: parsed.underlying,
        targetPrice: parsed.targetPrice,
        expiry: parsed.expiry,
        period: parsed.period,
      } satisfies DefaultBinaryMarket;
    }

    const questionEntry = index.byOutcome.get(outcome.outcome);
    if (questionEntry) {
      return {
        type: "multiOutcome",
        outcomeId: outcome.outcome,
        name: outcome.name,
        description: outcome.description,
        sides,
        raw: outcome,
        questionId: questionEntry.question.question,
        questionName: questionEntry.question.name,
        questionDescription: questionEntry.question.description,
        isFallback: questionEntry.isFallback,
        rawQuestion: questionEntry.question,
      } satisfies MultiOutcomeMarket;
    }

    return {
      type: "labelledBinary",
      outcomeId: outcome.outcome,
      name: outcome.name,
      description: outcome.description,
      sides,
      raw: outcome,
    } satisfies LabelledBinaryMarket;
  });
}
