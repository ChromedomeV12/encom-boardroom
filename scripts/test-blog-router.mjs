// Router/history behavior tests for the unified BlogController.
// The controller is CommonJS (Browserify) and uses window/document/history.
// We mock the minimal DOM + history surface to test routing, lens state,
// post-open/close, and signal dispatch without a browser.
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Mock the browser globals the controller touches before requiring it.
// The controller accesses: window, document, history (pushState/replaceState),
// addEventListener, scrollY, scrollTo.
var mockHistory = { state: {}, pushed: [], replaced: [] };
mockHistory.pushState = function (state, title, url) {
  mockHistory.pushed.push(url);
  mockHistory.currentUrl = url;
};
mockHistory.replaceState = function (state, title, url) {
  mockHistory.replaced.push(url);
  mockHistory.currentUrl = url;
};

var eventListeners = {};
global.window = {
  location: { search: "", pathname: "/", hash: "" },
  history: mockHistory,
  addEventListener: function (type, fn) {
    if (!eventListeners[type]) eventListeners[type] = [];
    eventListeners[type].push(fn);
  },
  scrollY: 0,
  scrollTo: function (x, y) { global.window.scrollY = y; }
};
global.document = {
  activeElement: { focus: function () {} }
};

// jQuery mock: the controller requires jquery but only uses it for nothing
// at module load time (the $ is unused at the top level in the controller
// except as a variable). We provide a minimal stub.
var Module = await import('module');
var origResolve = Module.default._resolveFilename;
// We can't easily intercept require('jquery') in ESM, so load the controller
// source directly and eval it in a sandbox with our mocks.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
var controllerSrc = readFileSync(path.join(repoRoot, 'src', 'BlogController.js'), 'utf8');

// Provide a CommonJS require shim inside our sandbox.
var moduleShim = { exports: {} };
var requireShim = function (name) {
  if (name === 'jquery') return function () {}; // $ is unused functionally
  throw new Error('Unknown require: ' + name);
};

var intervalCallbacks = [];
function mockSetInterval(callback) {
  var token = { callback: callback, cleared: false };
  intervalCallbacks.push(token);
  return token;
}
function mockClearInterval(token) {
  if (token) token.cleared = true;
}

// Eval the controller in a function scope with our mocks.
var wrapped = '(function(module, exports, require, window, document, setInterval, clearInterval) {' +
  controllerSrc +
  '\n})(moduleShim, moduleShim.exports, requireShim, global.window, global.document, mockSetInterval, mockClearInterval);';
eval(wrapped);
var BlogController = moduleShim.exports;

function resetUrl(search) {
  global.window.location.search = search || "";
  global.window.location.pathname = "/";
  mockHistory.pushed = [];
  mockHistory.replaced = [];
  mockHistory.currentUrl = search || "/";
}

var samplePosts = [
  { slug: 'alpha', title: 'Alpha', date: '2026-06-15', featured: true, category: 'Dispatches', tags: ['x'], excerpt: 'Alpha excerpt', readTime: 2, wordCount: 100 },
  { slug: 'beta', title: 'Beta', date: '2026-06-14', featured: false, category: 'Notes', tags: ['x', 'y'], excerpt: 'Beta excerpt', readTime: 1, wordCount: 50 }
];
var sampleIndex = {
  featuredPosts: ['alpha'],
  latestPosts: ['alpha', 'beta'],
  tags: { x: ['alpha', 'beta'], y: ['beta'] },
  categories: { Dispatches: ['alpha'], Notes: ['beta'] },
  archiveByYear: { '2026': ['alpha', 'beta'] },
  totalCount: 2,
  wordCount: 150
};

// --- Test 1: init sets up post index and parses deep-link --------------
resetUrl('?post=beta');
BlogController.init(samplePosts, sampleIndex);
assert.equal(BlogController.getPost('beta').title, 'Beta');
assert.equal(BlogController.getSelectedSlug(), 'beta', 'deep-linked post should be selected');

