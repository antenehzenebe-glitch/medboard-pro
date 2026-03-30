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
      ? topic.includes("Endocrinology") ? "a randomly selected endocrinology topic"
        : topic.includes("ABIM") ? "a randomly selected ABIM Internal Medicine topic"
        : topic.includes("USMLE") ? "a randomly selected USMLE high-yield topic"
        : "a randomly selected medical topic — make each question a different specialty"
      : `"${topic}"`;

    const prompt = `Generate exactly ${count} board-style medical MCQ(s) on ${topicPrompt} at ${level} level. Use current ADA, Endocrine Society, ACC/AHA guidelines and Harrison's Principles of Internal Medicine, Williams Textbook of Endocrinology as references.

Return ONLY a valid JSON array. No text before or after. No markdown. No backticks:
[{"stem":"A 45-year-old woman presents with...","choices":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correct":"B","explanation":"The correct answer is B because... per [guideline].","topic":"Topic Name"}]`;

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
      return {
        statusCode: 500,
        body: JSON.stringify({ error: data.error?.message || "Anthropic API error" })
      };
    }

    // Safely extract text
    const textContent = data.content && data.content[0] && data.content[0].text;
    if (!textContent) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Empty response from AI" })
      };
    }

    // Clean and parse
    const clean = textContent
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

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
