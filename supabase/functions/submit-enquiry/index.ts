import { createClient } from "npm:@supabase/supabase-js@2";

// Only allow your website and local development.
const allowedOrigins = new Set([
  "https://techsatnexora.vercel.app",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);

const corsHeaders = (origin: string) => ({
  ...(allowedOrigins.has(origin)
    ? { "Access-Control-Allow-Origin": origin }
    : {}),
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
    },
  });
}

// Generate a one-way HMAC of the visitor's IP address.
async function hashIP(ip: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(ip),
  );

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";

  // Handle browser preflight requests.
  if (req.method === "OPTIONS") {
    if (!allowedOrigins.has(origin)) {
      return new Response("Origin not allowed", { status: 403 });
    }

    return new Response("ok", {
      headers: corsHeaders(origin),
    });
  }

  if (!allowedOrigins.has(origin)) {
    return jsonResponse({ error: "Origin not allowed" }, 403, origin);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }

  try {
    // Read secrets from the Supabase environment.
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
    const secretKeys = secretKeysRaw
      ? JSON.parse(secretKeysRaw)
      : null;

    // Legacy fallback for projects that have not migrated API keys.
    const serviceKey =
      secretKeys?.default ??
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const hashSecret = Deno.env.get("RATE_LIMIT_HASH_SECRET");
    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");

    if (!supabaseUrl || !serviceKey || !hashSecret || !turnstileSecret) {
      throw new Error("Server configuration is incomplete");
    }

    // Use only gateway-provided client IP headers.
    const ip = req.headers.get("cf-connecting-ip");

    if (!ip || ip.length > 64) {
      return jsonResponse(
        { error: "Unable to identify request source" },
        503,
        origin,
      );
    }

    // Create a server-side Supabase client.
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Hash IP before storing or using it as a database identifier.
    const ipHash = await hashIP(ip.trim(), hashSecret);

    // Check the limit: 3 submissions per 10-minute window.
    const { data: allowed, error: rateError } =
      await supabaseAdmin.rpc("consume_enquiry_rate_limit", {
        p_ip_hash: ipHash,
        p_limit: 3,
      });

    if (rateError) {
      console.error("Rate-limit check failed:", rateError);
      return jsonResponse(
        { error: "Unable to process enquiry right now" },
        503,
        origin,
      );
    }

    if (allowed !== true) {
      return jsonResponse(
        { error: "Too many enquiries. Please try again later." },
        429,
        origin,
      );
    }

    // Limit the request body size.
    const contentLength = Number(req.headers.get("content-length") ?? 0);

    if (contentLength > 6000) {
      return jsonResponse({ error: "Request too large" }, 413, origin);
    }

    const rawBody = await req.text();

    if (new TextEncoder().encode(rawBody).length > 6000) {
      return jsonResponse({ error: "Request too large" }, 413, origin);
    }

    const enquiry = JSON.parse(rawBody);

    const turnstileToken = typeof enquiry.turnstile_token === "string"
      ? enquiry.turnstile_token.trim()
      : "";

    if (!turnstileToken) {
      return jsonResponse(
        { error: "Please complete security verification." },
        400,
        origin,
      );
    }

    // Verify Cloudflare Turnstile token
    const verification = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          secret: turnstileSecret,
          response: turnstileToken,
          remoteip: ip.trim(),
        }),
      },
    );

    const verificationResult = await verification.json();

    if (!verification.ok || !verificationResult.success) {
      console.error(
        "Turnstile verification failed:",
        verificationResult["error-codes"] || [],
      );
      return jsonResponse(
        { error: "Security verification failed. Please try again." },
        403,
        origin,
      );
    }

    const name = typeof enquiry.name === "string"
      ? enquiry.name.trim()
      : "";

    const email = typeof enquiry.email === "string"
      ? enquiry.email.trim()
      : "";

    const service = typeof enquiry.service === "string"
      ? enquiry.service
      : "";

    const message = typeof enquiry.message === "string"
      ? enquiry.message.trim()
      : "";

    const allowedServices = [
      "Website Development",
      "UI/UX Design",
      "Web Applications",
      "Digital Solutions",
    ];

    // Validate all fields on the server.
    if (
      name.length < 2 ||
      name.length > 100 ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !allowedServices.includes(service) ||
      message.length < 5 ||
      message.length > 5000
    ) {
      return jsonResponse({ error: "Invalid enquiry details" }, 400, origin);
    }

    // Insert only the permitted fields.
    const { error: insertError } = await supabaseAdmin
      .from("enquiries")
      .insert([{ name, email, service, message }]);

    if (insertError) {
      console.error("Enquiry insert failed:", insertError);
      return jsonResponse(
        { error: "Unable to save enquiry" },
        500,
        origin,
      );
    }

    return jsonResponse(
      { message: "Enquiry submitted successfully" },
      201,
      origin,
    );

  } catch (error) {
    console.error("Function error:", error);

    return jsonResponse(
      { error: "Internal server error" },
      500,
      origin,
    );
  }
});
