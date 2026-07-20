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
assert.match(main, /BlogController\.init/, 'main should initialize the controller with post data');
assert.match(main, /BlogController\.onBoardroomReady/, 'main should call onBoardroomReady in the show callback');

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
  mobileDeclarations('body.blog-flex #lt-right-column').some((rule) => /overflow-x\s*:\s*auto\b/.test(rule)),
  'touch keyboard should remain reachable through a horizontally scrollable shelf at narrow widths',
);

assert.match(blogCss, /body\.blog-flex #boardroom/, 'blog CSS should own responsive boardroom layout');
assert.match(blogCss, /display: grid;/, 'blog CSS should use grid/flex-style layout instead of only fixed boxes');
assert.match(blogCss, /max-width: 72ch/, 'article body should have readable line length');
assert.doesNotMatch(blogCss, /blog-thread-card/, 'rejected thread-card styles should stay removed');
assert.doesNotMatch(blogCss, /blog-mini-list/, 'old README mini launcher styles should stay removed');

console.log('blog runtime tests passed');
