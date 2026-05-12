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
};

export const SESSION_COOKIE = "pulsepilot_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const DB_DIR = process.env.VERCEL ? path.join(os.tmpdir(), "ai-fitness-coach-data") : path.join(process.cwd(), ".data");
const DB_PATH = path.join(DB_DIR, "fitness-db.json");
const PASSWORD_ITERATIONS = 120_000;
const PASSWORD_KEY_LENGTH = 64;
const STREAK_WINDOW_MS = 24 * 60 * 60 * 1000;

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
  return updateDb((db) => {
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
  const db = await readDb();
  const user = db.users.find((item) => item.loginKey === normalizeLogin(login));

  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return null;
  }

  return toPublicUser(user);
}

export async function createSession(userId: string) {
  return updateDb((db) => {
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

  await updateDb((db) => {
    db.sessions = db.sessions.filter((session) => session.token !== token);
    return null;
  });
}

export async function getUserBySession(token: string | undefined) {
  if (!token) {
    return null;
  }

  return updateDb((db) => {
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
  const today = getTodayKey();
  const now = Date.now();

  return updateDb((db) => {
    const user = db.users.find((item) => item.id === userId);

    if (!user) {
      throw new Error("Пользователь не найден");
    }

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

    return toPublicUser(user);
  });
}

export async function getLeaders(): Promise<Leader[]> {
  return updateDb((db) => {
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

async function updateDb<T>(mutator: (db: FitnessDb) => T | Promise<T>) {
  const run = dbQueue.then(async () => {
    const db = await readDb();
    const result = await mutator(db);

    db.sessions = db.sessions.filter((session) => session.expiresAt > Date.now());
    await writeDb(db);

    return result;
  });

  dbQueue = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
}

async function readDb(): Promise<FitnessDb> {
  await mkdir(DB_DIR, { recursive: true });

  try {
    const raw = await readFile(DB_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<FitnessDb>;

    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { users: [], sessions: [] };
    }

    throw error;
  }
}

async function writeDb(db: FitnessDb) {
  await mkdir(DB_DIR, { recursive: true });

  const tempPath = `${DB_PATH}.${process.pid}.tmp`;
  await writeFile(tempPath, JSON.stringify(db, null, 2), "utf8");
  await rename(tempPath, DB_PATH);
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
