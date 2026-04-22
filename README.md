# Guardian Angel 👼
> **Empowerment through discretion. A stealth-safety application for women.**

Guardian Angel is a mobile application designed to provide a safe space for women in high-risk environments. On the surface, it appears and functions as a fully operational, standard calculator. However, through a discreet authentication process, it unlocks a comprehensive safety suite.

---

## 📱 Features

### 1. The Stealth Mask (Calculator UI)
The app opens to a fully functional calculator. Only by entering a specific numerical code (e.g., `1234=`) does the hidden safety dashboard unlock.

### 2. Traffic Light Assessment 🚦
A real-time behavioral indicator system that helps users evaluate their current situation. 
* **Green:** Low risk, focus on empowerment.
* **Yellow:** Warning signs detected, preparation mode.
* **Red:** High risk, immediate access to emergency protocols.
* *Technical Note:* Implements a **Reverse Scoring Logic** to translate behavioral indicators into actionable risk levels.

### 3. Exit Fund Vault 💰
A secure, encrypted digital wallet designed to help users manage their financial independence discreetly, away from monitoring eyes.

### 4. Shake-to-Hide (The Discretion Engine) 🪄
Security is most effective when it’s instinctive. In high-pressure situations, searching for a "close" button isn't always possible.

![Shake to Hide Demo](./assets/shake-demo.gif)

**How it works:**
* **Instant Trigger:** Utilizing the device's **Accelerometer** via `expo-sensors`, the app detects rapid, specific movement.
* **Seamless Transition:** Once a shake is detected, the UI instantly resets to the calculator's "safe state," hiding all sensitive data in milliseconds.
* **Privacy First:** No camera or microphone permissions are required, maintaining the app's stealth profile and protecting user trust.

### 🏥 Resource & Shelter Directory
A minimalist, English-interfaced directory providing access to critical Hebrew-language resources.
* **Internationalized UI:** All controls and navigation are in English for a professional, clean look.
* **Minimalist Dashboard:** Emergency triggers (Police, 118) are icon-based only, removing identifying text for enhanced stealth.
* **Dual-Action Header:** Features a "Back to App" navigation and an "Emergency Exit" panic button.
---

## 🛠 Tech Stack

* **Framework:** React Native with Expo (Managed Workflow).
* **Language:** TypeScript for robust, type-safe code.
* **Sensors:** `expo-sensors` (Accelerometer) for gesture detection.
* **Security:** `expo-secure-store` for encrypted data persistence.
* **Navigation:** React Navigation (Stack & Tab navigation).

---

## 🚀 Future Roadmap (WIP)

- [x] Core Stealth Calculator UI.
- [x] Traffic Light Assessment Logic.
- [x] Shake-to-Hide Integration.
- [x] Emergency Contact Quick-Dial (Stealth mode).
- [wip] **UI/UX Refinement:** Polishing the stealth-aesthetic and visual identity to ensure a professional, seamless, and intuitive user experience.
---
