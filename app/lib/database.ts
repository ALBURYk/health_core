import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export type PublicUser = {
  id: string;
  login: string;
  stats: UserStats;
};

export type UserStats = {
  days: number;
  minutes: number;
  lastWorkoutDate: string;
  streakDays: number;
  lastStreakDate: string;
  streakDeadlineAt: number;
};

export type Leader = {
  name: string;
  days: number;
  minutes: number;
  streakDays: number;
};

export type FoodScanInput = {
  goal: string;
  foodName: string;
  confidence: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portion: string;
  advice: string;
  isFood: boolean;
  needsReview: boolean;
};

export type FoodScanRecord = FoodScanInput & {
  id: string;
  userId: string;
  createdAt: string;
};

type UserRecord = {
  id: string;
  login: string;
  loginKey: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
  stats: UserStats;
};

type SessionRecord = {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
};

type FitnessDb = {
  users: UserRecord[];
  sessions: SessionRecord[];
  foodScans: FoodScanRecord[];
};

type SupabaseUserRow = {
  id: string;
  login: string;
  login_key: string;
  password_salt: string;
  password_hash: string;
  created_at: string;
  stats: unknown;
};

type SupabaseSessionRow = {
  token: string;
  user_id: string;
  created_at: number;
  expires_at: number;
};

type SupabaseFoodScanRow = {
  id: string;
  user_id: string;
  created_at: string;
  goal: string | null;
  food_name: string | null;
  confidence: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  portion: string | null;
  advice: string | null;
  is_food: boolean | null;
  needs_review: boolean | null;
};

export const SESSION_COOKIE = "pulsepilot_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const DB_DIR = process.env.VERCEL ? path.join(os.tmpdir(), "ai-fitness-coach-data") : path.join(process.cwd(), ".data");
const DB_PATH = path.join(DB_DIR, "fitness-db.json");
const PASSWORD_ITERATIONS = 120_000;
const PASSWORD_KEY_LENGTH = 64;
const STREAK_WINDOW_MS = 24 * 60 * 60 * 1000;
const FOOD_HISTORY_LIMIT = 50;
const SUPABASE_USERS_TABLE = "fitness_users";
const SUPABASE_SESSIONS_TABLE = "fitness_sessions";
const SUPABASE_FOOD_TABLE = "food_scan_history";

let dbQueue = Promise.resolve();

export function validateCredentials(
  login: unknown,
  password: unknown,
): { ok: false; error: string } | { ok: true; login: string; password: string } {
  const cleanLogin = typeof login === "string" ? login.trim() : "";
  const cleanPassword = typeof password === "string" ? password : "";

  if (!/^[\p{L}\p{N}_-]{3,24}$/u.test(cleanLogin)) {
    return { ok: false, error: "Логин: 3-24 символа, буквы/цифры/_/-" };
  }

  if (cleanPassword.length < 8) {
    return { ok: false, error: "Пароль должен быть не меньше 8 символов" };
  }

  return { ok: true, login: cleanLogin, password: cleanPassword };
}

export async function registerUser(login: string, password: string) {
  if (isSupabaseConfigured()) {
    return registerSupabaseUser(login, password);
  }

  return updateLocalDb((db) => {
    const loginKey = normalizeLogin(login);

    if (db.users.some((user) => user.loginKey === loginKey)) {
      throw new Error("Такой логин уже зарегистрирован");
    }

    const salt = randomBytes(16).toString("hex");
    const user: UserRecord = {
      id: randomUUID(),
      login,
      loginKey,
      passwordSalt: salt,
      passwordHash: hashPassword(password, salt),
      createdAt: new Date().toISOString(),
      stats: createEmptyStats(),
    };

    db.users.push(user);

    return toPublicUser(user);
  });
}

export async function verifyUser(login: string, password: string) {
  if (isSupabaseConfigured()) {
    const user = await getSupabaseUserByLoginKey(normalizeLogin(login));

    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      return null;
    }

    return toPublicUser(user);
  }

  const db = await readLocalDb();
  const user = db.users.find((item) => item.loginKey === normalizeLogin(login));

  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return null;
  }

  return toPublicUser(user);
}

export async function createSession(userId: string) {
  if (isSupabaseConfigured()) {
    return createSupabaseSession(userId);
  }

  return updateLocalDb((db) => {
    const now = Date.now();
    const token = randomBytes(32).toString("hex");

    db.sessions = db.sessions.filter((session) => session.expiresAt > now && session.userId !== userId);
    db.sessions.push({
      token,
      userId,
      createdAt: now,
      expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000,
    });

    return token;
  });
}

