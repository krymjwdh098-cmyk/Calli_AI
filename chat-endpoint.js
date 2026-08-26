import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/api/v1/chat', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { message, history = [] } = req.body;

    const myCandidates = CANDIDATES.filter(c => c.org_id === user.org_id);
    const totalCands = myCandidates.length;
    const activeJobs = JOBS.filter(j => j.org_id === user.org_id && j.is_active).length;
    
    // Provide a summary of the candidates
    const categories = myCandidates.reduce((acc, c) => {
      acc[c.category || 'POTENTIAL_MATCH'] = (acc[c.category || 'POTENTIAL_MATCH'] || 0) + 1;
      return acc;
    }, {});

    const systemInstruction = `You are a helpful, professional AI Recruitment Assistant for CalliQ ATS. 
You speak to the HR recruiter. 
Here is the current system context:
- Total Candidates: ${totalCands}
- Active Jobs: ${activeJobs}
- Candidate Categories: ${JSON.stringify(categories)}

Answer the user's questions clearly, concisely, and professionally. 
If they ask about candidate stats, use the provided context.`;

    const chat = ai.chats.create({
      model: 'gemini-3.7-flash',
      config: {
        systemInstruction,
      },
      history: history.map(m => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.text }]
      }))
    });

    const response = await chat.sendMessage({ message });
    res.json({ reply: response.text });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message.' });
  }
});
