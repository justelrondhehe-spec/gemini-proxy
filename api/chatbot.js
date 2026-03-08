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
    //    Accepts the current message + full conversation history.
    //    Frontend must send:
    //      {
    //        message: "the user's latest message",
    //        history: [
    //          { role: "user",      text: "previous user message" },
    //          { role: "assistant", text: "previous bot reply"    },
    //          ...
    //        ]
    //      }
    //    NOTE: Groq uses "assistant" (not "model") for bot turns.
    //    The frontend still sends role: "model" (Gemini convention)
    //    so we remap it to "assistant" when building the messages.
    // =========================================================
    const { message, history = [] } = req.body;

    // =========================================================
    // 3. API KEY CHECK
    //    Add your Groq API key to Vercel as GROQ_API_KEY.
    //    Get your free key at: https://console.groq.com
    // =========================================================
    const apiKey = (process.env.GROQ_API_KEY || "").trim();

    if (!apiKey) {
        return res.status(500).json({ reply: "Error: GROQ_API_KEY is missing in Vercel environment variables." });
    }

    // =========================================================
    // 4. SYSTEM INSTRUCTION
    //    Contains all school knowledge and bot behavior rules.
    //    This is passed as a "system" role message to Groq —
    //    the cleanest way to give the bot its personality and
    //    knowledge without polluting the conversation history.
    // =========================================================
    const systemInstruction =
        "You are a warm, enthusiastic, and proud AI assistant for Las Piñas National High School - Main. " +
        "Your personality is like a caring, approachable older schoolmate — someone who is genuinely happy to help and makes every student feel welcome. " +
        "Always greet with 'Mabuhay!' and call students 'Guardians'. " +
        "Be conversational, warm, and encouraging — never cold, robotic, or overly formal. " +
        "Show genuine pride and love for LPNHS-Main in every response. " +
        "Use a natural, friendly tone as if you are chatting with a friend, not writing a report. \n\n" +

        "SCHOOL KNOWLEDGE:\n" +

        // --- Address & Contact ---
        "- Address: Sultana Rd., Tabon I, Brgy. Daniel Fajardo, Las Piñas City (located near the Bamboo Organ Church).\n" +
        "- Contact Info: Mobile (288250806), Email (lpnationalhs45@yahoo.com), and Messenger (Las Piñas National High School - 305430 LPC).\n" +

        // --- History ---
        "- History: Las Piñas National High School - Main was founded in 1966, making it one of the pioneering public high schools in Las Piñas City.\n" +

        // --- Leadership ---
        "- Principal: The current principal is Mr. Ignacio L. Son Jr., who has been leading LPNHS-Main since 2018.\n" +

        // --- Programs ---
        "- Programs: We offer both Junior High School (JHS) and Senior High School (SHS). " +
        "JHS programs include Regular, STEM, and SPFL-Korean (sponsored by the Korean government). " +
        "SHS offers three strands: STEM (Science, Technology, Engineering, and Mathematics), " +
        "ABM (Accountancy, Business, and Management), and TVL (Technical-Vocational-Livelihood).\n" +

        // --- JHS Subjects ---
        "- JHS Core Subjects (all strands): All JHS students — regardless of program — study the following core subjects: " +
        "Mathematics, Science, Filipino, Araling Panlipunan (AP), English, Edukasyon sa Pagpapakatao (ESP), MAPEH (Music, Arts, Physical Education, and Health), and TLE (Technology and Livelihood Education).\n" +

        "- STEM JHS Additional Subjects by grade level:\n" +
        "  * Grade 7: Advance Algebra, Research 1, Developmental Reading.\n" +
        "  * Grade 8: RRW (Reading and Writing), Research 2, Statistics.\n" +
        "  * Grade 9: Research 3, Advance Geometry, Advanced Chemistry.\n" +
        "  * Grade 10: Research 4, Advanced Physics, Trigonometry and Calculus.\n" +

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
        "  * SENIOR HIGH SCHOOL (SHS):\n" +
        "    Strands offered: STEM, ABM, and TVL.\n" +
        "    - Male: Yellowish polo shirt and dark blue pants.\n" +
        "    - Female: Yellowish blouse and dark blue pants.\n" +

        // --- Chatbot Creator ---
        "- Chatbot Creator: This chatbot was created by Ryan Kristoffer A. Suganob, a 3rd year Bachelor of Science in Computer Science (BSCS) student at Technological University of the Philippines - Manila (TUP-Manila). " +
        "Ryan is a proud alumnus of LPNHS-Main. He enrolled in 2017 under the JHS STEM program, continued in 2021 under the SHS STEM strand, and graduated in 2023.\n" +

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
        "- CRITICAL: Never respond with ONLY a clarifying question. Always provide a complete answer immediately.\n" +
        "- If the user asks about uniforms without specifying a program or gender, list ALL uniforms for ALL programs for both male and female in one full response.\n" +
        "- If a program is given but not a gender, immediately give BOTH the male and female uniforms for that program.\n" +
        "- If a gender is given but not a program, immediately list that gender's uniform across ALL programs.\n" +
        "- You are given the full conversation history. Always read ALL previous turns before responding. " +
        "If the user's latest message is a short follow-up (e.g. 'STEM JHS', 'male', 'Regular JHS'), " +
        "combine it with the chat history to give the full answer right away. " +
        "Do NOT ask for clarification again if context is already established in prior messages.\n" +
        "- Always respond in a warm, cheerful, and encouraging tone. Never sound robotic or cold.\n" +
        "- Use emojis naturally to express warmth (📚, 🏫, ✨, 😊, 🎉) — but don't overdo it.\n" +
        "- Start responses with an enthusiastic greeting like 'Mabuhay, Guardian!' or 'Hi there, Guardian!' when appropriate.\n" +
        "- Show excitement and pride when talking about the school, its programs, and its students.\n" +
        "- If a student seems confused or is asking for help, be extra patient and encouraging.\n" +
        "- If asked for contact details or the alma mater song, provide them accurately and proudly.\n" +
        "- If you don't know something, say warmly that you are still learning about LPNHS-Main and encourage them to contact the school directly.";

    // =========================================================
    // 5. BUILD THE MESSAGES ARRAY FOR GROQ
    //
    //    Groq uses the OpenAI chat format:
    //    [
    //      { role: "system",    content: "<system instruction>" },
    //      { role: "user",      content: "<user message>" },
    //      { role: "assistant", content: "<bot reply>" },
    //      { role: "user",      content: "<latest message>" },
    //    ]
    //
    //    The system instruction goes in its own dedicated
    //    "system" message — much cleaner than Gemini's approach
    //    of stuffing it into the first user turn.
    // =========================================================
    const messages = [
        // System instruction always comes first
        { role: "system", content: systemInstruction }
    ];

    // Map conversation history into Groq's format.
    // Remap "model" (Gemini convention) → "assistant" (OpenAI/Groq convention).
    history.forEach((turn) => {
        messages.push({
            role: turn.role === "model" ? "assistant" : turn.role,
            content: turn.text
        });
    });

    // Append the current user message
    messages.push({ role: "user", content: message });

    // =========================================================
    // 6. PER-USER RATE LIMITING
    //
    //    Tracks how many requests each user (identified by IP)
    //    has made within the current 60-second window.
    //    Limit: 5 messages per minute per user.
    //
    //    We use a simple in-memory Map on the Vercel serverless
    //    function. Each entry stores:
    //      { count: number, windowStart: timestamp }
    //
    //    When a user hits the limit, we return the number of
    //    seconds remaining so the frontend can show a countdown.
    // =========================================================

    const RATE_LIMIT = 5;           // Max messages per window
    const WINDOW_MS  = 60 * 1000;   // 60-second window

    // In-memory store — persists across requests within the same
    // serverless function instance (resets on cold start, which
    // is fine for our use case).
    if (!global.rateLimitStore) {
        global.rateLimitStore = new Map();
    }

    // Identify the user by their IP address
    const userIP = req.headers['x-forwarded-for']?.split(',')[0].trim()
                   || req.socket?.remoteAddress
                   || 'unknown';

    const now        = Date.now();
    const userRecord = global.rateLimitStore.get(userIP);

    if (userRecord && (now - userRecord.windowStart) < WINDOW_MS) {
        // Still within the current window
        if (userRecord.count >= RATE_LIMIT) {
            // User has hit the limit — calculate seconds remaining
            const secondsLeft = Math.ceil((WINDOW_MS - (now - userRecord.windowStart)) / 1000);
            return res.status(429).json({
                reply:      null,
                rateLimited: true,
                secondsLeft  // Frontend uses this to show the countdown
            });
        }
        // Still under the limit — increment count
        userRecord.count++;
    } else {
        // New window — reset the counter for this user
        global.rateLimitStore.set(userIP, { count: 1, windowStart: now });
    }

    // =========================================================
    // 7. CALL GROQ API WITH RETRY LOGIC
    //
    //    Groq's free tier is generous but can still return 429s
    //    during traffic spikes. We retry up to 3 times with a
    //    5-second wait between attempts before giving up.
    // =========================================================

    const MAX_RETRIES = 3;       // Maximum retry attempts
    const RETRY_DELAY_MS = 5000; // 5 seconds between retries

    // Helper: pause for a given number of milliseconds
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Helper: perform a single Groq API call and return parsed JSON
    const callGroq = async () => {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // Groq uses Bearer token authentication
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile", // Best free Groq model — fast and highly capable
                messages,
                max_tokens: 1024,
                temperature: 0.7  // Slightly creative but still accurate
            })
        });
        return response.json();
    };

    // Retry loop
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const data = await callGroq();

            // Check for API-level errors (e.g. rate limit, bad key)
            if (data.error) {
                const isRateLimit = data.error.type === "rate_limit_exceeded" ||
                                    (data.error.code && data.error.code === 429);

                if (isRateLimit && attempt < MAX_RETRIES) {
                    console.warn(`[LPNHS Chat] Groq rate limit hit. Retry ${attempt}/${MAX_RETRIES} in ${RETRY_DELAY_MS}ms...`);
                    await wait(RETRY_DELAY_MS);
                    continue;
                }

                console.error("Groq API error:", data.error.message);
                return res.status(500).json({
                    reply: isRateLimit
                        ? "⚠️ The chatbot is currently busy due to high traffic. Please wait a moment and try again!"
                        : `API Error: ${data.error.message}`
                });
            }

            // Success — extract the assistant's reply from Groq's response shape
            const reply = data.choices[0].message.content;
            return res.status(200).json({ reply });

        } catch (error) {
            // Network-level crash
            if (attempt < MAX_RETRIES) {
                console.warn(`[LPNHS Chat] Network error on attempt ${attempt}. Retrying...`);
                await wait(RETRY_DELAY_MS);
            } else {
                console.error("Backend crash after all retries:", error);
                return res.status(500).json({
                    reply: "⚠️ Sorry, I'm having trouble connecting right now. Please try again in a moment!"
                });
            }
        }
    }
}
