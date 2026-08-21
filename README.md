# Guardian Angel 👼
> **Empowerment through discretion. A stealth-safety platform for women.**

Guardian Angel is a covert, cross-platform safety web app (PWA) and native mobile application designed to provide an invisible lifeline for women in high-risk environments and abusive relationships. On the surface, it functions as an everyday, fully operational calculator with a stealth mask. Behind a secret 4-digit PIN, it unlocks a comprehensive, clinically validated safety suite operating with **Zero Digital Footprint**.

---

## 📱 Features & System Architecture

### 1. Stealth & Security (The Disguise Engine) 🧮
* **Calculator Mask:** The app opens as a fully functional calculator with a black iOS-style keypad and real mathematical logic. The navigation bar is hidden, and the layout remains strictly Left-to-Right (LTR) across all languages to preserve the disguise.
* **Hidden Registration & PIN Auth:** First-time users trigger the sign-up flow with a long-press (~1.2s) on the display — not a typeable digit sequence, since something like `1234=` is the first thing anyone probing a calculator would try. Registered users enter their custom 4-digit PIN followed by `=` to unlock the dashboard.
* **Silent Failure on Wrong PIN:** Entering an incorrect PIN simply resets the calculator display to `0` without showing error messages, protecting users under surveillance.
* **Session Locking:** Returning to the calculator (via the quick exit button `✕` or physical shake) calls `lockSecureSession()`, rendering sensitive data inaccessible until re-authenticated.
* **Shake-to-Reset (Native):** Utilizing device accelerometer sensors (`expo-sensors`), a quick physical shake immediately resets the UI back to the calculator mask.
* **Encrypted Storage:** Native devices utilize `expo-secure-store` (Keychain/Keystore) for credentials, tokens, and risk levels, with fallbacks for web `localStorage`.

### 2. Clinical Risk Assessment & Continuous Support 🚦
* **I-Risk Assessment Questionnaire:** A 13-question screening tool based on the clinical I-Risk model:
  * **10 Main Questions:** Evaluate relationship control, isolation, and financial monitoring (scored 0–3, max 30).
  * **3 Critical Questions:** Focus on violence escalation, choking/weapons, and death threats.
  * **Zero-Tolerance Rule:** Any positive answer to a critical question automatically forces a **Red Status**.
* **Traffic Light Guidance System:**
  * **Green (≤ 7):** Low risk — focus on personal empowerment.
  * **Yellow (8–18):** Warning signs — preparation mode.
  * **Red (≥ 19):** High risk — emergency protocols activated.
* **Daily Mood Check-in & Safety Pipeline:** Color-coded check-ins track emotional trends over time. If enabled, 4 days of user inactivity triggers a quiet reminder notification. After 6 additional hours without a response, an automated SMS containing an optional Google Maps GPS location link is dispatched to primary trusted contacts.

### 3. AI Evidence Locker & Forensic Documentation 🔐
* **AI Vision Auto-Description:** When attaching a photo to a journal entry, integrated **Vision AI** automatically analyzes the image and generates a detailed, objective text description of the scene—reducing emotional strain and trauma during crisis moments.
* **Multimodal Attachments:** Supports text descriptions, photo attachments (camera/gallery), and voice recordings.
* **SHA-256 Hash Chain:** Each journal entry is cryptographically linked to the previous one via SHA-256 hashes. Editing or tampering with past entries invalidates the chain, ensuring forensic integrity for legal proceedings.
* **Forensic PDF Export:** Generates a print-ready evidence report complete with all media references and hash chain verification metadata.
* **Tamper-Evident Controls:** Supports individual entry deletion and bulk clearing with confirmation workflows.

### 4. Crisis Action, Panic Triggers & Resources 🆘
* **One-Tap Emergency Dialing:** Icon-only panic triggers for Emergency Services (**Police 100**) and Social Welfare (**118**) without identifying labels.
* **Shelters Directory:** A searchable directory of regional and national Hebrew-language shelters with direct `tel:` dialing.
* **Panic SMS Trigger:** Configurable emergency SMS workflow supporting custom SOS messaging and one-tap sending to up to 2 saved trusted contacts.

### 5. Exit Fund Vault 💰
* **Financial Independence Vault:** A simulated secure savings vault in ILS (₪) allowing users to track progress toward escape goals (presets: 1,000 / 5,000 / 10,000 / 50,000 ₪).
* **Round-Up Savings Simulation:** Simulates daily spare-change round-ups from mock purchases.
* **Emergency Protocol (Red Status):** Auto-transfers funds from main accounts to the emergency exit vault until safety goals are met or funds run out. Includes a **"Safe Now"** toggle to downgrade status.

---

## 🌐 Localization & Accessibility

* **Trilingual Support:** Full UI internationalization via `i18next` supporting **English, Hebrew, and Arabic**.
* **Dynamic RTL / LTR Handling:**
  * Hebrew and Arabic dynamically enforce Right-to-Left (RTL) text alignment and UI direction.
  * The **Calculator Disguise remains LTR intentionally** across all locales to maintain uniform appearance.

---

## 🛠 Tech Stack & Infrastructure

* **Frontend Framework:** React Native with Expo SDK 54 (Managed Workflow), Expo Router (file-based navigation), React 19, and TypeScript.
* **Deployment Platforms:** Cross-platform iOS, Android, and Progressive Web App (PWA) deployed as a static export to **Cloudflare Pages**.
* **Serverless Backend (Cloudflare Ecosystem):**
  * **Cloudflare Workers:** Serverless API endpoints handling JWT authentication, password hashing with server-side salt, and route protection.
  * **Cloudflare D1:** Relational SQL database storing user credentials, hashed codes, and application logs.
  * **Cloudflare R2:** S3-compatible object storage for secure off-device image and media persistence.

| Data Type | Native Storage | Web Storage |
| :--- | :--- | :--- |
| **Auth Credentials & PIN** | `SecureStore` (Encrypted) | `localStorage` |
| **Risk Status & Exit Fund** | `SecureStore` | `SecureStore` Shim |
| **Evidence Journal & Hashes** | `AsyncStorage` | `localStorage` |
| **Mood Check-ins & Settings** | `AsyncStorage` | `AsyncStorage` |

---

## 🎓 Academic & Clinical Collaboration

Developed as an academic capstone project in collaboration with leading clinical, legal, and social work experts:
* **Dr. Uri Globus** — Mentor & Academic Advisor
* **Dana Savoray** — Human Rights Attorney
* **Juman Akhbaria** — Clinical Psychologist
* **Ghada Jehleb** — Senior Social Worker

**Project Authors:** Hadeel Mahamid & Nour Guty (Project Number:15005527 )



