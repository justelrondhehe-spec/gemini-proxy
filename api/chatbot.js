export default async function handler(req, res) {

    // =========================================================
    // 1. CORS SETUP
    //    Allows the frontend (any origin) to call this endpoint.
    // =========================================================
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // =========================================================
    // 2. READ REQUEST BODY
    //
    //    NEW: We now accept a 'history' array alongside 'message'.
    //    The frontend must send:
    //      {
    //        message: "the user's latest message",
    //        history: [
    //          { role: "user",  text: "previous user message" },
    //          { role: "model", text: "previous bot reply"    },
    //          ...
    //        ]
    //      }
    //    If 'history' is missing (e.g. very first message), it
    //    defaults to an empty array — fully backwards compatible.
    // =========================================================
    const { message, history = [] } = req.body;

    // =========================================================
    // 3. API KEY CHECK
    // =========================================================
    const apiKey = (process.env.GEMINI_API_KEY || "").trim();

    if (!apiKey) {
        return res.status(500).json({ reply: "Error: API Key is missing in Vercel." });
    }

    // =========================================================
    // 4. SYSTEM INSTRUCTION
    //    Contains all school knowledge and bot behavior rules.
    // =========================================================
    const systemInstruction =
        "You are a friendly, helpful, and proud AI assistant for Las Piñas National High School - Main. " +
        "Your personality is a 'Supportive Mentor'—call students 'Guardians' and use greetings like 'Mabuhay!'. \n\n" +

        "SCHOOL KNOWLEDGE:\n" +

        // --- Address & Contact ---
        "- Address: Sultana Rd., Tabon I, Brgy. Daniel Fajardo, Las Piñas City (located near the Bamboo Organ Church).\n" +
        "- Contact Info: Mobile (288250806), Email (lpnationalhs45@yahoo.com), and Messenger (Las Piñas National High School - 305430 LPC).\n" +

        // --- Leadership ---
        "- Principal: The current principal is Mr. Ignacio L. Son Jr., who has been leading LPNHS-Main since 2018.\n" +

        // --- Programs ---
        "- Programs: We offer both Junior High School (JHS) and Senior High School (SHS). " +
        "Our STEM program is prestigious with advanced subjects. " +
        "The SPFL-Korean program is officially sponsored by the Korean government.\n" +

        // --- Uniforms ---
        "- Uniforms: Student uniforms vary depending on the program:\n" +
        "  * REGULAR PROGRAM (JHS):\n" +
        "    - Male: White polo shirt with the school logo and black pants.\n" +
        "    - Female: White blouse with a ribbon-style string tie and a light green checkered skirt.\n" +
        "  * STEM PROGRAM (JHS):\n" +
        "    - Male: Greenish-colored polo shirt and dark green pants.\n" +
        "    - Female: Greenish blouse with a green tie and a dark green checkered skirt.\n" +
        "  * SPFL-KOREAN PROGRAM (JHS):\n" +
        "    - Male: White short-sleeved shirt with brown checkered trim, paired with matching plaid trousers.\n" +
        "    - Female: White short-sleeved shirt with brown checkered trim, paired with a matching plaid pleated midi-length skirt.\n" +
        "  * SENIOR HIGH SCHOOL (SHS — all strands):\n" +
        "    - Male: Yellowish polo shirt and dark blue pants.\n" +
        "    - Female: Yellowish blouse and dark blue pants.\n" +

        // --- Motto & Alma Mater ---
        "- Motto: 'Excellence in Service, Quality in Education.'\n" +
        "- Alma Mater Song: 'Loyal schoolmates come together, Be glad and let us sing. " +
        "Give praise to Alma Mater, And let her glorious ring. " +
        "Let our duties noble and loving, To her bring honor high. " +
        "For her, our school inspiring, Our love shall never die. " +
        "Long live Alma Mater's glory, Whose spirit shall guide us ever. " +
        "We'll labor with faith and nobly, In dedication to her. " +
        "Long live, long life, Las Piñas High!'\n\n" +

        "BEHAVIOR:\n" +
        // --- Core rule: always answer proactively, never stall with questions ---
        "- CRITICAL: Never respond with ONLY a clarifying question. Always provide a complete answer immediately based on all available context.\n" +
        "- If the user asks about uniforms without specifying a program or gender, list ALL uniforms for ALL programs (Regular JHS, STEM JHS, SPFL-Korean JHS, SHS) for both male and female in one full response.\n" +
        "- If a program is given but not a gender, immediately give BOTH the male and female uniforms for that program.\n" +
        "- If a gender is given but not a program, immediately list that gender's uniform across ALL programs.\n" +
        "- If both program and gender are given, provide that exact uniform.\n" +
        // --- Conversation memory: use history to resolve short follow-up messages ---
        "- You are given the full conversation history. Always read ALL previous turns before responding. " +
        "If the user's latest message is a short follow-up (e.g. 'STEM JHS', 'male', 'the male students', 'Regular JHS'), " +
        "combine it with the chat history to give the full, complete answer right away. " +
        "Do NOT ask for clarification again if context is already established in prior messages.\n" +
        "- Answer concisely and politely with emojis (📚, 🏫, ✨).\n" +
        "- If asked for contact details or the song, provide them accurately and proudly.\n" +
        "- If you don't know something, say you are still learning about LPNHS-Main.";

    // =========================================================
    // 5. BUILD THE MULTI-TURN 'contents' ARRAY
    //
    //    The Gemini API expects this shape:
    //    [
    //      { role: "user",  parts: [{ text: "..." }] },
    //      { role: "model", parts: [{ text: "..." }] },
    //      { role: "user",  parts: [{ text: "..." }] },  ← latest
    //    ]
    //
    //    We attach the system instruction to the very first user
    //    turn so the bot always has the full school knowledge,
    //    regardless of how deep into a conversation we are.
    // =========================================================
    const contents = [];

    history.forEach((turn, index) => {
        contents.push({
            role: turn.role,   // "user" or "model"
            parts: [{
                // Prepend system instruction only to the very first user turn
                text: (index === 0 && turn.role === 'user')
                    ? `${systemInstruction}\n\nUser: ${turn.text}`
                    : turn.text
            }]
        });
    });

    // Append the current (newest) user message
    contents.push({
        role: 'user',
        parts: [{
            // If this is the very first message (no history), attach system instruction here
            text: contents.length === 0
                ? `${systemInstruction}\n\nUser: ${message}`
                : message
        }]
    });

    // =========================================================
    // 6. CALL GEMINI API & RETURN REPLY
    // =========================================================
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Send the full multi-turn contents array
                body: JSON.stringify({ contents })
            }
        );

        const data = await response.json();

        // Catch errors returned by Google's API (e.g. invalid key, quota exceeded)
        if (data.error) {
            console.error("Google rejected the request:", data.error.message);
            return res.status(500).json({ reply: `Google Error: ${data.error.message}` });
        }

        // Extract and return the bot's reply text
        const reply = data.candidates[0].content.parts[0].text;
        res.status(200).json({ reply });

    } catch (error) {
        console.error("Backend crash:", error);
        res.status(500).json({ reply: "Sorry, the backend code crashed. Check Vercel logs." });
    }
}