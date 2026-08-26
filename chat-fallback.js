export async function chatFallback(message, history, systemInstruction, res) {
  const groq = getGroqClient();
  if (!groq) return res.status(500).json({ error: "No AI client available" });

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemInstruction },
        ...history.map(m => ({
          role: m.role === 'model' ? 'assistant' : 'user',
          content: m.text
        })),
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });
    return res.json({ reply: response.choices[0]?.message?.content || 'Sorry, I have no response.' });
  } catch (err) {
    console.error('Groq fallback error:', err);
    return res.status(500).json({ error: String(err) });
  }
}
