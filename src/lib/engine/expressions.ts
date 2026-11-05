/**
 * Безопасные условия и операции над флагами (без eval).
 *
 * Условия:  trust >= 2 && !lied || name == "Аня"
 *   - операнды: идентификатор флага, число, true/false, строка в кавычках
 *   - операторы сравнения: == != > >= < <=
 *   - логика: && (and), || (or), ! (not), скобки
 *   - «голый» флаг проверяется на истинность
 *
 * Операции:  trust += 1 | name = "Аня" | met_gleb | !met_gleb | score -= 2
 */

import type { FlagValue, Flags } from "@/lib/types/database";

type Token =
  | { t: "id"; v: string }
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "op"; v: string }
  | { t: "lp" }
  | { t: "rp" };

const IDENT = /[\p{L}_][\p{L}\p{N}_.]*/uy;
const NUM = /-?\d+(?:\.\d+)?/y;

export class ExpressionError extends Error {}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ t: "lp" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ t: "rp" });
      i++;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (["&&", "||", "==", "!=", ">=", "<="].includes(two)) {
      tokens.push({ t: "op", v: two });
      i += 2;
      continue;
    }
    if (ch === ">" || ch === "<" || ch === "!" || ch === "=") {
      tokens.push({ t: "op", v: ch === "=" ? "==" : ch });
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "«") {
      const close = ch === "«" ? "»" : ch;
      const end = src.indexOf(close, i + 1);
      if (end < 0) throw new ExpressionError(`Незакрытая строка в «${src}»`);
      tokens.push({ t: "str", v: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    NUM.lastIndex = i;
    const num = NUM.exec(src);
    if (num && (tokens.length === 0 || tokens[tokens.length - 1].t === "op" || tokens[tokens.length - 1].t === "lp" || !num[0].startsWith("-"))) {
      tokens.push({ t: "num", v: parseFloat(num[0]) });
      i += num[0].length;
      continue;
    }
    IDENT.lastIndex = i;
    const id = IDENT.exec(src);
    if (id) {
      const word = id[0];
      const lower = word.toLowerCase();
      if (lower === "and") tokens.push({ t: "op", v: "&&" });
      else if (lower === "or") tokens.push({ t: "op", v: "||" });
      else if (lower === "not") tokens.push({ t: "op", v: "!" });
      else if (lower === "true") tokens.push({ t: "bool", v: true });
      else if (lower === "false") tokens.push({ t: "bool", v: false });
      else tokens.push({ t: "id", v: word });
      i += word.length;
      continue;
    }
    throw new ExpressionError(`Неожиданный символ «${ch}» в «${src}»`);
  }
  return tokens;
}

type Node =
  | { k: "lit"; v: FlagValue | null }
  | { k: "flag"; name: string }
  | { k: "not"; e: Node }
  | { k: "bin"; op: string; a: Node; b: Node };

function parse(tokens: Token[], src: string): Node {
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => {
    const t = peek();
    return t && t.t === "op" && t.v === v;
  };

  function parseOr(): Node {
    let left = parseAnd();
    while (isOp("||")) {
      pos++;
      left = { k: "bin", op: "||", a: left, b: parseAnd() };
    }
    return left;
  }
  function parseAnd(): Node {
    let left = parseNot();
    while (isOp("&&")) {
      pos++;
      left = { k: "bin", op: "&&", a: left, b: parseNot() };
    }
    return left;
  }
  function parseNot(): Node {
    if (isOp("!")) {
      pos++;
      return { k: "not", e: parseNot() };
    }
    return parseCmp();
  }
  function parseCmp(): Node {
    const left = parseAtom();
    const t = peek();
    if (t && t.t === "op" && ["==", "!=", ">", ">=", "<", "<="].includes(t.v)) {
      pos++;
      return { k: "bin", op: t.v, a: left, b: parseAtom() };
    }
    return left;
  }
  function parseAtom(): Node {
    const t = tokens[pos++];
    if (!t) throw new ExpressionError(`Неполное условие «${src}»`);
    switch (t.t) {
      case "lp": {
        const e = parseOr();
        if (!tokens[pos] || tokens[pos].t !== "rp") throw new ExpressionError(`Нет закрывающей скобки в «${src}»`);
        pos++;
        return e;
      }
      case "id":
        return { k: "flag", name: t.v };
      case "num":
      case "str":
      case "bool":
        return { k: "lit", v: t.v };
      default:
        throw new ExpressionError(`Ошибка в условии «${src}»`);
    }
  }

  const node = parseOr();
  if (pos < tokens.length) throw new ExpressionError(`Лишние символы в условии «${src}»`);
  return node;
}

function truthy(v: FlagValue | null | undefined): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v !== "" && v !== "false" && v !== "0";
  return v;
}