export async function deleteSession(token: string | undefined) {
  if (!token) {
    return;
  }

  if (isSupabaseConfigured()) {
    await supabaseRequest(SUPABASE_SESSIONS_TABLE, `?token=${filterEq(token)}`, { method: "DELETE" });
    return;
  }

  await updateLocalDb((db) => {
    db.sessions = db.sessions.filter((session) => session.token !== token);
    return null;
  });
}

export async function getUserBySession(token: string | undefined) {
  if (!token) {
    return null;
  }

  if (isSupabaseConfigured()) {
    return getSupabaseUserBySession(token);
  }

  return updateLocalDb((db) => {
    const now = Date.now();
    const session = db.sessions.find((item) => item.token === token && item.expiresAt > now);

    if (!session) {
      return null;
    }

    const user = db.users.find((item) => item.id === session.userId);

    if (!user) {
      return null;
    }

    expireUserStreak(user, now);

    return toPublicUser(user);
  });
}

export async function recordTraining(userId: string, minutes: number) {
  const safeMinutes = Math.max(1, Math.min(600, Math.round(minutes)));

  if (isSupabaseConfigured()) {
    return recordSupabaseTraining(userId, safeMinutes);
  }

  const today = getTodayKey();
  const now = Date.now();

  return updateLocalDb((db) => {
    const user = db.users.find((item) => item.id === userId);

    if (!user) {
      throw new Error("Пользователь не найден");
    }

    applyTrainingToUser(user, safeMinutes, today, now);

    return toPublicUser(user);
  });
}

export async function getLeaders(): Promise<Leader[]> {
  if (isSupabaseConfigured()) {
    const users = await supabaseRequest<SupabaseUserRow[]>(
      SUPABASE_USERS_TABLE,
      "?select=id,login,login_key,password_salt,password_hash,created_at,stats",
    );
    const now = Date.now();
    const changedUsers: UserRecord[] = [];

    const leaders = users
      .map(mapSupabaseUser)
      .map((user) => {
        const before = user.stats.streakDays;
        expireUserStreak(user, now);

        if (before !== user.stats.streakDays) {
          changedUsers.push(user);
        }

        return user;
      })
      .map((user) => ({
        name: user.login,
        days: user.stats.days,
        minutes: user.stats.minutes,
        streakDays: user.stats.streakDays,
      }))
      .sort((first, second) => second.minutes - first.minutes || second.days - first.days || second.streakDays - first.streakDays)
      .slice(0, 20);

    await Promise.all(changedUsers.map((user) => patchSupabaseUserStats(user.id, user.stats)));

    return leaders;
  }

  return updateLocalDb((db) => {
    const now = Date.now();

    db.users.forEach((user) => expireUserStreak(user, now));

    return db.users
      .map((user) => ({
        name: user.login,
        days: user.stats.days,
        minutes: user.stats.minutes,
        streakDays: user.stats.streakDays,
      }))
      .sort((first, second) => second.minutes - first.minutes || second.days - first.days || second.streakDays - first.streakDays)
      .slice(0, 20);
  });
}

export async function recordFoodScan(userId: string, scan: FoodScanInput) {
  if (isSupabaseConfigured()) {
    const rows = await supabaseRequest<SupabaseFoodScanRow[]>(SUPABASE_FOOD_TABLE, "", {
      method: "POST",
      prefer: "return=representation",
      body: JSON.stringify({
        id: randomUUID(),
        user_id: userId,
        created_at: new Date().toISOString(),
        goal: scan.goal,
        food_name: scan.foodName,
        confidence: scan.confidence,
        calories: scan.calories,
        protein: scan.protein,
        carbs: scan.carbs,
        fat: scan.fat,
        portion: scan.portion,
        advice: scan.advice,
        is_food: scan.isFood,
        needs_review: scan.needsReview,
      }),
    });

    await pruneSupabaseFoodHistory(userId);

    return mapSupabaseFoodScan(rows[0]);
  }

  return updateLocalDb((db) => {
    const record: FoodScanRecord = {
      ...scan,
      id: randomUUID(),
      userId,
      createdAt: new Date().toISOString(),
    };

    db.foodScans = [record, ...db.foodScans].sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));

    const userRecords = db.foodScans.filter((item) => item.userId === userId);
    const oldUserIds = new Set(userRecords.slice(FOOD_HISTORY_LIMIT).map((item) => item.id));
    db.foodScans = db.foodScans.filter((item) => item.userId !== userId || !oldUserIds.has(item.id));

    return record;
  });
}

export async function getFoodScanHistory(userId: string, limit = 20): Promise<FoodScanRecord[]> {
  const safeLimit = Math.max(1, Math.min(FOOD_HISTORY_LIMIT, Math.round(limit)));

  if (isSupabaseConfigured()) {
    const rows = await supabaseRequest<SupabaseFoodScanRow[]>(
      SUPABASE_FOOD_TABLE,
      `?user_id=${filterEq(userId)}&select=*&order=created_at.desc&limit=${safeLimit}`,
    );

    return rows.map(mapSupabaseFoodScan);
  }

  const db = await readLocalDb();

  return db.foodScans
    .filter((item) => item.userId === userId)
    .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt))
    .slice(0, safeLimit);
}