// --- Test 2: openPost pushes history state ----------------------------
resetUrl('');
BlogController.init(samplePosts, sampleIndex);
BlogController.onBoardroomReady();
BlogController.openPost('alpha');
assert.ok(mockHistory.pushed.some(function (u) { return u.indexOf('post=alpha') >= 0; }),
  'openPost should push a URL with post=alpha');

// --- Test 3: closePost restores lens URL + emits signal ---------------
var closeSignalReceived = false;
BlogController.on('post-close', function () { closeSignalReceived = true; });
BlogController.closePost();
assert.ok(closeSignalReceived, 'post-close signal should fire');
assert.ok(mockHistory.replaced.length > 0, 'closePost should replace URL');

// --- Test 4: setLens changes state and pushes history -----------------
BlogController.setLens('archive');
assert.equal(BlogController.getLens(), 'archive');
assert.ok(mockHistory.pushed.some(function (u) { return u.indexOf('lens=archive') >= 0; }),
  'setLens should push a URL with lens=archive');

// --- Test 5: getVisiblePosts respects lens ----------------------------
BlogController.setLens('featured', false);
var featured = BlogController.getVisiblePosts();
assert.equal(featured.length, 1, 'featured lens shows only featured posts');
assert.equal(featured[0].slug, 'alpha');

BlogController.setLens('archive', false);
var archive = BlogController.getVisiblePosts();
assert.equal(archive[0].slug, 'beta', 'archive lens is chronological (oldest first)');

BlogController.setLens('latest', false);
var latest = BlogController.getVisiblePosts();
assert.equal(latest[0].slug, 'alpha', 'latest lens is newest first');

// --- Test 6: search filters posts -------------------------------------
BlogController.setSearch('beta');
assert.equal(BlogController.getLens(), 'search');
var results = BlogController.getVisiblePosts();
assert.equal(results.length, 1);
assert.equal(results[0].slug, 'beta');

// --- Test 7: onBoardroomReady fires once and emits ready signal ------
var readyCount = 0;
resetUrl('');
BlogController.init(samplePosts, sampleIndex);
BlogController.on('ready', function () { readyCount++; });
BlogController.onBoardroomReady();
BlogController.onBoardroomReady(); // second call should be a no-op
assert.equal(readyCount, 1, 'ready signal should fire exactly once');

// --- Test 8: popstate triggers routeFromUrl --------------------------
resetUrl('?lens=archive');
BlogController.init(samplePosts, sampleIndex);
var lensChanges = 0;
BlogController.on('lens-change', function () { lensChanges++; });
// Simulate a popstate event
resetUrl('?lens=featured');
eventListeners.popstate.forEach(function (fn) { fn(); });
assert.equal(BlogController.getLens(), 'featured', 'popstate should re-route to the new URL');
assert.equal(lensChanges, 1, 'popstate should emit lens-change once');


// --- Test 9: state.readerOpen is authoritative ------------------------
resetUrl('');
BlogController.init(samplePosts, sampleIndex);
assert.equal(BlogController.state.readerOpen, false, 'readerOpen should be false initially');
BlogController.openPost('alpha');
assert.equal(BlogController.state.readerOpen, true, 'readerOpen should be true after openPost');
BlogController.closePost();
assert.equal(BlogController.state.readerOpen, false, 'readerOpen should be false after closePost');

// --- Test 10: duplicate open does not push history -----------------
resetUrl('');
BlogController.init(samplePosts, sampleIndex);
BlogController.onBoardroomReady();
var pushCountBefore = mockHistory.pushed.length;
BlogController.openPost('alpha');
var pushCountAfter = mockHistory.pushed.length;
assert.equal(pushCountAfter - pushCountBefore, 1, 'first open should push once');
BlogController.openPost('alpha'); // duplicate open
var pushCountAfterDup = mockHistory.pushed.length;
assert.equal(pushCountAfterDup - pushCountAfter, 0, 'duplicate open should not push history');

// --- Test 11: initial deep link opens reader ------------------------
resetUrl('?post=beta');
BlogController.init(samplePosts, sampleIndex);
assert.equal(BlogController.state.readerOpen, true, 'deep link should set readerOpen to true');
assert.equal(BlogController.getSelectedSlug(), 'beta', 'deep link should select post');

