// Only meaningful inside the native Capacitor app — the web/PWA version
// always serves the latest code directly, there's nothing to "update".
//
// This works by comparing the installed app's own versionCode (set by
// build-android.yml to the GitHub Actions run number) against the tag
// name of the repo's latest GitHub Release (tagged "v<run number>" by
// that same workflow). No server of our own needed.
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";

const REPO = "HimanshuSinghdev/workout-tracker";

export async function checkForUpdate() {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    const info = await CapApp.getInfo();
    const currentCode = parseInt(info.build, 10);

    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (!res.ok) return null;
    const release = await res.json();

    const match = /^v(\d+)$/.exec(release.tag_name || "");
    if (!match) return null;
    const latestCode = parseInt(match[1], 10);

    if (!Number.isFinite(currentCode) || !Number.isFinite(latestCode)) return null;
    if (latestCode <= currentCode) return null;

    const asset = (release.assets || []).find((a) => a.name.endsWith(".apk"));
    if (!asset) return null;

    return {
      version: release.tag_name,
      downloadUrl: asset.browser_download_url,
    };
  } catch (err) {
    // Offline, rate-limited, or GitHub unreachable — just skip silently,
    // this is a nice-to-have, not something worth bothering the user about.
    return null;
  }
}
