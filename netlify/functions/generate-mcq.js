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

    const prompt = `You are a senior medical educator. Generate exactly ${count} board-style MCQ(s) on ${topicPrompt} at ${level} level. Use current guidelines from ADA, Endocrine Society, ACC/AHA, ESC and major medical societies. Reference Harrison's, Williams Textbook of Endocrinology and relevant textbooks.

Each question must have a clinical vignette, 5 choices (A-E), one correct answer, and a detailed explanation citing the guideline or textbook.
${isRandom ? "Each question must be from a DIFFERENT specialty." : ""}

Return ONLY a valid JSON array:
[{"stem":"...","choices":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correct":"B","explanation":"...","topic":"..."}]`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        claude-sonnet-4-5: "claude-opus-4-6",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic API error:", JSON.stringify(data));
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Anthropic API error: " + (data.error?.message || "Unknown") })
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
    console.error("Function error:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
