const REPO = 'kulczy/md-editor'

// True when the released tag is a higher semver than what's installed.
// numeric:true compares digit-runs as numbers, so 0.10.0 > 0.9.0 (plain string compare gets this wrong).
export function isNewer(latestTag, current) {
  return String(latestTag).replace(/^v/, '').localeCompare(current, undefined, { numeric: true }) > 0
}

// ponytail: launch-time check only — native notification, click opens the release page.
// Silent on offline / rate-limit / up-to-date. No in-app install (that needs code signing).
export async function checkUpdate(current) {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' }
    })
    if (!res.ok) return // no release yet / rate-limited / offline
    const { tag_name, html_url } = await res.json()
    if (!isNewer(tag_name, current)) return
    const { Notification, shell } = await import('electron')
    const n = new Notification({
      title: `md ${String(tag_name).replace(/^v/, '')} is available`,
      body: `You're on ${current}. Click to download.`
    })
    n.on('click', () => shell.openExternal(html_url))
    n.show()
  } catch { /* network blip → try again next launch */ }
}
