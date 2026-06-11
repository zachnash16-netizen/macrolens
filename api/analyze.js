export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { base64, mediaType } = req.body;

  if (!base64 || !mediaType) {
    return res.status(400).json({ error: "Missing image data" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `You are a professional nutritionist AI. Analyze food images and return ONLY a JSON object with no markdown, no explanation, no preamble.
Return this exact structure:
{
  "mealName": "descriptive meal name",
  "confidence": "high|medium|low",
  "items": [{"name": "item", "portion": "estimated portion", "calories": 0, "protein": 0, "carbs": 0, "fat": 0}],
  "totals": {"calories": 0, "protein": 0, "carbs": 0, "fat": 0},
  "notes": "brief nutritional insight"
}
All macros in grams. Be realistic with portions. Return ONLY the JSON.`,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64,
                },
              },
              {
                type: "text",
                text: "Analyze this food image and return the nutrition data as JSON.",
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Analysis failed", detail: err.message });
  }
}
