export default async function handler(req, res) {
    // 1. Setup CORS so your GitHub Pages frontend is allowed to talk to this Vercel backend
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests from the browser
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 2. Grab the user's message sent from your frontend chat window
    const { message } = req.body;
    
    // 3. Get the secret API key from Vercel's environment variables (We will set this up next!)
    const apiKey = process.env.GEMINI_API_KEY;

    // 4. SYSTEM INSTRUCTIONS: Tell the AI who it is
    const systemInstruction = "You are a friendly, helpful, and proud AI assistant for Las Piñas National High School - Main, located in Las Piñas City near the Bamboo Organ Church. Answer questions concisely and politely. If you don't know the answer to a specific school question, just say you are still learning about LPNHS.";

    try {
        // 5. Send the prompt to Google Gemini
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `${systemInstruction}\n\nUser: ${message}` }]
                }]
            })
        });

        const data = await response.json();
        
        // 6. Extract the AI's reply and send it back to your frontend
        const reply = data.candidates[0].content.parts[0].text;
        res.status(200).json({ reply: reply });

    } catch (error) {
        console.error(error);
        res.status(500).json({ reply: "Sorry, the backend is having trouble connecting to Gemini." });
    }
}