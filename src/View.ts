import {BooleanSetting, LayoutSetting, Settings, SettingsProps, ThemeSetting} from "./Settings";
import {Bookmarks} from "./Bookmarks";
import {BookmarkClicks, ClickEntry} from "./BookmarkClicks";
// import {RecentlyClosed, RecentlyClosedEntry} from "./RecentlyClosed"; // disabled — see RecentlyClosed.ts
import {$, $$q, faviconURL, truncateLongText} from "./utils";
import BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode;

export class View {
  constructor(
    private settings: Settings,
    private bookmarks: Bookmarks,
    private bookmarkClicks: BookmarkClicks,
    // private recentlyClosed: RecentlyClosed,
  ) {
  }

  renderBookmark(bookmark: BookmarkTreeNode, size: number, isDraggable: boolean) {
    const $bookmark = document.createElement("a");
    $bookmark.href = bookmark.url || "";
    // Keep "id" for later sorting operations.
    $bookmark.dataset.index = bookmark.index?.toString();
    $bookmark.dataset.id = bookmark.id;
    $bookmark.dataset.parentId = bookmark.parentId;

    $bookmark.classList.add("bookmark");
    $bookmark.classList.add("flex-item");
    $bookmark.addEventListener("click", (e) => {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
      $bookmark.classList.add("loading");
    });
    // Track clicks (left/middle/modifier) for Top + Last bookmarks. Mousedown
    // captures middle-click and Cmd/Ctrl+click — both bypass the plain "click" handler.
    $bookmark.addEventListener("mousedown", (e) => {
      if (e.button !== 0 && e.button !== 1) return;
      this.bookmarkClicks.record($bookmark.href, bookmark.title);
    });

    // Handle drag
    if (isDraggable) {
      $bookmark.setAttribute("draggable", "true");
      let animationFrame = 0;
      $bookmark.addEventListener("drag", (e: DragEvent) => {
        if (animationFrame) return;
        animationFrame = requestAnimationFrame(() => {
          animationFrame = 0;
          const selectedItem = e.target as HTMLElement;
          if (!selectedItem) {
            return;
          }

          const x = e.clientX, y = e.clientY;

          selectedItem.classList.add('drag-sort-active');
          const rawElement = document.elementFromPoint(x, y);
          if (!rawElement) return;
          let swapItem = rawElement.closest('.bookmark') as HTMLElement;
          if (!swapItem) return;
          const list = selectedItem.parentNode;

          if (!list) {
            return;
          }

          if (swapItem !== selectedItem && list === swapItem.parentNode) {
            swapItem = swapItem !== selectedItem.nextSibling as HTMLElement ? swapItem : swapItem.nextSibling as HTMLElement;
            list.insertBefore(selectedItem, swapItem);
            selectedItem.dataset.indexSwap = swapItem.dataset.index;
            selectedItem.dataset.parentIdSwap = swapItem.dataset.parentId;
            // console.log(selectedItem.innerText, swapItem.innerText);
          }
        });
      });
      $bookmark.addEventListener("dragend", async (e) => {
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = 0;
        }
        const selectedItem = e.target as HTMLElement;
        selectedItem.classList.remove('drag-sort-active');
        if (selectedItem.dataset.indexSwap) {
          try {
            await this.bookmarks.move(selectedItem.dataset.id || '', selectedItem.dataset.indexSwap, selectedItem.dataset.parentIdSwap || '');
          } catch (err) {
            console.warn('Failed to reorder bookmark:', err);
          } finally {
            // Recompute indices from current DOM order
            const parent = selectedItem.parentNode;
            if (parent) {
              parent.querySelectorAll('.bookmark').forEach((el, i) => {
                (el as HTMLElement).dataset.index = i.toString();
              });
            }
            delete selectedItem.dataset.indexSwap;
            delete selectedItem.dataset.parentIdSwap;
          }
        }
      });
    }

    // Img.
    const $bookmarkImg = document.createElement('img');
    $bookmarkImg.src = faviconURL(bookmark.url || '', size.toString());
    $bookmarkImg.className = "bookmark-icon";

    // Link.
    const $bookmarkLink = document.createElement("div");
    $bookmarkLink.className = "bookmark-link";

    const $bookmarkLinkText = document.createElement("span");
    $bookmarkLinkText.innerText = truncateLongText(bookmark.title);

    $bookmark.appendChild($bookmarkImg);
    $bookmark.appendChild($bookmarkLink).appendChild($bookmarkLinkText);

