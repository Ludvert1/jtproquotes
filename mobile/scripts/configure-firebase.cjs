const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Public Firebase client identifiers only. No service-account key is used here.
// The Android app ID is from the registered app in the existing project.
function configureFirebase(mobile) {
  const registration = JSON.parse(fs.readFileSync(path.join(mobile, 'firebase-android.json'), 'utf8'));
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(mobile, '../config.js'), 'utf8'), context);
  const firebase = context.window.JTPQ_CONFIG.firebase;
  const capacitor = JSON.parse(fs.readFileSync(path.join(mobile, 'capacitor.config.json'), 'utf8'));
  if (registration.projectId !== firebase.projectId || registration.projectNumber !== firebase.messagingSenderId || registration.packageName !== capacitor.appId || !firebase.apiKey) {
    throw new Error('Android Firebase registration must match the existing project and package.');
  }
  const target = path.join(mobile, 'android/app/google-services.json');
  if (!fs.existsSync(target)) {
    // This is the documented Google services JSON schema. Values come from
    // verified project/app registration and the existing public Firebase key.
    fs.writeFileSync(target, JSON.stringify({
      project_info: { project_number: registration.projectNumber, project_id: registration.projectId, storage_bucket: firebase.storageBucket },
      client: [{
        client_info: { mobilesdk_app_id: registration.appId, android_client_info: { package_name: registration.packageName } },
        api_key: [{ current_key: firebase.apiKey }],
      }],
      configuration_version: '1',
    }, null, 2) + '\n');
  }
  const config = JSON.parse(fs.readFileSync(target, 'utf8'));
  const client = config.client?.find((entry) => entry.client_info?.android_client_info?.package_name === capacitor.appId);
  if (config.project_info?.project_id !== registration.projectId || client?.client_info?.mobilesdk_app_id !== registration.appId || !client.api_key?.[0]?.current_key) {
    throw new Error('Firebase Android configuration does not match the registered release app.');
  }
  return true;
}
module.exports = { configureFirebase };
