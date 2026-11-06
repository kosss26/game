/**
 * Адаптер для собственного PostgreSQL (DATABASE_URL).
 * Реализует то подмножество API supabase-js, которое использует приложение:
 * from().select/insert/upsert/update/delete + eq/neq/in/is/gt/gte/lt/lte/not
 * + order/limit/single/maybeSingle, а также rpc().
 * Все значения передаются параметрами ($1, $2…) — без конкатенации SQL.
 */
import { Pool, types, type PoolConfig } from "pg";

// Регистрация парсеров типов — один раз на процесс (модуль может грузиться повторно)
const typesFlag = globalThis as unknown as { __pgTypesSet?: boolean };
if (!typesFlag.__pgTypesSet) {
  typesFlag.__pgTypesSet = true;
  // BIGINT → number (telegram_id и COUNT укладываются в 2^53)
  types.setTypeParser(20, v => (v === null ? null : Number(v)));
  // NUMERIC → number
  types.setTypeParser(1700, v => (v === null ? null : Number(v)));
  // TIMESTAMPTZ / TIMESTAMP → ISO-строка, как в Supabase
  const toIso = (parse: (v: string) => unknown) => (v: string) => {
    if (v === null) return null;
    const d = parse(v);
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : d;
  };
  types.setTypeParser(1184, toIso(types.getTypeParser(1184)));
  types.setTypeParser(1114, toIso(types.getTypeParser(1114)));
}

type Row = Record<string, any>;
interface DbError {
  message: string;
  code?: string;
}
interface Result {
  data: any;
  error: DbError | null;
  count?: number | null;
}

const IDENT = /^[a-z_][a-z0-9_]*$/;
function ident(name: string): string {
  const n = name.trim();
  if (!IDENT.test(n)) throw new Error(`Недопустимый идентификатор: ${name}`);
  return `"${n}"`;
}

/** jsonb-значения (объекты/массивы) сериализуем сами: в схеме нет PG-массивов */
function toParam(v: unknown): unknown {
  if (v === undefined) return null;
  if (v !== null && typeof v === "object" && !(v instanceof Date)) return JSON.stringify(v);
  return v;
}

const g = globalThis as unknown as { __pgPool?: Pool };

export function getPool(): Pool {
  if (!g.__pgPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL не задан");
    const cfg: PoolConfig = {
      connectionString: url,
      max: parseInt(process.env.DATABASE_POOL_SIZE || "10", 10),
      idleTimeoutMillis: 30_000,
    };
    if (process.env.DATABASE_SSL === "true") cfg.ssl = { rejectUnauthorized: process.env.DATABASE_SSL_STRICT !== "false" };
    g.__pgPool = new Pool(cfg);
    g.__pgPool.on("error", e => console.error("pg pool error", e));
  }
  return g.__pgPool;
}

function toError(e: unknown): DbError {
  const err = e as { message?: string; code?: string };
  return { message: err?.message || String(e), code: err?.code };
}

type Mode = "select" | "insert" | "upsert" | "update" | "delete";

class Query implements PromiseLike<Result> {
  private where: string[] = [];
  private params: unknown[] = [];
  private orders: string[] = [];
  private limitN: number | null = null;
  private mode: Mode = "select";
  private columns = "*";
  private returning = false;
  private countMode = false;
  private headOnly = false;
  private singleMode: "none" | "single" | "maybe" = "none";
  private rows: Row[] = [];
  private patch: Row = {};
  private onConflict: string | undefined;
  private ignoreDuplicates = false;

  constructor(private table: string) {
    ident(table);
  }

  private p(v: unknown): string {
    this.params.push(toParam(v));
    return `$${this.params.length}`;
  }

  select(columns = "*", opts?: { count?: string; head?: boolean }) {
    if (this.mode === "select") this.columns = columns;
    else this.returning = true;
    if (opts?.count) this.countMode = true;
    if (opts?.head) this.headOnly = true;
    return this;
  }
  insert(rows: Row | Row[]) {
    this.mode = "insert";
    this.rows = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  upsert(rows: Row | Row[], opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.mode = "upsert";
    this.rows = Array.isArray(rows) ? rows : [rows];
    this.onConflict = opts.onConflict;
    this.ignoreDuplicates = !!opts.ignoreDuplicates;
    return this;
  }
  update(patch: Row) {
    this.mode = "update";
    this.patch = patch;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }
  eq(col: string, v: unknown) {
    this.where.push(v === null ? `${ident(col)} IS NULL` : `${ident(col)} = ${this.p(v)}`);
    return this;
  }
  neq(col: string, v: unknown) {
    this.where.push(v === null ? `${ident(col)} IS NOT NULL` : `${ident(col)} IS DISTINCT FROM ${this.p(v)}`);
    return this;
  }
  in(col: string, vs: unknown[]) {
    if (vs.length === 0) this.where.push("FALSE");
    else this.where.push(`${ident(col)} IN (${vs.map(v => this.p(v)).join(", ")})`);
    return this;
  }
  /** Поиск без учёта регистра: шаблон в формате SQL LIKE (%, _) */
  ilike(col: string, pattern: string) {
    this.where.push(`${ident(col)}::text ILIKE ${this.p(pattern)}`);
    return this;
  }
  is(col: string, v: null | boolean) {
    this.where.push(`${ident(col)} IS ${v === null ? "NULL" : v ? "TRUE" : "FALSE"}`);
    return this;
  }
  gt(col: string, v: unknown) {
    this.where.push(`${ident(col)} > ${this.p(v)}`);
    return this;
  }
  gte(col: string, v: unknown) {
    this.where.push(`${ident(col)} >= ${this.p(v)}`);
    return this;
  }
  lt(col: string, v: unknown) {
    this.where.push(`${ident(col)} < ${this.p(v)}`);
    return this;
  }
  lte(col: string, v: unknown) {
    this.where.push(`${ident(col)} <= ${this.p(v)}`);
    return this;
  }
  not(col: string, op: string, v: unknown) {
    if (op === "is" && v === null) this.where.push(`${ident(col)} IS NOT NULL`);
    else throw new Error(`not(${op}) не поддерживается`);
    return this;
  }
  order(col: string, opts: { ascending?: boolean } = {}) {
    this.orders.push(`${ident(col)} ${opts.ascending === false ? "DESC" : "ASC"}`);
    return this;
  }
  limit(n: number) {
    this.limitN = Math.max(0, Math.floor(n));
    return this;
  }
  single() {
    this.singleMode = "single";
    return this;
  }
  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }

  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, fail?: ((e: any) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return this.run().then(ok, fail);
  }