    return $bookmark;
  }

  async renderSearchBookmarks() {
    $("bookmarks-search").style.display = 'block';
  }

  bindSearchListeners() {
    const $searchField = $("bookmarks-search-query");
    const $results = $("bookmarks-search-results");
    const $startPage = $("start-page");

    $searchField.addEventListener("focusin", (e: Event) => {
      (e.target as HTMLInputElement).setAttribute("placeholder", "");
    });
    $searchField.addEventListener("focusout", (e: Event) => {
      (e.target as HTMLInputElement).setAttribute("placeholder", "Search my bookmarks ...");
    });

    let debounceTimer = 0;
    $searchField.addEventListener("input", (e: Event) => {
      clearTimeout(debounceTimer);

      $results.replaceChildren();
      $results.style.display = 'none';
      $startPage.classList.remove("blur");

      debounceTimer = window.setTimeout(() => {
        const query = (e.target as HTMLInputElement).value.trim();
        if (!query) {
          return;
        }
        const bookmarksFound = this.bookmarks.search(query);

        if (bookmarksFound && bookmarksFound.length > 0) {
          bookmarksFound.forEach((bookmark) => {
            const size = this.settings.getValue("bookmarkItemSize") === "large" ? 32 : 16;
            const $bookmark = this.renderBookmark(bookmark, size, false);
            $results.appendChild($bookmark);
          });

          $results.style.display = 'block';
          $startPage.classList.add("blur");
        }
      }, 200);
    });
  }

  async renderStartPageBookmarks() {
    const $bookmarks = $("bookmarks");
    const $noBookmarksMsg = $("no-bookmarks-msg");
    const selectedBookmarksByFolder = this.bookmarks.getSelectedBookmarksByFolder();

    if (this.settings.getValue("firstRun") || !selectedBookmarksByFolder) {
      $noBookmarksMsg.style.display = 'block';
      return;
    }

    $noBookmarksMsg.style.display = 'none';

    const showFolderNames = this.settings.getValue("bookmarksShowFolderName");

    // Render bookmarks items.
    selectedBookmarksByFolder.forEach((item, index) => {
      const treeNodeChildren = item.node?.children;
      if (!treeNodeChildren) {
        return;
      }

      // Create the "folder" node that contains all bookmarks.
      const $folder = document.createElement("div");
      $folder.classList.add("bookmarks-folder");

      if (showFolderNames === BooleanSetting.YES) {
        const $folderTitleContainer = document.createElement("div");
        $folderTitleContainer.classList.add("bookmarks-folder-title");
        $folderTitleContainer.innerText = item.folderName;
        $folder.appendChild($folderTitleContainer);
      }

      const $folderBookMarksContainer = document.createElement("div");
      $folderBookMarksContainer.classList.add("bookmarks-folder-bookmarks");

      $folder.appendChild($folderBookMarksContainer);

      treeNodeChildren.forEach((bookmark) => {
        // Subfolder, skip.
        if (bookmark.children) {
          return;
        }

        const size = this.settings.getValue("bookmarkItemSize") === "large" ? 32 : 16;
        const isDraggable = this.settings.getValue("bookmarksReordering");
        const $bookmark = this.renderBookmark(bookmark, size, isDraggable === BooleanSetting.YES);

        $folderBookMarksContainer.appendChild($bookmark);
      });

      $bookmarks.appendChild($folder);
    });
  }

  renderClickEntry(entry: ClickEntry, size: number) {
    const $item = document.createElement("a");
    $item.href = entry.url;
    $item.classList.add("bookmark");
    $item.classList.add("flex-item");
    $item.addEventListener("click", (e) => {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
      $item.classList.add("loading");
    });
    $item.addEventListener("mousedown", (e) => {
      if (e.button !== 0 && e.button !== 1) return;
      this.bookmarkClicks.record($item.href, entry.title);
    });

    const $img = document.createElement("img");
    $img.src = faviconURL(entry.url, size.toString());
    $img.className = "bookmark-icon";

    const $link = document.createElement("div");
    $link.className = "bookmark-link";

    const $text = document.createElement("span");
    $text.innerText = truncateLongText(entry.title);

    $item.appendChild($img);
    $item.appendChild($link).appendChild($text);

    return $item;
  }

  async renderTopBookmarks() {
    if (this.settings.isOff("showTopBookmarks")) return;
    const items = this.bookmarkClicks.getTop(10);
    if (items.length === 0) return;

    const $startPage = $("start-page");
    const $bookmarks = $("bookmarks");

    const $section = document.createElement("div");
    $section.id = "top-bookmarks";

    const $folder = document.createElement("div");
    $folder.classList.add("bookmarks-folder");

    const $title = document.createElement("div");
    $title.classList.add("bookmarks-folder-title");
    $title.innerText = "Top bookmarks";
    $folder.appendChild($title);

    const $items = document.createElement("div");
    $items.classList.add("bookmarks-folder-bookmarks");
    $folder.appendChild($items);

    const size = this.settings.getValue("bookmarkItemSize") === "large" ? 32 : 16;
    items.forEach((entry) => {
      $items.appendChild(this.renderClickEntry(entry, size));
    });

    $section.appendChild($folder);
    $startPage.insertBefore($section, $bookmarks);
  }

  async renderLastBookmarks() {
    if (this.settings.isOff("showLastBookmarks")) return;
    const items = this.bookmarkClicks.getLast(15);
    if (items.length === 0) return;

    const $startPage = $("start-page");
    const $bookmarks = $("bookmarks");

    const $section = document.createElement("div");
    $section.id = "last-bookmarks";

    const $folder = document.createElement("div");
    $folder.classList.add("bookmarks-folder");

    const $title = document.createElement("div");
    $title.classList.add("bookmarks-folder-title");
    $title.innerText = "Last bookmarks";
    $folder.appendChild($title);

    const $items = document.createElement("div");
    $items.classList.add("bookmarks-folder-bookmarks");
    $folder.appendChild($items);

    const size = this.settings.getValue("bookmarkItemSize") === "large" ? 32 : 16;
    items.forEach((entry) => {
      $items.appendChild(this.renderClickEntry(entry, size));
    });

    $section.appendChild($folder);
    $startPage.insertBefore($section, $bookmarks);
  }

  // "Recently closed" rendering disabled — see RecentlyClosed.ts for the why
  // (requires "tabs" permission which triggers the "Read your browsing history" prompt).
  /*
  async renderRecentlyClosed() {
    if (this.settings.isOff("showRecentlyClosed") || this.recentlyClosed.entries.length === 0) {
      return;
    }

    const $wrapper = $("wrapper");
    const $bookmarks = $("bookmarks");

    const $section = document.createElement("div");
    $section.id = "recently-closed";

    const $folder = document.createElement("div");
    $folder.classList.add("bookmarks-folder");

    const $title = document.createElement("div");
    $title.classList.add("bookmarks-folder-title");
    $title.innerText = "Recently closed";
    $folder.appendChild($title);

    const $items = document.createElement("div");
    $items.classList.add("bookmarks-folder-bookmarks");
    $folder.appendChild($items);

    const size = this.settings.getValue("bookmarkItemSize") === "large" ? 32 : 16;
    this.recentlyClosed.entries.forEach((entry) => {
      $items.appendChild(this.renderRecentlyClosedEntry(entry, size));
    });

    $section.appendChild($folder);
    $wrapper.insertBefore($section, $bookmarks);
  }

  renderRecentlyClosedEntry(entry: RecentlyClosedEntry, size: number) {
    const $item = document.createElement("a");
    $item.href = entry.url;
    $item.classList.add("bookmark");
    $item.classList.add("flex-item");
    $item.addEventListener("click", (e) => {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
      $item.classList.add("loading");
    });

    const $img = document.createElement("img");
    $img.src = faviconURL(entry.url, size.toString());
    $img.className = "bookmark-icon";

    const $link = document.createElement("div");
    $link.className = "bookmark-link";

    const $text = document.createElement("span");
    $text.innerText = truncateLongText(entry.title);

    $item.appendChild($img);
    $item.appendChild($link).appendChild($text);

    return $item;
  }
  */

  preRenderSettingsDialog() {
    const $settingsDialog = $<HTMLDialogElement>("settings-dialog");
    const $settingsLinks = $$q(".settings-link");
    const $form = $settingsDialog.querySelector<HTMLFormElement>("form");

    let originalSettings: SettingsProps | null = null;
    let saved = false;

    const radioToKey: Record<string, keyof SettingsProps> = {
      "settings-bookmark-show-folder-name": "bookmarksShowFolderName",
      "settings-layout": "layout",
      "settings-bookmarks-width": "bookmarksWidth",
      "settings-bookmark-item-icon": "bookmarkItemIcon",
      "settings-bookmark-item-size": "bookmarkItemSize",
      "settings-show-subfolders": "bookmarksShowSubfolders",
      "settings-bookmark-reorder": "bookmarksReordering",
      "settings-bookmark-search-bar": "bookmarksSearchBar",
      "settings-show-top-bookmarks": "showTopBookmarks",
      "settings-show-last-bookmarks": "showLastBookmarks",
      // "settings-show-recently-closed": "showRecentlyClosed",
      "settings-theme": "theme",
    };

    const setRadio = (name: string, value: string) => {
      const $radio = document.querySelector<HTMLInputElement>(`input[type="radio"][name="${name}"][value="${value}"]`);
      if ($radio) $radio.checked = true;
    };

    const populateForm = () => {
      $<HTMLInputElement>("settings-root-folder").value = this.settings.getValue("rootFolderName");
      for (const [name, key] of Object.entries(radioToKey)) {
        setRadio(name, this.settings.getValue(key) as string);
      }
    };

    populateForm();

    // Live preview: every radio change mutates settings + re-renders.
    $settingsDialog.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach(($radio) => {
      $radio.addEventListener("change", () => {
        if (!$radio.checked) return;
        const key = radioToKey[$radio.name];
        if (!key) return;
        this.settings.setValue(key, $radio.value as never);
        void this.refresh();
      });
    });

    // Live preview: debounced root-folder text input.
    let folderDebounce = 0;
    $<HTMLInputElement>("settings-root-folder").addEventListener("input", (e) => {
      clearTimeout(folderDebounce);
      const value = (e.target as HTMLInputElement).value;
      folderDebounce = window.setTimeout(() => {
        this.settings.setValue("rootFolderName", value);
        void this.refresh();
      }, 200);
    });

    // <form method="dialog"> would close on Enter inside the text input and trigger the
    // restore path. Block implicit submit so Enter is a no-op (preview already updates).
    $form?.addEventListener("submit", (e) => {
      e.preventDefault();
    });

    // Close-without-save (Escape, backdrop, etc.): restore the snapshot.
    $settingsDialog.addEventListener("close", () => {
      if (!saved && originalSettings) {
        this.settings.settings = structuredClone(originalSettings);
        void this.refresh();
      }
    });

    $settingsLinks.forEach(($settingsLink) => {
      $settingsLink.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        originalSettings = structuredClone(this.settings.settings);
        saved = false;
        populateForm();
        $settingsDialog.showModal();
      });
    });

    $("settings-save-btn").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      saved = true;
      this.settings.save().then(() => {
        $settingsDialog.close();
      });
    });
  }

  private applySettingsClasses() {
    const $wrapper = $("wrapper");
    const $bookmarks = $("bookmarks");
    const $body = document.body;

    Array.from($wrapper.classList).forEach((c) => {
      if (
        c.startsWith("bookmarksWidth--") ||
        c.startsWith("bookmarkItemSize--") ||
        c.startsWith("bookmarkItemIcon--")
      ) {
        $wrapper.classList.remove(c);
      }
    });
    const width = this.settings.getValue("bookmarksWidth");
    if (width) $wrapper.classList.add(`bookmarksWidth--${width}`);
    $wrapper.classList.add(`bookmarkItemSize--${this.settings.getValue("bookmarkItemSize")}`);
    $wrapper.classList.add(`bookmarkItemIcon--${this.settings.getValue("bookmarkItemIcon")}`);

    $bookmarks.classList.remove("flex-container-even-columns", "flex-container-rows");
    if (this.settings.getValue("layout") === LayoutSetting.COLUMNS) {
      $bookmarks.classList.add("flex-container-even-columns");
    } else {
      $bookmarks.classList.add("flex-container-rows");
    }

    Array.from($body.classList).forEach((c) => {
      if (c.startsWith("theme--")) $body.classList.remove(c);
    });
    const theme = this.settings.getValue("theme");
    if (theme && theme !== ThemeSetting.DEFAULT) {
      $body.classList.add(`theme--${theme}`);
    }
  }

  async refresh() {
    $("bookmarks").replaceChildren();
    document.getElementById("top-bookmarks")?.remove();
    document.getElementById("last-bookmarks")?.remove();
    $("bookmarks-search").style.display = "none";
    $("bookmarks-search-results").replaceChildren();
    $("start-page").classList.remove("blur");

    this.applySettingsClasses();

    if (
      !this.settings.getValue("firstRun") &&
      this.settings.getValue("bookmarksSearchBar") === BooleanSetting.YES
    ) {
      await this.renderSearchBookmarks();
    }
    await this.renderTopBookmarks();
    await this.renderLastBookmarks();
    await this.renderStartPageBookmarks();
  }

  // debugSettings() {
  //     $("bookmarks-settings-debug").innerHTML = JSON.stringify(this.settings, null, 2);
  // }

  async render() {
    this.applySettingsClasses();
    this.bindSearchListeners();

    if (
      !this.settings.getValue("firstRun") &&
      this.settings.getValue("bookmarksSearchBar") === BooleanSetting.YES
    ) {
      await this.renderSearchBookmarks();
    }
    await this.renderTopBookmarks();
    await this.renderLastBookmarks();
    // await this.renderRecentlyClosed(); // disabled — see RecentlyClosed.ts
    await this.renderStartPageBookmarks();
    this.preRenderSettingsDialog();
  }

}
