# Publishing S-I-Quotespro to Google Play and the App Store

## Google Play
1. Create the upload key on your computer (keep the file and passwords private):
   keytool -genkey -v -keystore siq-upload.jks -alias siq -keyalg RSA -keysize 2048 -validity 10000
2. GitHub repo > Settings > Secrets: ANDROID_KEYSTORE_B64 (base64 of the .jks), ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS (siq).
3. Actions > "Mobile builds" > Run workflow; download the android-aab artifact.
4. Play Console > Create app > upload the .aab to Internal testing, fill Store listing, Data safety, Content rating, then Production > Review.
   Privacy policy URL: https://www.s-i-quotespro.com/ (add a privacy page first).

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
