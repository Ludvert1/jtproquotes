# S-I-Quotespro mobile

The Android application bundles the current product UI and connects to the existing Firebase workspace and https://www.s-i-quotespro.com API. Package ID is com.siquotespro.app.

Use Node 22+ and JDK 21. Install dependencies with npm ci at the repository root and in mobile, then run npm run sync:android in mobile. The checked-in Android project targets API 36.

Run npm run check in mobile for pricing, signature-version and native-transport checks. A pull request runs an Android debug build and lint. The manual Mobile builds workflow creates signed AAB and APK artifacts. Signing credentials are required for release tasks.

Set ANDROID_KEYSTORE_B64, ANDROID_KEYSTORE_PASSWORD and ANDROID_KEY_ALIAS in GitHub Actions secrets. The workflow decodes the upload key only in the runner's temporary directory. Android Firebase registration is recorded in firebase-android.json. The build generates client configuration from it and the existing public Firebase project configuration. Optional ANDROID_GOOGLE_SERVICES_JSON_B64 may supply a matching exported configuration. Native notification delivery still requires phone verification. Never commit signing material or service-account keys.

See store/PLAY-SUBMISSION.md for proposed listing copy, disclosures and submission prerequisites. Public privacy and account-deletion pages are deployed at https://www.s-i-quotespro.com/privacy and https://www.s-i-quotespro.com/delete-account. The mobile release source remains on its own review branch to preserve the existing website. Version 1.0.1 adds phone navigation, quote search, pricing validation, local recovery and guarded editor saves.
