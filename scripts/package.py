"""Build Chromium and Firefox development packages using Python's standard library."""
import hashlib
import json
import shutil
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
FILES = [
    "shared.js", "background.js", "page.js", "timer.js", "content.js", "content.css",
    "popup.js", "popup.html", "popup.css",
    "icons/icon16.png", "icons/icon48.png", "icons/icon128.png", "LICENSE",
]


def main():
    manifest = json.loads((ROOT / "manifest.json").read_text())
    package = json.loads((ROOT / "package.json").read_text())
    if package["version"] != manifest["version"]:
        raise ValueError("package.json and manifest.json versions must match")
    for name in FILES:
        if not (ROOT / name).is_file():
            raise FileNotFoundError(name)

    DIST.mkdir(exist_ok=True)
    checksums = []
    for browser in ["chromium", "firefox"]:
        output = DIST / browser
        if output.exists():
            shutil.rmtree(output)
        output.mkdir()
        variant = dict(manifest)
        if browser == "firefox":
            variant.pop("minimum_chrome_version")
            variant["background"] = {"scripts": ["shared.js", "background.js"]}
            variant["browser_specific_settings"] = {
                "gecko": {
                    "id": "focuvia@zdying.github.io",
                    "strict_min_version": "142.0",
                    "data_collection_permissions": {"required": ["browsingActivity"]},
                }
            }
        (output / "manifest.json").write_text(json.dumps(variant, indent=2) + "\n")
        for name in FILES:
            destination = output / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, destination)

        archive = DIST / f"focuvia-{manifest['version']}-{browser}.zip"
        with ZipFile(archive, "w", ZIP_DEFLATED) as bundle:
            for name in ["manifest.json", *FILES]:
                bundle.write(output / name, name)
        checksums.append(f"{hashlib.sha256(archive.read_bytes()).hexdigest()}  {archive.name}")
        print(f"Built {archive.relative_to(ROOT)}")
    (DIST / "SHA256SUMS").write_text("\n".join(checksums) + "\n")


if __name__ == "__main__":
    main()
