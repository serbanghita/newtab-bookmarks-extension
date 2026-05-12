import {BooleanSetting, LayoutSetting, Settings, SizeSetting, ThemeSetting} from "./Settings";
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
    const $container = $("bookmarks-search");
    // const $form = $("bookmarks-search-form");
    const $searchField = $("bookmarks-search-query");
    const $results = $("bookmarks-search-results");
    const $startPage = $("start-page");
    const $bookmarks = $("bookmarks");

    if (this.settings.getValue("layout") === LayoutSetting.COLUMNS) {
      $bookmarks.classList.add("flex-container-even-columns");
    } else {
      $bookmarks.classList.add("flex-container-rows");
    }

    $container.style.display = 'block';

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
    const $wrapper = $("wrapper");
    const selectedBookmarksByFolder = this.bookmarks.getSelectedBookmarksByFolder();

    if (this.settings.getValue("firstRun") || !selectedBookmarksByFolder) {
      const $noBookmarksMsg = $("no-bookmarks-msg");
      $noBookmarksMsg.style.display = 'block';
      return;
    }

    const bookmarksWidth = this.settings.getValue("bookmarksWidth");
    const showFolderNames = this.settings.getValue("bookmarksShowFolderName");

    if (bookmarksWidth) {
      $wrapper.classList.add(`bookmarksWidth--${bookmarksWidth}`);
    }

    // Set CSS settings to the main wrapper (so we can paint conditionally later with CSS).
    // for (const settingName in this.settings.getAll()) {
    //   $wrapper.classList.add(`${settingName}--${this.settings.getValue(settingName as keyof SettingsProps)}`);
    // }

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

    // Set form default values from Chrome's "storage".
    $<HTMLInputElement>("settings-root-folder").value = this.settings.getValue("rootFolderName");
    $<HTMLInputElement>("settings-bookmark-show-folder-name").value = this.settings.getValue("bookmarksShowFolderName");
    $<HTMLInputElement>("settings-layout").value = this.settings.getValue("layout");
    $<HTMLInputElement>("settings-bookmarks-width").value = this.settings.getValue("bookmarksWidth");
    $<HTMLInputElement>("settings-bookmark-item-icon").value = this.settings.getValue("bookmarkItemIcon");
    $<HTMLInputElement>("settings-bookmark-item-size").value = this.settings.getValue("bookmarkItemSize");
    $<HTMLInputElement>("settings-show-subfolders").value = this.settings.getValue("bookmarksShowSubfolders");
    $<HTMLInputElement>("settings-bookmark-reorder").value = this.settings.getValue("bookmarksReordering");
    $<HTMLInputElement>("settings-bookmark-search-bar").value = this.settings.getValue("bookmarksSearchBar");
    $<HTMLInputElement>("settings-show-top-bookmarks").value = this.settings.getValue("showTopBookmarks");
    $<HTMLInputElement>("settings-show-last-bookmarks").value = this.settings.getValue("showLastBookmarks");
    // $<HTMLInputElement>("settings-show-recently-closed").value = this.settings.getValue("showRecentlyClosed");
    $<HTMLInputElement>("settings-theme").value = this.settings.getValue("theme");

    $settingsLinks.forEach(($settingsLink) => {
      $settingsLink.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        $settingsDialog.showModal();
      });
    })


    const $saveSettingsBtn = $("settings-save-btn");
    $saveSettingsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      this.settings.save({
        rootFolderName: $<HTMLInputElement>("settings-root-folder").value,
        bookmarksShowFolderName: $<HTMLInputElement>("settings-bookmark-show-folder-name").value as BooleanSetting,
        layout: $<HTMLInputElement>("settings-layout").value as LayoutSetting,
        bookmarksWidth: $<HTMLInputElement>("settings-bookmarks-width").value,
        bookmarkItemIcon: $<HTMLInputElement>("settings-bookmark-item-icon").value as BooleanSetting,
        bookmarkItemSize: $<HTMLInputElement>("settings-bookmark-item-size").value as SizeSetting,
        bookmarksShowSubfolders: $<HTMLInputElement>("settings-show-subfolders").value as BooleanSetting,
        bookmarksReordering: $<HTMLInputElement>("settings-bookmark-reorder").value as BooleanSetting,
        bookmarksSearchBar: $<HTMLInputElement>("settings-bookmark-search-bar").value as BooleanSetting,
        showTopBookmarks: $<HTMLInputElement>("settings-show-top-bookmarks").value as BooleanSetting,
        showLastBookmarks: $<HTMLInputElement>("settings-show-last-bookmarks").value as BooleanSetting,
        // showRecentlyClosed: $<HTMLInputElement>("settings-show-recently-closed").value as BooleanSetting,
        theme: $<HTMLInputElement>("settings-theme").value as ThemeSetting,
      }).then(() => {
        $settingsDialog.close();
        window.location.reload();
      })
    });
  }

  // debugSettings() {
  //     $("bookmarks-settings-debug").innerHTML = JSON.stringify(this.settings, null, 2);
  // }

  async render() {
    // Apply theme.
    const theme = this.settings.getValue("theme");
    if (theme && theme !== ThemeSetting.DEFAULT) {
      document.body.classList.add(`theme--${theme}`);
    }

    // Bookmarks search bar.
    if (
      !this.settings.getValue("firstRun") &&
      this.settings.getValue("bookmarksSearchBar") === 'yes'
    ) {
      await this.renderSearchBookmarks();
    }
    // Top + Last bookmarks (counter-based, derived from clicks on this page).
    await this.renderTopBookmarks();
    await this.renderLastBookmarks();
    // await this.renderRecentlyClosed(); // disabled — see RecentlyClosed.ts
    // Start Page bookmarks.
    await this.renderStartPageBookmarks();
    // Hidden "Settings" dialog.
    this.preRenderSettingsDialog();
    // await debugSettings(settings);
  }

}
