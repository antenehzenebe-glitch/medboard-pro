exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { topic, level, count } = JSON.parse(event.body);
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "API key not configured" })
      };
    }

    const isRandom = topic.toLowerCase().includes("random");
    const topicPrompt = isRandom
      ? topic.includes("Endocrinology") ? "a randomly selected endocrinology topic"
        : topic.includes("ABIM IM") ? "a randomly selected ABIM Internal Medicine blueprint topic"
        : topic.includes("USMLE") ? "a randomly selected high-yield USMLE topic"
        : "a randomly selected topic from any medical specialty"
      : `"${topic}"`;

    // Limit to max 5 questions per call to avoid timeout
    const safeCount = Math.min(count || 5, 5);

    const prompt = `Generate exactly ${safeCount} board-style medical MCQ(s) on ${topicPrompt} at ${level} level. Use current ADA, Endocrine Society, ACC/AHA guidelines and Harrison's, Williams Textbook of Endocrinology.

Return ONLY a valid JSON array, no markdown:
[{"stem":"clinical vignette...","choices":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correct":"B","explanation":"explanation citing guideline...","topic":"topic name"}]`;

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

    if (!response.ok) {
      console.error("Anthropic error:", JSON.stringify(data));
      return {
        statusCode: 500,
        body: JSON.stringify({ error: data.error?.message || "Anthropic API error" })
      };
    }

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
    console.error("Error:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
