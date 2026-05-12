"use client";

import { useEffect, useMemo, useState } from "react";

type Goal = "lose" | "gain" | "fit";
type Difficulty = "easy" | "medium" | "hard";

type ChatMessage = {
  role: "user" | "model";
  text: string;
};

type ScanResult = {
  foodName: string;
  confidence: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portion: string;
  advice: string;
};

type Meal = {
  name: string;
  kcal: number;
  protein: number;
};

type MealPlan = {
  title: string;
  advice: string;
  meals: Meal[];
};

type WorkoutMove = {
  name: string;
  base: number;
  step: number;
  seconds: number;
  unit: string;
};

type Leader = {
  name: string;
  days: number;
  minutes: number;
  streakDays: number;
};

type UserStats = {
  days: number;
  minutes: number;
  lastWorkoutDate: string;
  streakDays: number;
  lastStreakDate: string;
  streakDeadlineAt: number;
};

type AuthUser = {
  id: string;
  login: string;
  stats: UserStats;
};

const goals: Record<Goal, string> = {
  lose: "Похудеть",
  gain: "Набрать мышцы",
  fit: "Быть в форме",
};

const goalAdvice: Record<Goal, { title: string; foods: string[]; note: string }> = {
  lose: {
    title: "Для похудения выбирай простую еду с белком и объемом",
    foods: ["куриная грудка", "рыба", "творог", "яйца", "овощной салат", "гречка"],
    note: "Главная идея: сытость без лишних калорий. Сладкое лучше после нормального приема пищи, а не вместо него.",
  },
  gain: {
    title: "Для набора мышц нужны белок, углеводы и регулярность",
    foods: ["говядина", "курица с рисом", "омлет", "творог с бананом", "паста с тунцом", "греческий йогурт"],
    note: "После тренировки добавляй белок и углеводы, чтобы было из чего восстанавливаться и расти.",
  },
  fit: {
    title: "Для формы держи баланс и не усложняй тарелку",
    foods: ["индейка", "лосось", "картофель", "овощи", "кефир", "овсянка"],
    note: "Собирай тарелку просто: половина овощи, четверть белок, четверть крупа, картофель или цельнозерновой хлеб.",
  },
};

