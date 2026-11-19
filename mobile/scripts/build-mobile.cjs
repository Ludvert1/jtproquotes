const fs = require('node:fs');
const path = require('node:path');
const babel = require('../../node_modules/@babel/core');

const mobile = path.resolve(__dirname, '..');
const root = path.resolve(mobile, '..');
const output = path.join(mobile, 'www');
const modules = path.join(mobile, 'node_modules');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(path.join(output, 'vendor'), { recursive: true });

const vendors = {
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js': 'react/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js': 'react-dom/umd/react-dom.production.min.js',
};
for (const component of ['app', 'auth', 'firestore', 'storage']) {
  vendors['https://www.gstatic.com/firebasejs/10.12.2/firebase-' + component + '-compat.js'] = 'firebase/firebase-' + component + '-compat.js';
}
let template = fs.readFileSync(path.join(root, 'src/index.template.html'), 'utf8');
for (const [url, source] of Object.entries(vendors)) {
  const filename = path.basename(source);
  fs.copyFileSync(path.join(modules, source), path.join(output, 'vendor', filename));
  template = template.replace(url, './vendor/' + filename);
}
fs.copyFileSync(path.join(modules, 'html2pdf.js/dist/html2pdf.bundle.min.js'), path.join(output, 'vendor/html2pdf.bundle.min.js'));

let fonts = '';
for (const family of ['barlow', 'barlow-condensed']) {
  for (const weight of [400, 500, 600, 700]) {
    const filename = family + '-latin-' + weight + '-normal.woff2';
    fs.copyFileSync(path.join(modules, '@fontsource', family, 'files', filename), path.join(output, 'vendor', filename));
    const name = family === 'barlow' ? 'Barlow' : 'Barlow Condensed';
    fonts += '@font-face{font-family:"' + name + '";font-style:normal;font-weight:' + weight + ';font-display:swap;src:url("./vendor/' + filename + '") format("woff2")}\n';
  }
}
fs.writeFileSync(path.join(output, 'fonts.css'), fonts);
template = template.replace(/<link rel="stylesheet" href="https:\/\/fonts.googleapis.com[^>]+>/, '<link rel="stylesheet" href="./fonts.css">');
template = template.replace('width=device-width, initial-scale=1.0', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
template = template.replace('<script src="./config.js"></script>', '<script src="./config.js"></script>\n<script src="./native-settings.js"></script>\n<script src="./native-runtime.js"></script>\n<link rel="stylesheet" href="./native.css">');
template = template.replace('<link rel="manifest" href="/manifest.webmanifest" />', '');
const result = babel.transformSync(fs.readFileSync(path.join(root, 'src/app.jsx'), 'utf8'), {
  filename: 'app.jsx', babelrc: false, configFile: false,
  presets: [[require.resolve('../../node_modules/@babel/preset-react'), { runtime: 'classic' }]],
  comments: false,
});
const shared = fs.readFileSync(path.join(root, 'src/scope-templates.js'), 'utf8');
const code = (shared + '\n' + result.code).replace(/<\/script>/gi, '<\\/script>');
if (!template.includes('/*__APP__*/')) throw Error('Missing app template marker');
fs.writeFileSync(path.join(output, 'index.html'), template.replace('/*__APP__*/', code));
fs.copyFileSync(path.join(root, 'config.js'), path.join(output, 'config.js'));
fs.cpSync(path.join(root, 'icons'), path.join(output, 'icons'), { recursive: true });
fs.cpSync(path.join(root, 'integrations'), path.join(output, 'integrations'), { recursive: true });
for (const name of ['native-runtime.js', 'native.css']) {
  fs.copyFileSync(path.join(mobile, 'runtime', name), path.join(output, name));
}
for (const name of ['privacy.html', 'delete-account.html']) {
  fs.copyFileSync(path.join(mobile, 'store', name), path.join(output, name));
}
const push = require('./configure-firebase.cjs').configureFirebase(mobile);
fs.writeFileSync(path.join(output, 'native-settings.js'), 'window.SIQ_PLAY_APP = true;\nwindow.SIQ_NATIVE_PUSH_ENABLED = ' + push + ' && window.Capacitor?.getPlatform?.() === \"android\";\nwindow.JTPQ_CONFIG.allowCompanySignup = false;\n');
console.log('Built bundled mobile app. Native push configured: ' + push);
