/* JTProQuotes build step.
 *
 *   npm install     (once)
 *   npm run build
 *
 * Compiles src/app.jsx and injects it into src/index.template.html,
 * writing the finished index.html that Vercel serves. Compiling here
 * instead of in the browser removes a 2.8 MB Babel download and the
 * start-up delay that came with it.
 *
 * Edit src/app.jsx, not index.html.
 */
const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");

const root = __dirname;
const jsxPath = path.join(root, "src", "app.jsx");
const tplPath = path.join(root, "src", "index.template.html");
const outPath = path.join(root, "index.html");

const jsx = fs.readFileSync(jsxPath, "utf8");

let result;
try {
  result = babel.transformSync(jsx, {
    filename: "app.jsx",
    babelrc: false,
    configFile: false,
    presets: [
      // "classic" emits React.createElement, which is what the UMD React
      // global on the page provides. The automatic runtime would emit an
      // import statement and break in a plain <script> tag.
      ["@babel/preset-react", { runtime: "classic" }],
    ],
    comments: false,
    compact: false,
  });
} catch (e) {
  console.error("\nBuild failed — JSX did not compile:\n");
  console.error(e.message);
  process.exit(1);
}

const template = fs.readFileSync(tplPath, "utf8");
if (!template.includes("/*__APP__*/")) {
  console.error("Build failed: src/index.template.html is missing the /*__APP__*/ marker.");
  process.exit(1);
}

// A literal </script> inside the code would close the tag early.
const safe = result.code.replace(/<\/script>/gi, "<\\/script>");

const html = template.replace("/*__APP__*/", safe);
fs.writeFileSync(outPath, html);

const kb = (n) => (n / 1024).toFixed(1) + " KB";
console.log("Built index.html  (" + kb(html.length) + ", app " + kb(safe.length) + ")");
