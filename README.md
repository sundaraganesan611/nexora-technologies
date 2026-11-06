# Nexora Technologies

Modern, responsive corporate website and digital solutions portal for **Nexora Technologies**.

* **Live Website**: [https://techsatnexora.vercel.app](https://techsatnexora.vercel.app)
* **Hosting Platform**: Vercel
* **Database & Backend**: Supabase (PostgreSQL + Edge Functions)
* **Bot Protection**: Cloudflare Turnstile & Honeypot field

---

## 🛠 Tech Stack

* **Frontend**: HTML5, Modern CSS3, JavaScript (ES Modules)
* **Backend Runtime**: Supabase Edge Functions (Deno / TypeScript)
* **Database**: PostgreSQL (Supabase) with Row Level Security (RLS)
* **Authentication**: Supabase Auth (Admin Dashboard)
* **Security & Anti-Abuse**: Cloudflare Turnstile, HMAC-SHA256 IP Rate Limiting, Honeypot protection, CSV injection prevention

---

## 🛡 Security Architecture

The contact form implements a multi-layer defense-in-depth model:

```
[ Visitor Submits Form ]
           │
           ▼
[ Layer 1: Client Honeypot ] ──(Filled?)──> [ Drop / Silent Error ]
           │
           ▼
[ Layer 2: Cloudflare Turnstile Widget ] ──(Unverified?)──> [ Block Submission ]
           │
           ▼
[ Layer 3: Supabase Edge Function ]
   ├─ CORS Origin Check (techsatnexora.vercel.app, localhost:5500)
   ├─ HMAC-SHA256 IP Rate Limiter (Max 3 submissions per 10 mins)
   ├─ Cloudflare Siteverify API (Server-side token verification)
   └─ Strict Schema & Service Whitelist Validation
           │
           ▼
[ Layer 4: PostgreSQL Database ] (Inserted via Service Role)
```

### Key Security Features
1. **Honeypot Trap**: Invisible field `#website` traps automated web crawlers.
2. **Server-Side Turnstile Verification**: Verifies tokens directly with Cloudflare's `siteverify` endpoint before database operations.
3. **Atomic Database Rate Limiting**: An internal function `private.enquiry_rate_limits` tracks HMAC-hashed client IPs, dropping spammers with HTTP 429.
4. **Admin Row Level Security (RLS)**: Public anon users cannot read or modify enquiries; only authenticated administrators have access.
5. **CSV Formula Injection Sanitization**: All exported customer data in `admin.js` is sanitized against DDE/formula injection attacks (`=`, `+`, `-`, `@`).

---

## 📁 Project Structure

```text
nexora-technologies/
├── .env.example             # Template for required environment secrets
├── .gitignore               # Excludes secrets, temporary files, and caches
├── admin.html               # Secure administrative dashboard portal
├── admin.js                 # Admin dashboard logic, Auth, and CSV export
├── config.js                # Public configuration (Supabase URL, anon key, Turnstile key)
├── index.html               # Main landing page with contact form
├── script.js                # Frontend form handling, Turnstile, and navigation
├── style.css                # Global stylesheet and responsive design
└── supabase/
    ├── config.toml          # Supabase Edge Function configuration
    └── functions/
        └── submit-enquiry/  # Edge Function source (TypeScript)
            ├── deno.json
            ├── index.ts
            └── .npmrc
```

---

## 💻 Local Development

1. **Serve locally** on port `5500` (allowed by the Edge Function CORS policy):
   ```powershell
   python -m http.server 5500
   ```
   *Or right-click `index.html` in VS Code and select **Open with Live Server**.*

2. **Open in browser**:
   ```
   http://localhost:5500
   ```

---

## 🚀 Deployment

### Frontend (Vercel)
Pushes to the `main` branch automatically trigger continuous deployment on Vercel.

### Backend Edge Functions (Supabase)
Deploy updates to the contact form Edge Function:
```powershell
npx supabase functions deploy submit-enquiry
```

Set required production secrets:
```powershell
npx supabase secrets set TURNSTILE_SECRET_KEY=your_secret_here
npx supabase secrets set RATE_LIMIT_HASH_SECRET=your_secret_here
```
