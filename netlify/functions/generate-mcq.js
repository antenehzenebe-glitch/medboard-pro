exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { topic, level, count } = JSON.parse(event.body);
    const apiKey = process.env.ANTHROPIC_API_KEY;

    const prompt = `Generate exactly ${count} board-style medical MCQ(s) on "${topic}" at ${level} level. Use current ADA, Endocrine Society, ACC/AHA guidelines and Harrison's, Williams Textbook of Endocrinology. Return ONLY a valid JSON array, no markdown: [{"stem":"...","choices":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correct":"B","explanation":"...","topic":"..."}]`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    const raw = data.content?.map(b => b.text || "").join("").trim();
    const clean = raw.replace(/```json|```/g, "").trim();
    const questions = JSON.parse(clean);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify(questions)
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
