"use client";

import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";

type Goal = "lose" | "gain" | "fit";
type Difficulty = "easy" | "medium" | "hard";
type NavItemId = "home" | "food" | "history" | "chat";
type AppTheme = "green" | "blue" | "violet" | "graphite" | "light";
type AppLanguage = "ru" | "en" | "kk";

type ChatMessage = {
  role: "user" | "model";
  text: string;
};

type ScanResult = {
  isFood: boolean;
  needsReview: boolean;
  foodName: string;
  confidence: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  vitamins?: string[];
  portion: string;
  advice: string;
};

type FoodHistoryItem = ScanResult & {
  id: string;
  userId: string;
  createdAt: string;
  goal: string;
};

type Meal = {
  slot: string;
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
        { slot: "Завтрак", name: "Омлет + овощи + зелень", kcal: 330, protein: 28 },
        { slot: "Перекус", name: "Греческий йогурт + ягоды", kcal: 180, protein: 17 },
        { slot: "Обед", name: "Курица + гречка + салат", kcal: 510, protein: 44 },
        { slot: "Перекус", name: "Яблоко + творог", kcal: 210, protein: 18 },
        { slot: "Ужин", name: "Творог + ягоды", kcal: 280, protein: 31 },
      ],
    },
    {
      title: "Сытный день",
      advice: "Подходит, если вечером часто тянет на перекусы.",
      meals: [
        { slot: "Завтрак", name: "Греческий йогурт + яблоко", kcal: 300, protein: 24 },
        { slot: "Перекус", name: "Морковь + хумус", kcal: 170, protein: 7 },
        { slot: "Обед", name: "Рыба + картофель + огурцы", kcal: 520, protein: 39 },
        { slot: "Перекус", name: "Кефир + хлебец", kcal: 190, protein: 11 },
        { slot: "Ужин", name: "Индейка + овощной суп", kcal: 430, protein: 36 },
      ],
    },
    {
      title: "Быстро приготовить",
      advice: "Минимум готовки, но нормальный белок остается.",
      meals: [
        { slot: "Завтрак", name: "Яйца + цельнозерновой хлеб", kcal: 360, protein: 25 },
        { slot: "Перекус", name: "Протеиновый йогурт", kcal: 160, protein: 20 },
        { slot: "Обед", name: "Тунец + рис + овощи", kcal: 490, protein: 42 },
        { slot: "Перекус", name: "Груша + сыр", kcal: 220, protein: 12 },
        { slot: "Ужин", name: "Кефир + творог + корица", kcal: 310, protein: 34 },
      ],
    },
  ],
  gain: [
    {
      title: "Рост мышц",
      advice: "Добавь углеводы после тренировки и не пропускай белок.",
      meals: [
        { slot: "Завтрак", name: "Овсянка + йогурт + банан", kcal: 520, protein: 30 },
        { slot: "Перекус", name: "Тост + арахисовая паста", kcal: 320, protein: 12 },
        { slot: "Обед", name: "Курица + рис + овощи", kcal: 680, protein: 52 },
        { slot: "Перекус", name: "Кефир + банан", kcal: 280, protein: 14 },
        { slot: "Ужин", name: "Творог + орехи + мед", kcal: 460, protein: 35 },
      ],
    },
    {
      title: "Больше калорий",
      advice: "Если вес стоит, добавь один плотный прием пищи.",
      meals: [
        { slot: "Завтрак", name: "Омлет + сыр + тост", kcal: 560, protein: 34 },
        { slot: "Перекус", name: "Йогурт + мюсли", kcal: 350, protein: 18 },
        { slot: "Обед", name: "Говядина + паста + салат", kcal: 760, protein: 50 },
        { slot: "Перекус", name: "Банан + орехи", kcal: 330, protein: 9 },
        { slot: "Ужин", name: "Йогурт + мюсли + ягоды", kcal: 430, protein: 26 },
      ],
    },
    {
      title: "После тренировки",
      advice: "Этот вариант лучше ставить в день силовой тренировки.",
      meals: [
        { slot: "Завтрак", name: "Рис + тунец + авокадо", kcal: 650, protein: 45 },
        { slot: "Перекус", name: "Смузи с молоком и бананом", kcal: 360, protein: 18 },
        { slot: "Обед", name: "Индейка + картофель", kcal: 700, protein: 48 },
        { slot: "Перекус", name: "Творог + мед", kcal: 310, protein: 29 },
        { slot: "Ужин", name: "Протеиновый йогурт + банан", kcal: 390, protein: 32 },
      ],
    },
  ],
  fit: [
    {
      title: "Баланс на день",
      advice: "Ровный вариант без жестких ограничений.",
      meals: [
        { slot: "Завтрак", name: "Овсянка + ягоды + орехи", kcal: 430, protein: 22 },
        { slot: "Перекус", name: "Фрукт + греческий йогурт", kcal: 230, protein: 16 },
        { slot: "Обед", name: "Лосось + картофель + салат", kcal: 620, protein: 38 },
        { slot: "Перекус", name: "Хлебец + сыр", kcal: 210, protein: 12 },
        { slot: "Ужин", name: "Кефир + творог + фрукт", kcal: 350, protein: 30 },
      ],
    },
    {
      title: "Больше энергии",
      advice: "Хорошо подходит в активный день.",
      meals: [
        { slot: "Завтрак", name: "Омлет + овощи + тост", kcal: 450, protein: 29 },
        { slot: "Перекус", name: "Банан + кефир", kcal: 260, protein: 12 },
        { slot: "Обед", name: "Курица + булгур + салат", kcal: 610, protein: 45 },
        { slot: "Перекус", name: "Орехи + яблоко", kcal: 250, protein: 6 },
        { slot: "Ужин", name: "Йогурт + банан + семена", kcal: 370, protein: 23 },
      ],
    },
    {
      title: "Спокойный вечер",
      advice: "Легко для желудка, но не пусто по белку.",
      meals: [
        { slot: "Завтрак", name: "Индейка + овощи на сковороде", kcal: 430, protein: 40 },
        { slot: "Перекус", name: "Кефир + ягоды", kcal: 190, protein: 11 },
        { slot: "Обед", name: "Рыба + салат + хлебец", kcal: 470, protein: 36 },
        { slot: "Перекус", name: "Творог + фрукт", kcal: 260, protein: 24 },
        { slot: "Ужин", name: "Творог + ягоды", kcal: 300, protein: 31 },
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

const bottomNavItems: Array<{ id: NavItemId; label: string }> = [
  { id: "home", label: "Главная" },
  { id: "food", label: "Питание" },
  { id: "history", label: "История" },
  { id: "chat", label: "Чат" },
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
  const [foodHistory, setFoodHistory] = useState<FoodHistoryItem[]>([]);
  const [activeNav, setActiveNav] = useState<NavItemId>("home");
  const [tabDirection, setTabDirection] = useState<"next" | "prev">("next");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(() => readPreferences().theme ?? "green");
  const [language, setLanguage] = useState<AppLanguage>(() => readPreferences().language ?? "ru");
  const [avatarUrl, setAvatarUrl] = useState(() => readPreferences().avatarUrl ?? "");
  const [voice, setVoice] = useState<"Vega" | "Regulus">(() => readPreferences().voice ?? "Vega");
  const [isWorkoutSessionOpen, setIsWorkoutSessionOpen] = useState(false);
  const [workoutStep, setWorkoutStep] = useState(0);
  const [restSeconds, setRestSeconds] = useState(30);
  const [isResting, setIsResting] = useState(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const plan = useMemo(() => {
    const base = Math.round(10 * weight + 6.25 * height - 120);
    const calories = goal === "lose" ? base - 350 : goal === "gain" ? base + 300 : base;
    const protein = Math.round(weight * (goal === "gain" ? 2 : 1.7));
    const burned = Math.round(minutes * 7);

    return { calories, protein, burned };
  }, [goal, height, minutes, weight]);

  const currentAdvice = goalAdvice[goal];
  const currentMealPlans = mealPlans[goal];
  const dailyMealIndex = getDailyMealIndex(currentTime, currentMealPlans.length);
  const currentMealPlanIndex = (dailyMealIndex + mealIndex) % currentMealPlans.length;
  const currentMealPlan = currentMealPlans[currentMealPlanIndex];
  const currentMenuDate = formatMenuDate(currentTime);
  const workoutMoves = workouts[difficulty];
  const timerProgress = Math.round(((minutes * 60 - timerSeconds) / (minutes * 60)) * 100);
  const activeStats = user?.stats ?? createEmptyUserStats();
  const hasStreakTimer = activeStats.streakDeadlineAt > 0;
  const streakSecondsLeft = activeStats.streakDeadlineAt > 0 ? Math.floor((activeStats.streakDeadlineAt - currentTime) / 1000) : 0;
  const streakDisplay = formatSignedTime(streakSecondsLeft);
  const isStreakInGrace = streakSecondsLeft < 0;
  const leaderboard = leaders;
  const todayFood = useMemo(() => getFoodSummary(foodHistory, "today", currentTime), [currentTime, foodHistory]);
  const weekFood = useMemo(() => getFoodSummary(foodHistory, "week", currentTime), [currentTime, foodHistory]);
  const foodProgress = Math.min(100, Math.round((todayFood.calories / Math.max(1, plan.calories)) * 100));

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    window.localStorage.setItem("pulsepilot-preferences", JSON.stringify({ theme, language, avatarUrl, voice }));
  }, [theme, language, avatarUrl, voice]);

  useEffect(() => {
    if (!isResting) return;
    const id = window.setInterval(() => setRestSeconds((value) => {
      if (value <= 1) { window.clearInterval(id); setIsResting(false); return 30; }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(id);
  }, [isResting]);

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
      const [meResponse, leadersResponse, foodHistoryResponse] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/leaders"),
        fetch("/api/food-history"),
      ]);
      const meData = await meResponse.json();
      const leadersData = await leadersResponse.json();
      const foodHistoryData = await foodHistoryResponse.json();

      setUser(meData.user ?? null);
      setLeaders(Array.isArray(leadersData.leaders) ? leadersData.leaders : []);
      setFoodHistory(Array.isArray(foodHistoryData.history) ? foodHistoryData.history : []);
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
      await Promise.all([loadLeaders(), loadFoodHistory()]);
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
    setFoodHistory([]);
    setIsTimerRunning(false);
    setIsFinishConfirming(false);
    setTimerSeconds(minutes * 60);
  }

  async function loadLeaders() {
    const response = await fetch("/api/leaders");
    const data = await response.json();

    setLeaders(Array.isArray(data.leaders) ? data.leaders : []);
  }

  async function loadFoodHistory() {
    const response = await fetch("/api/food-history");
    const data = await response.json();

    setFoodHistory(Array.isArray(data.history) ? data.history : []);
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

  function beginWorkoutSession() {
    setWorkoutStep(0);
    setRestSeconds(30);
    setIsResting(false);
    setIsWorkoutSessionOpen(true);
    startTrainingTimer();
    speakCoach(`${workoutMoves[0].name}. ${workoutMoves[0].base} ${workoutMoves[0].unit}.`);
  }

  function nextWorkoutStep() {
    if (workoutStep >= workoutMoves.length - 1) {
      setIsWorkoutSessionOpen(false);
      return;
    }
    setWorkoutStep((step) => step + 1);
    setRestSeconds(30);
    setIsResting(true);
  }

  function speakCoach(text: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "kk" ? "kk-KZ" : language === "en" ? "en-US" : "ru-RU";
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((item) => new RegExp(voice, "i").test(item.name)) ?? voices.find((item) => item.lang.startsWith(utterance.lang.slice(0, 2))) ?? null;
    window.speechSynthesis.speak(utterance);
  }

  function saveAvatar(file: File) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  }

  function pauseTrainingTimer() {
    setIsTimerRunning(false);
  }

  function resetTrainingTimer() {
    setIsTimerRunning(false);
    setIsFinishConfirming(false);
    setTimerSeconds(minutes * 60);
  }

  function switchNav(nextNav: NavItemId, direction?: "next" | "prev") {
    if (nextNav === activeNav) {
      return;
    }

    const currentIndex = bottomNavItems.findIndex((item) => item.id === activeNav);
    const nextIndex = bottomNavItems.findIndex((item) => item.id === nextNav);

    setTabDirection(direction ?? (nextIndex > currentIndex ? "next" : "prev"));
    setActiveNav(nextNav);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    const target = event.target instanceof Element ? event.target : null;

    if (target?.closest("button,input,label,textarea,select,a")) {
      swipeStart.current = null;
      return;
    }

    const touch = event.touches[0];

    swipeStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    if (!swipeStart.current) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - swipeStart.current.x;
    const deltaY = touch.clientY - swipeStart.current.y;

    swipeStart.current = null;

    if (Math.abs(deltaX) < 65 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) {
      return;
    }

    const currentIndex = bottomNavItems.findIndex((item) => item.id === activeNav);
    const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
    const nextItem = bottomNavItems[nextIndex];

    if (nextItem) {
      switchNav(nextItem.id, deltaX < 0 ? "next" : "prev");
    }
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
            language,
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
      await loadFoodHistory();
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
              <p className="text-xs font-bold uppercase text-[#2c8a72]">AI Fitness</p>
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

            {authError ? <p className="rounded-lg bg-[#e7f4ee] p-3 text-sm font-bold text-[#1f3327]">{authError}</p> : null}

            <button
              disabled={isAuthSubmitting}
              className="w-full rounded-lg bg-[#1f3327] px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#9aa99e]"
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
    <main className={`app-theme app-theme-${theme} min-h-screen overflow-x-hidden bg-[#14211b] pb-28 text-[#172018]`}>
      <div
        key={activeNav}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`mx-auto grid min-h-screen w-full max-w-6xl gap-5 px-4 py-5 ${
          activeNav === "home" ? "lg:grid-cols-[280px_1fr]" : ""
        } tab-panel ${tabDirection === "next" ? "tab-panel-next" : "tab-panel-prev"}`}
      >
        <aside className={`${activeNav === "home" ? "block" : "hidden"} rounded-lg border border-[#dfe5d8] bg-white p-5 shadow-sm`}>
          <div className="flex items-center gap-3">
            {avatarUrl ? <img src={avatarUrl} alt="Profile" className="size-11 rounded-lg object-cover" /> : <div className="grid size-11 place-items-center rounded-lg bg-[#1f3327] font-black text-white">AI</div>}
            <div>
              <p className="text-xs font-bold uppercase text-[#2c8a72]">AI Fitness</p>
              <h1 className="text-2xl font-black">Будьте Здоровы</h1>
            </div>
          </div>

          <div className="mt-5 rounded-lg bg-[#f2f5ee] p-3">
            <p className="text-xs font-bold text-[#59665d]">Аккаунт</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-lg font-black">{user.login}</p>
              <button onClick={() => setIsSettingsOpen(true)} className="rounded-md bg-white px-2 py-1 text-xs font-black text-[#1f3327]" aria-label="Settings">⚙</button>
              <button onClick={logout} className="rounded-md bg-white px-2 py-1 text-xs font-black text-[#1f3327]">
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
                className="mt-2 w-full accent-[#2c8a72]"
              />
            </label>

            <div className="rounded-lg bg-[#f2f5ee] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#59665d]">Счетчик</p>
                  <p className="mt-1 text-3xl font-black text-[#1f3327]">{formatTime(timerSeconds)}</p>
                </div>
                <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-[#2c8a72]">{timerProgress}%</span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-[#2c8a72] transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, timerProgress))}%` }}
                />
              </div>

              <div className={`mt-3 rounded-lg p-3 ${isStreakInGrace ? "bg-[#e7f4ee]" : "bg-white"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-[#59665d]">Стрик: {activeStats.streakDays} дн.</p>
                  <span className={`text-xs font-black ${isStreakInGrace ? "text-[#59665d]" : "text-[#2c8a72]"}`}>
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
                    isFinishConfirming ? "bg-[#59665d]" : "bg-[#2c8a72]"
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
                    <span className="grid size-7 place-items-center rounded-md bg-white text-xs font-black text-[#2c8a72]">
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
          <div className={`${activeNav === "home" ? "block" : "hidden"} rounded-lg border border-[#dfe5d8] bg-white p-5 shadow-sm`}>
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

          <div className={`${activeNav === "home" ? "grid" : "hidden"} gap-5 md:grid-cols-3`}>
            <Card label="Калории" value={`${plan.calories} ккал`} />
            <Card label="Белок" value={`${plan.protein} г`} />
            <Card label="Тренировка" value={`${plan.burned} ккал`} />
          </div>

          <div className={`${activeNav === "home" ? "grid" : "hidden"} gap-5 lg:grid-cols-[1fr_1fr]`}>
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
                  onClick={beginWorkoutSession}
                  className="rounded-lg bg-[#1f3327] px-4 py-3 text-sm font-black text-white transition hover:bg-[#2c8a72]"
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

          <div className={`${activeNav === "food" || activeNav === "history" ? "block" : "hidden"} rounded-lg border border-[#dfe5d8] bg-[#1f3327] p-5 text-white shadow-sm`}>
            <div className={`${activeNav === "food" ? "grid" : "hidden"} gap-5 lg:grid-cols-[0.9fr_1.1fr]`}>
              <div>
                <p className="text-sm font-bold text-[#b8cdbf]">Food scanner</p>
                <h3 className="mt-1 text-2xl font-black">Покажи еду AI</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#dbe8df]">
                  Сделай фото блюда на телефоне или загрузи картинку. AI-Тренер оценит порцию, калории и КБЖУ, а фото не сохранит.
                </p>

                <label className="tap-target mt-4 flex min-h-14 cursor-pointer items-center justify-center rounded-lg bg-white px-4 py-3 text-center text-sm font-black text-[#1f3327] transition hover:bg-[#e7f4ee]">
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
                    <p className="text-sm font-bold text-[#1f3327]">{scanError}</p>
                  ) : scanResult ? (
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-bold uppercase text-[#59665d]">{scanResult.confidence}</p>
                        {scanResult.needsReview ? (
                          <span className="rounded-md bg-[#e7f4ee] px-2 py-1 text-xs font-black text-[#1f3327]">
                            проверить
                          </span>
                        ) : null}
                      </div>
                      <h4 className="mt-1 text-xl font-black">{scanResult.foodName}</h4>
                      <p className="mt-1 text-sm font-bold text-[#59665d]">{scanResult.portion}</p>

                      <div className="mt-4 grid grid-cols-4 gap-2">
                        <MiniStat label="Ккал" value={scanResult.calories} />
                        <MiniStat label="Б" value={scanResult.protein} />
                        <MiniStat label="У" value={scanResult.carbs} />
                        <MiniStat label="Ж" value={scanResult.fat} />
                      </div>

                      {scanResult.vitamins?.length ? <p className="mt-3 rounded-lg bg-[#eef2ea] p-3 text-sm font-bold text-[#1f3327]">Vitamins: {scanResult.vitamins.join(" · ")}</p> : null}
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

            <div className={`mt-5 grid gap-4 ${activeNav === "history" ? "" : "lg:grid-cols-[0.85fr_1.15fr]"}`}>
              <div className={`${activeNav === "food" ? "block" : "hidden"} rounded-lg bg-white p-4 text-[#172018]`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#59665d]">Прогресс питания</p>
                    <h4 className="mt-1 text-2xl font-black">{todayFood.calories} ккал</h4>
                  </div>
                  <span className="rounded-md bg-[#e7f4ee] px-2 py-1 text-xs font-black text-[#2c8a72]">
                    {foodProgress}%
                  </span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f2f5ee]">
                  <div className="h-full rounded-full bg-[#2c8a72]" style={{ width: `${foodProgress}%` }} />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <MiniStat label="Б" value={todayFood.protein} />
                  <MiniStat label="У" value={todayFood.carbs} />
                  <MiniStat label="Ж" value={todayFood.fat} />
                </div>

                <p className="mt-3 text-xs font-bold leading-5 text-[#59665d]">
                  За 7 дней: {weekFood.calories} ккал · {weekFood.items} записей. В базе хранится только текстовая история.
                </p>
              </div>

              <div className="rounded-lg bg-white p-4 text-[#172018]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#59665d]">История сканов</p>
                    <h4 className="mt-1 text-xl font-black">Последние блюда</h4>
                  </div>
                  <span className="rounded-md bg-[#f2f5ee] px-2 py-1 text-xs font-black text-[#59665d]">
                    {foodHistory.length}/50
                  </span>
                </div>

                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                  {foodHistory.length === 0 ? (
                    <p className="rounded-lg bg-[#f2f5ee] p-3 text-sm font-bold text-[#59665d]">
                      Сканов пока нет. Первый результат появится здесь текстом.
                    </p>
                  ) : null}

                  {foodHistory.slice(0, 8).map((item) => (
                    <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg bg-[#f2f5ee] p-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-black">{item.foodName}</p>
                          {item.needsReview ? (
                            <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-black text-[#1f3327]">
                              проверить
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs font-bold text-[#59665d]">
                          {formatFoodDate(item.createdAt)} · {item.portion}
                        </p>
                      </div>
                      <p className="text-sm font-black text-[#1f3327]">{item.calories} ккал</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className={`${activeNav === "food" || activeNav === "chat" ? "grid" : "hidden"} gap-5`}>
            <div className={`${activeNav === "food" ? "block" : "hidden"} rounded-lg border border-[#dfe5d8] bg-white p-5 shadow-sm`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-[#e7f4ee] px-2 py-1 text-sm font-black text-[#2c8a72]">Food</span>
                  <div>
                    <h3 className="text-xl font-black">Меню на день</h3>
                    <p className="mt-1 text-sm font-bold text-[#59665d]">
                      {currentMenuDate} · {currentMealPlan.title} · меню #{currentMealPlanIndex + 1}
                    </p>
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
                    <p className="text-xs font-black uppercase text-[#2c8a72]">{meal.slot}</p>
                    <p className="font-bold">{meal.name}</p>
                    <p className="mt-1 text-sm font-semibold text-[#59665d]">
                      {meal.kcal} ккал · {meal.protein} г белка
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-4 rounded-lg bg-[#e7f4ee] p-3 text-sm font-bold leading-6 text-[#2c8a72]">
                {currentMealPlan.advice} Меню обновится завтра автоматически.
              </p>
            </div>

            <div className={`${activeNav === "chat" ? "block" : "hidden"} rounded-lg border border-[#dfe5d8] bg-white p-5 shadow-sm`}>
              <div className="mb-4 flex items-center gap-2">
                <span className="rounded-md bg-[#e7f4ee] px-2 py-1 text-sm font-black text-[#2c8a72]">AI</span>
                <h3 className="text-xl font-black">AI Тренер</h3>
                <div className="ml-auto flex gap-1">
                  {(["Vega", "Regulus"] as const).map((item) => <button key={item} onClick={() => setVoice(item)} className={`rounded-md px-2 py-1 text-xs font-black ${voice === item ? "bg-[#1f3327] text-white" : "bg-[#eef2ea] text-[#59665d]"}`}>{item === "Vega" ? "♀ Vega" : "♂ Regulus"}</button>)}
                </div>
              </div>

              <div className="flex max-h-80 min-h-48 flex-col gap-3 overflow-y-auto rounded-lg bg-[#e7f4ee] p-4 text-sm font-semibold leading-6 text-[#1f3327]">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`max-w-[92%] rounded-lg px-3 py-2 ${
                      message.role === "user"
                        ? "ml-auto bg-[#1f3327] text-white"
                        : "bg-white text-[#1f3327]"
                    }`}
                  >
                    {message.text}
                  </div>
                ))}

                {isAsking ? (
                  <div className="max-w-[92%] rounded-lg bg-white px-3 py-2 text-[#59665d]">AI думает...</div>
                ) : null}
              </div>

              {chatError ? <p className="mt-2 text-sm font-bold text-[#1f3327]">{chatError}</p> : null}

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
                  className="min-w-0 flex-1 rounded-lg border border-[#dfe5d8] px-4 py-3 text-sm font-semibold outline-none focus:border-[#1f3327]"
                  placeholder="Спроси AI Coach"
                />
                <button
                  type="submit"
                  disabled={isAsking}
                  className="grid size-12 shrink-0 place-items-center rounded-lg bg-[#1f3327] text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#9aa99e]"
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

      {isSettingsOpen ? <SettingsModal theme={theme} language={language} avatarUrl={avatarUrl} voice={voice} onClose={() => setIsSettingsOpen(false)} onTheme={setTheme} onLanguage={setLanguage} onAvatar={saveAvatar} onRemoveAvatar={() => setAvatarUrl("")} onVoice={setVoice} /> : null}
      {isWorkoutSessionOpen ? <WorkoutSession move={workoutMoves[workoutStep]} index={workoutStep} total={workoutMoves.length} isResting={isResting} restSeconds={restSeconds} timerSeconds={timerSeconds} onPause={pauseTrainingTimer} onStop={() => { setIsWorkoutSessionOpen(false); pauseTrainingTimer(); }} onNext={nextWorkoutStep} onSpeak={() => speakCoach(isResting ? `Отдых ${restSeconds} секунд` : `${workoutMoves[workoutStep].name}. ${workoutMoves[workoutStep].base} ${workoutMoves[workoutStep].unit}`)} /> : null}

      <nav className="bottom-nav fixed z-50 max-w-lg rounded-[32px] border border-[#dfe5d8] bg-white/92 p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-md">
        <div className="grid grid-cols-4 items-center gap-1">
          {bottomNavItems.map((item) => {
            const isActive = activeNav === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => switchNav(item.id)}
                className={`relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-[30px] text-xs font-black transition ${
                  isActive ? "bg-[#1f3327] text-white shadow-sm" : "text-[#59665d] hover:bg-[#f2f5ee]"
                }`}
                aria-label={item.label}
                title={item.label}
              >
                <NavIcon id={item.id} active={isActive} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}

function readPreferences(): Partial<{ theme: AppTheme; language: AppLanguage; avatarUrl: string; voice: "Vega" | "Regulus" }> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem("pulsepilot-preferences") || "{}"); } catch { return {}; }
}

function SettingsModal({ theme, language, avatarUrl, voice, onClose, onTheme, onLanguage, onAvatar, onRemoveAvatar, onVoice }: { theme: AppTheme; language: AppLanguage; avatarUrl: string; voice: "Vega" | "Regulus"; onClose: () => void; onTheme: (theme: AppTheme) => void; onLanguage: (language: AppLanguage) => void; onAvatar: (file: File) => void; onRemoveAvatar: () => void; onVoice: (voice: "Vega" | "Regulus") => void }) {
  const themes: Array<{ id: AppTheme; label: string }> = [{ id: "green", label: "Green" }, { id: "blue", label: "Blue" }, { id: "violet", label: "Violet" }, { id: "graphite", label: "Graphite" }, { id: "light", label: "Light" }];
  return <div className="fixed inset-0 z-[60] grid place-items-end bg-black/45 p-4 sm:place-items-center" role="dialog" aria-modal="true" aria-label="Settings">
    <section className="w-full max-w-lg rounded-[28px] bg-white p-6 text-[#172018] shadow-2xl">
      <div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#2c8a72]">PulsePilot</p><h2 className="mt-1 text-2xl font-black">Настройки</h2></div><button onClick={onClose} className="grid size-10 place-items-center rounded-full bg-[#eef2ea] text-xl" aria-label="Close">×</button></div>
      <div className="mt-6 grid gap-5">
        <div><p className="text-sm font-black">Фото профиля</p><div className="mt-2 flex items-center gap-3">{avatarUrl ? <img src={avatarUrl} alt="Avatar" className="size-14 rounded-2xl object-cover" /> : <div className="grid size-14 place-items-center rounded-2xl bg-[#1f3327] font-black text-white">AI</div>}<label className="cursor-pointer rounded-xl bg-[#eef2ea] px-3 py-2 text-sm font-black">Загрузить<input type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onAvatar(file); }} /></label>{avatarUrl ? <button onClick={onRemoveAvatar} className="text-sm font-bold text-[#59665d]">Убрать</button> : null}</div></div>
        <div><p className="text-sm font-black">Тема</p><div className="mt-2 grid grid-cols-5 gap-2">{themes.map((item) => <button key={item.id} onClick={() => onTheme(item.id)} className={`theme-choice theme-choice-${item.id} rounded-xl p-2 text-[10px] font-black ${theme === item.id ? "ring-2 ring-[#2c8a72] ring-offset-2" : ""}`}>{item.label}</button>)}</div></div>
        <div><p className="text-sm font-black">Язык интерфейса и тренера</p><div className="mt-2 grid grid-cols-3 gap-2">{([{ id: "ru", label: "Русский" }, { id: "en", label: "English" }, { id: "kk", label: "Қазақша" }] as const).map((item) => <button key={item.id} onClick={() => onLanguage(item.id)} className={`rounded-xl px-3 py-2 text-sm font-black ${language === item.id ? "bg-[#1f3327] text-white" : "bg-[#eef2ea] text-[#59665d]"}`}>{item.label}</button>)}</div><p className="mt-2 text-xs font-semibold text-[#59665d]">Ответы AI и голос будут на выбранном языке.</p></div>
        <div><p className="text-sm font-black">Голос тренера</p><div className="mt-2 flex gap-2">{(["Vega", "Regulus"] as const).map((item) => <button key={item} onClick={() => onVoice(item)} className={`rounded-xl px-4 py-2 text-sm font-black ${voice === item ? "bg-[#1f3327] text-white" : "bg-[#eef2ea] text-[#59665d]"}`}>{item === "Vega" ? "♀ Vega" : "♂ Regulus"}</button>)}</div><p className="mt-2 text-xs font-semibold text-[#59665d]">Используется голос с таким именем, если он доступен в браузере.</p></div>
      </div>
    </section>
  </div>;
}

function WorkoutSession({ move, index, total, isResting, restSeconds, timerSeconds, onPause, onStop, onNext, onSpeak }: { move: WorkoutMove; index: number; total: number; isResting: boolean; restSeconds: number; timerSeconds: number; onPause: () => void; onStop: () => void; onNext: () => void; onSpeak: () => void }) {
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-[#14211b]/95 p-5 text-white"><section className="w-full max-w-md text-center"><p className="text-sm font-black uppercase tracking-[0.2em] text-[#9edcb9]">Таймер · {formatTime(timerSeconds)}</p><div className={`coach-orb mx-auto mt-8 grid size-56 place-items-center rounded-full border border-white/25 bg-gradient-to-br from-[#2c8a72] to-[#0e2019] shadow-[0_0_100px_rgba(44,138,114,.35)] ${isResting ? "coach-orb-speaking" : ""}`}><div className="max-w-44"><p className="text-sm font-bold text-white/70">{isResting ? "Пауза" : `Упражнение ${index + 1} из ${total}`}</p><h2 className="mt-2 text-2xl font-black">{isResting ? `${restSeconds} сек` : move.name}</h2><p className="mt-2 text-sm font-bold">{isResting ? "Восстановите дыхание" : `${move.base} ${move.unit} · ${move.seconds} сек`}</p></div></div><p className="mx-auto mt-8 max-w-sm text-sm font-semibold leading-6 text-white/70">{isResting ? "Следующее упражнение начнётся после короткой паузы." : "Работайте в своём темпе. Остановитесь, если появилась боль или головокружение."}</p><div className="mt-7 grid grid-cols-3 gap-2"><button onClick={onSpeak} className="rounded-xl bg-white/15 px-3 py-3 text-sm font-black">◉ Голос</button><button onClick={onPause} className="rounded-xl bg-white/15 px-3 py-3 text-sm font-black">Пауза</button><button onClick={isResting ? undefined : onNext} disabled={isResting} className="rounded-xl bg-[#2c8a72] px-3 py-3 text-sm font-black disabled:opacity-50">{index === total - 1 ? "Готово" : "Далее"}</button></div><button onClick={onStop} className="mt-4 text-sm font-bold text-white/60">Завершить принудительно</button></section></div>;
}

function NavIcon({ id, active }: { id: NavItemId; active: boolean }) {
  const color = active ? "#ffffff" : "#1f3327";
  const commonProps = {
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
    className: "shrink-0",
  };

  if (id === "home") {
    return (
      <svg {...commonProps} fill={color}>
        <path d="M4 10.8 12 4l8 6.8V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.2Z" />
      </svg>
    );
  }

  if (id === "food") {
    return (
      <svg {...commonProps} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <path d="M8 3v8" />
        <path d="M5 3v4a3 3 0 0 0 6 0V3" />
        <path d="M8 11v10" />
        <path d="M16 3v18" />
        <path d="M16 3c2.2 1.5 3.2 3.6 3 6.2-.1 1.5-1.3 2.8-3 2.8" />
      </svg>
    );
  }

  if (id === "history") {
    return (
      <svg {...commonProps} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <path d="M4 12a8 8 0 1 0 2.3-5.7" />
        <path d="M4 4v5h5" />
        <path d="M12 8v5l3 2" />
      </svg>
    );
  }

  if (id === "chat") {
    return (
      <svg {...commonProps} fill={color}>
        <path d="M5 5a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h8.2l4.2 3.2A1 1 0 0 0 19 19.4V17a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H5Zm2.5 5.9a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm4.5 0a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm4.5 0a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Z" />
      </svg>
    );
  }

  return (
    <svg {...commonProps} fill={color}>
      <path d="M5 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
    </svg>
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

function getDailyMealIndex(now: number, count: number) {
  const date = new Date(now);
  const seed = Number(
    `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`,
  );

  return count > 0 ? seed % count : 0;
}

function formatMenuDate(value: number) {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

function getFoodSummary(history: FoodHistoryItem[], period: "today" | "week", now: number) {
  const todayKey = getDateKey(now);
  const weekStart = now - 7 * 24 * 60 * 60 * 1000;
  const items = history.filter((item) => {
    const itemTime = Date.parse(item.createdAt);

    if (!item.isFood || !Number.isFinite(itemTime)) {
      return false;
    }

    return period === "today" ? getDateKey(itemTime) === todayKey : itemTime >= weekStart && itemTime <= now;
  });

  return items.reduce(
    (summary, item) => ({
      items: summary.items + 1,
      calories: summary.calories + item.calories,
      protein: summary.protein + item.protein,
      carbs: summary.carbs + item.carbs,
      fat: summary.fat + item.fat,
    }),
    { items: 0, calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

function getDateKey(value: number) {
  return new Date(value).toLocaleDateString("en-CA");
}

function formatFoodDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "без даты";
  }

  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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
