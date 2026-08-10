/* ============================================================
   JTProQuotes — configuration
   This is the ONLY file you need to edit to connect the app to
   your shared database. Nothing here is secret: Firebase web
   keys are meant to be public. Your data is protected by the
   rules in firestore.rules, not by hiding these values.
   ============================================================

   TO GO LIVE FOR THE WHOLE TEAM:
   1. Create a free project at https://console.firebase.google.com
   2. Add a Web app, copy the config values it shows you
   3. Paste them below
   4. Turn on Authentication > Email/Password
   5. Create a Firestore database
   6. Paste firestore.rules into Firestore > Rules and publish

   LEAVE apiKey BLANK to keep running in offline single-device
   mode, where each device stores its own separate data.
============================================================ */

window.JTPQ_CONFIG = {
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
  },

  // This email address gets Owner rights. Everyone else is an associate.
  ownerEmail: "info@jtproconstruction.com",
};
