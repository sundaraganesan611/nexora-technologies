
export default async function handler(req, res) {
    // Allow POST requests only
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        const {
            name,
            email,
            service,
            message,
            turnstile_token
        } = req.body || {};

        // Validate form data
        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof service !== "string" ||
            typeof message !== "string" ||
            !name.trim() ||
            !email.trim() ||
            !service.trim() ||
            !message.trim() ||
            name.length > 100 ||
            email.length > 254 ||
            message.length > 5000 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            return res.status(400).json({
                error: "Invalid form details."
            });
        }

        if (
            typeof turnstile_token !== "string" ||
            !turnstile_token
        ) {
            return res.status(400).json({
                error: "Please complete security verification."
            });
        }

        // Verify Turnstile with Cloudflare
        const secret = process.env.TURNSTILE_SECRET_KEY;

        if (!secret) {
            throw new Error("Turnstile secret is not configured.");
        }

        const verification = await fetch(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    secret,
                    response: turnstile_token
                })
            }
        );

        const verificationResult = await verification.json();

        if (!verification.ok || !verificationResult.success) {
            console.error(
                "Turnstile verification failed:",
                verificationResult["error-codes"] || []
            
            );
            
            return res.status(403).json({
                error: "Security verification failed. Please try again."
            });
        }

        // Insert verified enquiry into Supabase
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error("Supabase server configuration is missing.");
        }

        const databaseResponse = await fetch(
            `${supabaseUrl}/rest/v1/enquiries`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": supabaseKey,
                    "Authorization": `Bearer ${supabaseKey}`,
                    "Prefer": "return=minimal"
                },
                body: JSON.stringify({
                    name: name.trim(),
                    email: email.trim(),
                    service: service.trim(),
                    message: message.trim()
                })
            }
        );

        if (!databaseResponse.ok) {
            const errorText = await databaseResponse.text();
            console.error("Supabase error:", errorText);

            throw new Error("Database submission failed.");
        }

        return res.status(200).json({
            success: true,
            message: "Enquiry submitted successfully."
        });

    } catch (error) {
        console.error("API error:", error);

        return res.status(500).json({
            error: "Unable to submit enquiry. Please try again."
        });
    }
}
