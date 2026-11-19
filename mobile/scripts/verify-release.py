"""Inspect release outputs without reading or printing private signing material."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import zipfile
import tempfile

mobile = Path(__file__).resolve().parent.parent
aab = mobile / "android/app/build/outputs/bundle/release/app-release.aab"
apk = mobile / "android/app/build/outputs/apk/release/app-release.apk"
for artifact in [aab, apk]:
    if not artifact.is_file():
        raise SystemExit("Missing release output: " + str(artifact))
with zipfile.ZipFile(aab) as bundle:
    names = bundle.namelist()
    if not any(name.endswith(".RSA") and name.startswith("META-INF/") for name in names):
        raise SystemExit("The bundle has no signing certificate.")
    if "base/assets/public/index.html" not in names:
        raise SystemExit("The bundled application is missing.")
    settings = bundle.read("base/assets/public/native-settings.js").decode()
    config = json.loads(bundle.read("base/assets/capacitor.config.json"))
    if config.get("server", {}).get("url"):
        raise SystemExit("Release points to a remote website.")
    if "window.SIQ_PLAY_APP = true" not in settings:
        raise SystemExit("Play-specific account mode is missing.")
    native_libraries = [name for name in names if name.endswith(".so")]
    with tempfile.TemporaryDirectory() as directory:
        for index, name in enumerate(native_libraries):
            library = Path(directory) / (str(index) + ".so")
            library.write_bytes(bundle.read(name))
            result = subprocess.run(["readelf", "-lW", str(library)], capture_output=True, text=True, check=True)
            segments = [line for line in result.stdout.splitlines() if line.strip().startswith("LOAD")]
            if any(int(line.split()[-1], 16) < 16384 for line in segments):
                raise SystemExit("A native library does not support 16 KB pages: " + name)

print(json.dumps({
    "package": "com.siquotespro.app",
    "native_shared_libraries": native_libraries,
    "artifacts": [{"name": p.name, "bytes": p.stat().st_size, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in [aab, apk]],
}, indent=2))
jarsigner = str(Path(os.environ["JAVA_HOME"]) / "bin/jarsigner") if os.environ.get("JAVA_HOME") else "jarsigner"
subprocess.run([jarsigner, "-verify", str(aab)], check=True, stdout=subprocess.DEVNULL)
