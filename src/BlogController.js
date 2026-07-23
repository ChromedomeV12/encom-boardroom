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
  posts: [],                // lightweight window.BLOG_POSTS metadata
  index: {},                // window.BLOG_INDEX
  postBySlug: {},
  payloadBySlug: {},        // full reader payloads, cached after first load
  payloadRequests: {},      // in-flight loads, de-duplicated by slug
  payloadLoader: null,
  readerOpen: false,
  readerPending: false,     // deep-link/requested reader awaiting lifecycle readiness
  readerOriginCaptured: false,
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
function defaultPayloadLoader(post) {
  return new Promise(function (resolve, reject) {
    if (!post.contentPath || typeof window.XMLHttpRequest !== "function") {
      reject(new Error("No reader payload loader is available for " + post.slug));
      return;
    }
    var request = new window.XMLHttpRequest();
    request.open("GET", post.contentPath, true);
    request.onreadystatechange = function () {
      if (request.readyState !== 4) return;
      if (request.status >= 200 && request.status < 300) {
        try { resolve(JSON.parse(request.responseText)); }
        catch (error) { reject(error); }
      } else {
        reject(new Error("Reader payload request failed with status " + request.status));
      }
    };
    request.onerror = function () {
      reject(new Error("Reader payload request failed for " + post.slug));
    };
    request.send();
  });
}

BlogController.init = function (posts, index, options) {
  state.ready = false;  // re-init implies a fresh boardroom lifecycle
  BlogController.stopArchiveReplay();
  state.lens = "featured";
  state.selectedSlug = null;
  state.searchQuery = "";
  state.filterTag = null;
  state.filterYear = null;
  state.readerOpen = false;
  state.readerPending = false;
  state.readerOriginCaptured = false;
  state.readerFocusStack = [];
  state.readerScrollY = 0;
  state.posts = posts || [];
  state.index = index || {};
  state.postBySlug = {};
  state.payloadBySlug = {};
  state.payloadRequests = {};
  state.payloadLoader = options && typeof options.loadPost === "function"
    ? options.loadPost
    : defaultPayloadLoader;
  for (var i = 0; i < state.posts.length; i++) {
    state.postBySlug[state.posts[i].slug] = state.posts[i];
    // Compatibility with old/generated fixtures that still include content.
    if (typeof state.posts[i].html === "string") {
      state.payloadBySlug[state.posts[i].slug] = state.posts[i];
    }
  }
  // Parse the initial URL for a deep-linked post or discovery lens.
  BlogController.routeFromUrl();
};

// ---- Lifecycle: called when the boardroom finishes its intro -------------
BlogController.onBoardroomReady = function () {
  if (state.ready) return;
  state.ready = true;
  emit("ready", { lens: state.lens, postCount: state.posts.length });
  // Start archive replay at a controlled cadence once Boardroom.show reports readiness.
  startArchiveReplay();
};

// Render an initial deep-linked post after the adapter has subscribed to
// controller signals, without changing boardroom lifecycle state.
BlogController.renderPendingPost = function () {
  if (!state.readerPending || !state.selectedSlug || !state.postBySlug[state.selectedSlug]) {
    return false;
  }
  BlogController.openPost(state.selectedSlug);
  return true;
};

// ---- BlogSignal / archive replay ----------------------------------------
// Convert each post into a deterministic archive signal and replay it
// through the boardroom at a short controlled cadence. This is honestly
// labelled ARCHIVE REPLAY, not a live feed.
var replayTimer = null;
var replayIndex = 0;

function postToSignal(post) {
  return {
    stream: "blog",
    archiveReplay: true,
    username: post.category || "archive",
    title: post.title,
    type: (post.tags && post.tags[0]) || post.category || "post",
    size: post.readTime ? post.readTime + "m" : "",
    category: post.category || "Notes",
    tags: (post.tags || []).slice(),
    readTime: post.readTime || 0,
    featured: !!post.featured,
    popularity: post.linkDegree || 0,
    latlon: post.location ? { lat: post.location.lat, lon: post.location.lng } : null,
    location: post.location ? (post.location.label || post.location.lat + "," + post.location.lng) : "",
    picSmall: post.hero ? "blog-assets/" + post.hero : "",
    picLarge: post.hero ? "blog-assets/" + post.hero : "",
    slug: post.slug,
    date: post.date,
    wordCount: post.wordCount
  };
}