async function registerSupabaseUser(login: string, password: string) {
  const loginKey = normalizeLogin(login);
  const existing = await getSupabaseUserByLoginKey(loginKey);

  if (existing) {
    throw new Error("Такой логин уже зарегистрирован");
  }

  const salt = randomBytes(16).toString("hex");
  const rows = await supabaseRequest<SupabaseUserRow[]>(SUPABASE_USERS_TABLE, "", {
    method: "POST",
    prefer: "return=representation",
    body: JSON.stringify({
      id: randomUUID(),
      login,
      login_key: loginKey,
      password_salt: salt,
      password_hash: hashPassword(password, salt),
      created_at: new Date().toISOString(),
      stats: createEmptyStats(),
    }),
  });

  return toPublicUser(mapSupabaseUser(rows[0]));
}

async function createSupabaseSession(userId: string) {
  const now = Date.now();
  const token = randomBytes(32).toString("hex");

  await supabaseRequest(SUPABASE_SESSIONS_TABLE, `?user_id=${filterEq(userId)}`, { method: "DELETE" });
  await supabaseRequest(SUPABASE_SESSIONS_TABLE, `?expires_at=lte.${now}`, { method: "DELETE" });
  await supabaseRequest(SUPABASE_SESSIONS_TABLE, "", {
    method: "POST",
    body: JSON.stringify({
      token,
      user_id: userId,
      created_at: now,
      expires_at: now + SESSION_MAX_AGE_SECONDS * 1000,
    }),
  });

  return token;
}

async function getSupabaseUserBySession(token: string) {
  const now = Date.now();
  const sessions = await supabaseRequest<SupabaseSessionRow[]>(
    SUPABASE_SESSIONS_TABLE,
    `?token=${filterEq(token)}&expires_at=gt.${now}&select=*`,
  );
  const session = sessions[0];

  if (!session) {
    return null;
  }

  const user = await getSupabaseUserById(session.user_id);

  if (!user) {
    return null;
  }

  const before = user.stats.streakDays;
  expireUserStreak(user, now);

  if (before !== user.stats.streakDays) {
    await patchSupabaseUserStats(user.id, user.stats);
  }

  return toPublicUser(user);
}

async function recordSupabaseTraining(userId: string, minutes: number) {
  const user = await getSupabaseUserById(userId);

  if (!user) {
    throw new Error("Пользователь не найден");
  }

  applyTrainingToUser(user, minutes, getTodayKey(), Date.now());
  await patchSupabaseUserStats(user.id, user.stats);

  return toPublicUser(user);
}

async function getSupabaseUserByLoginKey(loginKey: string) {
  const users = await supabaseRequest<SupabaseUserRow[]>(
    SUPABASE_USERS_TABLE,
    `?login_key=${filterEq(loginKey)}&select=*`,
  );

  return users[0] ? mapSupabaseUser(users[0]) : null;
}

async function getSupabaseUserById(id: string) {
  const users = await supabaseRequest<SupabaseUserRow[]>(SUPABASE_USERS_TABLE, `?id=${filterEq(id)}&select=*`);

  return users[0] ? mapSupabaseUser(users[0]) : null;
}

async function patchSupabaseUserStats(userId: string, stats: UserStats) {
  await supabaseRequest(SUPABASE_USERS_TABLE, `?id=${filterEq(userId)}`, {
    method: "PATCH",
    body: JSON.stringify({ stats }),
  });
}

async function pruneSupabaseFoodHistory(userId: string) {
  const oldRows = await supabaseRequest<Array<{ id: string }>>(
    SUPABASE_FOOD_TABLE,
    `?user_id=${filterEq(userId)}&select=id&order=created_at.desc&offset=${FOOD_HISTORY_LIMIT}`,
  );

  if (oldRows.length === 0) {
    return;
  }

  await supabaseRequest(SUPABASE_FOOD_TABLE, `?id=in.(${oldRows.map((row) => row.id).join(",")})`, { method: "DELETE" });
}

async function updateLocalDb<T>(mutator: (db: FitnessDb) => T | Promise<T>) {
  const run = dbQueue.then(async () => {
    const db = await readLocalDb();
    const result = await mutator(db);

    db.sessions = db.sessions.filter((session) => session.expiresAt > Date.now());
    await writeLocalDb(db);

    return result;
  });

  dbQueue = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
}

async function readLocalDb(): Promise<FitnessDb> {
  await mkdir(DB_DIR, { recursive: true });

  try {
    const raw = await readFile(DB_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<FitnessDb>;

    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      foodScans: Array.isArray(parsed.foodScans) ? parsed.foodScans : [],
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { users: [], sessions: [], foodScans: [] };
    }

    throw error;
  }
}

