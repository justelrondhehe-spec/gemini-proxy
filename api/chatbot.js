export default async function handler(req, res) {
    // 1. Setup CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { message } = req.body;
    
    // 2. Grab the API key and explicitly remove any invisible spaces!
    const apiKey = (process.env.GEMINI_API_KEY || "").trim();

    if (!apiKey) {
        return res.status(500).json({ reply: "Error: API Key is missing in Vercel." });
    }

    const systemInstruction = "You are a friendly, helpful, and proud AI assistant for Las Piñas National High School - Main, located in Las Piñas City near the Bamboo Organ Church. Answer questions concisely and politely. If you don't know the answer to a specific school question, just say you are still learning about LPNHS.";

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `${systemInstruction}\n\nUser: ${message}` }]
                }]
            })
        });

        const data = await response.json();
        
        // 3. Catch Google's specific error if it rejects us
        if (data.error) {
             console.error("Google rejected the request:", data.error.message);
             return res.status(500).json({ reply: `Google Error: ${data.error.message}` });
        }

        // 4. Send the successful reply
        const reply = data.candidates[0].content.parts[0].text;
        res.status(200).json({ reply: reply });

    } catch (error) {
        console.error("Backend crash:", error);
        res.status(500).json({ reply: "Sorry, the backend code crashed. Check Vercel logs." });
    }
}