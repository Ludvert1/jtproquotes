# Publishing S-I-Quotespro to Google Play and the App Store

## Google Play
The Android project is now checked in and uses bundled assets. Follow store/PLAY-SUBMISSION.md for release preparation, review requirements, and proposed listing text.

Run npm ci at the repository root and in mobile. Run npm run sync:android and npm run check in mobile. Use the manual Mobile builds workflow with a version code higher than every prior upload.

Release builds require ANDROID_KEYSTORE_B64, ANDROID_KEYSTORE_PASSWORD, and ANDROID_KEY_ALIAS in Actions secrets. A release fails when signing material is missing. Restore the supplied upload key for future releases. If this package already has a Play Console app, confirm its registered upload certificate before uploading.

The signed AAB is for Play Console internal testing. The signed APK is for installation and testing on an Android device. Public privacy/deletion URLs, reviewer access, actual-device tests, screenshots and Play Console declarations must be completed before submission.

## Apple App Store
1. developer.apple.com: register App ID com.siquotespro.app; App Store Connect > New App.
2. Download the ios-project artifact; open mobile/ios/App/App.xcworkspace on a Mac with Xcode, set your Team, Product > Archive > Distribute > App Store Connect.
   (No Mac? Use Codemagic or Xcode Cloud with the same project.)
3. In App Store Connect add screenshots, description, privacy answers, then Submit for Review.
   Apple reviewers want a demo login: create a test account and enter it in App Review notes.

## Billing note
Subscriptions sold inside the iOS app can fall under Apple in-app purchase rules (guideline 3.1.1). Contractor plans via Stripe are best presented as a web sign-up on iOS.

## Push notifications (native)
1. Firebase console (same project as the app) > Project settings > Add Android app `com.siquotespro.app` and iOS app `com.siquotespro.app`.
2. Put google-services.json into mobile/android/app/ (commit it) and GoogleService-Info.plist into mobile/ios/App/App/.
3. iOS only: Apple Developer > Keys > create an APNs key, upload it in Firebase > Cloud Messaging.
4. Server already uses FIREBASE_SERVICE_ACCOUNT in Vercel; the account needs the "Firebase Cloud Messaging API Admin" role.