function startArchiveReplay() {
  clearInterval(replayTimer);
  replayIndex = 0;
  var posts = BlogController.getVisiblePosts();
  if (!posts.length) return;
  // Replay one signal every 1.2s. The boardroom reacts to each.
  replayTimer = setInterval(function () {
    if (replayIndex >= posts.length) {
      clearInterval(replayTimer);
      replayTimer = null;
      emit("archive-replay-complete", { count: posts.length });
      return;
    }
    var signal = postToSignal(posts[replayIndex]);
    emit("archive-signal", signal);
    // Also push through the boardroom's message path if available.
    if (window.Boardroom && typeof window.Boardroom.message === "function") {
      try { window.Boardroom.message(signal); } catch (e) { /* swallow */ }
    }
    replayIndex++;
  }, 1200);
}

BlogController.postToSignal = postToSignal;
BlogController.startArchiveReplay = startArchiveReplay;
BlogController.stopArchiveReplay = function () {
  if (replayTimer) { clearInterval(replayTimer); replayTimer = null; }
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
    var rawKey = eq >= 0 ? pairs[i].slice(0, eq) : pairs[i];
    var rawValue = eq >= 0 ? pairs[i].slice(eq + 1) : "";
    var key;
    var val;
    try { key = decodeURIComponent(rawKey); } catch (e) { key = rawKey; }
    try { val = decodeURIComponent(rawValue); } catch (e) { val = rawValue; }
    params[key] = val;
  }
  return params;
}

function hasParam(params, key) {
  return Object.prototype.hasOwnProperty.call(params, key);
}

function normaliseLens(lens) {
  var known = { featured: true, latest: true, topics: true, archive: true, search: true };
  return known[lens] ? lens : "featured";
}

function captureReaderOrigin() {
  if (state.readerOriginCaptured) return;
  state.readerScrollY = window.scrollY || 0;
  state.readerFocusStack.push(document.activeElement);
  state.readerOriginCaptured = true;
}

function restoreReaderOrigin() {
  var prevFocus = state.readerFocusStack.pop();
  if (prevFocus && typeof prevFocus.focus === "function") {
    try { prevFocus.focus(); } catch (e) { /* swallow */ }
  }
  state.readerFocusStack = [];
  if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
    window.scrollTo(0, state.readerScrollY);
  }
  state.readerOriginCaptured = false;
}

function teardownReader(pushHistory) {
  var wasOpen = state.readerOpen || !!state.selectedSlug;
  var closingSlug = state.selectedSlug;
  if (!wasOpen && !state.readerOriginCaptured) return false;

  state.selectedSlug = null;
  state.readerOpen = false;
  state.readerPending = false;
  if (closingSlug) emit("post-close", { slug: closingSlug });
  if (wasOpen) emit("reader-close", {});
  restoreReaderOrigin();
  if (pushHistory !== false) {
    pushUrl({ lens: state.lens }, { replace: true });
  }
  return true;
}