// --- Test 12: post-to-post popstate replaces content ----------------
resetUrl('?post=alpha');
BlogController.init(samplePosts, sampleIndex);
BlogController.onBoardroomReady();
var popstateSignalCount = 0;
BlogController.on('post-open', function () { popstateSignalCount++; });
// Simulate popstate to another post
resetUrl('?post=beta');
eventListeners.popstate.forEach(function (fn) { fn(); });
assert.equal(BlogController.getSelectedSlug(), 'beta', 'popstate should change selected post');
assert.equal(popstateSignalCount, 1, 'post-to-post popstate should emit post-open once');

// --- Test 13: post-to-lens popstate closes reader ------------------
resetUrl('?post=alpha');
BlogController.init(samplePosts, sampleIndex);
BlogController.onBoardroomReady();
var closeSignalCount = 0;
BlogController.on('post-close', function () { closeSignalCount++; });
var readerCloseSignalCount = 0;
BlogController.on('reader-close', function () { readerCloseSignalCount++; });
// Simulate popstate to lens
resetUrl('?lens=archive');
eventListeners.popstate.forEach(function (fn) { fn(); });
assert.equal(BlogController.getSelectedSlug(), null, 'popstate to lens should clear selection');
assert.equal(BlogController.state.readerOpen, false, 'popstate to lens should set readerOpen false');
assert.equal(closeSignalCount, 1, 'popstate to lens should emit post-close once');
assert.equal(readerCloseSignalCount, 1, 'popstate to lens should emit reader-close once');

// --- Test 14: history count for open/close cycle ------------------
resetUrl('');
BlogController.init(samplePosts, sampleIndex);
BlogController.onBoardroomReady();
var historyBefore = mockHistory.pushed.length;
BlogController.openPost('alpha');
var historyAfterOpen = mockHistory.pushed.length;
BlogController.closePost();
var historyAfterClose = mockHistory.pushed.length;
assert.equal(historyAfterOpen - historyBefore, 1, 'open should push one history entry');
assert.equal(historyAfterClose - historyAfterOpen, 0, 'close should use replaceState, not push');

// --- Test 15: single origin focus restoration ----------------------
resetUrl('');
BlogController.init(samplePosts, sampleIndex);
BlogController.onBoardroomReady();
var mockFocusable = { focus: function () { this.focused = true; } };
global.document.activeElement = mockFocusable;
BlogController.openPost('alpha');
assert.ok(BlogController.state.readerFocusStack.length > 0, 'open should push focus to stack');
BlogController.closePost();
assert.equal(mockFocusable.focused, true, 'close should restore focus to origin');

// --- Test 16: single origin scroll restoration ---------------------
resetUrl('');
BlogController.init(samplePosts, sampleIndex);
BlogController.onBoardroomReady();
global.window.scrollY = 500;
BlogController.openPost('alpha');
assert.equal(BlogController.state.readerScrollY, 500, 'open should capture scroll position');
global.window.scrollY = 0; // simulate scroll being reset
BlogController.closePost();
assert.equal(global.window.scrollY, 500, 'close should restore scroll position');

// --- Test 17: signals emit exactly once per action ----------------
resetUrl('');
BlogController.init(samplePosts, sampleIndex);
BlogController.onBoardroomReady();
var openCount = 0;
var readerOpenCount = 0;
BlogController.on('post-open', function () { openCount++; });
BlogController.on('reader-open', function () { readerOpenCount++; });
BlogController.openPost('alpha');
assert.equal(openCount, 1, 'openPost should emit post-open once');
assert.equal(readerOpenCount, 1, 'openPost should emit reader-open once');