  private whereSql(): string {
    return this.where.length ? ` WHERE ${this.where.join(" AND ")}` : "";
  }

  private selectList(): string {
    const c = this.columns.trim();
    if (c === "*" || c === "") return "*";
    return c.split(",").map(ident).join(", ");
  }

  private finish(rows: Row[], count: number | null = null): Result {
    let data: any = rows;
    if (this.singleMode !== "none") {
      if (rows.length !== 1) {
        if (this.singleMode === "maybe" && rows.length === 0) return { data: null, error: null, count };
        return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" }, count };
      }
      data = rows[0];
    }
    if (this.headOnly) data = null;
    return { data, error: null, count };
  }

  private buildSql(): string {
    const t = ident(this.table);
    switch (this.mode) {
      case "select": {
        if (this.headOnly && this.countMode) return `SELECT COUNT(*)::bigint AS count FROM ${t}${this.whereSql()}`;
        let sql = `SELECT ${this.selectList()}`;
        if (this.countMode) sql += `, COUNT(*) OVER()::bigint AS __total`;
        sql += ` FROM ${t}${this.whereSql()}`;
        if (this.orders.length) sql += ` ORDER BY ${this.orders.join(", ")}`;
        // single() без limit: берём 2 строки, чтобы распознать «несколько»
        const lim = this.limitN ?? (this.singleMode !== "none" ? 2 : null);
        if (lim !== null) sql += ` LIMIT ${lim}`;
        return sql;
      }
      case "insert":
      case "upsert": {
        const cols = [...new Set(this.rows.flatMap(r => Object.keys(r)))];
        if (cols.length === 0) throw new Error("Пустая вставка");
        const values = this.rows
          .map(r => `(${cols.map(c => (c in r ? this.p(r[c]) : "DEFAULT")).join(", ")})`)
          .join(", ");
        let sql = `INSERT INTO ${t} (${cols.map(ident).join(", ")}) VALUES ${values}`;
        if (this.mode === "upsert") {
          const target = (this.onConflict || "id").split(",").map(ident).join(", ");
          const targetSet = new Set((this.onConflict || "id").split(",").map(s => s.trim()));
          const updatable = cols.filter(c => !targetSet.has(c));
          sql += this.ignoreDuplicates || updatable.length === 0
            ? ` ON CONFLICT (${target}) DO NOTHING`
            : ` ON CONFLICT (${target}) DO UPDATE SET ${updatable.map(c => `${ident(c)} = EXCLUDED.${ident(c)}`).join(", ")}`;
        }
        if (this.returning) sql += " RETURNING *";
        return sql;
      }
      case "update": {
        const keys = Object.keys(this.patch).filter(k => this.patch[k] !== undefined);
        if (keys.length === 0) throw new Error("Пустое обновление");
        const set = keys.map(k => `${ident(k)} = ${this.p(this.patch[k])}`).join(", ");
        return `UPDATE ${t} SET ${set}${this.whereSql()}${this.returning ? " RETURNING *" : ""}`;
      }
      case "delete":
        return `DELETE FROM ${t}${this.whereSql()}${this.returning ? " RETURNING *" : ""}`;
    }
  }

  private async run(): Promise<Result> {
    let sql: string;
    try {
      sql = this.buildSql();
    } catch (e) {
      return { data: null, error: toError(e) };
    }
    try {
      const res = await getPool().query(sql, this.params);
      if (this.mode === "select") {
        if (this.headOnly && this.countMode) return { data: null, error: null, count: Number(res.rows[0]?.count || 0) };
        let count: number | null = null;
        let rows = res.rows as Row[];
        if (this.countMode) {
          count = rows.length ? Number(rows[0].__total) : 0;
          rows = rows.map(({ __total: _t, ...r }) => r);
        }
        return this.finish(rows, count);
      }
      return this.returning ? this.finish(res.rows as Row[]) : { data: null, error: null };
    } catch (e) {
      return { data: null, error: toError(e) };
    }
  }
}

/** Функции, возвращающие таблицу (остальные — скаляр) */
const SET_RETURNING = new Set(["get_choice_stats"]);

async function rpc(name: string, args: Record<string, unknown> = {}): Promise<Result> {
  try {
    ident(name);
    const keys = Object.keys(args);
    const params = keys.map(k => toParam(args[k]));
    const call = `${ident(name)}(${keys.map((k, i) => `${ident(k)} => $${i + 1}`).join(", ")})`;
    if (SET_RETURNING.has(name)) {
      const res = await getPool().query(`SELECT * FROM ${call}`, params);
      return { data: res.rows, error: null };
    }
    const res = await getPool().query(`SELECT ${call} AS result`, params);
    return { data: res.rows[0]?.result ?? null, error: null };
  } catch (e) {
    return { data: null, error: toError(e) };
  }
}

export function createPostgresClient() {
  return { from: (table: string) => new Query(table), rpc };
}
