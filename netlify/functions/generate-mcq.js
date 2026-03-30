exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { topic, level, count } = JSON.parse(event.body);
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "API key not configured" }) };
    }

    const isRandom = topic.toLowerCase().includes("random");
    const topicPrompt = isRandom
      ? topic.includes("Endocrinology") ? "a random endocrinology topic"
        : topic.includes("ABIM") ? "a random ABIM Internal Medicine topic"
        : topic.includes("USMLE") ? "a random USMLE high-yield topic"
        : "random medical topics — each question a different specialty"
      : `"${topic}"`;

    const safeCount = Math.min(count, 5);

    const prompt = `Generate exactly ${safeCount} USMLE/ABIM board-style MCQ(s) on ${topicPrompt} at ${level} level.

Rules:
- Short clinical vignette (2-3 sentences)
- 5 choices A-E, one correct
- Brief explanation (2 sentences) citing one guideline or textbook
- No topic hints in the stem

Return ONLY a JSON array, no markdown, no backticks:
[{"stem":"...","choices":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correct":"B","explanation":"...","topic":"..."}]`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: data.error?.message || "API error" })
      };
    }

    const textContent = data.content && data.content[0] && data.content[0].text;
    if (!textContent) {
      return { statusCode: 500, body: JSON.stringify({ error: "Empty response" }) };
    }

    const clean = textContent.replace(/```json/g,"").replace(/```/g,"").trim();
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
