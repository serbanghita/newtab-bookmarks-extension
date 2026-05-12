export type ClickEntry = { url: string; title: string };

type ClickData = {
  counts: Record<string, { count: number; title: string }>;
  last: ClickEntry[];
};

/**
 * Tracks bookmark clicks in chrome.storage.local so the New Tab page can
 * surface "Top bookmarks" (by lifetime count) and "Last bookmarks" (newest-first,
 * deduped) without needing the `history` permission.
 */
export class BookmarkClicks {
  static STORAGE_KEY = "newtab-bookmarks-clicks";
  static LAST_MAX = 15;

  private data: ClickData = { counts: {}, last: [] };

  async init() {
    const stored = await chrome.storage.local.get(BookmarkClicks.STORAGE_KEY);
    const persisted = stored?.[BookmarkClicks.STORAGE_KEY] as ClickData | undefined;
    if (persisted) {
      this.data = {
        counts: persisted.counts ?? {},
        last: persisted.last ?? [],
      };
    }
    return this;
  }

  record(url: string, title: string) {
    if (!url) return;
    const prev = this.data.counts[url]?.count ?? 0;
    this.data.counts[url] = { count: prev + 1, title };
    this.data.last = [{ url, title }, ...this.data.last.filter((e) => e.url !== url)].slice(0, BookmarkClicks.LAST_MAX);
    // Fire-and-forget: the storage RPC is dispatched synchronously by `set()`,
    // so the write survives left-click navigation.
    void chrome.storage.local.set({ [BookmarkClicks.STORAGE_KEY]: this.data });
  }

  getTop(limit: number): ClickEntry[] {
    return Object.entries(this.data.counts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([url, { title }]) => ({ url, title }));
  }

  getLast(limit: number): ClickEntry[] {
    return this.data.last.slice(0, limit);
  }
}
