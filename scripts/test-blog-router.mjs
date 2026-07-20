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

// Eval the controller in a function scope with our mocks.
var wrapped = '(function(module, exports, require, window, document) {' +
  controllerSrc +
  '\n})(moduleShim, moduleShim.exports, requireShim, global.window, global.document);';
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

console.log('blog router tests passed (17 tests)');