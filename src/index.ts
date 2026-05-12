/**
 * "Add bookmark"
 */
// function preRenderAddBookmarkDialog(bookmarks) {
//     const $addBookmarkDialog = $("add-bookmark-dialog");
//     const $addBookmarkItem = $("add-bookmark-item");
//     $addBookmarkItem.addEventListener("click", () => {
//         $addBookmarkDialog.showModal();
//     });
//     const $addBookmarkBtn = $("add-bookmark-btn");
//     $addBookmarkBtn.addEventListener("click", (e) => {
//         e.preventDefault();
//
//         bookmarks.add(
//             0,
//             $("add-bookmark-title").value.trim(),
//             $("add-bookmark-url").value.trim()
//         ).then(() => {
//             $addBookmarkDialog.close();
//         });
//     });
// }

import {Settings} from "./Settings";
import {Bookmarks} from "./Bookmarks";
import {BookmarkClicks} from "./BookmarkClicks";
// import {RecentlyClosed} from "./RecentlyClosed"; // disabled — see RecentlyClosed.ts
import {View} from "./View";

/**
 * Bootstrap
 */
(async () => {
  const settings = await (new Settings()).init();
  const bookmarks = await (new Bookmarks(settings)).init();
  const bookmarkClicks = await (new BookmarkClicks()).init();
  // const recentlyClosed = await (new RecentlyClosed()).init();
  const view = new View(settings, bookmarks, bookmarkClicks);
  await view.render();
})();