const mealPlans: Record<Goal, MealPlan[]> = {
  lose: [
    {
      title: "Легкий дефицит",
      advice: "Меньше масла и соусов, больше белка и овощей.",
      meals: [
        { name: "Омлет + овощи + зелень", kcal: 330, protein: 28 },
        { name: "Курица + гречка + салат", kcal: 510, protein: 44 },
        { name: "Творог + ягоды", kcal: 280, protein: 31 },
      ],
    },
    {
      title: "Сытный день",
      advice: "Подходит, если вечером часто тянет на перекусы.",
      meals: [
        { name: "Греческий йогурт + яблоко", kcal: 300, protein: 24 },
        { name: "Рыба + картофель + огурцы", kcal: 520, protein: 39 },
        { name: "Индейка + овощной суп", kcal: 430, protein: 36 },
      ],
    },
    {
      title: "Быстро приготовить",
      advice: "Минимум готовки, но нормальный белок остается.",
      meals: [
        { name: "Яйца + цельнозерновой хлеб", kcal: 360, protein: 25 },
        { name: "Тунец + рис + овощи", kcal: 490, protein: 42 },
        { name: "Кефир + творог + корица", kcal: 310, protein: 34 },
      ],
    },
  ],
  gain: [
    {
      title: "Рост мышц",
      advice: "Добавь углеводы после тренировки и не пропускай белок.",
      meals: [
        { name: "Овсянка + йогурт + банан", kcal: 520, protein: 30 },
        { name: "Курица + рис + овощи", kcal: 680, protein: 52 },
        { name: "Творог + орехи + мед", kcal: 460, protein: 35 },
      ],
    },
    {
      title: "Больше калорий",
      advice: "Если вес стоит, добавь один плотный прием пищи.",
      meals: [
        { name: "Омлет + сыр + тост", kcal: 560, protein: 34 },
        { name: "Говядина + паста + салат", kcal: 760, protein: 50 },
        { name: "Йогурт + мюсли + ягоды", kcal: 430, protein: 26 },
      ],
    },
    {
      title: "После тренировки",
      advice: "Этот вариант лучше ставить в день силовой тренировки.",
      meals: [
        { name: "Рис + тунец + авокадо", kcal: 650, protein: 45 },
        { name: "Индейка + картофель", kcal: 700, protein: 48 },
        { name: "Протеиновый йогурт + банан", kcal: 390, protein: 32 },
      ],
    },
  ],
  fit: [
    {
      title: "Баланс на день",
      advice: "Ровный вариант без жестких ограничений.",
      meals: [
        { name: "Овсянка + ягоды + орехи", kcal: 430, protein: 22 },
        { name: "Лосось + картофель + салат", kcal: 620, protein: 38 },
        { name: "Кефир + творог + фрукт", kcal: 350, protein: 30 },
      ],
    },
    {
      title: "Больше энергии",
      advice: "Хорошо подходит в активный день.",
      meals: [
        { name: "Омлет + овощи + тост", kcal: 450, protein: 29 },
        { name: "Курица + булгур + салат", kcal: 610, protein: 45 },
        { name: "Йогурт + банан + семена", kcal: 370, protein: 23 },
      ],
    },
    {
      title: "Спокойный вечер",
      advice: "Легко для желудка, но не пусто по белку.",
      meals: [
        { name: "Индейка + овощи на сковороде", kcal: 430, protein: 40 },
        { name: "Рыба + салат + хлебец", kcal: 470, protein: 36 },
        { name: "Творог + ягоды", kcal: 300, protein: 31 },
      ],
    },
  ],
};

const difficulties: Record<Difficulty, string> = {
  easy: "Легкая",
  medium: "Средняя",
  hard: "Сложная",
};

const workouts: Record<Difficulty, WorkoutMove[]> = {
  easy: [
    { name: "Отжимания от пола или опоры", base: 8, step: 2, seconds: 40, unit: "раз" },
    { name: "Приседания", base: 12, step: 3, seconds: 45, unit: "раз" },
    { name: "Планка", base: 20, step: 5, seconds: 30, unit: "сек" },
  ],
  medium: [
    { name: "Отжимания", base: 12, step: 3, seconds: 45, unit: "раз" },
    { name: "Выпады", base: 16, step: 4, seconds: 50, unit: "раз" },
    { name: "Скручивания", base: 20, step: 5, seconds: 45, unit: "раз" },
  ],
  hard: [
    { name: "Отжимания с паузой", base: 16, step: 4, seconds: 50, unit: "раз" },
    { name: "Прыжковые приседания", base: 20, step: 5, seconds: 55, unit: "раз" },
    { name: "Планка с касанием плеч", base: 30, step: 8, seconds: 60, unit: "сек" },
  ],
};

const initialMessages: ChatMessage[] = [
  {
    role: "model",
    text: "Привет. Я твой AI Coach: могу собрать питание под цель, подсказать тренировку, разобрать привычки и помочь не сорваться с плана.",
  },
];

