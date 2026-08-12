# Guardian Angel — Entity Relationship Diagram

> **Workshop / course submission:** For combined **ERD + Class Diagram** (entities, methods, DB mapping, UI layer), see **[WORKSHOP_DIAGRAMS.md](WORKSHOP_DIAGRAMS.md)**.

This document reflects the **implemented** data model: Cloudflare D1 (server), R2 (media), and on-device storage (client).

**PNG exports** (regenerate with `npm run docs:erd-png`):

| Diagram | PNG |
|---------|-----|
| D1 schema | [erd-d1.png](diagrams/erd-d1.png) |
| D1 + R2 | [erd-r2.png](diagrams/erd-r2.png) |
| On-device entities | [erd-on-device.png](diagrams/erd-on-device.png) |
| Cloud + client flow | [erd-e2e.png](diagrams/erd-e2e.png) |

Source `.mmd` files live in [`docs/diagrams/`](diagrams/).

---

## 1. Cloudflare D1 (relational)

Source: [`cloudflare/migrations/0001_init.sql`](../cloudflare/migrations/0001_init.sql)

![Cloudflare D1 ERD](diagrams/erd-d1.png)

<details>
<summary>Mermaid source</summary>

```mermaid
erDiagram
    users ||--o{ journal : "owns"

    users {
        int id PK "AUTOINCREMENT"
        text username UK "NOT NULL"
        text password_hash "SHA-256(salt:password)"
        text created_at "DEFAULT CURRENT_TIMESTAMP"
    }

    journal {
        int id PK "AUTOINCREMENT"
        int user_id FK "NOT NULL"
        text note "NOT NULL"
        text image_url "nullable, R2 public URL"
        text created_at "DEFAULT CURRENT_TIMESTAMP"
    }
```

</details>

| Relationship | Cardinality | On delete |
|--------------|-------------|-----------|
| `users` → `journal` | One user, many journal rows | `CASCADE` (`user_id` → `users.id`) |

**Index:** `idx_journal_user_created` on `(user_id, created_at DESC)` for per-user timeline queries.

**Not stored in D1:** Calculator unlock code lives in the JWT session payload and client SecureStore (`ga_calculator_code`), not as a column on `users`.

---

## 2. Cloudflare R2 (object storage, logical link)

Bucket: `guardianangel-journal-images` (binding `JOURNAL_IMAGES`). Objects are keyed as `journal/{userId}/{timestamp}.{ext}`.

![D1 and R2 logical ERD](diagrams/erd-r2.png)

<details>
<summary>Mermaid source</summary>

```mermaid
erDiagram
    users ||--o{ journal : "owns"
    journal }o--o| r2_object : "image_url references"

    users {
        int id PK
    }

    journal {
        int id PK
        text image_url "GET /images/{key}"
    }

    r2_object {
        text key PK "journal/userId/timestamp.ext"
        blob body "image bytes"
        text content_type "e.g. image/jpeg"
    }
```

</details>

Upload flow: authenticated `POST /api/images/upload` → `put` to R2 → response `url` may be persisted in `journal.image_url`.

---

## 3. On-device data (logical entities)

These are **not** normalized SQL tables; values are JSON blobs or key–value pairs in **Expo SecureStore** or **AsyncStorage** (web: `localStorage` for some keys).

![On-device logical ERD](diagrams/erd-on-device.png)

<details>
<summary>Mermaid source</summary>

```mermaid
erDiagram
    app_session ||--|| secure_auth : "ga_auth_token, ga_calculator_code"
    app_session ||--|| risk_profile : "SecureStore keys"
    app_session ||--o{ evidence_entry : "guardian_angel_evidence_journal_v1"
    app_session ||--o{ mood_entry : "ga_mood_entries_v1"
    app_session ||--|| safety_checkin_settings : "ga_safety_checkin_settings_v1"
    app_session ||--|| safety_checkin_state : "ga_safety_checkin_state_v1"
    app_session ||--|| emergency_contact : "core-emergency-contact-v1"
    app_session ||--|| panic_settings : "panic-settings-v1"
    risk_profile ||--o{ exit_fund_transaction : "embedded in exit_fund_transactions JSON"
    risk_profile ||--o{ trusted_contact : "embedded in trusted_contacts JSON"

    secure_auth {
        string ga_auth_token "Bearer JWT"
        string ga_calculator_code "unlock PIN pattern"
    }

    risk_profile {
        enum user_risk_status "green | yellow | red"
        number exit_fund_balance
        number main_account_balance
        number user_defined_limit
        bool is_emergency_active
    }

    exit_fund_transaction {
        string id
        number amount
        string createdAt
        string note
    }

    trusted_contact {
        string name
        string phone
    }

    evidence_entry {
        string id
        string description
        string timestamp
        string imageBase64 "optional"
        string audioBase64 "optional"
        number audioDurationSec "optional"
        string entryHash "SHA-256 chain"
        string previousEntryHash "optional"
    }

    mood_entry {
        string date "YYYY-MM-DD"
        enum moodId "sage | mist | dawn | dust"
        number recordedAt
    }

    safety_checkin_settings {
        bool safetyCheckinEnabled
        string presetSosMessage
    }

    safety_checkin_state {
        number warningIssuedAt "optional"
        number escalationIssuedAt "optional"
        string_array scheduledIds "optional"
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

</details>

---

## 4. End-to-end view (cloud + client)

![End-to-end cloud and client flow](diagrams/erd-e2e.png)

<details>
<summary>Mermaid source</summary>

```mermaid
flowchart LR
    subgraph client["Mobile app"]
        SS[SecureStore]
        AS[AsyncStorage]
        EJ[Evidence journal JSON]
        Mood[Mood / safety check-in]
    end

    subgraph cloud["Cloudflare"]
        API[Pages Functions]
        D1[(D1: users, journal)]
        R2[(R2: journal images)]
    end

    SS -->|JWT, calculator code, risk / exit fund| API
    AS --> EJ
    AS --> Mood
    API --> D1
    API --> R2
    D1 -.->|image_url| R2
```

</details>

**Note:** The in-app **evidence journal** (hash-chained entries) is stored locally. The D1 **`journal`** table is the server-side journal API path (text + optional `image_url`); both can coexist in the product roadmap.

---

## 5. Auth session (not a table)

JWT payload (`SessionPayload`) after login/register:

| Field | Type | Source |
|-------|------|--------|
| `userId` | number | `users.id` |
| `username` | string | `users.username` |
| `calculatorCode` | string | Same as login password at token issue time |
| `exp` | number | Unix expiry |

Verified with `AUTH_SECRET` (HMAC-SHA256); not persisted in D1.