async function writeLocalDb(db: FitnessDb) {
  await mkdir(DB_DIR, { recursive: true });

  const tempPath = `${DB_PATH}.${process.pid}.tmp`;
  await writeFile(tempPath, JSON.stringify(db, null, 2), "utf8");
  await rename(tempPath, DB_PATH);
}

async function supabaseRequest<T = unknown>(
  table: string,
  query: string,
  options: RequestInit & { prefer?: string } = {},
): Promise<T> {
  const config = getSupabaseConfig();

  if (!config) {
    throw new Error("Supabase не настроен");
  }

  const response = await fetch(`${config.url}/rest/v1/${table}${query}`, {
    ...options,
    cache: "no-store",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = typeof data?.message === "string" ? data.message : "Supabase request failed";
    throw new Error(`${message}. Проверь таблицы из supabase/schema.sql и переменные SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY.`);
  }

  return data as T;
}

function getSupabaseConfig() {
  const rawUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!rawUrl || !key) {
    return null;
  }

  return {
    url: rawUrl.replace(/\/$/, ""),
    key,
  };
}

function isSupabaseConfigured() {
  return Boolean(getSupabaseConfig());
}

function applyTrainingToUser(user: UserRecord, safeMinutes: number, today: string, now: number) {
  const streakExpired = user.stats.streakDeadlineAt > 0 && now - user.stats.streakDeadlineAt >= STREAK_WINDOW_MS;
  const trainedToday = user.stats.lastWorkoutDate === today;
  const streakTrainedToday = user.stats.lastStreakDate === today;

  user.stats.minutes += safeMinutes;

  if (!trainedToday) {
    user.stats.days += 1;
    user.stats.lastWorkoutDate = today;
  }

  if (!streakTrainedToday) {
    user.stats.streakDays = (streakExpired ? 0 : user.stats.streakDays) + 1;
    user.stats.lastStreakDate = today;
  }

  user.stats.streakDeadlineAt = now + STREAK_WINDOW_MS;
}

function createEmptyStats(): UserStats {
  return {
    days: 0,
    minutes: 0,
    lastWorkoutDate: "",
    streakDays: 0,
    lastStreakDate: "",
    streakDeadlineAt: 0,
  };
}

function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    login: user.login,
    stats: user.stats,
  };
}

function mapSupabaseUser(row: SupabaseUserRow): UserRecord {
  return {
    id: row.id,
    login: row.login,
    loginKey: row.login_key,
    passwordSalt: row.password_salt,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    stats: normalizeStats(row.stats),
  };
}

function mapSupabaseFoodScan(row: SupabaseFoodScanRow): FoodScanRecord {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    goal: row.goal || "",
    foodName: row.food_name || "Неизвестно",
    confidence: row.confidence || "средняя",
    calories: toNumber(row.calories),
    protein: toNumber(row.protein),
    carbs: toNumber(row.carbs),
    fat: toNumber(row.fat),
    portion: row.portion || "Порция не определена",
    advice: row.advice || "",
    isFood: row.is_food ?? true,
    needsReview: row.needs_review ?? false,
  };
}

function normalizeStats(stats: unknown): UserStats {
  if (!stats || typeof stats !== "object") {
    return createEmptyStats();
  }

  const maybeStats = stats as Partial<UserStats>;

  return {
    days: toNumber(maybeStats.days),
    minutes: toNumber(maybeStats.minutes),
    lastWorkoutDate: typeof maybeStats.lastWorkoutDate === "string" ? maybeStats.lastWorkoutDate : "",
    streakDays: toNumber(maybeStats.streakDays),
    lastStreakDate: typeof maybeStats.lastStreakDate === "string" ? maybeStats.lastStreakDate : "",
    streakDeadlineAt: toNumber(maybeStats.streakDeadlineAt),
  };
}

function expireUserStreak(user: UserRecord, now: number) {
  if (user.stats.streakDeadlineAt > 0 && now - user.stats.streakDeadlineAt >= STREAK_WINDOW_MS) {
    user.stats.streakDays = 0;
    user.stats.streakDeadlineAt = 0;
  }
}

function normalizeLogin(login: string) {
  return login.trim().toLocaleLowerCase("ru-RU");
}

function hashPassword(password: string, salt: string) {
  return pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, "sha512").toString("hex");
}

function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actualHash = Buffer.from(hashPassword(password, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return actualHash.length === expected.length && timingSafeEqual(actualHash, expected);
}

function getTodayKey() {
  return new Date().toLocaleDateString("en-CA");
}

function filterEq(value: string) {
  return encodeURIComponent(`eq.${value}`);
}

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}
