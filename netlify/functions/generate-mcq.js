exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { topic, level, count } = JSON.parse(event.body);

    const isRandom = topic.toLowerCase().includes("random");
    const topicPrompt = isRandom
      ? topic.includes("Endocrinology") ? "a randomly selected endocrinology topic"
        : topic.includes("ABIM IM") ? "a randomly selected ABIM Internal Medicine blueprint topic"
        : topic.includes("USMLE") ? "a randomly selected high-yield USMLE topic"
        : "a randomly selected topic from any medical specialty"
      : `"${topic}"`;

    const prompt = `You are a senior medical educator and board examiner. Generate exactly ${count} high-quality board-style MCQ(s) on ${topicPrompt} at ${level} level.

Use the most current guidelines from ADA, AACE, Endocrine Society, ACC/AHA, ESC, EASD, KDIGO, IDSA, NCCN, USPSTF and all major US and European medical societies. Reference top textbooks including Harrison's Principles of Internal Medicine, Williams Textbook of Endocrinology, DeGroot's Endocrinology, Braunwald's Heart Disease, and other relevant specialty textbooks. Use evidence from recent years.

Each question must:
- Be a realistic clinical vignette with patient demographics, presenting complaint, relevant labs and vitals
- Have exactly 5 answer choices labeled A through E
- Have one definitively correct answer
- Include a detailed explanation (3-5 sentences) citing the specific guideline, society or textbook
- Vary in difficulty
${isRandom ? "- Each question must be from a DIFFERENT specialty or topic" : ""}

Return ONLY a valid JSON array, no markdown:
[{"stem":"...","choices":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correct":"B","explanation":"...citing guideline/textbook...","topic":"topic name"}]`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
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
