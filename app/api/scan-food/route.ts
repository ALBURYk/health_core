import { cookies } from "next/headers";
import { SESSION_COOKIE, getUserBySession, recordFoodScan } from "@/app/lib/database";

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
    "Ты AI fitness nutrition coach и строгий визуальный классификатор еды.",
    "Сначала проверь, есть ли на фото настоящая видимая еда или напиток. Если это ноутбук, экран, комната, человек, упаковка без видимой еды или любой неясный объект, не угадывай блюдо.",
    "Если еды нет или она неразборчива, поставь isFood=false, needsReview=true, calories/protein/carbs/fat=0, foodName='На фото не еда', portion='Еда не определена'.",
    "Если еда есть, оцени калории и КБЖУ приблизительно, но честно снижай confidence и ставь needsReview=true при плохом освещении, частично закрытой тарелке или неоднозначном блюде.",
    `Цель пользователя: ${goal}.`,
    "Верни только валидный JSON без markdown:",
    '{"isFood":boolean,"needsReview":boolean,"foodName":"string","confidence":"низкая|средняя|высокая","calories":number,"protein":number,"carbs":number,"fat":number,"vitamins":["Vitamin C"],"portion":"string","advice":"string"}',
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
        generationConfig: {
          temperature: 0.15,
          responseMimeType: "application/json",
        },
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

  const cookieStore = await cookies();
  const user = await getUserBySession(cookieStore.get(SESSION_COOKIE)?.value);

  if (user) {
    await recordFoodScan(user.id, {
      ...result,
      goal,
    });
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
    const isFood = parsed.isFood === false ? false : true;
    const needsReview = Boolean(parsed.needsReview) || !isFood || parsed.confidence === "низкая";

    return {
      isFood,
      needsReview,
      foodName: String(parsed.foodName || (isFood ? "Неизвестное блюдо" : "На фото не еда")),
      confidence: String(parsed.confidence || "средняя"),
      calories: isFood ? toNumber(parsed.calories) : 0,
      protein: isFood ? toNumber(parsed.protein) : 0,
      carbs: isFood ? toNumber(parsed.carbs) : 0,
      fat: isFood ? toNumber(parsed.fat) : 0,
      vitamins: isFood && Array.isArray(parsed.vitamins) ? parsed.vitamins.filter((value: unknown): value is string => typeof value === "string").slice(0, 6) : [],
      portion: String(parsed.portion || (isFood ? "Порция не определена" : "Еда не определена")),
      advice: String(
        parsed.advice ||
          (isFood
            ? "Проверь результат и при необходимости уточни порцию вручную."
            : "Я не буду записывать калории по фото без явной еды. Сделай снимок тарелки ближе и при хорошем свете."),
      ),
    };
  } catch {
    return null;
  }
}

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}
