import json
import unittest
from zipfile import ZipFile

from scripts.package import DIST, ROOT, main


class PackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        main()
        cls.version = json.loads((ROOT / "manifest.json").read_text())["version"]

    def test_runtime_entries_and_browser_manifests(self):
        for target in ["chromium", "firefox"]:
            with self.subTest(browser=target):
                with ZipFile(DIST / f"focuvia-{self.version}-{target}.zip") as bundle:
                    self.assertIsNone(bundle.testzip())
                    entries = set(bundle.namelist())
                    self.assertIn("LICENSE", entries)
                    self.assertFalse(any(name.startswith(("docs/", "tests/", "node_modules/", ".git")) for name in entries))
                    manifest = json.loads(bundle.read("manifest.json"))
                    background = manifest["background"]
                    scripts = manifest["content_scripts"][0]["js"]
                    scripts += background.get("scripts", [background.get("service_worker")])
                    assets = scripts + manifest["content_scripts"][0]["css"]
                    assets += list(manifest["icons"].values())
                    assets += [manifest["action"]["default_popup"], "popup.js", "popup.css"]
                    for name in assets:
                        self.assertIn(name, entries)
                    if target == "firefox":
                        self.assertNotIn("service_worker", background)
                        self.assertEqual(background["scripts"][0], "shared.js")
                        self.assertNotIn("minimum_chrome_version", manifest)
                        gecko = manifest["browser_specific_settings"]["gecko"]
                        self.assertEqual(gecko["data_collection_permissions"]["required"], ["browsingActivity"])
                    else:
                        self.assertIn("service_worker", background)
                        self.assertNotIn("scripts", background)

    def test_browser_packages_share_identical_runtime_files(self):
        with ZipFile(DIST / f"focuvia-{self.version}-chromium.zip") as chromium:
            with ZipFile(DIST / f"focuvia-{self.version}-firefox.zip") as firefox:
                self.assertEqual(set(chromium.namelist()), set(firefox.namelist()))
                for name in chromium.namelist():
                    if name != "manifest.json":
                        self.assertEqual(chromium.read(name), firefox.read(name), name)
