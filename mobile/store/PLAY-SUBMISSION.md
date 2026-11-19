# S-I-Quotespro Google Play submission

## Prepared release

Application ID is com.siquotespro.app. Version name is 1.0.1 and version code is 2. Android minimum API is 24, with compile and target API 36. The release includes packaged web assets, company sign-in, quote and scope entry, crew pricing, owner approval, PDF export and sharing, and signatures captured on a manager's device.

This Android release uses existing approved accounts. Company sign-up and subscription purchase are disabled in the Android interface. Existing subscription cancellation remains available. The app's server still enforces account access. Quotes use the existing Firebase project and production API. The interface remains English.

The Android package was registered in the existing jtproquotes Firebase project. Its App ID is 1:994940793610:android:2a152c053a8e689386c0f3, and Cloud Messaging API v1 is enabled. The build generates Google services configuration from that verified registration and the existing public Firebase client key. An exported matching config can override the generated file through CI. Notification registration and delivery still require real-device testing. iOS push remains disabled.

## Store listing text

App name — S-I-Quotespro

Short description — Create contractor quotes, price crew labor, and review jobs from the field.

Full description

S-I-Quotespro helps contractors prepare clear quotes while working with their team.

Enter client details, describe the project, and select the included scope of work. Set crew size, working days, hours and labor rate. Choose labor only or include materials, then review overhead, margin, discounts, the total and the deposit.

Associates submit quotes for review. Owners and authorized reviewers can approve them or request changes before the quote goes to the customer. Capture client and contractor signatures on an approved quote from an authorized reviewer's device. Signatures apply to that quote version.

Generate a branded PDF, save it through Android's file picker, print it or share it using your device's available apps. Keep quotes, job records, receipts and company details connected to your S-I-Quotespro workspace.

An existing S-I-Quotespro account and company approval are required. Internet access is required for cloud synchronization, sign-in and AI services. Available features depend on the company's account and role.

Category — Business
Support email — support@s-i-quotespro.com
Support phone — (713) 835-8245
Website — https://www.s-i-quotespro.com

## Published public resources

The owner approved publishing these resources. Both are live with HTTP 200 at https://www.s-i-quotespro.com/privacy and https://www.s-i-quotespro.com/delete-account. Only these two static files were added to the website. Existing home, app, help and pricing responses were verified byte-for-byte unchanged. Confirm that support follows the published handling and retention practices.

The deletion page initiates an email request to support. The support operator must verify the requester and complete account and associated-data deletion. Disabling a user is not deletion.

## Data safety review

These are source-based proposed disclosures, to confirm in Play Console against the deployed service and current SDK configuration.

| Information | Use |
| --- | --- |
| Name, email, account ID, company and role | Sign-in, account management and workspace access |
| Customer phone, email and job address | Quotes, correspondence, scheduling and records |
| Job photos and user-provided files | Optional attachments, storage, quote analysis and export |
| Scopes, notes, signatures and documents | Quote and job management |
| Precise or approximate location | Optional property lookup and travel estimate |
| Invoices and recorded payment details | Contractor job and receipt records |
| App errors, technical and account identifiers | Diagnostics and support |
| Notification token | Optional native alerts after permission is granted |

Data is encrypted in transit. Relevant processors include Firebase/Google, Vercel, Anthropic for AI job analysis and Google Maps for property lookup. Existing web billing uses Stripe. Service-provider processing must be classified using Google's current Data safety definitions. A service-provider exemption from “sharing” must be checked against actual contracts and use. No advertising SDK is installed.

## Outstanding before submission

1. Access to the intended Play Console developer account and app. Confirm whether com.siquotespro.app already exists there, whether version code 2 is greater than prior uploads, and whether the new upload certificate matches its registered upload key.
2. Complete developer registration and verification. The signed-in ludvert@gmail.com account currently opens the account-type selection page at https://play.google.com/console/signup. Organization details, verification, terms and registration payment require the account owner.
3. Supply a dedicated approved reviewer login with a usable company workspace. Do not place reviewer passwords in this repository or a public document.
4. Capture at least two screenshots from the release on Android. Browser-rendered phone UI previews, the 1024 × 500 feature graphic and the 512 × 512 SI product icon are supplied. UI previews are clearly labeled and must be confirmed against the installed build.
5. Verify actual-device sign-in, quote creation, approval from another account, attachment selection, PDF save/share/print, location permission and return from background. Native functionality has build checks but still needs device validation.
6. Complete Data safety, target audience, ads declaration, content rating and the app-access instructions in Play Console. Confirm the business operator's details and retention practice.
7. Run internal testing and review the Google pre-launch report. New personal developer accounts may require a closed test before production access.
8. Configure the three signing secrets for repeatable CI releases, using the separately supplied private signing backup.

The prepared release is an internal-testing candidate until these account, policy, asset and device checks are complete. No Play submission or public production release is performed by this preparation.

Version 1.0.1 includes quote search by client/job/number/address, a role-aware phone navigation bar, numeric pricing checks, device draft recovery and revision-guarded editor writes. Device backups are isolated by company and user, are removed on successful synchronization, and require confirmation before erasure at sign-out. Recovery is blocked when the server version changed. An exported recovery JSON can be compared manually without overwriting current cloud records.
