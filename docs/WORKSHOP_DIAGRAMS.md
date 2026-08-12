# Guardian Angel — Workshop Diagrams (ERD & Class Diagram)

**Project:** Stealth safety mobile app (React Native / Expo) + Cloudflare Pages Functions (D1, R2).

**Notation:** The codebase uses **TypeScript interfaces and functional modules** (no ES6 `class` declarations). Diagrams model exported **types as entities** and **modules as «service» / «screen» / «handler»** components — standard for documenting TypeScript/React systems.

**How to view:** Paste any fenced `mermaid` block into [Mermaid Live Editor](https://mermaid.live) or open this file in VS Code / GitHub.

**PNG exports:** [`docs/diagrams/workshop/`](diagrams/workshop/) — regenerate with `npm run docs:workshop-png` (also `npm run docs:erd-png` for the shorter ERD set).

---

## Part A — Entity Relationship Diagram (persistent data)

### A1. Cloudflare D1 (authoritative SQL)

Maps to: `cloudflare/migrations/0001_init.sql`, `functions/api/auth/*`.

```mermaid
erDiagram
    users ||--o{ journal : "owns 1:N"

    users {
        int id PK "AUTOINCREMENT"
        text username UK "NOT NULL"
        text password_hash "SHA-256(PASSWORD_SALT:password)"
        text created_at "DEFAULT CURRENT_TIMESTAMP"
    }

    journal {
        int id PK "AUTOINCREMENT"
        int user_id FK "NOT NULL → users.id CASCADE"
        text note "NOT NULL"
        text image_url "nullable; R2 URL"
        text created_at "DEFAULT CURRENT_TIMESTAMP"
    }
```

| SQL table | Used by (runtime) | Maps to app type |
|-----------|-------------------|------------------|
| `users` | `POST /api/auth/login`, `POST /api/auth/register` | `UserRow` → API `{ id, username }`; credentials → `SessionPayload` (JWT, not a table) |
| `journal` | Schema ready; **no API writes yet** | Conceptual server journal; client uses `EvidenceJournalEntry[]` locally |

### A2. Cloudflare R2 (object storage, logical ER)

Maps to: `functions/api/images/upload.ts`, `functions/images/[[path]].ts`.

```mermaid
erDiagram
    users ||--o{ journal : "1:N"
    journal }o--o| r2_journal_object : "0..1 image_url"

    users {
        int id PK
    }

    journal {
        int id PK
        text image_url
    }

    r2_journal_object {
        text object_key PK "journal/{userId}/{ts}.ext"
        blob bytes
        text content_type
    }
```

### A3. On-device persistence (logical ER)

Not SQL — JSON/key-value in **SecureStore** / **AsyncStorage** / web `localStorage`.

```mermaid
erDiagram
    device_user_session ||--|| secure_credentials : "1:1"
    device_user_session ||--|| risk_snapshot : "1:1"
    device_user_session ||--o{ evidence_journal_entry : "1:N"
    device_user_session ||--o{ mood_entry : "1:N"
    device_user_session ||--|| safety_checkin_settings : "1:1"
    device_user_session ||--|| safety_checkin_state : "1:1"
    device_user_session ||--|| emergency_contact : "1:1"
    device_user_session ||--|| panic_settings : "1:1"
    risk_snapshot ||--o{ exit_fund_transaction : "1:N embedded"
    risk_snapshot ||--o{ trusted_contact : "1:N max 2"

    secure_credentials {
        string ga_auth_token "JWT"
        string ga_calculator_code "unlock PIN"
        string ga_auth_username "optional"
    }

    risk_snapshot {
        enum user_risk_status "green|yellow|red"
        number exit_fund_balance
        number main_account_balance
        number user_defined_limit
        bool is_emergency_active
    }

    evidence_journal_entry {
        string id PK
        string description
        string timestamp
        string imageBase64
        string audioBase64
        string entryHash
        string previousEntryHash
    }

    mood_entry {
        string date "YYYY-MM-DD PK part"
        enum moodId
        number recordedAt
    }

    emergency_contact {
        string name
        string phone
        string email
    }

    panic_settings {
        string phoneNumber
        string emergencyMessage
    }
```

---

## Part B — Class Diagram (domain model)

Core **value types** and their relationships. Hash chain on evidence entries is maintained by `EvidenceService` (see Part C).

```mermaid
classDiagram
    direction TB

  class RiskState {
    <<enumeration>>
    green
    yellow
    red
  }

  class RiskProfile {
    +RiskState status
    +boolean emergencyActive
    +number exitFundBalance
    +number mainAccountBalance
    +number userDefinedLimit
    +ExitFundTransaction[] transactions
    +TrustedContact[] trustedContacts
  }

  class ExitFundTransaction {
    +string id
    +number amount
    +string createdAt
    +string note
  }

  class TrustedContact {
    +string name
    +string phone
  }

  class EvidenceJournalEntry {
    +string id
    +string description
    +string timestamp
    +string imageBase64
    +string audioBase64
    +number audioDurationSec
    +string entryHash
    +string previousEntryHash
  }

  class MoodEntry {
    +string date
    +MoodId moodId
    +number recordedAt
  }

  class MoodId {
    <<enumeration>>
    sage
    mist
    dawn
    dust
  }

  class SafetyCheckinSettings {
    +boolean safetyCheckinEnabled
    +string presetSosMessage
  }

  class SafetyCheckinState {
    +number warningIssuedAt
    +number escalationIssuedAt
    +string[] scheduledIds
  }

  class EmergencyContact {
    +string name
    +string phone
    +string email
  }

  class PanicSettings {
    +string phoneNumber
    +string emergencyMessage
  }

  class SessionPayload {
    +number userId
    +string username
    +string calculatorCode
    +number exp
  }

  class Shelter {
    +string id
    +string region
    +string city
    +string name
    +string phone
    +string type
  }

  class Question {
    +string id
    +QuestionCategory category
    +string textKey
  }

  class QuestionCategory {
    <<enumeration>>
    screening
    critical
  }

  RiskProfile "1" *-- "0..*" ExitFundTransaction : contains
  RiskProfile "1" *-- "0..2" TrustedContact : contains
  RiskProfile --> RiskState : status
  MoodEntry --> MoodId
  Question --> QuestionCategory
```

---

## Part C — Class Diagram (application services & persistence)

Functional modules modeled as **«service»** classes. Arrows show **dependency** (uses) and **composition** (owns in-memory state).

```mermaid
classDiagram
    direction TB

  class RiskStatusService {
    <<service>>
    -RiskState currentStatus
    -boolean isSecureSessionUnlocked
    -ExitFundSnapshot exitFundData
    +getCurrentStatus() RiskState
    +setCurrentStatus(next) void
    +statusFromScore(score) RiskState
    +resolveAssessmentStatus(score, critical) RiskState
    +hasSecureSessionAccess() boolean
    +getIsEmergencyActive() boolean
    +getExitFundData() ExitFundSnapshot
    +setExitFundData(next) void
    +getTrustedContacts() TrustedContact[]
    +addTrustedContact(c) void
    +unlockSecureDataWithPin(pin) boolean
    +hydrateSecureData() void
    +awaitSessionReady() Promise
    +stopEmergencyMode() void
  }

  class SecureStorageService {
    <<service>>
    +readSecureItem(key) string
    +writeSecureItem(key, value) void
    +deleteSecureItem(key) void
  }

  class JournalStorageService {
    <<service>>
    +readJournalRaw(key) string
    +writeJournalRaw(key, value) WriteResult
  }

  class EvidenceService {
    <<service>>
    +sha256Hex(input) string
    +computeEntryHash(entry, prev) string
    +chainHashes(entries) EvidenceJournalEntry[]
    +buildEvidenceHtml(entries, iso) string
  }

  class MoodStorageService {
    <<service>>
    +getMoodEntries() MoodEntry[]
    +saveMoodEntries(entries) void
    +appendTodayMood(moodId) MoodEntry[]
    +getSafetySettings() SafetyCheckinSettings
    +saveSafetySettings(s) void
    +getSafetyState() SafetyCheckinState
    +saveSafetyState(s) void
    +daysSinceLastMood(entries) number
  }

  class SafetyCheckinPipeline {
    <<service>>
    +runSafetyCheckinPipeline(t) void
    +disableSafetyCheckinSchedules() void
  }

  class NotificationService {
    <<service>>
    +configureNotificationHandler() void
    +ensureNotificationPermissions() boolean
    +scheduleQuietCheckInReminder(title, body) string[]
    +cancelStoredSchedules(ids) void
  }

  class EmergencyContactService {
    <<service>>
    +getEmergencyContact() EmergencyContact
    +saveEmergencyContact(c) void
  }

  class PanicSettingsService {
    <<service>>
    +getPanicSettings() PanicSettings
    +savePanicSettings(s) void
  }

  class ApiClient {
    <<service>>
    +apiFetch(path, init) Response
  }

  class JournalMediaService {
    <<service>>
    +pickJournalImageNative() PickedJournalImage
    +startNativeRecording() boolean
    +stopNativeRecording() CapturedAudio
  }

  class I18nService {
    <<service>>
    +setAppLanguage(lang) void
    +getSupportedLanguages() AppLanguage[]
  }

  RiskStatusService --> SecureStorageService : auth keys
  RiskStatusService ..> RiskProfile : manages
  EvidenceService ..> EvidenceJournalEntry : operates on
  JournalStorageService ..> EvidenceJournalEntry : serializes
  MoodStorageService ..> MoodEntry
  MoodStorageService ..> SafetyCheckinSettings
  MoodStorageService ..> SafetyCheckinState
  SafetyCheckinPipeline --> MoodStorageService
  SafetyCheckinPipeline --> RiskStatusService : trusted contacts
  SafetyCheckinPipeline --> NotificationService
  EmergencyContactService ..> EmergencyContact
  PanicSettingsService ..> PanicSettings
  ApiClient ..> SessionPayload : Bearer JWT
```

---

## Part D — Class Diagram (presentation / UI layer)

Screens are **React function components**; they depend on services and domain types.

```mermaid
classDiagram
    direction LR

  class CalculatorMaskScreen {
    <<screen>>
    -expression string
    -display string
    -username string
    -password string
    -storedToken string
    +evaluateExpression(expr) number
    +submitAuth(mode) void
    +saveSession(token, code) void
    +unlockWithPin(pin) void
  }

  class HomeHubScreen {
    <<screen>>
    -journalEntries EvidenceJournalEntry[]
    -currentStatus RiskState
    -trustedContacts TrustedContact[]
    +saveJournalEntry() void
    +exportEvidenceHtml() void
    +triggerEmergencyIntervention() void
    +appendMood(moodId) void
  }

  class AssessmentScreen {
    <<screen>>
    -questionIndex number
    -mainScore number
    -criticalHighRisk boolean
    +submitAnswer(key) void
    +finishAssessment() void
  }

  class ExitFundScreen {
    <<screen>>
  }

  class CoreSettingsScreen {
    <<screen>>
    +saveEmergencyContact() void
    +saveSafetySettings() void
  }

  class SheltersListScreen {
    <<screen>>
    -query string
    +filterShelters() Shelter[]
  }

  class UseShakeHide {
    <<hook>>
    +onShake callback
    +threshold number
  }

  CalculatorMaskScreen --> RiskStatusService : unlock PIN
  CalculatorMaskScreen --> SecureStorageService
  CalculatorMaskScreen --> ApiClient : login/register
  HomeHubScreen --> RiskStatusService
  HomeHubScreen --> EvidenceService
  HomeHubScreen --> JournalStorageService
  HomeHubScreen --> MoodStorageService
  HomeHubScreen --> PanicSettingsService
  AssessmentScreen --> RiskStatusService
  CoreSettingsScreen --> EmergencyContactService
  CoreSettingsScreen --> MoodStorageService
  SheltersListScreen --> RiskStatusService
  SheltersListScreen ..> Shelter : reads JSON
  HomeHubScreen --> UseShakeHide
  AssessmentScreen --> UseShakeHide
```

---

## Part E — Class Diagram (server / Cloudflare API)

```mermaid
classDiagram
    direction TB

  class AuthMiddleware {
    <<PagesFunction>>
    +onRequest() Response
  }

  class LoginHandler {
    <<handler>>
    +onRequestPost() Response
  }

  class RegisterHandler {
    <<handler>>
    +onRequestPost() Response
  }

  class ImageUploadHandler {
    <<handler>>
    +onRequestPost() Response
  }

  class ImageServeHandler {
    <<handler>>
    +onRequestGet() Response
  }

  class AuthLib {
    <<service>>
    +createToken(payload, secret) string
    +verifyToken(token, secret) SessionPayload
    +hashPassword(password, salt) string
  }

  class HttpLib {
    <<service>>
    +json(data, status) Response
    +badRequest(msg) Response
    +unauthorized(msg) Response
  }

  class D1Database {
    <<Cloudflare>>
    users
    journal
  }

  class R2Bucket {
    <<Cloudflare>>
    JOURNAL_IMAGES
  }

  class UserRow {
    +number id
    +string username
    +string password_hash
  }

  LoginHandler --> AuthLib
  LoginHandler --> D1Database
  RegisterHandler --> AuthLib
  RegisterHandler --> D1Database
  ImageUploadHandler --> AuthLib
  ImageUploadHandler --> R2Bucket
  ImageServeHandler --> R2Bucket
  LoginHandler --> HttpLib
  RegisterHandler --> HttpLib
  ImageUploadHandler --> HttpLib
  LoginHandler ..> UserRow : SELECT
  LoginHandler ..> SessionPayload : JWT body
```

---

## Part F — Database ↔ application mapping

Shows how **D1 rows** relate to **client types** and where they diverge (dual journal model).

```mermaid
classDiagram
    direction TB

  class D1_User {
    <<table users>>
    +int id
    +string username
    +string password_hash
    +string created_at
  }

  class D1_Journal {
    <<table journal>>
    +int id
    +int user_id
    +string note
    +string image_url
    +string created_at
  }

  class API_UserResponse {
    +int id
    +string username
  }

  class SessionPayload {
    +int userId
    +string username
    +string calculatorCode
    +number exp
  }

  class EvidenceJournalEntry {
    <<client only>>
    +string id
    +string description
    +string timestamp
    +string imageBase64
    +string entryHash
  }

  class R2_ObjectKey {
    +string key
    +string publicUrl
  }

  D1_User "1" --> "0..*" D1_Journal : user_id FK
  D1_User ..> API_UserResponse : login/register JSON
  D1_User ..> SessionPayload : userId, username
  SessionPayload ..> SecureStorageService : ga_auth_token
  D1_Journal ..> R2_ObjectKey : image_url
  D1_Journal ..> EvidenceJournalEntry : planned sync
  EvidenceJournalEntry ..> EvidenceService : hash chain
  note for D1_Journal "Server journal table;\nclient evidence log is separate today"
```

| D1 column | Application mapping |
|-----------|---------------------|
| `users.id` | `SessionPayload.userId`, API `user.id` |
| `users.username` | `SessionPayload.username`, login form |
| `users.password_hash` | Never sent to client; verified in `LoginHandler` |
| `journal.user_id` | Would map to `SessionPayload.userId` when API implemented |
| `journal.note` | Analogous to `EvidenceJournalEntry.description` |
| `journal.image_url` | Populated from `ImageUploadHandler` response URL (R2) |
| — | `EvidenceJournalEntry` stored under key `guardian_angel_evidence_journal_v1` via `JournalStorageService` |

---

## Part G — End-to-end architecture (workshop summary)

```mermaid
flowchart TB
  subgraph Presentation
    Calc[CalculatorMaskScreen]
    Home[HomeHubScreen]
    Assess[AssessmentScreen]
    Settings[CoreSettingsScreen]
  end

  subgraph DomainServices
    Risk[RiskStatusService]
    Ev[EvidenceService]
    Mood[MoodStorageService]
    SOS[SafetyCheckinPipeline]
  end

  subgraph ClientStorage
    SS[(SecureStore)]
    AS[(AsyncStorage)]
  end

  subgraph Cloudflare
    API[Pages Functions]
    D1[(D1 users + journal)]
    R2[(R2 images)]
  end

  Calc --> Risk
  Calc --> SS
  Home --> Risk
  Home --> Ev
  Home --> Mood
  Home --> AS
  Assess --> Risk
  Settings --> Mood
  Risk --> SS
  Mood --> AS
  Ev --> AS
  Calc --> API
  API --> D1
  API --> R2
  D1 -.->|image_url| R2
```

---

## Source file index (for grading)

| Layer | Primary paths |
|-------|----------------|
| Domain types | `app/risk-status.ts`, `src/evidence.ts`, `src/mood-checkin/types.ts`, `src/emergency-contact.ts`, `src/panic-settings.ts` |
| Services | `app/risk-status.ts`, `src/secure-storage.ts`, `src/journal-storage.ts`, `src/mood-checkin/*`, `src/evidence.ts`, `src/api.ts` |
| UI | `app/(tabs)/index.tsx`, `app/home.tsx`, `app/assessment.tsx`, `app/exit_fund.tsx`, `app/core-settings.tsx`, `src/screens/SheltersList.tsx` |
| API | `functions/api/auth/*`, `functions/api/images/upload.ts`, `functions/images/[[path]].ts`, `functions/_lib/*` |
| Database | `cloudflare/migrations/0001_init.sql` |