export default function CoachApp() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authLogin, setAuthLogin] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [goal, setGoal] = useState<Goal>("lose");
  const [weight, setWeight] = useState(78);
  const [height, setHeight] = useState(176);
  const [minutes, setMinutes] = useState(35);
  const [timerSeconds, setTimerSeconds] = useState(minutes * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [isFinishConfirming, setIsFinishConfirming] = useState(false);
  const [mealIndex, setMealIndex] = useState(0);
  const [isWorkoutOpen, setIsWorkoutOpen] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [workoutRound, setWorkoutRound] = useState(1);
  const [question, setQuestion] = useState("Что мне есть вечером после тренировки?");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [chatError, setChatError] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  const plan = useMemo(() => {
    const base = Math.round(10 * weight + 6.25 * height - 120);
    const calories = goal === "lose" ? base - 350 : goal === "gain" ? base + 300 : base;
    const protein = Math.round(weight * (goal === "gain" ? 2 : 1.7));
    const burned = Math.round(minutes * 7);

    return { calories, protein, burned };
  }, [goal, height, minutes, weight]);

  const currentAdvice = goalAdvice[goal];
  const currentMealPlans = mealPlans[goal];
  const currentMealPlan = currentMealPlans[mealIndex % currentMealPlans.length];
  const workoutMoves = workouts[difficulty];
  const timerProgress = Math.round(((minutes * 60 - timerSeconds) / (minutes * 60)) * 100);
  const activeStats = user?.stats ?? createEmptyUserStats();
  const hasStreakTimer = activeStats.streakDeadlineAt > 0;
  const streakSecondsLeft = activeStats.streakDeadlineAt > 0 ? Math.floor((activeStats.streakDeadlineAt - currentTime) / 1000) : 0;
  const streakDisplay = formatSignedTime(streakSecondsLeft);
  const isStreakInGrace = streakSecondsLeft < 0;
  const leaderboard = leaders;

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (!isTimerRunning) {
      return;
    }

    const timerId = window.setInterval(() => {
      setTimerSeconds((currentSeconds) => {
        if (currentSeconds <= 1) {
          window.clearInterval(timerId);
          setIsTimerRunning(false);
          setIsFinishConfirming(false);
          completeTraining(minutes);

          return 0;
        }

        return currentSeconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isTimerRunning, minutes]);

  async function loadSession() {
    setIsAuthLoading(true);

    try {
      const [meResponse, leadersResponse] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/leaders"),
      ]);
      const meData = await meResponse.json();
      const leadersData = await leadersResponse.json();

      setUser(meData.user ?? null);
      setLeaders(Array.isArray(leadersData.leaders) ? leadersData.leaders : []);
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function submitAuth() {
    setAuthError("");
    setIsAuthSubmitting(true);

    try {
      const response = await fetch(authMode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ login: authLogin, password: authPassword }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Не удалось войти");
      }

      setUser(data.user);
      setAuthPassword("");
      await loadLeaders();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Ошибка авторизации");
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setLeaders([]);
    setIsTimerRunning(false);
    setIsFinishConfirming(false);
    setTimerSeconds(minutes * 60);
  }

  async function loadLeaders() {
    const response = await fetch("/api/leaders");
    const data = await response.json();

    setLeaders(Array.isArray(data.leaders) ? data.leaders : []);
  }

  async function completeTraining(trainingMinutes: number) {
    const response = await fetch("/api/training/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ minutes: trainingMinutes }),
    });
    const data = await response.json();

    if (!response.ok) {
      setAuthError(data.error || "Не удалось записать тренировку");
      return;
    }

    setUser(data.user);
    setLeaders(Array.isArray(data.leaders) ? data.leaders : []);
    setCurrentTime(Date.now());
  }

  function chooseGoal(nextGoal: Goal) {
    setGoal(nextGoal);
    setMealIndex(0);
    setWorkoutRound(1);
  }

  function showPreviousMealPlan() {
    setMealIndex((currentIndex) => (currentIndex === 0 ? currentMealPlans.length - 1 : currentIndex - 1));
  }

  function showNextMealPlan() {
    setMealIndex((currentIndex) => (currentIndex + 1) % currentMealPlans.length);
  }

  function chooseDifficulty(nextDifficulty: Difficulty) {
    setDifficulty(nextDifficulty);
    setWorkoutRound(1);
  }

  function startTrainingTimer() {
    setIsWorkoutOpen(true);
    setTimerSeconds((currentSeconds) => (currentSeconds > 0 ? currentSeconds : minutes * 60));
    setIsTimerRunning(true);
    setIsFinishConfirming(false);
  }

  function pauseTrainingTimer() {
    setIsTimerRunning(false);
  }

  function resetTrainingTimer() {
    setIsTimerRunning(false);
    setIsFinishConfirming(false);
    setTimerSeconds(minutes * 60);
  }

  function finishTraining() {
    if (!isTimerRunning && timerSeconds === minutes * 60) {
      return;
    }

    if (!isFinishConfirming) {
      setIsFinishConfirming(true);
      return;
    }

    const elapsedSeconds = minutes * 60 - timerSeconds;
    const elapsedMinutes = Math.max(1, Math.round(elapsedSeconds / 60));

    setIsTimerRunning(false);
    setIsFinishConfirming(false);
    setTimerSeconds(minutes * 60);
    completeTraining(elapsedMinutes);
  }

  async function askCoach() {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || isAsking) {
      return;
    }

    const nextMessages: ChatMessage[] = [...messages, { role: "user", text: trimmedQuestion }];

    setMessages(nextMessages);
    setQuestion("");
    setChatError("");
    setIsAsking(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages,
          context: {
            goal: goals[goal],
            weight,
            height,
            minutes,
            calories: plan.calories,
            protein: plan.protein,
            burned: plan.burned,
          },
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI Coach не смог ответить");
      }

      setMessages((currentMessages) => [...currentMessages, { role: "model", text: data.answer }]);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Ошибка AI Coach");
    } finally {
      setIsAsking(false);
    }
  }

  async function scanFood(file: File) {
    setScanError("");
    setScanResult(null);
    setIsScanning(true);
    setPhotoUrl(URL.createObjectURL(file));

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("goal", goals[goal]);

      const response = await fetch("/api/scan-food", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Не удалось распознать еду");
      }

      setScanResult(data.result);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Ошибка сканирования");
    } finally {
      setIsScanning(false);
    }
  }

  if (isAuthLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#14211b] p-4 text-[#172018]">
        <div className="rounded-lg border border-[#dfe5d8] bg-white p-6 text-lg font-black shadow-sm">Загрузка...</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#14211b] p-4 text-[#172018]">
        <section className="w-full max-w-md rounded-lg border border-[#dfe5d8] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-lg bg-[#1f3327] font-black text-white">AI</div>
            <div>
              <p className="text-xs font-bold uppercase text-[#e05f3d]">AI Fitness</p>
              <h1 className="text-2xl font-black">Будьте Здоровы</h1>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-lg bg-[#eef2ea] p-1">
            <button
              onClick={() => {
                setAuthMode("login");
                setAuthError("");
              }}
              className={`rounded-md px-3 py-2 text-sm font-black ${
                authMode === "login" ? "bg-[#1f3327] text-white" : "text-[#59665d]"
              }`}
            >
              Войти
            </button>
            <button
              onClick={() => {
                setAuthMode("register");
                setAuthError("");
              }}
              className={`rounded-md px-3 py-2 text-sm font-black ${
                authMode === "register" ? "bg-[#1f3327] text-white" : "text-[#59665d]"
              }`}
            >
              Регистрация
            </button>
          </div>

          <form
            className="mt-5 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitAuth();
            }}
          >
            <label className="block">
              <span className="text-sm font-bold text-[#59665d]">Логин</span>
              <input
                value={authLogin}
                onChange={(event) => setAuthLogin(event.target.value)}
                className="mt-2 w-full rounded-lg border border-[#dfe5d8] px-4 py-3 text-sm font-semibold outline-none focus:border-[#1f3327]"
                placeholder="например Albury"
                autoComplete="username"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-[#59665d]">Пароль</span>
              <input
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                className="mt-2 w-full rounded-lg border border-[#dfe5d8] px-4 py-3 text-sm font-semibold outline-none focus:border-[#1f3327]"
                placeholder="минимум 8 символов"
                type="password"
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
              />
            </label>

            {authError ? <p className="rounded-lg bg-[#fff3e8] p-3 text-sm font-bold text-[#b83232]">{authError}</p> : null}

            <button
              disabled={isAuthSubmitting}
              className="w-full rounded-lg bg-[#e05f3d] px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#e6a08d]"
            >
              {isAuthSubmitting ? "Подождите..." : authMode === "login" ? "Войти" : "Создать аккаунт"}
            </button>

            <p className="text-xs font-bold leading-5 text-[#59665d]">
              Войти можно только в уже зарегистрированный аккаунт. Лидерборд общий для всех пользователей этой базы.
            </p>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#14211b] text-[#172018]">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl gap-5 px-4 py-5 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-lg border border-[#dfe5d8] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-lg bg-[#1f3327] font-black text-white">AI</div>
            <div>
              <p className="text-xs font-bold uppercase text-[#e05f3d]">AI Fitness</p>
              <h1 className="text-2xl font-black">Будьте Здоровы</h1>
            </div>
          </div>

          <div className="mt-5 rounded-lg bg-[#f2f5ee] p-3">
            <p className="text-xs font-bold text-[#59665d]">Аккаунт</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-lg font-black">{user.login}</p>
              <button onClick={logout} className="rounded-md bg-white px-2 py-1 text-xs font-black text-[#b83232]">
                Выйти
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <Field label="Вес" value={weight} setValue={setWeight} suffix="кг" min={45} max={150} />
            <Field label="Рост" value={height} setValue={setHeight} suffix="см" min={145} max={210} />

            <label className="block">
              <span className="text-sm font-bold text-[#59665d]">Тренировка: {minutes} мин</span>
              <input
                type="range"
                min="15"
                max="60"
                step="5"
                value={minutes}
                onChange={(event) => {
                  const nextMinutes = Number(event.target.value);

                  setMinutes(nextMinutes);

                  if (!isTimerRunning) {
                    setTimerSeconds(nextMinutes * 60);
                  }
                }}
                className="mt-2 w-full accent-[#e05f3d]"
              />
            </label>

            <div className="rounded-lg bg-[#f2f5ee] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#59665d]">Счетчик</p>
                  <p className="mt-1 text-3xl font-black text-[#1f3327]">{formatTime(timerSeconds)}</p>
                </div>
                <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-[#e05f3d]">{timerProgress}%</span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-[#e05f3d] transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, timerProgress))}%` }}
                />
              </div>

              <div className={`mt-3 rounded-lg p-3 ${isStreakInGrace ? "bg-[#fff3e8]" : "bg-white"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-[#59665d]">Стрик: {activeStats.streakDays} дн.</p>
                  <span className={`text-xs font-black ${isStreakInGrace ? "text-[#b83232]" : "text-[#2c8a72]"}`}>
                    {!hasStreakTimer ? "нет таймера" : isStreakInGrace ? "просрочено" : "активно"}
                  </span>
                </div>
                <p className="mt-1 text-xl font-black text-[#1f3327]">
                  {hasStreakTimer ? `${streakDisplay.sign}${streakDisplay.time}` : "24:00:00"}
                </p>
                <p className="mt-1 text-xs font-bold leading-5 text-[#59665d]">
                  После нуля время пойдет в минус. На -24:00:00 стрик сбросится, но дни и минуты останутся.
                </p>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  onClick={isTimerRunning ? pauseTrainingTimer : startTrainingTimer}
                  className="rounded-lg bg-[#1f3327] px-3 py-2 text-sm font-black text-white"
                >
                  {isTimerRunning ? "Пауза" : "Старт"}
                </button>
                <button
                  onClick={resetTrainingTimer}
                  className="rounded-lg bg-white px-3 py-2 text-sm font-black text-[#59665d]"
                >
                  Сброс
                </button>
                <button
                  onClick={finishTraining}
                  className={`rounded-lg px-3 py-2 text-sm font-black text-white ${
                    isFinishConfirming ? "bg-[#b83232]" : "bg-[#e05f3d]"
                  }`}
                >
                  {isFinishConfirming ? "Уверены?" : "Закончил"}
                </button>
              </div>

              <p className="mt-3 text-xs font-bold leading-5 text-[#59665d]">
                Поставь минуты, нажми старт, потом нажми кнопку завершения два раза для записи результата.
              </p>
            </div>

            <div className="rounded-lg border border-[#dfe5d8] bg-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">Лидеры</h2>
                <span className="text-xs font-black text-[#59665d]">дни / мин / стрик</span>
              </div>

              <div className="mt-3 space-y-2">
                {leaderboard.length === 0 ? (
                  <p className="rounded-lg bg-[#f2f5ee] p-3 text-sm font-bold text-[#59665d]">
                    Пока нет записанных тренировок.
                  </p>
                ) : null}

                {leaderboard.map((leader, index) => (
                  <div key={leader.name} className="grid grid-cols-[28px_1fr_auto] items-center gap-2 rounded-lg bg-[#f2f5ee] p-2">
                    <span className="grid size-7 place-items-center rounded-md bg-white text-xs font-black text-[#e05f3d]">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{leader.name}</p>
                      <p className="text-xs font-bold text-[#59665d]">{leader.days} дн. · стрик {leader.streakDays}</p>
                    </div>
                    <p className="text-sm font-black text-[#1f3327]">{leader.minutes} мин</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <section className="space-y-5">
          <div className="rounded-lg border border-[#dfe5d8] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold text-[#59665d]">Твой персональный план</p>
                <h2 className="mt-1 text-3xl font-black">Тренировки, питание и AI-советы</h2>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-lg bg-[#eef2ea] p-1">
                {(Object.keys(goals) as Goal[]).map((item) => (
                  <button
                    key={item}
                    onClick={() => chooseGoal(item)}
                    className={`rounded-md px-3 py-2 text-sm font-bold ${
                      goal === item ? "bg-[#1f3327] text-white" : "text-[#59665d]"
                    }`}
                  >
                    {goals[item]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <Card label="Калории" value={`${plan.calories} ккал`} />
            <Card label="Белок" value={`${plan.protein} г`} />
            <Card label="Тренировка" value={`${plan.burned} ккал`} />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-lg border border-[#dfe5d8] bg-white p-5 shadow-sm">
              <p className="text-sm font-bold text-[#59665d]">Совет под цель</p>
              <h3 className="mt-1 text-2xl font-black">{currentAdvice.title}</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {currentAdvice.foods.map((food) => (
                  <span key={food} className="rounded-md bg-[#f2f5ee] px-3 py-2 text-sm font-bold text-[#1f3327]">
                    {food}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-sm font-semibold leading-6 text-[#59665d]">{currentAdvice.note}</p>
            </div>

            <div className="rounded-lg border border-[#dfe5d8] bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-[#59665d]">Домашняя тренировка</p>
                  <h3 className="mt-1 text-2xl font-black">Быстрый старт</h3>
                </div>
                <button
                  onClick={() => setIsWorkoutOpen((isOpen) => !isOpen)}
                  className="rounded-lg bg-[#e05f3d] px-4 py-3 text-sm font-black text-white transition hover:bg-[#c84f32]"
                >
                  {isWorkoutOpen ? "Скрыть" : "Начать заниматься"}
                </button>
              </div>

              {isWorkoutOpen ? (
                <div className="mt-4 rounded-lg bg-[#f2f5ee] p-4">
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(difficulties) as Difficulty[]).map((item) => (
                      <button
                        key={item}
                        onClick={() => chooseDifficulty(item)}
                        className={`rounded-md px-2 py-2 text-sm font-black ${
                          difficulty === item ? "bg-[#1f3327] text-white" : "bg-white text-[#59665d]"
                        }`}
                      >
                        {difficulties[item]}
                      </button>
                    ))}
                  </div>

                  <p className="mt-4 text-sm font-bold text-[#59665d]">Круг {workoutRound}. Отдыхай 30-60 секунд между упражнениями.</p>
                  <div className="mt-3 space-y-2">
                    {workoutMoves.map((move) => {
                      const amount = move.base + move.step * (workoutRound - 1);
                      const seconds = move.seconds + 5 * (workoutRound - 1);

                      return (
                        <div key={move.name} className="rounded-lg bg-white p-3">
                          <p className="font-black">{move.name}</p>
                          <p className="mt-1 text-sm font-semibold text-[#59665d]">
                            Сделайте {amount} {move.unit} за {seconds} секунд.
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setWorkoutRound((round) => round + 1)}
                      className="rounded-lg bg-[#1f3327] px-3 py-3 text-sm font-black text-white"
                    >
                      Следующий круг
                    </button>
                    <button
                      onClick={() => setWorkoutRound(1)}
                      className="rounded-lg bg-white px-3 py-3 text-sm font-black text-[#59665d]"
                    >
                      Сбросить
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm font-semibold leading-6 text-[#59665d]">
                  Нажми старт, выбери сложность и приложение покажет упражнения с повторениями и временем.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[#dfe5d8] bg-[#1f3327] p-5 text-white shadow-sm">
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="text-sm font-bold text-[#b8cdbf]">Food scanner</p>
                <h3 className="mt-1 text-2xl font-black">Покажи еду AI</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#dbe8df]">
                  Сделай фото блюда на телефоне или загрузи картинку. AI-Тренер оценит порцию, калории и КБЖУ.
                </p>

                <label className="mt-4 flex min-h-14 cursor-pointer items-center justify-center rounded-lg bg-[#f2c94c] px-4 py-3 text-center text-sm font-black text-[#172018] transition hover:bg-[#ffd95f]">
                  Показать еду
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) scanFood(file);
                    }}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-white/10">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrl} alt="Фото еды" className="h-full w-full object-cover" />
                  ) : (
                    <span className="px-4 text-center text-sm font-bold text-[#c8d9ce]">Фото появится здесь</span>
                  )}
                </div>

                <div className="rounded-lg bg-white p-4 text-[#172018]">
                  {isScanning ? (
                    <p className="text-sm font-bold text-[#59665d]">AI анализирует фото...</p>
                  ) : scanError ? (
                    <p className="text-sm font-bold text-[#b83232]">{scanError}</p>
                  ) : scanResult ? (
                    <div>
                      <p className="text-xs font-bold uppercase text-[#59665d]">{scanResult.confidence}</p>
                      <h4 className="mt-1 text-xl font-black">{scanResult.foodName}</h4>
                      <p className="mt-1 text-sm font-bold text-[#59665d]">{scanResult.portion}</p>

                      <div className="mt-4 grid grid-cols-4 gap-2">
                        <MiniStat label="Ккал" value={scanResult.calories} />
                        <MiniStat label="Б" value={scanResult.protein} />
                        <MiniStat label="У" value={scanResult.carbs} />
                        <MiniStat label="Ж" value={scanResult.fat} />
                      </div>

                      <p className="mt-4 rounded-lg bg-[#f2f5ee] p-3 text-sm font-semibold leading-6">
                        {scanResult.advice}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm font-bold text-[#59665d]">
                      Здесь будет результат: блюдо, примерная порция, калории, белки, жиры и углеводы.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-lg border border-[#dfe5d8] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-[#e7f4ee] px-2 py-1 text-sm font-black text-[#2c8a72]">Food</span>
                  <div>
                    <h3 className="text-xl font-black">Меню на день</h3>
                    <p className="mt-1 text-sm font-bold text-[#59665d]">{currentMealPlan.title}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={showPreviousMealPlan}
                    className="grid size-10 place-items-center rounded-lg bg-[#f2f5ee] text-xl font-black text-[#1f3327]"
                    aria-label="Предыдущее меню"
                    title="Предыдущее меню"
                  >
                    ‹
                  </button>
                  <button
                    onClick={showNextMealPlan}
                    className="grid size-10 place-items-center rounded-lg bg-[#f2f5ee] text-xl font-black text-[#1f3327]"
                    aria-label="Следующее меню"
                    title="Следующее меню"
                  >
                    ›
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {currentMealPlan.meals.map((meal) => (
                  <div key={meal.name} className="rounded-lg bg-[#f2f5ee] p-4">
                    <p className="font-bold">{meal.name}</p>
                    <p className="mt-1 text-sm font-semibold text-[#59665d]">
                      {meal.kcal} ккал · {meal.protein} г белка
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-4 rounded-lg bg-[#e7f4ee] p-3 text-sm font-bold leading-6 text-[#2c8a72]">
                {currentMealPlan.advice}
              </p>
            </div>

            <div className="rounded-lg border border-[#dfe5d8] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <span className="rounded-md bg-[#eef0ff] px-2 py-1 text-sm font-black text-[#5661d8]">AI</span>
                <h3 className="text-xl font-black">AI Тренер</h3>
              </div>

              <div className="flex max-h-80 min-h-48 flex-col gap-3 overflow-y-auto rounded-lg bg-[#eef0ff] p-4 text-sm font-semibold leading-6 text-[#23275d]">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`max-w-[92%] rounded-lg px-3 py-2 ${
                      message.role === "user"
                        ? "ml-auto bg-[#5661d8] text-white"
                        : "bg-white text-[#23275d]"
                    }`}
                  >
                    {message.text}
                  </div>
                ))}

                {isAsking ? (
                  <div className="max-w-[92%] rounded-lg bg-white px-3 py-2 text-[#59665d]">AI думает...</div>
                ) : null}
              </div>

              {chatError ? <p className="mt-2 text-sm font-bold text-[#b83232]">{chatError}</p> : null}

              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  askCoach();
                }}
              >
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-[#dfe5d8] px-4 py-3 text-sm font-semibold outline-none focus:border-[#5661d8]"
                  placeholder="Спроси AI Coach"
                />
                <button
                  type="submit"
                  disabled={isAsking}
                  className="grid size-12 shrink-0 place-items-center rounded-lg bg-[#5661d8] text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#99a0e6]"
                  aria-label="Спросить"
                  title="Спросить"
                >
                  AI
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  setValue,
  suffix,
  min,
  max,
}: {
  label: string;
  value: number;
  setValue: (value: number) => void;
  suffix: string;
  min: number;
  max: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-[#59665d]">{label}</span>
      <div className="mt-2 flex items-center gap-2 rounded-lg bg-[#f2f5ee] px-3 py-2">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => setValue(Number(event.target.value))}
          className="min-w-0 flex-1 bg-transparent text-xl font-black outline-none"
        />
        <span className="text-sm font-bold text-[#59665d]">{suffix}</span>
      </div>
    </label>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#dfe5d8] bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-[#59665d]">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-[#f2f5ee] p-2 text-center">
      <p className="text-xs font-bold text-[#59665d]">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

function formatTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatSignedTime(totalSeconds: number) {
  const sign = totalSeconds < 0 ? "-" : "";
  const safeSeconds = Math.abs(totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return {
    sign,
    time: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
  };
}

function createEmptyUserStats(): UserStats {
  return {
    days: 0,
    minutes: 0,
    lastWorkoutDate: "",
    streakDays: 0,
    lastStreakDate: "",
    streakDeadlineAt: 0,
  };
}
