// Unified blog controller, store, and router for the ENCOM archive.
// Single authoritative source for: current discovery lens, selected post,
// reader state, search/filter state, URL/history state, post loading,
// boardroom-ready lifecycle, and widget signal dispatch.
//
// This replaces the competing post renderers and retry-timer boot that
// were split between Boardroom.js and blog-adapter.js.
//
// CommonJS (Browserify-compatible). Uses jQuery ($) which is global in the
// boardroom runtime. No modern browser APIs that break the 2013 bundle.

var $ = require("jquery");

var BlogController = {};

// ---- Store state ---------------------------------------------------------
var state = {
  ready: false,             // boardroom finished its intro animation
  lens: "featured",         // featured | latest | topics | archive | search
  selectedSlug: null,       // currently-open post slug (null when reader closed)
  searchQuery: "",
  filterTag: null,
  filterYear: null,
  posts: [],                // window.BLOG_POSTS
  index: {},                // window.BLOG_INDEX
  postBySlug: {},
  readerOpen: false,
  readerFocusStack: [],     // focus restoration stack
  readerScrollY: 0,         // scroll position before reader opened
  signalListeners: []
};

// ---- Signal dispatch -----------------------------------------------------
// Widgets subscribe to archive signals; the controller emits them.
BlogController.on = function (eventType, handler) {
  state.signalListeners.push({ eventType: eventType, handler: handler });
};

function emit(eventType, payload) {
  for (var i = 0; i < state.signalListeners.length; i++) {
    var listener = state.signalListeners[i];
    if (listener.eventType === eventType || listener.eventType === "*") {
      try { listener.handler(payload, eventType); } catch (e) { /* swallow */ }
    }
  }
}

BlogController.emit = emit;

// ---- Initialization ------------------------------------------------------
BlogController.init = function (posts, index) {
  state.ready = false;  // re-init implies a fresh boardroom lifecycle
  state.posts = posts || [];
  state.index = index || {};
  state.postBySlug = {};
  for (var i = 0; i < state.posts.length; i++) {
    state.postBySlug[state.posts[i].slug] = state.posts[i];
  }
  // Parse the initial URL for a deep-linked post.
  BlogController.routeFromUrl();
};

// ---- Lifecycle: called when the boardroom finishes its intro -------------
BlogController.onBoardroomReady = function () {
  if (state.ready) return;
  state.ready = true;
  emit("ready", { lens: state.lens, postCount: state.posts.length });
  // If a post was deep-linked, open it now that the boardroom is ready.
  if (state.selectedSlug) {
    BlogController.openPost(state.selectedSlug);
  }
};

// ---- URL routing ---------------------------------------------------------
// URL model: /?post=<slug>  or  /?lens=<lens>  or  /?search=<query>
// We use pushState so browser history works. Closing a post restores
// the previous URL and focus.

function parseUrlParams() {
  var search = (window.location.search || "").replace(/^\?/, "");
  var params = {};
  if (!search) return params;
  var pairs = search.split("&");
  for (var i = 0; i < pairs.length; i++) {
    var eq = pairs[i].indexOf("=");
    var key = eq >= 0 ? pairs[i].slice(0, eq) : pairs[i];
    var val = eq >= 0 ? decodeURIComponent(pairs[i].slice(eq + 1)) : "";
    params[key] = val;
  }
  return params;
}

BlogController.routeFromUrl = function () {
  var params = parseUrlParams();
  if (params.post && state.postBySlug[params.post]) {
    state.selectedSlug = params.post;
    if (state.ready) {
      BlogController.openPost(params.post);
    }
  } else if (params.lens) {
    BlogController.setLens(params.lens, false);
  } else if (params.search) {
    state.searchQuery = params.search;
    BlogController.setLens("search", false);
  }
};

function pushUrl(params, opts) {
  var qs = [];
  for (var k in params) {
    if (params[k] != null && params[k] !== "") {
      qs.push(k + "=" + encodeURIComponent(params[k]));
    }
  }
  var url = qs.length ? "?" + qs.join("&") : window.location.pathname;
  if (opts && opts.replace) {
    window.history.replaceState({}, "", url);
  } else {
    window.history.pushState({}, "", url);
  }
}