function toNum(v: FlagValue | null | undefined): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === undefined || v === null || v === "") return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function looseEq(a: FlagValue | null | undefined, b: FlagValue | null | undefined): boolean {
  if (typeof a === "boolean" || typeof b === "boolean") return truthy(a) === truthy(b);
  if (typeof a === "number" || typeof b === "number") return toNum(a) === toNum(b);
  return String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase();
}

function evalNode(n: Node, flags: Flags): FlagValue | null {
  switch (n.k) {
    case "lit":
      return n.v;
    case "flag":
      return flags[n.name] ?? null;
    case "not":
      return !truthy(evalNode(n.e, flags));
    case "bin": {
      if (n.op === "&&") return truthy(evalNode(n.a, flags)) && truthy(evalNode(n.b, flags));
      if (n.op === "||") return truthy(evalNode(n.a, flags)) || truthy(evalNode(n.b, flags));
      const a = evalNode(n.a, flags);
      const b = evalNode(n.b, flags);
      switch (n.op) {
        case "==":
          return looseEq(a, b);
        case "!=":
          return !looseEq(a, b);
        case ">":
          return toNum(a) > toNum(b);
        case ">=":
          return toNum(a) >= toNum(b);
        case "<":
          return toNum(a) < toNum(b);
        case "<=":
          return toNum(a) <= toNum(b);
      }
    }
  }
  return null;
}

const cache = new Map<string, Node>();

export function compileCondition(src: string): Node {
  const key = src.trim();
  let node = cache.get(key);
  if (!node) {
    node = parse(tokenize(key), key);
    cache.set(key, node);
  }
  return node;
}

/** Проверка условия. Пустое условие = true. Ошибочное = false. */
export function evaluateCondition(src: string | null | undefined, flags: Flags): boolean {
  if (!src || !src.trim()) return true;
  try {
    return truthy(evalNode(compileCondition(src), flags));
  } catch {
    return false;
  }
}

/** Валидирует условие и возвращает текст ошибки или null */
export function checkCondition(src: string): string | null {
  try {
    compileCondition(src);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Ошибка в условии";
  }
}

// ---------------------------------------------------------------------------
// Операции над флагами
// ---------------------------------------------------------------------------

const OP_RE = /^(!)?\s*([\p{L}_][\p{L}\p{N}_.]*)\s*(?:(\+=|-=|=)\s*(.+))?$/u;

function parseLiteral(raw: string): FlagValue {
  const v = raw.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")) || (v.startsWith("«") && v.endsWith("»"))) {
    return v.slice(1, -1);
  }
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return parseFloat(v);
  return v;
}

export function checkOp(op: string): string | null {
  const clean = op.trim().replace(/^flag:/i, "");
  return OP_RE.test(clean) ? null : `Не понимаю операцию «${op}»`;
}

/** Применяет одну операцию, возвращает новый объект флагов */
export function applyOp(flags: Flags, op: string): Flags {
  const clean = op.trim().replace(/^flag:/i, "");
  const m = clean.match(OP_RE);
  if (!m) return flags;
  const [, neg, key, operator, rawValue] = m;
  const next = { ...flags };
  if (!operator) {
    next[key] = !neg;
    return next;
  }
  const value = parseLiteral(rawValue);
  if (operator === "=") next[key] = value;
  else if (operator === "+=") next[key] = toNum(next[key]) + toNum(value);
  else if (operator === "-=") next[key] = toNum(next[key]) - toNum(value);
  return next;
}

export function applyOps(flags: Flags, ops: string[] | null | undefined): Flags {
  if (!ops) return flags;
  return ops.reduce(applyOp, flags);
}

/** Применение set_flags выбора: значения-строки вида "+=1" трактуются как операции */
export function applyChoiceFlags(flags: Flags, setFlags: Flags | null | undefined): Flags {
  if (!setFlags) return flags;
  let next = { ...flags };
  for (const [key, value] of Object.entries(setFlags)) {
    if (typeof value === "string" && /^(\+=|-=)/.test(value)) {
      next = applyOp(next, `${key} ${value}`);
    } else {
      next[key] = value;
    }
  }
  return next;
}

/**
 * Подстановка в текст:
 *  {name}            — значение флага
 *  {спал|спала}      — форма по роду игрока (флаг gender = "f" → вторая)
 */
export function interpolate(text: string, flags: Flags): string {
  const fem = flags.gender === "f";
  text = text.replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_w, m: string, f: string) => (fem ? f : m));
  return text.replace(/\{([\p{L}_][\p{L}\p{N}_.]*)\}/gu, (whole, key: string) => {
    const v = flags[key];
    if (v === undefined || v === null || v === "") return whole === "{name}" ? "незнакомец" : "";
    return String(v);
  });
}
