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

assert.match(lightTable, /simulateCommand\("\|cd blog\$"\)/, 'featured folder should type cd blog');
assert.match(lightTable, /simulateCommand\("run blog\.exe\$"\)/, 'featured folder should type run blog.exe');
assert.match(lightTable, /BLOG_LAUNCH_MODE = "featured"/, 'featured folder should set featured mode');
assert.match(lightTable, /BLOG_LAUNCH_MODE = "latest"/, 'latest folder should set latest mode');
assert.match(lightTable, /BLOG_LAUNCH_MODE = "archive"/, 'archive folder should set archive mode');
assert.match(lightTable, /command == "run blog\.exe"/, 'terminal should execute blog.exe');
assert.match(lightTable, /currentDir == "blog"/, 'terminal should track blog directory');
assert.match(lightTable, /BLOG_LAUNCH_MODE = "topics"/, 'topics folder should set topics mode');
assert.match(lightTable, /BLOG_LAUNCH_MODE = "search"/, 'search folder should set search mode');
assert.match(lightTable, /command == "help"/, 'terminal should support help command');
assert.match(lightTable, /command == "featured"/, 'terminal should support featured command');
assert.match(lightTable, /command == "latest"/, 'terminal should support latest command');
assert.match(lightTable, /command == "tags"/, 'terminal should support tags command');
assert.match(lightTable, /command\.indexOf\("tag "\)/, 'terminal should support tag command');
assert.match(lightTable, /command\.indexOf\("year "\)/, 'terminal should support year command');
assert.match(lightTable, /command\.indexOf\("search "\)/, 'terminal should support search command');
assert.match(lightTable, /command\.indexOf\("open "\)/, 'terminal should support open command');
assert.match(lightTable, /command == "back"/, 'terminal should support back command');

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
assert.match(controller, /closePost/, 'controller should expose closePost');
assert.match(controller, /getVisiblePosts/, 'controller should expose getVisiblePosts for the current lens');
assert.match(controller, /archive-signal/, 'controller should emit archive signals');
assert.match(controller, /postToSignal/, 'controller should convert posts to archive signals');
assert.match(controller, /startArchiveReplay/, 'controller should start archive replay');
assert.match(controller, /ARCHIVE REPLAY|archiveReplay/, 'controller should label replay honestly');
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
assert.match(index, /lt-command-form|lt-command-input/, 'index.html should have a real labeled terminal form');
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

// M6 task 3 fixes: Boardroom.message preserves semantic button markup
assert.match(boardroom, /<button|role=["']button['"]/, 'Boardroom.message should preserve button markup');
assert.doesNotMatch(boardroom, /<li[^>]*class=["']interaction-username['"]/, 'Boardroom.message should not rewrite semantic button with li children');
assert.match(boardroom, /tabindex/, 'Boardroom.message should preserve tabindex');
assert.match(boardroom, /aria-label/, 'Boardroom.message should preserve aria-label');
assert.match(boardroom, /data-post-slug/, 'Boardroom.message should preserve data-post-slug');

assert.match(blogCss, /:focus-visible/, 'blog CSS should have :focus-visible styling');
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

console.log('blog runtime tests passed');