// ---- Lens management -----------------------------------------------------
BlogController.setLens = function (lens, pushHistory) {
  state.lens = lens;
  state.selectedSlug = null;
  emit("lens-change", { lens: lens });
  if (pushHistory !== false) {
    pushUrl({ lens: lens });
  }
};

BlogController.getLens = function () { return state.lens; };
BlogController.getPosts = function () { return state.posts; };
BlogController.getIndex = function () { return state.index; };
BlogController.getPost = function (slug) { return state.postBySlug[slug] || null; };
BlogController.isReady = function () { return state.ready; };

// ---- Post list for the current lens --------------------------------------
BlogController.getVisiblePosts = function () {
  var posts = state.posts;
  if (state.lens === "featured") {
    var featured = posts.filter(function (p) { return p.featured; });
    return featured.length ? featured : posts.slice(0, 1);
  }
  if (state.lens === "latest") {
    return posts.slice(); // already sorted latest-first by the build
  }
  if (state.lens === "archive") {
    return posts.slice().sort(function (a, b) {
      return new Date(a.date) - new Date(b.date); // chronological
    });
  }
  if (state.lens === "topics" && state.filterTag) {
    var slugs = (state.index.tags || {})[state.filterTag] || [];
    return slugs.map(function (s) { return state.postBySlug[s]; }).filter(Boolean);
  }
  if (state.lens === "search" && state.searchQuery) {
    var q = state.searchQuery.toLowerCase();
    return posts.filter(function (p) {
      return (p.title || "").toLowerCase().indexOf(q) >= 0 ||
        (p.excerpt || "").toLowerCase().indexOf(q) >= 0 ||
        (p.tags || []).some(function (t) { return t.toLowerCase().indexOf(q) >= 0; }) ||
        (p.category || "").toLowerCase().indexOf(q) >= 0;
    });
  }
  return posts;
};

// ---- Reader: open/close with focus management + scroll lock --------------
BlogController.openPost = function (slug) {
  var post = state.postBySlug[slug];
  if (!post) return;
  state.selectedSlug = slug;
  state.readerScrollY = window.scrollY;
  state.readerFocusStack.push(document.activeElement);
  emit("post-open", { slug: slug, post: post });
  pushUrl({ post: slug });
  // The reader UI is rendered by the adapter; we just manage state + signals.
  // Focus management happens in the adapter's reader implementation.
};

BlogController.closePost = function () {
  if (!state.selectedSlug) return;
  var slug = state.selectedSlug;
  state.selectedSlug = null;
  emit("post-close", { slug: slug });
  // Restore the lens URL.
  pushUrl({ lens: state.lens }, { replace: true });
  // Restore focus.
  var prevFocus = state.readerFocusStack.pop();
  if (prevFocus && typeof prevFocus.focus === "function") {
    try { prevFocus.focus(); } catch (e) { /* swallow */ }
  }
  // Restore scroll.
  window.scrollTo(0, state.readerScrollY);
};

BlogController.getSelectedSlug = function () { return state.selectedSlug; };

// ---- Search/filter -------------------------------------------------------
BlogController.setSearch = function (query) {
  state.searchQuery = query;
  state.lens = "search";
  emit("search", { query: query });
  pushUrl({ search: query });
};

BlogController.setFilterTag = function (tag) {
  state.filterTag = tag;
  state.lens = "topics";
  emit("filter-tag", { tag: tag });
  pushUrl({ lens: "topics", tag: tag });
};

BlogController.setFilterYear = function (year) {
  state.filterYear = year;
  state.lens = "archive";
  emit("filter-year", { year: year });
  pushUrl({ lens: "archive", year: year });
};

// ---- popstate: back/forward browser navigation ---------------------------
BlogController.handlePopState = function () {
  BlogController.routeFromUrl();
  if (!state.selectedSlug && state.readerOpen === false) {
    emit("lens-change", { lens: state.lens });
  }
};

// Install the popstate listener once.
if (typeof window !== "undefined") {
  window.addEventListener("popstate", function () {
    BlogController.handlePopState();
  });
}

module.exports = BlogController;