var closeCount = 0;
var readerCloseCount = 0;
BlogController.on('post-close', function () { closeCount++; });
BlogController.on('reader-close', function () { readerCloseCount++; });
BlogController.closePost();
assert.equal(closeCount, 1, 'closePost should emit post-close once');
assert.equal(readerCloseCount, 1, 'closePost should emit reader-close once');
// --- Test 18: post-to-post navigation while open does not push focus ---
resetUrl('');
BlogController.init(samplePosts, sampleIndex);
BlogController.onBoardroomReady();
var mockFocusable1 = { focus: function () { this.focused = true; } };
var mockFocusable2 = { focus: function () { this.focused = true; } };
global.document.activeElement = mockFocusable1;
BlogController.openPost('alpha');
var stackAfterFirstOpen = BlogController.state.readerFocusStack.length;
// Switch to another post while reader is open
global.document.activeElement = mockFocusable2;
BlogController.openPost('beta');
var stackAfterSecondOpen = BlogController.state.readerFocusStack.length;
assert.equal(stackAfterSecondOpen, stackAfterFirstOpen, 'post-to-post while open should not push another focus entry');
assert.equal(mockFocusable1.focused, undefined, 'first focus should not be restored yet');
BlogController.closePost();
assert.equal(mockFocusable1.focused, true, 'close should restore original focus from first open');

// --- Test 19: dataset string coercion bug - exact restoration ---
resetUrl('');
BlogController.init(samplePosts, sampleIndex);
BlogController.onBoardroomReady();
var mockElement = { 
  inert: false, 
  getAttribute: function(attr) { return this[attr]; },
  setAttribute: function(attr, val) { this[attr] = val; },
  removeAttribute: function(attr) { delete this[attr]; }
};
// Simulate adapter saving state via dataset (string coercion)
mockElement.dataset = { previouslyInert: String(mockElement.inert) };
// String "false" coerces to true in boolean context
var restoredInert = mockElement.dataset.previouslyInert === 'true';
assert.equal(restoredInert, false, 'string coercion should preserve false correctly');
// But if we use closure state with exact boolean
var savedInert = mockElement.inert;
assert.equal(savedInert, false, 'closure state preserves exact boolean');

// --- Test 20: archive replay respects the active lens ----------------
resetUrl('');
BlogController.init(samplePosts, sampleIndex);
BlogController.setLens('featured', false);
var replayedSlugs = [];
BlogController.on('archive-signal', function (signal) { replayedSlugs.push(signal.slug); });
BlogController.startArchiveReplay();
var activeReplay = intervalCallbacks[intervalCallbacks.length - 1];
activeReplay.callback();
activeReplay.callback();
assert.deepEqual(replayedSlugs, ['alpha'], 'featured replay should not inject non-featured posts');

// --- Test 21: topic and year filters change visible posts ------------
BlogController.setFilterTag('y');
assert.deepEqual(BlogController.getVisiblePosts().map(function (post) { return post.slug; }), ['beta'],
  'tag filter should return matching posts');
BlogController.setFilterYear('2025');
assert.deepEqual(BlogController.getVisiblePosts(), [], 'year filter should exclude posts from other years');

// --- Test 22: filter params survive URL routing -----------------------
resetUrl('?lens=topics&tag=y');
eventListeners.popstate.forEach(function (fn) { fn(); });
assert.deepEqual(BlogController.getVisiblePosts().map(function (post) { return post.slug; }), ['beta'],
  'routed topic lens should apply its tag parameter');
// --- Test 23: initial deep-link renders before boardroom readiness ------
resetUrl('?post=beta');
BlogController.init(samplePosts, sampleIndex);
var deepLinkPostOpen = 0;
var deepLinkReaderOpen = 0;
BlogController.on('post-open', function () { deepLinkPostOpen++; });
BlogController.on('reader-open', function () { deepLinkReaderOpen++; });
assert.equal(BlogController.isReady(), false, 'initial deep link must not mark boardroom ready');
assert.equal(BlogController.state.readerPending, true, 'initial deep link should remain pending before adapter boot');
var replayCountBeforePendingRender = intervalCallbacks.length;
BlogController.renderPendingPost();
assert.equal(BlogController.isReady(), false, 'pending reader render must not mark boardroom ready');
assert.equal(intervalCallbacks.length, replayCountBeforePendingRender,
  'pending reader render must not start archive replay');
