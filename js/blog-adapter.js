// ENCOM blog adapter — the non-bundled runtime layer that connects the
// unified BlogController (exposed on window by the Browserify bundle) to
// the boardroom DOM. Loaded as a separate <script> after the bundle.
//
// Responsibilities retained here:
// - Add the blog-flex responsive class
// - Swap light-table/boardroom copy to archive labels
// - Render the article reader overlay (focus trap, scroll lock, escape)
// - Wire click delegation for post rows and in-reader links
//
// Responsibilities moved to BlogController:
// - Lens/selection/search state
// - URL history (pushState/popstate replaces hash + hashchange)
// - Post list filtering (getVisiblePosts)
// - Lifecycle (onBoardroomReady replaces the retry-timer boot cascade)
(function () {
  var ctrl = window.BlogController;
  var posts = window.BLOG_POSTS || [];
  if (!posts.length) return;

  var postBySlug = {};
  posts.forEach(function (post) { postBySlug[post.slug] = post; });

  var readerInstalled = false;
  // Closure state for exact restoration (no dataset string coercion)
  var lightTable = null;
  var boardroom = null;
  var savedLightTableInert = null;
  var savedBoardroomInert = null;
  var savedLightTableAriaHidden = null;
  var savedBoardroomAriaHidden = null;
  var savedBodyOverflow = null;
  var readerFocusContainmentHandler = null;

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function deploymentBasePath() {
    var pathname = window.location.pathname || '/';
    // The boardroom can be opened as `/project/` or `/project/index.html`.
    if (pathname.charAt(pathname.length - 1) !== '/') {
      pathname = pathname.slice(0, pathname.lastIndexOf('/') + 1);
    }
    return pathname.replace(/\/+$/, '');
  }

  function deploymentPath(rootPath) {
    var normalized = String(rootPath || '').replace(/^\/+/, '');
    var base = deploymentBasePath();
    return (base || '') + '/' + normalized;
  }

  function rebaseReaderHtml(value) {
    var base = deploymentBasePath();
    if (!base) return String(value || '');
    return String(value || '').replace(
      /\b(href|src)="\/(posts|blog-assets)\//g,
      '$1="' + base + '/$2/'
    );
  }

  function parseCanonicalPostLink(link) {
    var rawHref = link.getAttribute('href');
    if (!rawHref) return null;
    var probe = document.createElement('a');
    probe.href = rawHref;
    if (probe.host && probe.host !== window.location.host) return null;
    var prefix = deploymentPath('posts/');
    if (probe.pathname.indexOf(prefix) !== 0) return null;
    var remainder = probe.pathname.slice(prefix.length);
    var slugPart = remainder.split('/')[0];
    if (!slugPart) return null;
    return {
      slug: decodeURIComponent(slugPart),
      heading: probe.hash ? decodeURIComponent(probe.hash.slice(1)) : ''
    };
  }

  function renderLinkSection(label, links) {
    if (!links || !links.length) return '';
    return '<section class="blog-reader-links">' +
      '<h2>' + label + '</h2>' +
      '<ul>' + links.map(function (link) {
        return '<li><a href="?post=' + escapeHtml(link.slug) + '" data-slug="' + escapeHtml(link.slug) + '">' +
          escapeHtml(link.title) + '</a></li>';
      }).join('') + '</ul></section>';
  }

  function renderTocNav(tocTree) {
    if (!tocTree || !tocTree.length) return '';
    var renderList = function (items) {
      var lis = items.map(function (item) {
        var nested = item.children && item.children.length ? renderList(item.children) : '';
        return '<li><a href="#' + escapeHtml(item.id) + '">' + escapeHtml(item.text) + '</a>' + nested + '</li>';
      });
      return '<ul>' + lis.join('') + '</ul>';
    };
    return '<nav class="blog-reader-toc"><h2>Contents</h2>' + renderList(tocTree) + '</nav>';
  }

  // ---- Reader overlay with focus trap + scroll lock + escape ------------
  function containReaderFocus(reader, event) {
    if (!reader.classList.contains('is-open') || reader.contains(event.target)) return false;

    event.preventDefault();
    event.stopPropagation();
    var closeBtn = reader.querySelector('.blog-reader-close');
    var focusable = reader.querySelectorAll('a[href],button,[tabindex]:not([tabindex="-1"])');
    var fallback = closeBtn || (focusable.length ? focusable[0] : reader);
    if (typeof fallback.focus === 'function') fallback.focus();
    return true;
  }

  function installReader() {
    if (readerInstalled) return;
    readerInstalled = true;

    if (!document.querySelector('#blog-reader-styles')) {
      var style = document.createElement('style');
      style.id = 'blog-reader-styles';
      style.textContent = [
        '#blog-reader{position:fixed;inset:0;z-index:1000;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.78);padding:24px}',
        '#blog-reader.is-open{display:flex}',
        '.blog-reader-panel{background:rgba(4,12,12,.98);border:2px solid #6fc0ba;box-shadow:0 0 24px rgba(0,238,238,.2);max-height:86vh;max-width:820px;overflow:hidden;width:min(820px,94vw);display:flex;flex-direction:column}',
        '.blog-reader-panel>header{align-items:center;border-bottom:1px solid #1b2f2d;color:#00eeee;display:flex;font-family:Inconsolata,monospace;font-size:11px;justify-content:space-between;padding:8px 12px;text-transform:uppercase}',
        '.blog-reader-close{background:transparent;border:0;color:#ffcc00;cursor:pointer;font:inherit}',
        '.blog-reader-copy{color:#d8e1dd;font-family:Inconsolata,monospace;font-size:17px;line-height:1.72;max-height:calc(86vh - 40px);overflow:auto;padding:28px 36px 42px}',
        '.blog-reader-meta{color:#6fc0ba;font-size:11px;letter-spacing:.04em;margin:0;text-transform:uppercase}',
        '.blog-reader-title{color:#f2f7f4;font-size:44px;line-height:1;margin:0 0 18px}',
        '.blog-reader-body{color:#d8e1dd}',
        '.blog-reader-body a{color:#ffcc00;text-decoration:none;border-bottom:1px solid rgba(255,204,0,.45)}',
        '.blog-reader-body a:hover{color:#fff;border-bottom-color:#fff}',
        '.blog-reader-body img{display:block;max-width:100%;margin:20px auto;border:1px solid rgba(111,192,186,.45)}',
        '.blog-reader-body blockquote{border-left:2px solid #6fc0ba;color:#edf4f0;margin:22px 0;padding:4px 0 4px 18px;background:rgba(0,238,238,.035)}',
        '.blog-reader-toc{border:1px solid rgba(111,192,186,.2);padding:14px 20px;margin:24px 0 32px}',
        '.blog-reader-toc h2{color:#6fc0ba;font-size:13px;margin:0 0 10px;text-transform:uppercase}',
        '.blog-reader-toc ul{margin:0;padding-left:18px}',
        '.blog-reader-links{border-top:1px solid rgba(111,192,186,.28);margin-top:28px;padding-top:18px}',
        '.blog-reader-links h2{color:#6fc0ba;font-size:12px;letter-spacing:.08em;margin:0 0 10px;text-transform:uppercase}',
        '.blog-reader-links ul{list-style:none;margin:0;padding:0}',
        '.blog-reader-links li{margin:6px 0}',
        '@media(max-width:620px){.blog-reader-title{font-size:28px}.blog-reader-copy{padding:20px 18px 32px;font-size:16px}}'
      ].join('\n');
      document.head.appendChild(style);
    }

    var reader = document.createElement('section');
    reader.id = 'blog-reader';
    reader.setAttribute('role', 'dialog');
    reader.setAttribute('aria-modal', 'true');
    reader.innerHTML = [
      '<div class="blog-reader-panel">',
      '<header>',
      '<span>ARTICLE STREAM <b>.TXT</b></span>',
      '<button type="button" class="blog-reader-close" aria-label="Close article">X CLOSE</button>',
      '</header>',
      '<div class="blog-reader-copy">',
      '<p class="blog-reader-meta"></p>',
      '<h1 class="blog-reader-title" id="blog-reader-title"></h1>',
      '<div class="blog-reader-body"></div>',
      '</div>',
      '</div>'
    ].join('');
    reader.setAttribute('aria-labelledby', 'blog-reader-title');
    document.body.appendChild(reader);

    var closeBtn = reader.querySelector('.blog-reader-close');
    closeBtn.addEventListener('click', function () {
      if (ctrl) ctrl.closePost();
      else closeReaderLocal();
    });

    reader.addEventListener('click', function (event) {
      if (event.target === reader) {
        if (ctrl) ctrl.closePost();
        else closeReaderLocal();
      }
    });

    // Escape key closes the reader (when it's open).
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && reader.classList.contains('is-open')) {
        if (ctrl) ctrl.closePost();
        else closeReaderLocal();
      }
    });

    // Focus trap: keep Tab within the reader while open.
    reader.addEventListener('keydown', function (event) {
      if (event.key !== 'Tab' || !reader.classList.contains('is-open')) return;
      var focusable = reader.querySelectorAll('a[href],button,[tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    // Capture focus at document scope because focus that escapes the dialog
    // never bubbles through the reader itself. installReader's guard ensures
    // this listener is registered only once across repeated open/close cycles.
    if (!readerFocusContainmentHandler) {
      readerFocusContainmentHandler = function (event) {
        containReaderFocus(reader, event);
      };
      document.addEventListener('focusin', readerFocusContainmentHandler, true);
    }
  }

  function openReaderLocal(slug, loadedPost) {
    installReader();
    var post = loadedPost || postBySlug[slug];
    if (!post) return;
    var reader = document.querySelector('#blog-reader');
    var backlinks = post.backlinks || [];
    var outgoing = post.outgoingLinks || [];
    var related = (post.relatedPosts || []).map(function (s) {
      var p = postBySlug[s];
      return p ? { slug: s, title: p.title } : null;
    }).filter(Boolean);

    // Only capture background state on first open (closed->open transition)
    var isFirstOpen = !lightTable;
    if (isFirstOpen) {
      lightTable = document.querySelector('#light-table');
      boardroom = document.querySelector('#boardroom');
      savedBodyOverflow = document.body.style.overflow;
      if (lightTable) {
        savedLightTableInert = lightTable.inert;
        savedLightTableAriaHidden = lightTable.getAttribute('aria-hidden');
        lightTable.inert = true;
        lightTable.setAttribute('aria-hidden', 'true');
      }
      if (boardroom) {
        savedBoardroomInert = boardroom.inert;
        savedBoardroomAriaHidden = boardroom.getAttribute('aria-hidden');
        boardroom.inert = true;
        boardroom.setAttribute('aria-hidden', 'true');
      }
      document.body.style.overflow = 'hidden';
    }

    reader.querySelector('.blog-reader-title').textContent = post.title;
    reader.querySelector('.blog-reader-meta').textContent =
      post.category + ' // ' + post.readTime + ' MIN READ // ' + post.date;
    reader.querySelector('.blog-reader-body').innerHTML =
      renderTocNav(post.toc) +
      rebaseReaderHtml(post.html) +
      renderLinkSection('LINKS OUT', outgoing) +
      renderLinkSection('LINKED FROM', backlinks) +
      (related.length ? renderLinkSection('RELATED', related) : '');
    reader.classList.add('is-open');

    // Move focus into the reader.
    var closeBtn = reader.querySelector('.blog-reader-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeReaderLocal() {
    var reader = document.querySelector('#blog-reader');
    if (reader) reader.classList.remove('is-open');
    
    // Restore background surfaces inert and aria-hidden using closure state
    if (lightTable) {
      lightTable.inert = savedLightTableInert;
      if (savedLightTableAriaHidden !== null) {
        lightTable.setAttribute('aria-hidden', savedLightTableAriaHidden);
      } else {
        lightTable.removeAttribute('aria-hidden');
      }
    }
    if (boardroom) {
      boardroom.inert = savedBoardroomInert;
      if (savedBoardroomAriaHidden !== null) {
        boardroom.setAttribute('aria-hidden', savedBoardroomAriaHidden);
      } else {
        boardroom.removeAttribute('aria-hidden');
      }
    }
    
    // Restore body overflow
    document.body.style.overflow = savedBodyOverflow;
    
    // Clear closure state
    lightTable = null;
    boardroom = null;
    savedLightTableInert = null;
    savedBoardroomInert = null;
    savedLightTableAriaHidden = null;
    savedBoardroomAriaHidden = null;
    savedBodyOverflow = null;
    // Focus restoration is handled by BlogController.closePost via readerFocusStack
  }

  // ---- Light-table + boardroom label swaps ------------------------------
  function installLightTableContent() {
    text('#lt-header-top-right .lt-header-left-section', 'CENTRAL SYSTEM DATA ... LAUNCH BLOG ARCHIVE');
    html('#lt-readme .content', [
      '<h2>README <span class="alt-1">.TXT</span><em>END. PROGRAM</em></h2>',
      '<p>Hello <strong>User</strong>. This boardroom instance is wired to a publish-ready Obsidian archive.</p>',
      '<p>Use the folders or keyboard to open article streams. The boardroom mode keeps the original globe, telemetry, keyboard, swirls, and stream animation language.</p>',
      '<p>Reader panels use softened body text so long posts stay readable even inside the ENCOM interface.</p>'
    ].join(''));
    html('#lt-globalization .content h2', 'BLOG VISUALIZATION ... SELECT ARTICLE <span class="alt-1">.STREAM</span><em>END. PROGRAM</em>');

    var folders = [
      ['#lt-launch-github', 'Featured'],
      ['#lt-launch-test', 'Latest'],
      ['#lt-launch-wikipedia', 'Archive'],
      ['#lt-launch-bitcoin', 'Topics'],
      ['#lt-launch-unknown', 'Search / Index']
    ];

    folders.forEach(function (entry) {
      var folder = document.querySelector(entry[0]);
      if (!folder) return;
      var label = folder.querySelector('.folder-label');
      if (label) {
        label.textContent = entry[1];
        // Make folder a semantic focusable control
        folder.setAttribute('role', 'button');
        folder.setAttribute('tabindex', '0');
        folder.setAttribute('aria-label', entry[1]);
        
        // Handle keyboard activation (Enter/Space)
        folder.addEventListener('keydown', function(event) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            // Trigger the existing simulated click path
            var clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
            folder.dispatchEvent(clickEvent);
          }
        });
      }
      folder.removeAttribute('data-post-slug');
    });
  }

  function text(selector, value) {
    var el = document.querySelector(selector);
    if (el) el.textContent = value;
  }

  function html(selector, value) {
    var el = document.querySelector(selector);
    if (el) el.innerHTML = value;
  }

  function isPlainPrimarySelfClick(event, link) {
    var target = link.getAttribute('target');
    return event.button === 0 &&
      !event.defaultPrevented &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      !link.hasAttribute('download') &&
      (!target || target === '_self');
  }

  // ---- Click delegation for post rows and in-reader links ---------------
  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-post-slug]');
    if (trigger && !trigger.closest('.folder-container')) {
      event.preventDefault();
      event.stopPropagation();
      var slug = trigger.getAttribute('data-post-slug');
      if (ctrl) ctrl.openPost(slug);
      else openReaderLocal(slug);
      return;
    }
    var canonicalLink = event.target.closest('a[href]');
    if (canonicalLink && isPlainPrimarySelfClick(event, canonicalLink)) {
      var canonicalPost = parseCanonicalPostLink(canonicalLink);
      var canonicalSlug = canonicalPost ? canonicalPost.slug : '';
      if (canonicalPost && postBySlug[canonicalSlug]) {
        event.preventDefault();
        if (ctrl) ctrl.openPost(canonicalSlug);
        else openReaderLocal(canonicalSlug);
        if (canonicalPost.heading) {
          var headingId = canonicalPost.heading;
          window.setTimeout(function () {
            var heading = document.getElementById(headingId);
            if (heading && typeof heading.scrollIntoView === 'function') heading.scrollIntoView();
          }, 0);
        }
        return;
      }
    }
    var link = event.target.closest('a[href*="post="]');
    if (link) {
      var match = link.getAttribute('href').match(/[?&]post=([^&]+)/);
      if (match && postBySlug[match[1]]) {
        event.preventDefault();
        if (ctrl) ctrl.openPost(match[1]);
        else openReaderLocal(match[1]);
      }
    }
  }, true);

  // ---- Controller signal subscriptions ----------------------------------
  if (ctrl) {
    ctrl.on('post-open', function (data) {
      openReaderLocal(data.slug, data.post);
    });
    ctrl.on('post-close', function () {
      closeReaderLocal();
    });
    // Rerender post rows on lens/filter changes
    ctrl.on('lens-change', function () {
      if (window.Boardroom && window.Boardroom.renderBlogInteractions) {
        window.Boardroom.renderBlogInteractions();
      }
    });
    ctrl.on('search', function () {
      if (window.Boardroom && window.Boardroom.renderBlogInteractions) {
        window.Boardroom.renderBlogInteractions();
      }
    });
    ctrl.on('filter-tag', function () {
      if (window.Boardroom && window.Boardroom.renderBlogInteractions) {
        window.Boardroom.renderBlogInteractions();
      }
    });
    ctrl.on('filter-year', function () {
      if (window.Boardroom && window.Boardroom.renderBlogInteractions) {
        window.Boardroom.renderBlogInteractions();
      }
    });
  }
  // ---- Boot: single call, no retry cascade ------------------------------
  function boot() {
    document.body.classList.add('blog-flex');
    installLightTableContent();
    if (ctrl && ctrl.renderPendingPost) {
      ctrl.renderPendingPost();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
