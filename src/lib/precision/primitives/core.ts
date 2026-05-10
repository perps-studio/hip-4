import DecimalJS from "decimal.js";
import type { DecimalInput } from "./types";

const Decimal = DecimalJS.clone({
  precision: 28,
  rounding: DecimalJS.ROUND_HALF_UP,
});

type Decimal = DecimalJS;

function toDecimal(value: DecimalInput): Decimal {
  if (value instanceof Decimal) return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid numeric input: ${value}`);
    }
    return new Decimal(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      throw new Error("Empty string is not a valid decimal input");
    }
    return new Decimal(trimmed);
  }
  throw new Error(`Unsupported input type: ${typeof value}`);
}

function toNum(value: DecimalInput): number {
  return toDecimal(value).toNumber();
}

function add(a: DecimalInput, b: DecimalInput): string {
  return toDecimal(a).plus(toDecimal(b)).toString();
}

function sub(a: DecimalInput, b: DecimalInput): string {
  return toDecimal(a).minus(toDecimal(b)).toString();
}

function mul(a: DecimalInput, b: DecimalInput): string {
  return toDecimal(a).times(toDecimal(b)).toString();
}

function div(a: DecimalInput, b: DecimalInput, dp?: number): string {
  const divisor = toDecimal(b);
  if (divisor.isZero()) throw new Error("Division by zero");
  const result = toDecimal(a).dividedBy(divisor);
  return dp !== undefined ? result.toFixed(dp) : result.toString();
}

function abs(value: DecimalInput): string {
  return toDecimal(value).abs().toString();
}

function neg(value: DecimalInput): string {
  return toDecimal(value).negated().toString();
}

function pow(base: DecimalInput, exp: DecimalInput): string {
  return toDecimal(base).pow(toDecimal(exp)).toString();
}

function sqrt(value: DecimalInput): string {
  const d = toDecimal(value);
  if (d.isNegative()) throw new RangeError("sqrt of negative number");
  return d.sqrt().toString();
}

export { Decimal, toDecimal, toNum, add, sub, mul, div, abs, neg, pow, sqrt };