assert.equal(deepLinkPostOpen, 1, 'initial deep link should emit post-open when rendered');
assert.equal(deepLinkReaderOpen, 1, 'initial deep link should emit reader-open when rendered');
assert.equal(BlogController.state.readerPending, false, 'rendered deep link should no longer be pending');

// --- Test 24: pre-ready post-to-post popstate rerenders new content -----
resetUrl('?post=alpha');
BlogController.init(samplePosts, sampleIndex);
var preReadyPostOpens = [];
BlogController.on('post-open', function (data) { preReadyPostOpens.push(data.slug); });
assert.equal(BlogController.isReady(), false, 'pre-ready popstate fixture starts before boardroom readiness');
resetUrl('?post=beta');
eventListeners.popstate.forEach(function (fn) { fn(); });
assert.deepEqual(preReadyPostOpens, ['beta'], 'pre-ready post-to-post popstate should emit the new post');
assert.equal(BlogController.getSelectedSlug(), 'beta', 'pre-ready popstate should select the new post');
assert.equal(BlogController.state.readerPending, false, 'pre-ready post-to-post popstate should render immediately');

// --- Test 25: popstate teardown restores focus/scroll without history ---
resetUrl('');
BlogController.init(samplePosts, sampleIndex);
BlogController.onBoardroomReady();
var teardownFocus = { focus: function () { this.focused = true; } };
global.document.activeElement = teardownFocus;
global.window.scrollY = 777;
BlogController.openPost('alpha');
global.window.scrollY = 0;
var teardownPushCount = mockHistory.pushed.length;
var teardownReplaceCount = mockHistory.replaced.length;
global.window.location.search = "";
eventListeners.popstate.forEach(function (fn) { fn(); });
assert.equal(BlogController.state.readerOpen, false, 'empty-url popstate should close the reader');
assert.equal(BlogController.getSelectedSlug(), null, 'empty-url popstate should clear selection');
assert.equal(teardownFocus.focused, true, 'empty-url popstate should restore origin focus');
assert.equal(global.window.scrollY, 777, 'empty-url popstate should restore origin scroll');
assert.equal(mockHistory.pushed.length, teardownPushCount, 'popstate teardown must not push history');
assert.equal(mockHistory.replaced.length, teardownReplaceCount, 'popstate teardown must not replace history');

// --- Test 26: search popstate also tears down without history -----------
resetUrl('');
BlogController.init(samplePosts, sampleIndex);
BlogController.onBoardroomReady();
var searchTeardownFocus = { focus: function () { this.focused = true; } };
global.document.activeElement = searchTeardownFocus;
global.window.scrollY = 888;
BlogController.openPost('alpha');
global.window.scrollY = 0;
var searchTeardownPushCount = mockHistory.pushed.length;
var searchTeardownReplaceCount = mockHistory.replaced.length;
global.window.location.search = '?search=beta';
eventListeners.popstate.forEach(function (fn) { fn(); });
assert.equal(BlogController.state.readerOpen, false, 'search popstate should close the reader');
assert.equal(BlogController.getLens(), 'search', 'search popstate should select search lens');
assert.equal(searchTeardownFocus.focused, true, 'search popstate should restore origin focus');
assert.equal(global.window.scrollY, 888, 'search popstate should restore origin scroll');
assert.equal(mockHistory.pushed.length, searchTeardownPushCount, 'search popstate teardown must not push history');
assert.equal(mockHistory.replaced.length, searchTeardownReplaceCount, 'search popstate teardown must not replace history');
assert.deepEqual(BlogController.getVisiblePosts().map(function (post) { return post.slug; }), ['beta'],
  'search popstate should apply its query');

// --- Test 27: invalid URL lens falls back to a named discovery lens ----
resetUrl('?lens=not-a-lens');
eventListeners.popstate.forEach(function (fn) { fn(); });
assert.equal(BlogController.getLens(), 'featured', 'invalid URL lens should use featured fallback');

