"use strict";
(() => {
  // src/Settings.ts
  var Settings = class _Settings {
    constructor() {
      this.settings = /* @__PURE__ */ Object.create(null);
      this.settings = {
        firstRun: true,
        rootFolderName: "",
        bookmarksShowFolderName: "no" /* NO */,
        layout: "rows" /* ROWS */,
        bookmarksWidth: "full-screen",
        bookmarkItemIcon: "yes" /* YES */,
        bookmarkItemSize: "small" /* SMALL */,
        bookmarksShowSubfolders: "no" /* NO */,
        bookmarksReordering: "yes" /* YES */,
        bookmarksSearchBar: "yes" /* YES */,
        showTopBookmarks: "no" /* NO */,
        showLastBookmarks: "no" /* NO */,
        theme: "default" /* DEFAULT */
      };
    }
    static {
      this.SETTINGS_ROOT_KEY = "newtab-bookmarks";
    }
    /**
     * Initialize the Local Storage key to keep the settings object.
     */
    async init() {
      const settings = await chrome.storage.local.get(_Settings.SETTINGS_ROOT_KEY) || /* @__PURE__ */ Object.create(null);
      this.settings = { ...this.settings, ...settings[_Settings.SETTINGS_ROOT_KEY] };
      return this;
    }
    isOn(settingName) {
      return this.settings[settingName] === "yes" /* YES */;
    }
    isOff(settingName) {
      const settingValue = this.settings[settingName];
      return !settingValue || settingValue === "no" /* NO */;
    }
    getValue(settingName) {
      return this.settings[settingName];
    }
    setValue(settingName, settingValue) {
      this.settings[settingName] = settingValue;
    }
    async saveOne(key, value) {
      this.setValue(key, value);
      await this.save();
    }
    getAll() {
      return this.settings;
    }
    async save(newSettings) {
      const settingsToSave = newSettings ? { ...this.settings, ...newSettings, firstRun: false } : { ...this.settings, firstRun: false };
      await chrome.storage.local.set({ [_Settings.SETTINGS_ROOT_KEY]: settingsToSave });
      this.settings = settingsToSave;
    }
  };

  // src/utils.ts
  function $(id) {
    return document.getElementById(id);
  }
  function $$q(cssSelector) {
    return document.querySelectorAll(cssSelector);
  }
  function faviconURL(u, imgSize) {
    const url = new URL(chrome.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", u);
    url.searchParams.set("size", imgSize || "16");
    return url.toString();
  }
  function determineFolderNames(foldersAsString) {
    return foldersAsString.split(",").map((folderName) => folderName.trim()).filter(Boolean);
  }
  function truncateLongText(text) {
    if (text.length > 100 && !text.includes(" ")) {
      return text.substring(0, 60) + " ...";
    }
    return text;
  }

  // src/Bookmarks.ts
  var Bookmarks = class _Bookmarks {
    constructor(settings) {
      this.settings = settings;
      this.bookmarks = [];
      this.settings = settings;
    }
    async init() {
      this.bookmarks = await chrome.bookmarks.getTree();
      return this;
    }
    async add(parentId, title, url) {
      return await chrome.bookmarks.create({ parentId, title, url });
    }
    async remove(id) {
      return await chrome.bookmarks.remove(id);
    }
    async move(id, index, parentId) {
      return await chrome.bookmarks.move(id, { index: Number(index), parentId });
    }
    async addFolder(parentId, title) {
      return await chrome.bookmarks.create({ parentId, title });
    }
    getSelectedBookmarksByFolder() {
      const rootBookmarkTreeNode = this.bookmarks[0];
      if (typeof rootBookmarkTreeNode === "undefined") {
        return null;
      }
      const rootFolders = determineFolderNames(this.settings.getValue("rootFolderName") || "");
      const validFolders = rootFolders.filter((name) => name.length > 0);
      if (validFolders.length === 0) {
        return null;
      }
      const folderMap = _Bookmarks.getBookmarksFromFolders(new Set(validFolders), rootBookmarkTreeNode);
      return validFolders.map((folderName) => ({
        folderName,
        node: folderMap.get(folderName) || null
      }));
    }
    static getBookmarksFromFolders(folderNames, treeItem) {
      if (folderNames.size === 0) return /* @__PURE__ */ new Map();
      const results = /* @__PURE__ */ new Map();
      function traverse(node) {
        if (folderNames.has(node.title) && !results.has(node.title)) {
          results.set(node.title, node);
          if (results.size === folderNames.size) return;
        }
        if (node.children) {
          for (const child of node.children) {
            traverse(child);
            if (results.size === folderNames.size) return;
          }
        }
      }
      traverse(treeItem);
      return results;
    }
    static getBookmarksFromFolder(folderName, treeItem) {
      if (typeof folderName !== "string" || folderName.trim().length === 0) {
        return null;
      }
      if (folderName === treeItem.title) {
        return treeItem;
      }
      const childTreeNodes = treeItem.children;
      if (typeof childTreeNodes === "undefined" || childTreeNodes.length === 0) {
        return null;
      }
      let result = null;
      for (let i = 0; i < childTreeNodes.length; i++) {
        const childTreeNode = childTreeNodes[i];
        if (childTreeNode) {
          result = _Bookmarks.getBookmarksFromFolder(folderName, childTreeNode);
          if (result !== null) {
            return result;
          }
        }
      }
      return null;
    }
    static searchRecursive(query, treeItem) {
      let results = [];
      if (typeof query !== "string" || query.trim().length < 3) {
        return results;
      }
      if (treeItem.url && treeItem.title.toLowerCase().includes(query.toLowerCase())) {
        results.push(treeItem);
      }
      const childTreeNodes = treeItem.children;
      if (typeof childTreeNodes === "undefined" || childTreeNodes.length === 0) {
        return results;
      }
      for (let i = 0; i < childTreeNodes.length; i++) {
        const childTreeNode = childTreeNodes[i];
        if (childTreeNode) {
          const result = _Bookmarks.searchRecursive(query, childTreeNode);
          if (result !== null) {
            results = results.concat(result);
          }
        }
      }
      return results;
    }
    search(query) {
      const rootTreeNode = this.bookmarks[0];
      if (typeof rootTreeNode === "undefined") {
        return [];
      }
      return _Bookmarks.searchRecursive(query, rootTreeNode);
    }
  };

  // src/BookmarkClicks.ts
  var BookmarkClicks = class _BookmarkClicks {
    constructor() {
      this.data = { counts: {}, last: [] };
    }
    static {
      this.STORAGE_KEY = "newtab-bookmarks-clicks";
    }
    static {
      this.LAST_MAX = 15;
    }
    async init() {
      const stored = await chrome.storage.local.get(_BookmarkClicks.STORAGE_KEY);
      const persisted = stored?.[_BookmarkClicks.STORAGE_KEY];
      if (persisted) {
        this.data = {
          counts: persisted.counts ?? {},
          last: persisted.last ?? []
        };
      }
      return this;
    }
    record(url, title) {
      if (!url) return;
      const prev = this.data.counts[url]?.count ?? 0;
      this.data.counts[url] = { count: prev + 1, title };
      this.data.last = [{ url, title }, ...this.data.last.filter((e) => e.url !== url)].slice(0, _BookmarkClicks.LAST_MAX);
      void chrome.storage.local.set({ [_BookmarkClicks.STORAGE_KEY]: this.data });
    }
    getTop(limit) {
      return Object.entries(this.data.counts).sort((a, b) => b[1].count - a[1].count).slice(0, limit).map(([url, { title }]) => ({ url, title }));
    }
    getLast(limit) {
      return this.data.last.slice(0, limit);
    }
  };

  // src/View.ts
  var View = class {
    constructor(settings, bookmarks, bookmarkClicks) {
      this.settings = settings;
      this.bookmarks = bookmarks;
      this.bookmarkClicks = bookmarkClicks;
    }
    renderBookmark(bookmark, size, isDraggable) {
      const $bookmark = document.createElement("a");
      $bookmark.href = bookmark.url || "";
      $bookmark.dataset.index = bookmark.index?.toString();
      $bookmark.dataset.id = bookmark.id;
      $bookmark.dataset.parentId = bookmark.parentId;
      $bookmark.classList.add("bookmark");
      $bookmark.classList.add("flex-item");
      $bookmark.addEventListener("click", (e) => {
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
        $bookmark.classList.add("loading");
      });
      $bookmark.addEventListener("mousedown", (e) => {
        if (e.button !== 0 && e.button !== 1) return;
        this.bookmarkClicks.record($bookmark.href, bookmark.title);
      });
      if (isDraggable) {
        $bookmark.setAttribute("draggable", "true");
        let animationFrame = 0;
        $bookmark.addEventListener("drag", (e) => {
          if (animationFrame) return;
          animationFrame = requestAnimationFrame(() => {
            animationFrame = 0;
            const selectedItem = e.target;
            if (!selectedItem) {
              return;
            }
            const x = e.clientX, y = e.clientY;
            selectedItem.classList.add("drag-sort-active");
            const rawElement = document.elementFromPoint(x, y);
            if (!rawElement) return;
            let swapItem = rawElement.closest(".bookmark");
            if (!swapItem) return;
            const list = selectedItem.parentNode;
            if (!list) {
              return;
            }
            if (swapItem !== selectedItem && list === swapItem.parentNode) {
              swapItem = swapItem !== selectedItem.nextSibling ? swapItem : swapItem.nextSibling;
              list.insertBefore(selectedItem, swapItem);
              selectedItem.dataset.indexSwap = swapItem.dataset.index;
              selectedItem.dataset.parentIdSwap = swapItem.dataset.parentId;
            }
          });
        });
        $bookmark.addEventListener("dragend", async (e) => {
          if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = 0;
          }
          const selectedItem = e.target;
          selectedItem.classList.remove("drag-sort-active");
          if (selectedItem.dataset.indexSwap) {
            try {
              await this.bookmarks.move(selectedItem.dataset.id || "", selectedItem.dataset.indexSwap, selectedItem.dataset.parentIdSwap || "");
            } catch (err) {
              console.warn("Failed to reorder bookmark:", err);
            } finally {
              const parent = selectedItem.parentNode;
              if (parent) {
                parent.querySelectorAll(".bookmark").forEach((el, i) => {
                  el.dataset.index = i.toString();
                });
              }
              delete selectedItem.dataset.indexSwap;
              delete selectedItem.dataset.parentIdSwap;
            }
          }
        });
      }
      const $bookmarkImg = document.createElement("img");
      $bookmarkImg.src = faviconURL(bookmark.url || "", size.toString());
      $bookmarkImg.className = "bookmark-icon";
      const $bookmarkLink = document.createElement("div");
      $bookmarkLink.className = "bookmark-link";
      const $bookmarkLinkText = document.createElement("span");
      $bookmarkLinkText.innerText = truncateLongText(bookmark.title);
      $bookmark.appendChild($bookmarkImg);
      $bookmark.appendChild($bookmarkLink).appendChild($bookmarkLinkText);
      return $bookmark;
    }
    async renderSearchBookmarks() {
      $("bookmarks-search").style.display = "block";
    }
    bindSearchListeners() {
      const $searchField = $("bookmarks-search-query");
      const $results = $("bookmarks-search-results");
      const $startPage = $("start-page");
      $searchField.addEventListener("focusin", (e) => {
        e.target.setAttribute("placeholder", "");
      });
      $searchField.addEventListener("focusout", (e) => {
        e.target.setAttribute("placeholder", "Search my bookmarks ...");
      });
      let debounceTimer = 0;
      $searchField.addEventListener("input", (e) => {
        clearTimeout(debounceTimer);
        $results.replaceChildren();
        $results.style.display = "none";
        $startPage.classList.remove("blur");
        debounceTimer = window.setTimeout(() => {
          const query = e.target.value.trim();
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
            $results.style.display = "block";
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
        $noBookmarksMsg.style.display = "block";
        return;
      }
      $noBookmarksMsg.style.display = "none";
      const showFolderNames = this.settings.getValue("bookmarksShowFolderName");
      selectedBookmarksByFolder.forEach((item, index) => {
        const treeNodeChildren = item.node?.children;
        if (!treeNodeChildren) {
          return;
        }
        const $folder = document.createElement("div");
        $folder.classList.add("bookmarks-folder");
        if (showFolderNames === "yes" /* YES */) {
          const $folderTitleContainer = document.createElement("div");
          $folderTitleContainer.classList.add("bookmarks-folder-title");
          $folderTitleContainer.innerText = item.folderName;
          $folder.appendChild($folderTitleContainer);
        }
        const $folderBookMarksContainer = document.createElement("div");
        $folderBookMarksContainer.classList.add("bookmarks-folder-bookmarks");
        $folder.appendChild($folderBookMarksContainer);
        treeNodeChildren.forEach((bookmark) => {
          if (bookmark.children) {
            return;
          }
          const size = this.settings.getValue("bookmarkItemSize") === "large" ? 32 : 16;
          const isDraggable = this.settings.getValue("bookmarksReordering");
          const $bookmark = this.renderBookmark(bookmark, size, isDraggable === "yes" /* YES */);
          $folderBookMarksContainer.appendChild($bookmark);
        });
        $bookmarks.appendChild($folder);
      });
    }
    renderClickEntry(entry, size) {
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
      const $settingsDialog = $("settings-dialog");
      const $settingsLinks = $$q(".settings-link");
      const $form = $settingsDialog.querySelector("form");
      let originalSettings = null;
      let saved = false;
      const radioToKey = {
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
        "settings-theme": "theme"
      };
      const setRadio = (name, value) => {
        const $radio = document.querySelector(`input[type="radio"][name="${name}"][value="${value}"]`);
        if ($radio) $radio.checked = true;
      };
      const populateForm = () => {
        $("settings-root-folder").value = this.settings.getValue("rootFolderName");
        for (const [name, key] of Object.entries(radioToKey)) {
          setRadio(name, this.settings.getValue(key));
        }
      };
      populateForm();
      $settingsDialog.querySelectorAll('input[type="radio"]').forEach(($radio) => {
        $radio.addEventListener("change", () => {
          if (!$radio.checked) return;
          const key = radioToKey[$radio.name];
          if (!key) return;
          this.settings.setValue(key, $radio.value);
          void this.refresh();
        });
      });
      let folderDebounce = 0;
      $("settings-root-folder").addEventListener("input", (e) => {
        clearTimeout(folderDebounce);
        const value = e.target.value;
        folderDebounce = window.setTimeout(() => {
          this.settings.setValue("rootFolderName", value);
          void this.refresh();
        }, 200);
      });
      $form?.addEventListener("submit", (e) => {
        e.preventDefault();
      });
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
    applySettingsClasses() {
      const $wrapper = $("wrapper");
      const $bookmarks = $("bookmarks");
      const $body = document.body;
      Array.from($wrapper.classList).forEach((c) => {
        if (c.startsWith("bookmarksWidth--") || c.startsWith("bookmarkItemSize--") || c.startsWith("bookmarkItemIcon--")) {
          $wrapper.classList.remove(c);
        }
      });
      const width = this.settings.getValue("bookmarksWidth");
      if (width) $wrapper.classList.add(`bookmarksWidth--${width}`);
      $wrapper.classList.add(`bookmarkItemSize--${this.settings.getValue("bookmarkItemSize")}`);
      $wrapper.classList.add(`bookmarkItemIcon--${this.settings.getValue("bookmarkItemIcon")}`);
      $bookmarks.classList.remove("flex-container-even-columns", "flex-container-rows");
      if (this.settings.getValue("layout") === "columns" /* COLUMNS */) {
        $bookmarks.classList.add("flex-container-even-columns");
      } else {
        $bookmarks.classList.add("flex-container-rows");
      }
      Array.from($body.classList).forEach((c) => {
        if (c.startsWith("theme--")) $body.classList.remove(c);
      });
      const theme = this.settings.getValue("theme");
      if (theme && theme !== "default" /* DEFAULT */) {
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
      if (!this.settings.getValue("firstRun") && this.settings.getValue("bookmarksSearchBar") === "yes" /* YES */) {
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
      if (!this.settings.getValue("firstRun") && this.settings.getValue("bookmarksSearchBar") === "yes" /* YES */) {
        await this.renderSearchBookmarks();
      }
      await this.renderTopBookmarks();
      await this.renderLastBookmarks();
      await this.renderStartPageBookmarks();
      this.preRenderSettingsDialog();
    }
  };

  // src/index.ts
  (async () => {
    const settings = await new Settings().init();
    const bookmarks = await new Bookmarks(settings).init();
    const bookmarkClicks = await new BookmarkClicks().init();
    const view = new View(settings, bookmarks, bookmarkClicks);
    await view.render();
  })();
})();
//# sourceMappingURL=newtab.js.map
