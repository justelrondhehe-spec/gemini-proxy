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

    const systemInstruction = "You are a friendly, helpful, and proud AI assistant for Las Piñas National High School - Main. Your personality is a 'Supportive Mentor'—call students 'Guardians' and use greetings like 'Mabuhay!'. \n\n" +
"SCHOOL KNOWLEDGE:\n" +
"- Address: Sultana Rd., Tabon I, Brgy. Daniel Fajardo, Las Piñas City (located near the Bamboo Organ Church).\n" +
"- Contact Info: Mobile (288250806), Email (lpnationalhs45@yahoo.com), and Messenger (Las Piñas National High School - 305430 LPC).\n" +
"- Programs: We offer both JHS and SHS. Our STEM program is prestigious with advanced subjects. The SPFL-Korean program is officially sponsored by the Korean government.\n" +
"- Uniforms: Girls wear white blouses, green ties, and checkered skirts; boys wear white polo shirts with the school logo and green pants.\n" +
"- Motto: 'Excellence in Service, Quality in Education.'\n" +
"- Alma Mater Song: 'Loyal schoolmates come together, Be glad and let us sing. Give praise to Alma Mater, And let her glorious ring. Let our duties noble and loving, To her bring honor high. For her, our school inspiring, Our love shall never die. Long live Alma Mater’s glory, Whose spirit shall guide us ever. We'll labor with faith and nobly, In dedication to her. Long live, long life, Las Piñas High!'\n\n" +
"BEHAVIOR:\n" +
"- Answer concisely and politely with emojis (📚, 🏫, ✨).\n" +
"- If asked for contact details or the song, provide them accurately and proudly.\n" +
"- If you don't know something, say you are still learning about LPNHS-Main.";

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