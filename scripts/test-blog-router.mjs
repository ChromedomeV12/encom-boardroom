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

console.log('blog router tests passed (8 tests)');