import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relativePath) {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

const lightTable = await read('src/LightTable.js');
const main = await read('src/main.js');
const boardroom = await read('src/Boardroom.js');
const controller = await read('src/BlogController.js');
const motionController = await read('src/MotionController.js');
const bundle = await read('build/encom-boardroom.js');
const index = await read('index.html');
const adapter = await read('js/blog-adapter.js');
const blogCss = await read('css/blog.css');

assert.doesNotThrow(() => new Function(boardroom), 'Boardroom source should parse');
assert.doesNotThrow(() => new Function(lightTable), 'LightTable source should parse');

assert.match(lightTable, /simulateCommand\("\|cd blog\$"\)/, 'featured folder should type cd blog');
assert.match(lightTable, /simulateCommand\("run blog\.exe\$"\)/, 'featured folder should type run blog.exe');
assert.match(lightTable, /function selectBlogLens\(lens\)/, 'folders should share one blog lens selector');
assert.match(lightTable, /BLOG_LAUNCH_MODE = lens/, 'folder selector should preserve launch mode compatibility');
assert.match(lightTable, /BlogController\.setLens\(lens, false\)/, 'folder selector should update controller state before launch');
assert.match(lightTable, /command == "run blog\.exe"/, 'terminal should execute blog.exe');
assert.match(lightTable, /currentDir == "blog"/, 'terminal should track blog directory');
assert.match(lightTable, /selectBlogLens\("topics"\)/, 'topics folder should prime controller lens before launch');
assert.match(lightTable, /selectBlogLens\("search"\)/, 'search folder should prime controller lens before launch');
assert.match(lightTable, /command == "help"/, 'terminal should support help command');
assert.match(lightTable, /command == "featured"/, 'terminal should support featured command');
assert.match(lightTable, /command == "latest"/, 'terminal should support latest command');
assert.match(lightTable, /command == "tags"/, 'terminal should support tags command');
assert.match(lightTable, /command\.indexOf\("tag "\)/, 'terminal should support tag command');
assert.match(lightTable, /command\.indexOf\("year "\)/, 'terminal should support year command');
assert.match(lightTable, /command\.indexOf\("search "\)/, 'terminal should support search command');
assert.match(lightTable, /command\.indexOf\("open "\)/, 'terminal should support open command');
assert.match(lightTable, /command == "back"/, 'terminal should support back command');

assert.match(lightTable, /selectBlogLens\("featured"\)/, 'featured folder should prime controller lens before launch');
assert.match(lightTable, /selectBlogLens\("latest"\)/, 'latest folder should prime controller lens before launch');
assert.match(lightTable, /selectBlogLens\("topics"\)/, 'topics folder should prime controller lens before launch');
assert.match(lightTable, /selectBlogLens\("archive"\)/, 'archive folder should prime controller lens before launch');
assert.match(lightTable, /selectBlogLens\("search"\)/, 'search folder should prime controller lens before launch');
assert.match(boardroom, /blog-discovery/, 'boardroom should expose discovery controls');
assert.match(boardroom, /getIndex\(\)/, 'discovery controls should use BLOG_INDEX through the controller');
assert.match(boardroom, /setFilterTag/, 'topics discovery should select tags');
assert.match(boardroom, /setFilterYear/, 'archive discovery should select years');
assert.match(boardroom, /setSearch/, 'search discovery should submit queries');
assert.match(lightTable, /terminalStatus/, 'terminal should retain fixed semantic status markup without raw interpolation');
assert.doesNotMatch(lightTable, /writeResponse\([\s\S]{0,180}\+\s*(tagName|yearName|query|slug)/, 'terminal dynamic values should not be interpolated as HTML');
assert.match(lightTable, /escapeHtml/, 'terminal dynamic responses should escape user input');
assert.match(main, /view === "blog"/, 'main switch should support blog stream');
assert.match(main, /screensaver\.text\("BLOG"\)/, 'blog stream should use BLOG screensaver');
assert.match(main, /Boardroom\.init\("blog", window\.BLOG_POSTS[^;]+BLOG_LAUNCH_MODE/, 'blog stream should initialize boardroom with posts and launch mode');
assert.match(main, /BlogController/, 'main should import the unified blog controller');
assert.match(main, /BlogController\.onBoardroomReady/, 'main should call onBoardroomReady in the show callback');

// M6 motion management integration assertions
assert.match(motionController, /MotionController\.create/, 'MotionController should expose create factory');
assert.match(motionController, /shouldTick/, 'MotionController should expose shouldTick method');
assert.match(motionController, /setReaderOpen/, 'MotionController should expose setReaderOpen method');
assert.match(motionController, /setReducedEffects/, 'MotionController should expose setReducedEffects method');
assert.match(motionController, /resetAnimationClock/, 'MotionController should expose resetAnimationClock method');
assert.match(motionController, /cleanup/, 'MotionController should expose cleanup method');
assert.match(motionController, /visibilitychange/, 'MotionController should listen to visibility API');
assert.match(motionController, /prefers-reduced-motion/, 'MotionController should listen to prefers-reduced-motion');
assert.match(motionController, /IntersectionObserver/, 'MotionController should use IntersectionObserver for offscreen detection');
assert.match(motionController, /encom-reduced-effects/, 'MotionController should persist reduced-effects preference');
assert.match(motionController, /reduced-effects/, 'MotionController should update body class for reduced-effects');
assert.match(main, /MotionController/, 'main should import MotionController');
assert.match(main, /shouldTick/, 'main should gate Boardroom ticks through motion policy');
assert.match(boardroom, /resetAnimationClock/, 'Boardroom should expose resetAnimationClock API');
assert.match(blogCss, /prefers-reduced-motion/, 'blog CSS should have prefers-reduced-motion media query');
assert.match(blogCss, /\.reduced-effects/, 'blog CSS should have reduced-effects class');
assert.match(boardroom, /streamType === "blog"/, 'boardroom should have first-class blog behavior');
assert.match(boardroom, /renderBlogInteractions/, 'boardroom should render blog post rows');
assert.match(boardroom, /data-post-slug/, 'boardroom rows should carry post slugs');
assert.doesNotMatch(boardroom, /blog-thread-card/, 'boardroom should not use rejected thread-card stream UI');
assert.match(boardroom, /blogMode === "featured"/, 'boardroom should support featured post mode');
assert.match(boardroom, /blogMode === "archive"/, 'boardroom should support archive post mode');
assert.match(controller, /pushState/, 'controller should use history pushState for routing');
assert.match(controller, /popstate/, 'controller should handle popstate for back/forward');
assert.match(controller, /onBoardroomReady/, 'controller should expose a boardroom-ready lifecycle event');
assert.match(controller, /openPost/, 'controller should expose openPost');
assert.match(controller, /loadPost/, 'controller should expose lazy post loading');
assert.match(controller, /payloadRequests/, 'controller should de-duplicate in-flight post payloads');
assert.match(controller, /closePost/, 'controller should expose closePost');
assert.match(controller, /getVisiblePosts/, 'controller should expose getVisiblePosts for the current lens');
assert.match(controller, /archive-signal/, 'controller should emit archive signals');
assert.match(controller, /postToSignal/, 'controller should convert posts to archive signals');
assert.match(controller, /startArchiveReplay/, 'controller should start archive replay');
assert.match(controller, /ARCHIVE REPLAY|archiveReplay/, 'controller should label replay honestly');
assert.match(controller, /renderPendingPost\s*=/, 'controller should expose a pending deep-link render operation');
assert.match(controller, /getUTCFullYear/, 'archive year fallback should use UTC');
assert.doesNotMatch(controller, /new Date\(p\.date\)\.getFullYear\(\)/, 'archive filtering must not use local getFullYear');
assert.match(boardroom, /ARCHIVE REPLAY/, 'boardroom should label the feed as ARCHIVE REPLAY');
assert.match(boardroom, /ARCHIVE GEOGRAPHY/, 'boardroom should label globalization as archive geography');
assert.match(boardroom, /ARCHIVE GROWTH/, 'boardroom should label growth as archive growth');

assert.match(bundle, /simulateCommand\("\|cd blog\$"\)/, 'served bundle should type cd blog');
assert.match(bundle, /command == "run blog\.exe"/, 'served bundle should execute blog.exe');
assert.match(bundle, /view === "blog"/, 'served bundle should support blog stream');
assert.match(bundle, /Boardroom\.init\("blog", window\.BLOG_POSTS[^;]+BLOG_LAUNCH_MODE/, 'served bundle should initialize boardroom with posts and launch mode');
assert.match(bundle, /renderBlogInteractions/, 'served bundle should render blog post rows');
assert.doesNotMatch(bundle, /blog-thread-card/, 'served bundle should not use rejected thread-card stream UI');
assert.match(bundle, /BlogController/, 'served bundle should include the unified blog controller');
assert.match(bundle, /onBoardroomReady/, 'served bundle should wire the boardroom-ready lifecycle');

assert.match(index, /id="boardroom-readme-blog"/, 'blog boardroom readme should exist');
assert.match(index, /<meta\s+name=["']viewport["']\s+content=["'][^"']*\bwidth=device-width\b[^"']*\binitial-scale=1\b[^"']*["']\s*\/?>/, 'index should declare a responsive viewport');
assert.match(index, /ENCOM ARCHIVE INFO/, 'index should have an archive info readme');
assert.doesNotMatch(index, /Next build step: replace the placeholder/, 'index should not have stale placeholder copy');
assert.match(index, /css\/blog\.css\?v=blog-fork-11/, 'responsive blog stylesheet should be loaded after ENCOM styles');
assert.match(index, /js\/blog-posts\.js\?v=blog-fork-11/, 'generated blog data should be cache-busted');
assert.match(index, />[^<]*Featured[^<]*</, 'index should label the featured folder');
assert.match(index, />[^<]*Latest[^<]*</, 'index should label the latest folder');
assert.match(index, />[^<]*Archive[^<]*</, 'index should label the archive folder');
assert.match(index, />[^<]*Topics[^<]*</, 'index should label the topics folder');
assert.match(index, />[^<]*Search \/ Index[^<]*</, 'index should label the search folder');
assert.doesNotMatch(adapter, /blog-mini-list/, 'README mini post launcher should stay removed');
assert.doesNotMatch(adapter, /boardroom-readme-test/, 'adapter should not overwrite the test readme as blog copy');
assert.match(adapter, /classList\.add\('blog-flex'\)/, 'adapter should enable blog responsive layout class');
assert.doesNotMatch(adapter, /renderPostCard/, 'adapter fallback should not use rejected thread-card stream UI');
assert.match(adapter, /\\?post=/, 'reader should use query-param post URLs');
const adapterBoot = adapter.slice(adapter.indexOf('// ---- Boot:'));
assert.match(
  adapterBoot,
  /renderPendingPost\(\)/,
  'adapter boot should render an initial deep-linked post after signal subscriptions',
);
assert.doesNotMatch(
  adapterBoot,
  /onBoardroomReady\(/,
  'adapter boot must not mark boardroom ready before Boardroom.show',
);
assert.match(
  adapter,
  /canonicalLink[\s\S]{0,320}parseCanonicalPostLink/,
  'runtime reader should intercept canonical cross-post article links',
);
assert.match(adapter, /function deploymentBasePath\(/, 'runtime should derive the boardroom deployment path');
assert.match(adapter, /rebaseReaderHtml\(post\.html\)/, 'reader HTML should be rebased for project-site paths');
assert.match(
  adapter,
  /deploymentPath\(['"]posts\/['"]\)/,
  'canonical post interception should retain the deployment pathname'
);
const deploymentHelpersSource = adapter.slice(
  adapter.indexOf('  function deploymentBasePath'),
  adapter.indexOf('  function renderLinkSection'),
);
function loadDeploymentHelpers(pathname) {
  const runtimeWindow = {
    location: {
      pathname,
      href: `https://chromedomev12.github.io${pathname}`,
      host: 'chromedomev12.github.io',
    },
  };
  const runtimeDocument = {
    createElement() {
      const anchor = {};
      Object.defineProperty(anchor, 'href', {
        set(value) {
          const parsed = new URL(value, runtimeWindow.location.href);
          anchor.host = parsed.host;
          anchor.pathname = parsed.pathname;
          anchor.hash = parsed.hash;
        },
      });
      return anchor;
    },
  };
  return new Function(
    'window',
    'document',
    `${deploymentHelpersSource}\nreturn { deploymentPath, rebaseReaderHtml, parseCanonicalPostLink };`,
  )(runtimeWindow, runtimeDocument);
}

const projectHelpers = loadDeploymentHelpers('/encom-boardroom/');
assert.equal(projectHelpers.deploymentPath('blog-data/posts/a.json'), '/encom-boardroom/blog-data/posts/a.json');
assert.equal(
  projectHelpers.rebaseReaderHtml('<a href="/posts/a/"><img src="/blog-assets/a.png"></a>'),
  '<a href="/encom-boardroom/posts/a/"><img src="/encom-boardroom/blog-assets/a.png"></a>',
  'reader-generated post and asset paths should retain the project pathname',
);
assert.deepEqual(
  projectHelpers.parseCanonicalPostLink({
    getAttribute() { return '/encom-boardroom/posts/caf%C3%A9/#heading'; },
  }),
  { slug: 'café', heading: 'heading' },
  'project-path canonical links should still route inside the reader',
);
const rootHelpers = loadDeploymentHelpers('/');
assert.equal(
  rootHelpers.rebaseReaderHtml('<a href="/posts/a/">A</a>'),
  '<a href="/posts/a/">A</a>',
  'local root reader paths should remain root-relative',
);
assert.match(adapter, /event\.button\s*===\s*0/, 'canonical links should require primary clicks');
assert.match(adapter, /event\.defaultPrevented/, 'canonical links should respect prior preventDefault');
assert.match(adapter, /event\.metaKey/, 'canonical links should preserve command-click navigation');
assert.match(adapter, /event\.ctrlKey/, 'canonical links should preserve ctrl-click navigation');
assert.match(adapter, /event\.shiftKey/, 'canonical links should preserve shift-click navigation');
assert.match(adapter, /event\.altKey/, 'canonical links should preserve alt-click navigation');
assert.match(adapter, /hasAttribute\(['"]download['"]\)/, 'canonical links should preserve downloads');
assert.match(adapter, /target\s*===\s*['_"]_self['"]/, 'canonical links should preserve targeted navigation');
assert.match(adapter, /Escape/, 'reader should close on Escape key');
assert.match(adapter, /LINKED FROM/, 'reader should render backlinks');
assert.match(adapter, /LINKS OUT/, 'reader should render outgoing links');

// M6 task 3: reader accessibility and semantic navigation runtime assertions
assert.match(adapter, /aria-labelledby/, 'reader dialog should use aria-labelledby for naming');
assert.match(adapter, /aria-modal/, 'reader dialog should have aria-modal');
assert.match(adapter, /inert/, 'adapter should set inert on background surfaces when reader opens');
assert.match(adapter, /inert\s*=\s*false|inert\s*=\s*true/, 'adapter should manage inert property');
assert.match(adapter, /removeAttribute\(['"]aria-hidden['"]\)|setAttribute\(['"]aria-hidden['"]/, 'adapter should manage aria-hidden attribute');
assert.match(boardroom, /role=["']button['"]|tabindex=["']0['"]/, 'boardroom post rows should be focusable controls');
assert.match(boardroom, /aria-label/, 'boardroom post rows should have accessible labels');
assert.match(lightTable, /executeCommand/, 'light-table should expose executeCommand API');
assert.doesNotMatch(index, /lt-command-form|lt-command-input/, 'light-table terminal should remain display-only like the original');
assert.match(index, /ENCOM TOUCH APP\s*<span class=["']alt-1["']>OS<\/span><span class=["']alt-2["']>12<\/span>/, 'index.html should preserve the original ENCOM OS12 title treatment');
assert.doesNotMatch(adapter, /OBSIDIAN TOUCH APP OS12/, 'blog adapter should not overwrite the original ENCOM OS12 title');
assert.match(lightTable, /input|textarea|select|contenteditable/, 'light-table key handler should exempt form inputs');
assert.match(lightTable, /metaKey|ctrlKey|altKey/, 'light-table key handler should ignore modifier shortcuts');
assert.match(boardroom, /renderBlogInteractions/, 'boardroom should rerender posts on lens changes');
// M6 task 3 fixes: aria-current on selected post button
assert.match(boardroom, /aria-current/, 'boardroom should set aria-current on selected post button');
assert.match(boardroom, /removeAttribute\(['"]aria-current['"]\)|setAttribute\(['"]aria-current['"]/, 'boardroom should update aria-current on post changes');

// M6 task 3 fixes: Boardroom.renderBlogInteractions exposed for rerender
assert.match(boardroom, /Boardroom\.renderBlogInteractions\s*=/, 'Boardroom should expose renderBlogInteractions function');

// M6 task 3 fixes: adapter subscriptions for lens-change, search, filter-tag, filter-year
assert.match(adapter, /lens-change/, 'adapter should subscribe to lens-change signal');
assert.match(adapter, /search/, 'adapter should subscribe to search signal');
assert.match(adapter, /filter-tag/, 'adapter should subscribe to filter-tag signal');
assert.match(adapter, /filter-year/, 'adapter should subscribe to filter-year signal');

// M6 task 3 fixes: adapter uses closure state for exact restoration
assert.match(adapter, /var\s+lightTable\s*=\s*null/, 'adapter should capture element in closure for exact restoration');
assert.match(adapter, /savedLightTableInert/, 'adapter should use closure state for exact restoration');
assert.doesNotMatch(adapter, /dataset\.previouslyInert/, 'adapter should not use dataset for state storage');

// M6 task 3 fixes: focusin containment listener for programmatic focus escape
assert.match(
  adapter,
  /document\.addEventListener\(['"]focusin['"],\s*readerFocusContainmentHandler,\s*true\)/,
  'adapter should capture focus escapes at document scope',
);
assert.match(adapter, /var readerFocusContainmentHandler = null/, 'adapter should retain one containment handler');
assert.match(
  adapter,
  /if \(!readerFocusContainmentHandler\)/,
  'adapter should not register duplicate containment listeners',
);

const focusContainmentSource = adapter.slice(
  adapter.indexOf('  function containReaderFocus'),
  adapter.indexOf('  function installReader'),
);
const containReaderFocus = new Function(`${focusContainmentSource}\nreturn containReaderFocus;`)();
const insideTarget = {};
const outsideTarget = {};
let fallbackFocusCount = 0;
const fallbackFocusTarget = { focus() { fallbackFocusCount += 1; } };
let readerOpen = true;
const focusReader = {
  classList: { contains(name) { return name === 'is-open' && readerOpen; } },
  contains(target) { return target === insideTarget || target === fallbackFocusTarget; },
  querySelector(selector) { return selector === '.blog-reader-close' ? fallbackFocusTarget : null; },
  querySelectorAll() { return [fallbackFocusTarget]; },
};

let prevented = 0;
let stopped = 0;
const escapedFocusEvent = {
  target: outsideTarget,
  preventDefault() { prevented += 1; },
  stopPropagation() { stopped += 1; },
};
assert.equal(containReaderFocus(focusReader, escapedFocusEvent), true, 'escaped focus should be intercepted');
assert.equal(prevented, 1, 'escaped focus should be cancelled');
assert.equal(stopped, 1, 'escaped focus should not propagate into the inert background');
assert.equal(fallbackFocusCount, 1, 'escaped focus should return to the reader close control');

const containedFocusEvent = {
  target: insideTarget,
  preventDefault() { assert.fail('contained focus must not be cancelled'); },
  stopPropagation() { assert.fail('contained focus must not be stopped'); },
};
assert.equal(containReaderFocus(focusReader, containedFocusEvent), false, 'focus inside the reader should remain untouched');
assert.equal(fallbackFocusCount, 1, 'contained focus should not be redirected');

readerOpen = false;
assert.equal(containReaderFocus(focusReader, escapedFocusEvent), false, 'closed reader should not contain page focus');
assert.equal(fallbackFocusCount, 1, 'closed reader should not redirect page focus');
// M6 task 3 fixes: Boardroom.message preserves semantic buttons in blog streams
assert.match(boardroom, /createElement.*button/, 'Boardroom.message should create button elements for blog streams');
assert.match(boardroom, /replaceChild.*button.*lastChild/, 'Boardroom.message should replace placeholder with button for blog streams');
assert.match(boardroom, /streamType === "blog"/, 'Boardroom.message should check stream type before button replacement');
const messageRuntime = boardroom.slice(
  boardroom.indexOf('Boardroom.message = function(message){'),
  boardroom.indexOf('Boardroom.resize = function(){'),
);
const blogMessageStart = messageRuntime.indexOf('// For blog streams, replace placeholder <ul> with semantic <button>');
const blogMessageEnd = messageRuntime.indexOf('        } else {', blogMessageStart);
const blogMessageBranch = messageRuntime.slice(blogMessageStart, blogMessageEnd);
const nonBlogMessageBranch = messageRuntime.slice(blogMessageEnd);

assert.match(
  blogMessageBranch,
  /message\.featured\s*\?\s*"featured"\s*:\s*"archive"/,
  'blog replay should derive its status from message.featured',
);
assert.match(
  nonBlogMessageBranch,
  /message\.popularity\s*>\s*100\s*\?\s*"featured"\s*:\s*"archive"/,
  'non-blog replay should retain popularity-derived status',
);
assert.doesNotMatch(
  nonBlogMessageBranch,
  /message\.featured/,
  'non-blog replay should not depend on blog-only featured metadata',
);
assert.match(
  messageRuntime,
  /replaceChild\(button,\s*lastChild\);\s*lastChild\s*=\s*button;/,
  'blog replay should reorder the replacement button, not the detached placeholder',
);

function runtimeNode(className) {
  const attributes = Object.create(null);
  const node = {
    className,
    innerHTML: '',
    parentNode: null,
    classList: {
      contains(name) {
        return node.className.split(/\s+/).includes(name);
      },
    },
    setAttribute(name, value) {
      attributes[name] = String(value);
    },
    removeAttribute(name) {
      delete attributes[name];
    },
    getAttribute(name) {
      return attributes[name] || null;
    },
  };
  return node;
}

function runtimeContainer(children) {
  const container = {
    children,
    get firstChild() {
      return this.children[0] || null;
    },
    get lastChild() {
      return this.children[this.children.length - 1] || null;
    },
    replaceChild(next, previous) {
      const index = this.children.indexOf(previous);
      assert.notEqual(index, -1, 'replay should replace an attached interaction row');
      this.children[index] = next;
      previous.parentNode = null;
      next.parentNode = this;
    },
    insertBefore(node, reference) {
      const currentIndex = this.children.indexOf(node);
      if (currentIndex >= 0) this.children.splice(currentIndex, 1);
      const referenceIndex = this.children.indexOf(reference);
      this.children.splice(referenceIndex >= 0 ? referenceIndex : this.children.length, 0, node);
      node.parentNode = this;
    },
  };
  children.forEach((child) => {
    child.parentNode = container;
  });
  return container;
}

function loadBoardroomMessageRuntime() {
  const jquery = () => ({
    text() { return this; },
    css() { return this; },
    prepend() { return this; },
  });
  const documentStub = {
    createElement() {
      return runtimeNode('');
    },
  };
  const windowStub = {
    BlogController: {
      getSelectedSlug() {
        return null;
      },
    },
  };
  const moduleStub = { exports: {} };
  const requireStub = (name) => {
    if (name === 'jquery') return jquery;
    if (name === 'moment') return { tz() {} };
    return {};
  };
  const source = `${boardroom}
module.exports.__setMessageRuntime = function (type, container) {
  streamType = type;
  interactionContainer = [container];
  globe = {};
  swirls = null;
  locationAreas = { unknown: { count: 0, ref: { css() {} } } };
};`;
  new Function('require', 'module', 'exports', 'document', 'window', 'setInterval', source)(
    requireStub,
    moduleStub,
    moduleStub.exports,
    documentStub,
    windowStub,
    () => 0,
  );
  return moduleStub.exports;
}

const replayRuntime = loadBoardroomMessageRuntime();
const detachedRows = [
  runtimeNode('interaction-data blog-interaction'),
  runtimeNode('interaction-data blog-interaction'),
];
const discoveryNode = runtimeNode('blog-discovery');
const replayContainer = runtimeContainer([...detachedRows, discoveryNode]);
replayRuntime.__setMessageRuntime('blog', replayContainer);
replayRuntime.message({
  stream: 'blog',
  slug: 'first-post',
  title: 'First post',
  category: 'Notes',
  date: '2026-07-01',
  readTime: 2,
  tags: ['archive'],
  featured: false,
});
replayRuntime.message({
  stream: 'blog',
  slug: 'second-post',
  title: 'Second post',
  category: 'Notes',
  date: '2026-07-02',
  readTime: 3,
  tags: ['archive'],
  featured: false,
});
const replayRows = replayContainer.children.filter((node) => node.classList.contains('blog-interaction'));
assert.equal(replayRows.length, 2, 'archive replay should preserve one row per placeholder');
assert.deepEqual(
  replayRows.map((node) => node.getAttribute('data-post-slug')),
  ['second-post', 'first-post'],
  'archive replay should move each replacement button to the front without restoring detached rows',
);
assert.equal(
  detachedRows.filter((node) => node.parentNode === null).length,
  2,
  'detached placeholders should stay detached',
);

const legacyRow = runtimeNode('interaction-data');
const legacyContainer = runtimeContainer([legacyRow]);
replayRuntime.__setMessageRuntime('github', legacyContainer);
replayRuntime.message({
  stream: 'github',
  username: 'Legacy',
  title: 'Legacy status',
  type: 'push',
  size: 1,
  featured: true,
  popularity: 1,
});
assert.match(
  legacyRow.innerHTML,
  /interaction-popularity[^>]*>archive</,
  'non-blog replay should render archive status from low popularity even when featured is set',
);
const mobileBlogCss = blogCss.slice(blogCss.indexOf('@media (max-width: 900px)'));
const mobileRules = [...mobileBlogCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)];

function mobileDeclarations(selector) {
  return mobileRules
    .filter(([, selectors]) => selectors.split(',').some((candidate) => candidate.trim() === selector))
    .map(([, , declarations]) => declarations);
}

for (const selector of ['body.blog-flex #globe', 'body.blog-flex #globe-footer', 'body.blog-flex #cube', 'body.blog-flex #swirls']) {
  const declarations = mobileDeclarations(selector);
  assert.notEqual(declarations.length, 0, `${selector} should have a compact mobile layout`);
  assert.ok(declarations.every((rule) => !/display\s*:\s*none\b/.test(rule)), `${selector} should remain rendered on mobile`);
}

for (const selector of [
  'body.blog-flex #interaction-overlay',
  'body.blog-flex #stock-chart',
  'body.blog-flex #stock-subcharts',
  'body.blog-flex #timer-trees',
]) {
  const declarations = mobileDeclarations(selector);
  assert.notEqual(declarations.length, 0, `${selector} should have a compact mobile layout`);
  assert.ok(
    declarations.some((rule) => /display\s*:\s*block\b/.test(rule))
      && declarations.every((rule) => !/display\s*:\s*none\b/.test(rule)),
    `${selector} should remain visible on mobile`,
  );
}

assert.ok(
  mobileDeclarations('body.blog-flex #interaction-overlay').some(
    (rule) => /height\s*:/.test(rule) && /max-width\s*:/.test(rule) && /pointer-events\s*:\s*none\b/.test(rule),
  ),
  'mobile interaction overlay should remain compact without blocking the reader',
);
assert.ok(
  mobileDeclarations('body.blog-flex #growth').some((rule) => /overflow-x\s*:\s*auto\b/.test(rule))
    && mobileDeclarations('body.blog-flex #growth-container').some(
      (rule) => /min-height\s*:/.test(rule) && /min-width\s*:/.test(rule),
    ),
  'mobile stock charts should remain in a constrained horizontally scrollable shelf',
);
assert.ok(
  mobileDeclarations('body.blog-flex #timer').some((rule) => /overflow-x\s*:\s*auto\b/.test(rule))
    && mobileDeclarations('body.blog-flex #timer-trees').some(
      (rule) => /height\s*:/.test(rule) && /width\s*:/.test(rule),
    ),
  'mobile timer trees should remain in a compact horizontally scrollable shelf',
);

assert.ok(
  mobileDeclarations('body.blog-flex #user-interaction-container').some((rule) => /overflow-x\s*:\s*auto\b/.test(rule)),
  'mobile cube and swirls should share a horizontally scrollable instrument shelf',
);
assert.ok(
  mobileDeclarations('body.blog-flex #globe').some((rule) => /overflow\s*:\s*hidden\b/.test(rule) && /max-height\s*:/.test(rule)),
  'mobile globe should remain visible within a constrained instrument viewport',
);

assert.ok(
  mobileDeclarations('body.blog-flex #lt-keyboard').some(
    (rule) => /display\s*:\s*block\b/.test(rule) && /transform\s*:\s*scale\(/.test(rule),
  ),
  'touch keyboard should remain visible in a compact mobile layout',
);
assert.ok(
  mobileDeclarations('body.blog-flex #lt-container-outside').some((rule) => /position\s*:\s*absolute\b/.test(rule)),
  'decorative light-table shell should remain overlaid and out of normal flow at narrow widths',
);

assert.ok(
  mobileDeclarations('body.blog-flex #lt-right-column').some((rule) => /overflow-x\s*:\s*auto\b/.test(rule)),
  'touch keyboard should remain reachable through a horizontally scrollable shelf at narrow widths',
);
assert.ok(
  mobileDeclarations('body.blog-flex #lt-right-column').some((rule) => {
    const minHeight = rule.match(/min-height\s*:\s*(\d+)px\b/);
    return minHeight && Number(minHeight[1]) >= 480;
  }),
  'narrow keyboard shelf should reserve enough block space to show the keyboard without vertical scrolling',
);

assert.match(blogCss, /body\.blog-flex #boardroom/, 'blog CSS should own responsive boardroom layout');
assert.match(blogCss, /display: grid;/, 'blog CSS should use grid/flex-style layout instead of only fixed boxes');
assert.match(blogCss, /max-width: 72ch/, 'article body should have readable line length');
assert.doesNotMatch(blogCss, /blog-thread-card/, 'rejected thread-card styles should stay removed');
assert.doesNotMatch(blogCss, /blog-mini-list/, 'old README mini launcher styles should stay removed');

const mobileMediaRules = mobileDeclarations('body.blog-flex #media');
const mobileMediaShelfRules = mobileDeclarations('body.blog-flex #media-container');
assert.ok(
  mobileMediaRules.some(
    (rule) => /display\s*:\s*block\s*!important/.test(rule)
      && /max-width\s*:\s*100%/.test(rule)
      && /min-width\s*:\s*0/.test(rule)
      && /overflow-x\s*:\s*auto\s*!important/.test(rule),
  )
    && mobileMediaRules.every((rule) => !/display\s*:\s*none\b/.test(rule))
    && mobileMediaShelfRules.some(
      (rule) => /display\s*:\s*flex\b/.test(rule) && /width\s*:\s*max-content\b/.test(rule),
    ),
  'mobile media shelf should remain displayable, bounded, and internally scrollable',
);
console.log('blog runtime tests passed');
