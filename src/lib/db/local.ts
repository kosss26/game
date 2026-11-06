/**
 * Локальная демо-база: минимальная совместимая с supabase-js реализация
 * поверх JSON-файла (.data/local-db.json). Включается автоматически,
 * если не заданы переменные Supabase. Только для разработки и демо.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";

type Row = Record<string, any>;
type Tables = Record<string, Row[]>;

interface DbError {
  message: string;
  code?: string;
}

interface Result<T = any> {
  data: T;
  error: DbError | null;
  count?: number | null;
}

const FILE = path.join(process.cwd(), ".data", "local-db.json");

const DEFAULTS: Record<string, () => Row> = {
  users: () => ({ last_name: null, username: null, photo_url: null, language_code: null, is_guest: false, referred_by: null, skip_credits: 0, bot_blocked: false, meta: {}, last_seen_at: now() }),
  admin_users: () => ({}),
  stories: () => ({ slug: null, description: null, cover_style: "noir", status: "draft", sort_order: 0, meta: {} }),
  days: () => ({ unlock_at: null, estimated_minutes: null, status: "draft", meta: {} }),
  scenes: () => ({ speaker: null, text: null, meta: {}, next_scene_id: null, tag: null }),
  choices: () => ({ goto_tag: null, goto_scene_id: null, set_flags: {}, condition: null, sort_index: 0 }),
  snapshots: () => ({ published_at: now() }),
  progresses: () => ({ scene_id: null, flags: {}, history: [], state: {}, snapshot_version: null, completed: false, completed_at: null, notified_at: null }),
  choice_events: () => ({}),
  purchases: () => ({ story_id: null, day_number: null, stars: 0, source: "stars", telegram_charge_id: null }),
};

const UNIQUE: Record<string, string[][]> = {
  users: [["telegram_id"]],
  admin_users: [["user_id"]],
  stories: [["slug"]],
  days: [["story_id", "day_number"]],
  snapshots: [["day_id", "version"]],
  progresses: [["user_id", "story_id", "day_id"]],
  choice_events: [["user_id", "scene_id"]],
  purchases: [["telegram_charge_id"]],
};

/** Каскадное удаление: таблица → [дочерняя таблица, внешний ключ] */
const CASCADE: Record<string, Array<[string, string]>> = {
  users: [["admin_users", "user_id"], ["progresses", "user_id"], ["choice_events", "user_id"], ["purchases", "user_id"]],
  stories: [["days", "story_id"], ["progresses", "story_id"], ["choice_events", "story_id"], ["purchases", "story_id"]],
  days: [["scenes", "day_id"], ["snapshots", "day_id"], ["progresses", "day_id"], ["choice_events", "day_id"]],
  scenes: [["choices", "scene_id"]],
};

const EMBED_FK: Record<string, string> = { users: "user_id", stories: "story_id", days: "day_id", scenes: "scene_id", choices: "choice_id" };

function now() {
  return new Date().toISOString();
}

const g = globalThis as unknown as { __localDb?: Tables; __localDbTimer?: NodeJS.Timeout; __localDbMtime?: number };

function fileMtime(): number {
  try {
    return fs.statSync(FILE).mtimeMs;
  } catch {
    return 0;
  }
}

function load(): Tables {
  // Файл мог изменить другой процесс (npm run seed) — перечитываем
  if (g.__localDb && !g.__localDbTimer && fileMtime() > (g.__localDbMtime || 0)) g.__localDb = undefined;
  if (g.__localDb) return g.__localDb;
  g.__localDbMtime = fileMtime();
  let tables: Tables = {};
  try {
    tables = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    tables = {};
  }
  for (const t of Object.keys(DEFAULTS)) tables[t] ||= [];
  g.__localDb = tables;
  return tables;
}

function persist() {
  if (g.__localDbTimer) clearTimeout(g.__localDbTimer);
  g.__localDbTimer = setTimeout(() => {
    g.__localDbTimer = undefined;
    try {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(g.__localDb));
      g.__localDbMtime = fileMtime();
    } catch (e) {
      console.error("local db persist failed", e);
    }
  }, 50);
}

const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

type Filter = (r: Row) => boolean;

function cmp(a: any, b: any): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  return a < b ? -1 : 1;
}

