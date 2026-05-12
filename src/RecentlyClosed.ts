// DISABLED: "Recently closed" feature.
//
// chrome.sessions.getRecentlyClosed() returns tab objects whose url/title/favIconUrl
// fields are populated only when the manifest declares the "tabs" permission.
// "tabs" triggers the "Read your browsing history" install prompt — unwanted for a
// bookmarks extension. Keeping permissions minimal is more valuable than this feature.
//
// To restore: add "sessions" and "tabs" to manifest.json permissions, uncomment the
// import + bootstrap in index.ts, the wiring in View.ts, the showRecentlyClosed
// field in Settings.ts, the dialog field in dist/newtab/newtab.html, and the
// #recently-closed selector in dist/newtab/newtab.css.

/*
export type RecentlyClosedEntry = {
  title: string;
  url: string;
};

export class RecentlyClosed {
  public entries: RecentlyClosedEntry[] = [];

  async init() {
    const sessions = await chrome.sessions.getRecentlyClosed();
    const flat: RecentlyClosedEntry[] = [];

    sessions.forEach((session) => {
      if (session.tab && session.tab.url) {
        flat.push({ title: session.tab.title || session.tab.url, url: session.tab.url });
        return;
      }
      if (session.window && session.window.tabs) {
        session.window.tabs.forEach((tab) => {
          if (tab.url) {
            flat.push({ title: tab.title || tab.url, url: tab.url });
          }
        });
      }
    });

    const seen = new Set<string>();
    this.entries = flat.filter((e) => {
      if (seen.has(e.url)) return false;
      seen.add(e.url);
      return true;
    });

    return this;
  }
}
*/

export {};