BlogController.routeFromUrl = function () {
  var params = parseUrlParams();
  if (params.post && state.postBySlug[params.post]) {
    // Select deep-linked content before readiness; the adapter explicitly
    // renders the initial pending post after subscribing to these signals.
    var previousSlug = state.selectedSlug;
    var wasReaderOpen = state.readerOpen;
    var isNewPost = previousSlug !== params.post;
    state.selectedSlug = params.post;
    state.readerOpen = true;
    captureReaderOrigin();
    if (!state.ready) {
      state.readerPending = true;
      // Back/forward can switch posts before Boardroom.show. Rerender the
      // new post immediately, while leaving lifecycle readiness untouched.
      if (wasReaderOpen && previousSlug && isNewPost) {
        BlogController.openPost(params.post);
      }
    } else if (isNewPost || !state.readerOriginCaptured) {
      state.readerPending = true;
      BlogController.openPost(params.post);
    }
    return;
  }

  // Every non-reader route is a full reader teardown. Popstate must not
  // manufacture another history entry while restoring the prior origin.
  teardownReader(false);

  if (hasParam(params, "lens")) {
    if (params.lens === "topics" && hasParam(params, "tag") && params.tag) {
      BlogController.setFilterTag(params.tag, false);
    } else if (params.lens === "archive" && hasParam(params, "year") && params.year) {
      BlogController.setFilterYear(params.year, false);
    } else {
      BlogController.setLens(normaliseLens(params.lens), false);
    }
  } else if (hasParam(params, "search")) {
    BlogController.setSearch(params.search, false);
  } else {
    BlogController.setLens("featured", false);
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

function restartArchiveReplay() {
  if (state.ready) startArchiveReplay();
}

// ---- Lens management -----------------------------------------------------
BlogController.setLens = function (lens, pushHistory) {
  lens = normaliseLens(lens);
  if (state.readerOpen || state.selectedSlug || state.readerOriginCaptured) {
    teardownReader(false);
  }
  state.lens = lens;
  state.selectedSlug = null;
  state.readerPending = false;
  state.filterTag = null;
  state.filterYear = null;
  state.searchQuery = "";
  emit("lens-change", { lens: lens });
  restartArchiveReplay();
  if (pushHistory !== false) {
    pushUrl({ lens: lens });
  }
};

BlogController.getLens = function () { return state.lens; };
BlogController.getPosts = function () { return state.posts; };
BlogController.getIndex = function () { return state.index; };
BlogController.getPost = function (slug) {
  return state.payloadBySlug[slug] || state.postBySlug[slug] || null;
};
BlogController.isReady = function () { return state.ready; };

// Load a full article only when the reader needs it. Concurrent requests for
// the same slug share one promise, and successful payloads stay cached.
BlogController.loadPost = function (slug) {
  var metadata = state.postBySlug[slug];
  if (!metadata) return Promise.reject(new Error("Unknown post: " + slug));
  if (state.payloadBySlug[slug]) return Promise.resolve(state.payloadBySlug[slug]);
  if (!metadata.contentPath) {
    state.payloadBySlug[slug] = metadata;
    return Promise.resolve(metadata);
  }
  if (state.payloadRequests[slug]) return state.payloadRequests[slug];

  var request = Promise.resolve(state.payloadLoader(metadata)).then(function (payload) {
    if (!payload || payload.slug !== slug || typeof payload.html !== "string") {
      throw new Error("Invalid reader payload for " + slug);
    }
    var post = {};
    var key;
    for (key in metadata) post[key] = metadata[key];
    for (key in payload) post[key] = payload[key];
    state.payloadBySlug[slug] = post;
    delete state.payloadRequests[slug];
    return post;
  }).then(null, function (error) {
    delete state.payloadRequests[slug];
    throw error;
  });
  state.payloadRequests[slug] = request;
  return request;
};

// ---- Post list for the current lens --------------------------------------
function publicationYear(post) {
  var storedDate = String(post && post.date || "");
  var storedPrefix = /^(\d{4})-\d{2}-\d{2}/.exec(storedDate);
  if (storedPrefix) return storedPrefix[1];
  var parsed = new Date(storedDate);
  return isNaN(parsed.getTime()) ? "" : String(parsed.getUTCFullYear());
}

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
    var year = state.filterYear;
    var archivePosts = year ? posts.filter(function (p) {
      return publicationYear(p) === String(year);
    }) : posts.slice();
    return archivePosts.sort(function (a, b) {
      return new Date(a.date) - new Date(b.date); // chronological
    });
  }
  if (state.lens === "topics") {
    var tag = state.filterTag;
    if (!tag) return posts;
    return posts.filter(function (p) { return (p.tags || []).indexOf(tag) >= 0; });
  }
  if (state.lens === "search") {
    var q = state.searchQuery.toLowerCase();
    return posts.filter(function (p) {
      return (p.title + " " + (p.excerpt || "") + " " + (p.tags || []).join(" ")).toLowerCase().indexOf(q) >= 0;
    });
  }
  return posts;
};