class Query implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private orders: Array<{ col: string; asc: boolean }> = [];
  private limitN: number | null = null;
  private mode: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Row[] = [];
  private patch: Row = {};
  private returning = false;
  private columns = "*";
  private countMode = false;
  private headOnly = false;
  private singleMode: "none" | "single" | "maybe" = "none";
  private upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } = {};

  constructor(private table: string) {}

  select(columns = "*", opts?: { count?: string; head?: boolean }) {
    if (this.mode === "select") this.columns = columns;
    else this.returning = true;
    if (opts?.count) this.countMode = true;
    if (opts?.head) this.headOnly = true;
    return this;
  }
  insert(rows: Row | Row[]) {
    this.mode = "insert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  upsert(rows: Row | Row[], opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.mode = "upsert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.upsertOpts = opts;
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
  eq(col: string, v: any) {
    this.filters.push(r => r[col] === v || (r[col] != null && v != null && String(r[col]) === String(v)));
    return this;
  }
  neq(col: string, v: any) {
    this.filters.push(r => r[col] !== v);
    return this;
  }
  in(col: string, vs: any[]) {
    this.filters.push(r => vs.includes(r[col]));
    return this;
  }
  ilike(col: string, pattern: string) {
    const re = new RegExp("^" + String(pattern).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$", "is");
    this.filters.push(r => r[col] != null && re.test(String(r[col])));
    return this;
  }
  is(col: string, v: any) {
    this.filters.push(r => (v === null ? r[col] === null || r[col] === undefined : r[col] === v));
    return this;
  }
  gt(col: string, v: any) {
    this.filters.push(r => r[col] != null && r[col] > v);
    return this;
  }
  gte(col: string, v: any) {
    this.filters.push(r => r[col] != null && r[col] >= v);
    return this;
  }
  lt(col: string, v: any) {
    this.filters.push(r => r[col] != null && r[col] < v);
    return this;
  }
  lte(col: string, v: any) {
    this.filters.push(r => r[col] != null && r[col] <= v);
    return this;
  }
  not(col: string, op: string, v: any) {
    if (op === "is" && v === null) this.filters.push(r => r[col] !== null && r[col] !== undefined);
    return this;
  }
  order(col: string, opts: { ascending?: boolean } = {}) {
    this.orders.push({ col, asc: opts.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.limitN = n;
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

  then<A = Result, B = never>(onOk?: ((v: Result) => A | PromiseLike<A>) | null, onErr?: ((e: any) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve()
      .then(() => this.run())
      .then(onOk, onErr);
  }

  private match(rows: Row[]) {
    return rows.filter(r => this.filters.every(f => f(r)));
  }

  private conflict(rows: Row[], row: Row, keys?: string[][]): Row | undefined {
    const sets = keys || UNIQUE[this.table] || [];
    for (const cols of sets) {
      if (cols.some(c => row[c] === null || row[c] === undefined)) continue;
      const hit = rows.find(r => cols.every(c => String(r[c]) === String(row[c])));
      if (hit) return hit;
    }
    if (row.id) return rows.find(r => r.id === row.id);
    return undefined;
  }

  private shape(rows: Row[]): Row[] {
    const db = load();
    const embeds = [...this.columns.matchAll(/(\w+)\(([^)]*)\)/g)];
    return rows.map(r => {
      const out = clone(r);
      for (const [, rel, cols] of embeds) {
        const fk = EMBED_FK[rel];
        const target = fk ? (db[rel] || []).find(x => x.id === r[fk]) : undefined;
        if (!target) {
          out[rel] = null;
          continue;
        }
        const pick = cols.split(",").map(s => s.trim()).filter(Boolean);
        out[rel] = pick.length === 0 || pick.includes("*") ? clone(target) : Object.fromEntries(pick.map(c => [c, target[c]]));
      }
      return out;
    });
  }

  private finish(rows: Row[], count?: number): Result {
    let data: any = this.shape(rows);
    if (this.singleMode !== "none") {
      if (data.length !== 1) {
        if (this.singleMode === "maybe" && data.length === 0) return { data: null, error: null };
        return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" } };
      }
      data = data[0];
    }
    if (this.headOnly) data = null;
    return { data, error: null, count: this.countMode ? count ?? rows.length : null };
  }

  private run(): Result {
    const db = load();
    const rows = db[this.table];
    if (!rows) return { data: null, error: { message: `relation "${this.table}" does not exist` } };

    if (this.mode === "select") {
      let res = this.match(rows);
      const total = res.length;
      if (this.orders.length) {
        res = [...res].sort((a, b) => {
          for (const o of this.orders) {
            const c = cmp(a[o.col], b[o.col]);
            if (c !== 0) return o.asc ? c : -c;
          }
          return 0;
        });
      }
      if (this.limitN !== null) res = res.slice(0, this.limitN);
      return this.finish(res, total);
    }

    if (this.mode === "insert" || this.mode === "upsert") {
      const out: Row[] = [];
      const keys = this.upsertOpts.onConflict ? [this.upsertOpts.onConflict.split(",").map(s => s.trim())] : undefined;
      for (const input of this.payload) {
        const existing = this.conflict(rows, input, this.mode === "upsert" ? keys : undefined);
        if (existing) {
          if (this.mode === "insert") {
            return { data: null, error: { message: `duplicate key value violates unique constraint on ${this.table}`, code: "23505" } };
          }
          if (this.upsertOpts.ignoreDuplicates) continue;
          Object.assign(existing, clone(input), { updated_at: now() });
          out.push(existing);
          continue;
        }
        const row: Row = { id: crypto.randomUUID(), ...DEFAULTS[this.table]?.(), created_at: now(), updated_at: now(), ...clone(input) };
        rows.push(row);
        out.push(row);
      }
      persist();
      return this.returning ? this.finish(out) : { data: null, error: null };
    }

    if (this.mode === "update") {
      const hit = this.match(rows);
      for (const r of hit) {
        for (const cols of UNIQUE[this.table] || []) {
          if (!cols.some(c => c in this.patch)) continue;
          const candidate = { ...r, ...this.patch };
          const dup = rows.find(o => o !== r && cols.every(c => candidate[c] != null && String(o[c]) === String(candidate[c])));
          if (dup) return { data: null, error: { message: "duplicate key", code: "23505" } };
        }
        Object.assign(r, clone(this.patch), { updated_at: now() });
      }
      persist();
      return this.returning ? this.finish(hit) : { data: null, error: null };
    }

    // delete
    const hit = this.match(rows);
    const removeCascade = (table: string, victims: Row[]) => {
      const ids = new Set(victims.map(v => v.id));
      db[table] = db[table].filter(r => !ids.has(r.id));
      for (const [child, fk] of CASCADE[table] || []) {
        removeCascade(child, db[child].filter(r => ids.has(r[fk])));
      }
      if (table === "scenes") {
        for (const c of db.choices) if (ids.has(c.goto_scene_id)) c.goto_scene_id = null;
      }
    };
    removeCascade(this.table, hit);
    persist();
    return this.returning ? this.finish(hit) : { data: null, error: null };
  }
}

function rpc(name: string, args: Record<string, any>): Promise<Result> {
  const db = load();
  if (name === "get_choice_stats") {
    const counts = new Map<string, number>();
    for (const e of db.choice_events) if (e.scene_id === args.p_scene_id) counts.set(e.choice_id, (counts.get(e.choice_id) || 0) + 1);
    return Promise.resolve({ data: [...counts].map(([choice_id, count]) => ({ choice_id, count })), error: null });
  }
  if (name === "consume_skip_credit") {
    const u = db.users.find(x => x.id === args.p_user_id);
    if (u && u.skip_credits > 0) {
      u.skip_credits -= 1;
      persist();
      return Promise.resolve({ data: true, error: null });
    }
    return Promise.resolve({ data: false, error: null });
  }
  if (name === "grant_skip_credit") {
    const u = db.users.find(x => x.id === args.p_user_id);
    if (u) u.skip_credits = (u.skip_credits || 0) + (args.p_amount || 0);
    persist();
    return Promise.resolve({ data: null, error: null });
  }
  return Promise.resolve({ data: null, error: { message: `function ${name} not found` } });
}

export function createLocalClient() {
  return {
    from: (table: string) => new Query(table),
    rpc,
  };
}
