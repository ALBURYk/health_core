type ChatRole = "user" | "model";

type ChatMessage = {
  role: ChatRole;
  text: string;
};

type CoachContext = {
  goal?: string;
  weight?: number;
  height?: number;
  minutes?: number;
  calories?: number;
  protein?: number;
  burned?: number;
  language?: "ru" | "en" | "kk";
};

type GeminiPart = {
  text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
  error?: {
    message?: string;
  };
};

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const MAX_MESSAGE_LENGTH = 1200;
const MAX_HISTORY = 12;

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY не найден в .env.local" }, { status: 500 });
  }

  let body: { messages?: ChatMessage[]; context?: CoachContext };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный JSON-запрос" }, { status: 400 });
  }

  const messages = normalizeMessages(body.messages);

  if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
    return Response.json({ error: "Напиши вопрос для AI Coach" }, { status: 400 });
  }

  const contents = [
    {
      role: "user",
      parts: [{ text: buildCoachSettings(body.context) }],
    },
    {
      role: "model",
      parts: [{ text: "Принял настройки. Отвечаю как персональный AI fitness coach." }],
    },
    ...messages.map((message) => ({
      role: message.role,
      parts: [{ text: message.text }],
    })),
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.65,
          topP: 0.9,
          maxOutputTokens: 700,
        },
      }),
    },
  );

  const data = (await response.json()) as GeminiResponse;

  if (!response.ok) {
    return Response.json(
      { error: data.error?.message || "Gemini не смог ответить" },
      { status: response.status },
    );
  }

  const answer = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();

  if (!answer) {
    return Response.json({ error: "AI вернул пустой ответ" }, { status: 502 });
  }

  return Response.json({ answer });
}

function normalizeMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message) => {
      if (!message || typeof message !== "object") {
        return null;
      }

      const role = "role" in message ? message.role : null;
      const text = "text" in message ? message.text : null;

      if ((role !== "user" && role !== "model") || typeof text !== "string") {
        return null;
      }

      const trimmedText = text.trim().slice(0, MAX_MESSAGE_LENGTH);

      return trimmedText ? { role, text: trimmedText } : null;
    })
    .filter((message): message is ChatMessage => Boolean(message))
    .slice(-MAX_HISTORY);
}

function buildCoachSettings(context: CoachContext = {}) {
  const goal = context.goal || "быть в форме";
  const weight = toNumber(context.weight);
  const height = toNumber(context.height);
  const minutes = toNumber(context.minutes);
  const calories = toNumber(context.calories);
  const protein = toNumber(context.protein);
  const burned = toNumber(context.burned);
  const language = context.language === "en" ? "English" : context.language === "kk" ? "Kazakh" : "Russian";

  return [
    "Ты персональный AI fitness coach внутри приложения Health Core.",
    `Reply exclusively in ${language}. Do not use Russian unless the selected language is Russian. Keep the tone friendly, confident, and practical like a live fitness and nutrition coach.`,
    "Держи фокус на тренировках, питании, восстановлении, привычках, калориях, БЖУ и мотивации.",
    "Если вопрос вне темы фитнеса и здоровья, коротко верни разговор к целям пользователя.",
    "Не ставь диагнозы и не назначай лечение. При боли, травме, болезни, беременности или расстройствах пищевого поведения советуй обратиться к врачу или профильному специалисту.",
    "Давай практичные шаги, конкретные варианты еды или тренировки, но не обещай гарантированный результат.",
    "Если данных не хватает, сначала дай безопасный базовый совет и задай один уточняющий вопрос.",
    "Не используй markdown-таблицы. Отвечай компактно: 1-4 коротких абзаца или небольшой список.",
    `Текущий профиль: цель - ${goal}, вес - ${weight || "не указан"} кг, рост - ${height || "не указан"} см, тренировка - ${minutes || "не указано"} мин.`,
    `План приложения на день: ${calories || "не рассчитано"} ккал, ${protein || "не рассчитано"} г белка, примерно ${burned || "не рассчитано"} ккал активности.`,
    `Language lock: every word of the answer, including headings and examples, must be in ${language}.`,
  ].join("\n");
}

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}