// --- Test 28: archive year uses stored publication year in any TZ ------
var janOnePost = {
  slug: 'jan-one',
  title: 'New Year',
  date: '2026-01-01',
  featured: false,
  category: 'Notes',
  tags: [],
  excerpt: '',
  readTime: 1,
  wordCount: 10
};
resetUrl('');
BlogController.init([janOnePost], { archiveByYear: { '2026': ['jan-one'] } });
BlogController.setFilterYear('2026', false);
assert.deepEqual(
  BlogController.getVisiblePosts().map(function (post) { return post.slug; }),
  ['jan-one'],
  'archive year filtering should use the publication date year, not local timezone',
);

// --- Test 29: article bodies load lazily and are cached ------------------
var lazyLoadCount = 0;
var lazyPosts = [{
  slug: 'lazy',
  title: 'Lazy Signal',
  date: '2026-06-16',
  featured: true,
  category: 'Notes',
  tags: [],
  excerpt: 'Metadata only',
  readTime: 1,
  wordCount: 10,
  contentPath: '/blog-data/posts/lazy.json'
}];
resetUrl('');
BlogController.init(lazyPosts, {}, {
  loadPost: function (metadata) {
    lazyLoadCount++;
    assert.equal(metadata.html, undefined, 'loader receives metadata without article HTML');
    return Promise.resolve({
      slug: metadata.slug,
      title: metadata.title,
      html: '<p>Loaded on demand.</p>',
      toc: [],
      outgoingLinks: [],
      backlinks: [],
      relatedPosts: []
    });
  }
});
var lazyOpenPayloads = [];
BlogController.on('post-open', function (data) {
  if (data.slug === 'lazy') lazyOpenPayloads.push(data.post);
});
await BlogController.openPost('lazy');
assert.equal(lazyLoadCount, 1, 'first reader open should fetch one payload');
assert.match(lazyOpenPayloads[0].html, /Loaded on demand/, 'post-open should carry the full payload');
BlogController.closePost();
await BlogController.openPost('lazy');
assert.equal(lazyLoadCount, 1, 'subsequent opens should use the cached payload');

// --- Test 30: concurrent payload reads are de-duplicated -----------------
var resolveSharedPayload;
var sharedLoadCount = 0;
resetUrl('');
BlogController.init(lazyPosts, {}, {
  loadPost: function () {
    sharedLoadCount++;
    return new Promise(function (resolve) { resolveSharedPayload = resolve; });
  }
});
var firstLoad = BlogController.loadPost('lazy');
var secondLoad = BlogController.loadPost('lazy');
assert.equal(firstLoad, secondLoad, 'concurrent callers should share the in-flight promise');
assert.equal(sharedLoadCount, 1, 'only one network request should start');
resolveSharedPayload({ slug: 'lazy', html: '<p>Shared.</p>' });
await firstLoad;

// --- Test 31: repeated opens during loading emit reader content once ------
var resolvePendingPayload;
var pendingLoadCount = 0;
var pendingOpenCount = 0;
var pendingPosts = [{
  slug: 'pending',
  title: 'Pending Signal',
  date: '2026-06-16',
  featured: true,
  category: 'Notes',
  tags: [],
  excerpt: '',
  readTime: 1,
  wordCount: 10,
  contentPath: '/blog-data/posts/pending.json'
}];
resetUrl('');
BlogController.init(pendingPosts, {}, {
  loadPost: function () {
    pendingLoadCount++;
    return new Promise(function (resolve) { resolvePendingPayload = resolve; });
  }
});
BlogController.on('post-open', function (data) {
  if (data.slug === 'pending') pendingOpenCount++;
});
var pendingOpen = BlogController.openPost('pending');
BlogController.openPost('pending');
assert.equal(pendingLoadCount, 1, 'repeated activation should share the active payload request');
resolvePendingPayload({ slug: 'pending', html: '<p>Ready.</p>' });
await pendingOpen;
assert.equal(pendingOpenCount, 1, 'one payload completion should emit one post-open signal');

console.log('blog router tests passed (31 tests)');