// ---- Reader: open/close with focus management + scroll lock --------------
BlogController.openPost = function (slug) {
  var metadata = state.postBySlug[slug];
  if (!metadata) return;
  // Pending deep links are rendered by the adapter after it subscribes;
  // ordinary opens emit the same reader signal immediately.
  if (state.selectedSlug === slug && state.readerOpen && !state.readerPending) return;
  // Repeated activation while this payload is already in flight must not
  // attach another completion handler and emit duplicate reader signals.
  if (state.selectedSlug === slug && state.readerPending && state.payloadRequests[slug]) {
    return state.payloadRequests[slug];
  }
  state.selectedSlug = slug;
  state.readerOpen = true;
  captureReaderOrigin();
  // Only push history if not already at this URL (e.g., from deep link)
  var params = parseUrlParams();
  if (params.post !== slug) {
    pushUrl({ post: slug });
  }

  function finishOpen(post) {
    // Ignore a slow response after the user closed or selected another post.
    if (state.selectedSlug !== slug || !state.readerOpen) return post;
    state.readerPending = false;
    emit("post-open", { slug: slug, post: post });
    emit("reader-open", {}); // Signal for motion policy
    return post;
  }

  if (state.payloadBySlug[slug] || !metadata.contentPath) {
    return finishOpen(state.payloadBySlug[slug] || metadata);
  }

  state.readerPending = true;
  emit("post-loading", { slug: slug, post: metadata });
  return BlogController.loadPost(slug).then(finishOpen, function (error) {
    if (state.selectedSlug === slug) {
      state.readerPending = false;
      state.readerOpen = false;
      emit("post-error", { slug: slug, error: error });
    }
    return null;
  });
  // The reader UI is rendered by the adapter; we just manage state + signals.
  // Focus management happens in the adapter's reader implementation.
};

BlogController.closePost = function () {
  teardownReader(true);
};

BlogController.getSelectedSlug = function () { return state.selectedSlug; };
BlogController.state = state; // Expose state for testing and authoritative readerOpen

// ---- Search/filter -------------------------------------------------------
BlogController.setSearch = function (query, pushHistory) {
  if (state.readerOpen || state.selectedSlug || state.readerOriginCaptured) {
    teardownReader(false);
  }
  state.searchQuery = String(query == null ? "" : query);
  state.filterTag = null;
  state.filterYear = null;
  state.lens = "search";
  emit("search", { query: state.searchQuery });
  restartArchiveReplay();
  if (pushHistory !== false) pushUrl({ search: state.searchQuery });
};

BlogController.setFilterTag = function (tag, pushHistory) {
  if (state.readerOpen || state.selectedSlug || state.readerOriginCaptured) {
    teardownReader(false);
  }
  state.filterTag = String(tag == null ? "" : tag);
  state.filterYear = null;
  state.searchQuery = "";
  state.lens = "topics";
  emit("filter-tag", { tag: state.filterTag });
  restartArchiveReplay();
  if (pushHistory !== false) pushUrl({ lens: "topics", tag: state.filterTag });
};

BlogController.setFilterYear = function (year, pushHistory) {
  if (state.readerOpen || state.selectedSlug || state.readerOriginCaptured) {
    teardownReader(false);
  }
  state.filterYear = String(year == null ? "" : year);
  state.filterTag = null;
  state.searchQuery = "";
  state.lens = "archive";
  emit("filter-year", { year: state.filterYear });
  restartArchiveReplay();
  if (pushHistory !== false) pushUrl({ lens: "archive", year: state.filterYear });
};

// ---- popstate: back/forward browser navigation ---------------------------
BlogController.handlePopState = function () {
  BlogController.routeFromUrl();
};

// Install the popstate listener once.
if (typeof window !== "undefined") {
  window.addEventListener("popstate", function () {
    BlogController.handlePopState();
  });
}

module.exports = BlogController;
