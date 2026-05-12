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

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY не найден в .env.local" }, { status: 500 });
  }

  const formData = await request.formData();
  const image = formData.get("image");
  const goal = String(formData.get("goal") || "здоровое питание");

  if (!(image instanceof File)) {
    return Response.json({ error: "Загрузи фото еды" }, { status: 400 });
  }

  if (!image.type.startsWith("image/")) {
    return Response.json({ error: "Файл должен быть изображением" }, { status: 400 });
  }

  if (image.size > MAX_IMAGE_SIZE) {
    return Response.json({ error: "Фото слишком большое. Выбери файл до 8MB." }, { status: 400 });
  }

  const buffer = Buffer.from(await image.arrayBuffer());
  const base64Image = buffer.toString("base64");

  const prompt = [
    "Ты AI fitness nutrition coach.",
    "Определи еду на фото и оцени калории. Это приблизительная оценка, не медицинский диагноз.",
    `Цель пользователя: ${goal}.`,
    "Верни только валидный JSON без markdown:",
    '{"foodName":"string","confidence":"низкая|средняя|высокая","calories":number,"protein":number,"carbs":number,"fat":number,"portion":"string","advice":"string"}',
  ].join(" ");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: image.type,
                  data: base64Image,
                },
              },
              { text: prompt },
            ],
          },
        ],
      }),
    },
  );

  const data = (await response.json()) as GeminiResponse;

  if (!response.ok) {
    return Response.json(
      { error: data.error?.message || "Gemini не смог обработать фото" },
      { status: response.status },
    );
  }

  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  const result = parseGeminiJson(text);

  if (!result) {
    return Response.json({ error: "AI вернул ответ в неожиданном формате" }, { status: 502 });
  }

  return Response.json({ result });
}

function parseGeminiJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);

    return {
      foodName: String(parsed.foodName || "Неизвестное блюдо"),
      confidence: String(parsed.confidence || "средняя"),
      calories: toNumber(parsed.calories),
      protein: toNumber(parsed.protein),
      carbs: toNumber(parsed.carbs),
      fat: toNumber(parsed.fat),
      portion: String(parsed.portion || "Порция не определена"),
      advice: String(parsed.advice || "Проверь результат и при необходимости уточни порцию вручную."),
    };
  } catch {
    return null;
  }
}

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}
