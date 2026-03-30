exports.handler = async (event) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      message: "Function working",
      hasKey: !!apiKey,
      keyStart: apiKey ? apiKey.substring(0, 10) : "NOT FOUND"
    })
  };
};
```

5. Commit message: `Test function`
6. Wait for Netlify to deploy

---

Then go to this URL in your browser:
```
https://app-medboardpro-az.netlify.app/.netlify/functions/generate-mcq
