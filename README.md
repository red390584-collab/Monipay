# Goldltm — Android Banking App (WebView + Kotlin Native)

A production-quality Android app with a **Moniepoint-inspired dark theme** (navy + gold), a full
onboarding flow, and complete banking sections: Dashboard, Send Money, Airtime, Data, Bills,
Cards, Security, Profile and Settings.

- **UI layer:** HTML / CSS / JavaScript in `app/src/main/assets/` (loaded in a hardened WebView)
- **Native layer:** Kotlin (`MainActivity`, `WebAppInterface`, and helpers)
- **Data store:** [JSON Bin](https://jsonbin.io) — single bin holds app config + user data
- **SMS:** [Termii](https://termii.com) — **credit alerts only**, Sender ID `Goldltm`
- **Payments:** Paystack (secret key editable in the in-app Settings screen)

---

## 1. Project structure

```
.
├── .github/workflows/build.yml      # CI: auto-retry APK build + artifact upload
├── build.gradle                      # Project-level Gradle
├── settings.gradle
├── gradle.properties
├── local.properties                  # API keys (this repo ships with your keys pre-filled)
├── gradlew / gradle wrapper          # (generated on first sync — see §4)
└── app/
    ├── build.gradle                  # Module config, release signing, API key loading
    ├── proguard-rules.pro
    └── src/main/
        ├── AndroidManifest.xml
        ├── java/com/goldltm/app/
        │   ├── GoldltmApp.kt
        │   ├── MainActivity.kt       # WebView setup, status bar, back navigation, callbacks
        │   ├── WebAppInterface.kt    # @JavascriptInterface bridge exposed as window.Android
        │   └── helper/
        │       ├── ApiClient.kt      # OkHttp + Gson helpers
        │       ├── SharedPrefsHelper.kt
        │       ├── JsonBinHelper.kt  # JSON Bin read/update
        │       └── TermiiHelper.kt   # Credit-alert SMS (OkHttp)
        ├── assets/
        │   ├── index.html            # All 16 app screens
        │   ├── style.css             # Navy + gold dark theme
        │   └── script.js             # Navigation, state, API flows
        └── res/                      # Layouts, themes, colors, drawables, XML config
```

---

## 2. GitHub Secrets (required for CI)

Go to **Repo → Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret | Value |
|---|---|
| `TERMII_BASE_URL` | `https://v4.api.termii.com/` |
| `TERMII_API_KEY` | your Termii API key |
| `JSONBIN_MASTER_KEY` | your JSON Bin master key |
| `JSONBIN_BIN_ID` | `6ac9ed15ffd5d160535e59a3` |
| `PAYSTACK_DEFAULT_SECRET` | your Paystack secret key (optional fallback) |

`TERMII_SENDER_ID` is hard-coded to `Goldltm` in the workflow.

These are written into `local.properties` at build time (the same file the app reads), so the
values are **never** compiled into source code — only into the build.

> ⚠️ The keys currently in your local `local.properties` are baked into any APK you build
> locally. Rotate them if this repository is (or becomes) public.

---

## 3. Triggering the workflow & downloading the APK

1. Push to `main` (or open **Actions → Build Goldltm APK → Run workflow** for a manual run).
2. The build step retries automatically: **up to 5 attempts, 30 s apart** (20 min timeout each),
   so transient Gradle/network failures heal themselves.
3. On success, open **Actions → latest run → Artifacts → `Goldltm-APK`** and download it.
4. Install on a device: enable *Install unknown apps* for your file manager, then open the APK.

> If `gradle-wrapper.jar` / `gradlew` are not in the repo yet, generate them once locally with
> `gradle wrapper` (Android Studio sync does this automatically), then commit them so CI can run.

---

## 4. Opening in Android Studio

1. **File → Open** → select this folder.
2. Let Gradle sync (JDK 17, AGP 8.2.2, Kotlin 1.9.22).
3. Run ▶ on the `app` configuration.

---

## 5. JSON Bin setup

Bin URL: `https://api.jsonbin.io/v3/b/6ac9ed15ffd5d160535e59a3` (starts empty:
`{ "users": {}, "meta": { "lastUpdated": …, "totalUsers": 0, "appVersion": "1.0.0" } }`; users are
added on sign-up). The workflow falls back to the owner-supplied bin ID and master key when the
`JSONBIN_*` repo secrets are not configured, so builds work out of the box.

Auth header used by the app: `X-Master-Key: <JSONBIN_MASTER_KEY>` on every
GET/PUT/POST/DELETE. (JSON Bin v3 rejects `Authorization: Bearer` with **401**.) All requests also
send `X-Bin-Meta: false` so the API returns the raw record — without it, reads come back wrapped
as `{ "record": …, "metadata": … }`.

Top-level structure:

```json
{
  "users": {
    "0198061234567": {
      "accountNumber": "0198061234567",
      "phoneNumber": "08061234567",
      "fullName": "Ada Obi",
      "email": "ada@example.com",
      "passwordHash": "…",
      "pinHash": "…",
      "walletAddress": "GL_…",
      "balance": 5000000,
      "transactions": [],
      "beneficiaries": [],
      "cards": [],
      "notifications": { "creditSms": true, "debitSms": true, "push": true }
    }
  },
  "wallets": {},
  "lastSync": "2026-10-09T00:00:00.000Z",
  "version": "…",
  "meta": { "lastUpdated": "…", "totalUsers": 1, "appVersion": "1.0.0" }
}
```

Notes:

- **`users` is an object keyed by account number**, and every read/write goes through
  `getJsonBin` / `updateJsonBin` in the WebView bridge.
- **Legacy bins are migrated automatically.** Older records stored `users` as an *array* with
  `fullname` / `phone` / `transactionPin` fields and transactions using `date` +
  `received`/`sent` types. On every load, `Store.normalize()` in `script.js` re-keys users by
  account number, maps those fields to `fullName` / `phoneNumber` / `pin`, converts transaction
  types to `credit`/`debit` with a `timestamp`, and hashes any plaintext PIN after first login.
  All other top-level keys (`wallets`, `lastSync`, `version`, …) are preserved on save.
- Each user record stores wallet balance, beneficiaries, cards, PIN hash and preferences; the
  WebView writes it back through `updateJsonBin`.
- The bin may also be empty — the app initializes missing structures on first read.

---

## 6. Paystack key (in-app Settings)

- The secret key is entered in-app (**Settings → Paystack API Key**) and stored on-device
  (`paystack_api_key` in SharedPreferences — the same key the Kotlin layer reads first).
- On save, the app verifies the key by fetching the live NGN bank list; the fetched list replaces
  the built-in fallback and is cached for offline startup.
- Precedence in Kotlin: in-app key → `PAYSTACK_DEFAULT_SECRET` from `local.properties` → error.
- Account names are resolved via `GET https://api.paystack.co/bank/resolve?account_number=…&bank_code=…`
  with `Authorization: Bearer <secret>`; the resolved name automatically becomes the recipient name
  on the transaction, receipt and any saved beneficiary (existing beneficiaries are refreshed).
- Mobile-bank codes (verified live): OPay `999992`, PalmPay `999991`, Kuda Bank `50211`,
  Moniepoint MFB `50515`, Eyowo `50126`, Paga `100002`.

## 7. Termii credit alerts

- **Only credit alerts are sent** (no OTP, no debit SMS).
- **Recipients:** internal wallet transfers → the recipient's registered phone; **mobile-bank
  transfers (OPay, PalmPay, Kuda, Moniepoint, Eyowo, Paga)** → the account number, which *is* the
  customer's phone number, converted without the leading zero (`09012345678` → `+2349012345678`).
  **Traditional banks get no SMS** (their account numbers are not phone numbers). For mobile-bank
  alerts the available-balance line shows `N/A`.
- Phone derivation for internal transfers: account `0198123456789` → strip `019` → prefix `+234` →
  `+2348123456789`.
- Template:

```
Credit Alert

Amount: ₦[AMOUNT]
From: [SENDER_NAME] ([SENDER_ACCOUNT])
Date: [DATE]
Time: [TIME]
Transaction Type: [TYPE]
Available Balance: ₦[BALANCE]
Transaction ID: [TX_ID]
Reference: [REFERENCE]

Thank you for using Goldltm.
```

- API: `POST {TERMII_BASE_URL}/api/sms/send` with JSON body
  `{ to, from: "Goldltm", sms, type: "plain", channel: "generic", api_key }`.

---

## 8. Biometric authentication

Two independent features, both powered by **AndroidX Biometric** (`androidx.biometric:biometric`)
with `CryptoObject` keys from the Android Keystore (`MainActivity` extends `AppCompatActivity`,
which provides the required `FragmentActivity`; `USE_BIOMETRIC` is declared in the manifest).

- **Biometric login** (`biometric_enabled` in SharedPreferences): enabling it in **Settings →
  Biometric Security** prompts once to confirm, then encrypts the session identity
  (`accountNumber|email`) with an auth-gated AES/GCM-256 Keystore key
  (`goldltm_biometric_login_key`, `setUserAuthenticationRequired(true)`, per-use auth). The token
  is only decryptable behind a successful biometric prompt, so entry is gated on app open when the
  toggle is on (PIN login stays available as fallback). `KeyPermanentlyInvalidatedException`
  (lock-screen/biometric change) auto-disables and asks the user to re-enable. Disabling deletes
  the key and the stored token.
- **Transfer confirmation** (`biometric_transfer_enabled`): when on, every transfer flow (Send
  Money, Airtime, Data, Bills) shows the system prompt — *"Authenticate to send ₦X to Y"* — before
  the PIN step. On success the Keystore signs `amount|recipient|nonce|timestamp` (fresh native
  nonce, single use) into a confirmation token; the JS layer rejects replays and amount/recipient
  mismatches, stores the token on the transaction, and the receipt shows a *Biometric Verified*
  row. "Use PIN instead" (or any failure) falls back to the existing PIN flow.
- Bridge methods on `window.Android`: `isBiometricAvailable`, `enableBiometricLogin`,
  `disableBiometricLogin`, `authenticateBiometricLogin`, `isBiometricLoginEnabled`,
  `enableBiometricTransfer`, `disableBiometricTransfer`, `authenticateBiometricTransfer`.
  Native → JS callbacks: `window.onBiometricLoginEnabled(success, message)`,
  `window.onBiometricLoginSuccess(token)`, `window.onBiometricLoginError(message)`,
  `window.onBiometricTransferSuccess(token, nonce, amount, recipient, timestamp)`,
  `window.onBiometricTransferError(message)` (`"cancelled"` = dismissed silently → PIN fallback).
- Kotlin logic lives in `helper/BiometricHelper.kt`; the JS side is the `Biometric` module in
  `script.js`. Devices without biometrics see the exact spec messages
  ("Biometric not available on this device" / "No biometric credentials enrolled…") and keep the
  PIN flow unchanged.

---

## 9. Legal disclaimer

> This application is a **demonstration / reference implementation**. It does not hold, move, or
> safeguard real money and is **not a licensed banking or financial-services product**. It must
> not be published to any app store or distributed as a real banking service without the
> applicable regulatory approvals, licensing, security audits, KYC/AML controls and consumer
> disclosures required in your jurisdiction. All credentials (Termii, JSON Bin, Paystack) are
> used at your own risk; never embed live production secrets in a public repository or distribute
> them in a publicly released APK. "Goldltm" and any visual identity used here must not infringe
> third-party trademarks or imply endorsement by any bank (including Moniepoint), whose names are
> referenced for stylistic purposes only. To the maximum extent permitted by law, the software is
> provided "as is", without warranty of any kind, and the author is not liable for any loss
> arising from its use.
