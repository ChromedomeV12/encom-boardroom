(function () {
  var posts = window.BLOG_POSTS || [];
  if (!posts.length) return;

  var featured = posts.find(function (post) { return post.featured; }) || posts[0];
  var postBySlug = {};
  var eventsInstalled = false;
  posts.forEach(function (post) { postBySlug[post.slug] = post; });

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char];
    });
  }

  function renderLinkSection(label, links) {
    if (!links || !links.length) return '';
    return '<section class="blog-reader-links">' +
      '<h2>' + label + '</h2>' +
      '<ul>' + links.map(function (link) {
        return '<li><a href="#post:' + escapeHtml(link.slug) + '">' + escapeHtml(link.title) + '</a></li>';
      }).join('') + '</ul>' +
      '</section>';
  }

  function syncHash(slug) {
    if (window.location.hash !== '#/post/' + slug) {
      window.history.replaceState(null, '', '#/post/' + slug);
    }
  }

  function applyStyle(element, styles) {
    for (var key in styles) {
      element.style[key] = styles[key];
    }
  }

  function text(selector, value) {
    var element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  function html(selector, value) {
    var element = document.querySelector(selector);
    if (element) element.innerHTML = value;
  }

  function showPost(slug) {
    installReader();
    var post = postBySlug[slug] || featured;
    var overlay = document.querySelector('#blog-reader');
    if (!overlay) return;
    var backlinks = post.backlinks || [];
    var outgoing = post.outgoingLinks || [];
    overlay.querySelector('.blog-reader-title').textContent = post.title;
    overlay.querySelector('.blog-reader-meta').textContent =
      post.category + ' // ' + post.readTime + ' MIN READ // ' + post.date;
    overlay.querySelector('.blog-reader-body').innerHTML =
      post.html +
      renderLinkSection('LINKS OUT', outgoing) +
      renderLinkSection('LINKED FROM', backlinks);
    overlay.classList.add('is-open');
    overlay.style.display = 'flex';
    syncHash(post.slug);
  }

  function closePost() {
    var overlay = document.querySelector('#blog-reader');
    if (overlay) {
      overlay.classList.remove('is-open');
      overlay.style.display = 'none';
    }
  }

  function installReader() {
    if (document.querySelector('#blog-reader')) return;
    if (!document.querySelector('#blog-reader-styles')) {
      var style = document.createElement('style');
      style.id = 'blog-reader-styles';
      style.textContent = [
        '.blog-reader-body a{color:#ffcc00;text-decoration:none;border-bottom:1px solid rgba(255,204,0,.45)}',
        '.blog-reader-body a:hover{color:#fff;border-bottom-color:#fff}',
        '.blog-reader-body img{display:block;max-width:100%;margin:20px auto;border:1px solid rgba(111,192,186,.45)}',
        '.blog-reader-body blockquote{border-left:2px solid #6fc0ba;color:#edf4f0;margin:22px 0;padding:4px 0 4px 18px;background:rgba(0,238,238,.035)}',
        '.blog-reader-links{border-top:1px solid rgba(111,192,186,.28);margin-top:28px;padding-top:18px}',
        '.blog-reader-links h2{color:#6fc0ba;font-size:12px;letter-spacing:.08em;margin:0 0 10px;text-transform:uppercase}',
        '.blog-reader-links ul{list-style:none;margin:0;padding:0}',
        '.blog-reader-links li{margin:6px 0}'
      ].join('\\n');
      document.head.appendChild(style);
    }
    var reader = document.createElement('section');
    reader.id = 'blog-reader';
    reader.style.display = 'none';
    reader.style.alignItems = 'center';
    reader.style.background = 'rgba(0, 0, 0, 0.78)';
    reader.style.bottom = '0';
    reader.style.justifyContent = 'center';
    reader.style.left = '0';
    reader.style.padding = '24px';
    reader.style.position = 'fixed';
    reader.style.right = '0';
    reader.style.top = '0';
    reader.style.zIndex = '1000';
    reader.innerHTML = [
      '<div class="blog-reader-panel">',
      '<header>',
      '<span>ARTICLE STREAM <b>.TXT</b></span>',
      '<button type="button" class="blog-reader-close">X CLOSE</button>',
      '</header>',
      '<div class="blog-reader-copy">',
      '<p class="blog-reader-meta"></p>',
      '<h1 class="blog-reader-title"></h1>',
      '<div class="blog-reader-body"></div>',
      '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(reader);

    applyStyle(reader.querySelector('.blog-reader-panel'), {
      background: 'rgba(4, 12, 12, 0.98)',
      border: '2px solid #6fc0ba',
      boxShadow: '0 0 24px rgba(0, 238, 238, 0.2)',
      maxHeight: '86vh',
      maxWidth: '820px',
      overflow: 'hidden',
      width: 'min(820px, 94vw)'
    });
    applyStyle(reader.querySelector('header'), {
      alignItems: 'center',
      borderBottom: '1px solid #1b2f2d',
      color: '#00eeee',
      display: 'flex',
      fontFamily: 'Inconsolata, monospace',
      fontSize: '11px',
      justifyContent: 'space-between',
      padding: '8px 12px',
      textTransform: 'uppercase'
    });
    applyStyle(reader.querySelector('.blog-reader-close'), {
      background: 'transparent',
      border: '0',
      color: '#ffcc00',
      cursor: 'pointer',
      font: 'inherit'
    });
    applyStyle(reader.querySelector('.blog-reader-copy'), {
      color: '#d8e1dd',
      fontFamily: 'Inconsolata, monospace',
      fontSize: '17px',
      lineHeight: '1.72',
      maxHeight: 'calc(86vh - 40px)',
      overflow: 'auto',
      padding: '28px 36px 42px'
    });
    applyStyle(reader.querySelector('.blog-reader-meta'), {
      color: '#6fc0ba',
      fontSize: '11px',
      letterSpacing: '0.04em',
      marginTop: '0',
      textTransform: 'uppercase'
    });
    applyStyle(reader.querySelector('.blog-reader-title'), {
      color: '#f2f7f4',
      fontSize: '44px',
      lineHeight: '1',
      margin: '0 0 18px'
    });
    applyStyle(reader.querySelector('.blog-reader-body'), {
      color: '#d8e1dd'
    });

    reader.querySelector('.blog-reader-close').addEventListener('click', closePost);
    reader.addEventListener('click', function (event) {
      if (event.target === reader) closePost();
    });
  }

  function installLightTableContent() {
    text('#lt-header-top-left .lt-header-left-section', 'OBSIDIAN TOUCH APP OS12');
    text('#lt-header-top-right .lt-header-left-section', 'CENTRAL SYSTEM DATA ... LAUNCH BLOG ARCHIVE');
    html('#lt-readme .content', [
      '<h2>README <span class="alt-1">.TXT</span><em>END. PROGRAM</em></h2>',
      '<p>Hello <strong>User</strong>. This boardroom instance is wired to a publish-ready Obsidian archive.</p>',
      '<p>Use the folders or keyboard to open article streams. The boardroom mode keeps the original globe, telemetry, keyboard, swirls, and stream animation language.</p>',
      '<p>Reader panels use softened body text so long posts stay readable even inside the ENCOM interface.</p>'
    ].join(''));
    html('#lt-globalization .content h2', 'BLOG VISUALIZATION ... SELECT ARTICLE <span class="alt-1">.STREAM</span><em>END. PROGRAM</em>');

    var folders = [
      ['#lt-launch-github', 'Featured Stream'],
      ['#lt-launch-test', 'Latest Stream'],
      ['#lt-launch-wikipedia', 'Archive Stream'],
      ['#lt-launch-bitcoin', 'Tags / Soon'],
      ['#lt-launch-unknown', 'Index / Soon']
    ];

    folders.forEach(function (entry) {
      var folder = document.querySelector(entry[0]);
      if (!folder) return;
      var label = folder.querySelector('.folder-label');
      if (label) label.textContent = entry[1];
      folder.removeAttribute('data-post-slug');
    });
  }

  function installBoardroomContent() {
    var mode = window.BLOG_LAUNCH_MODE || 'featured';
    var visiblePosts = posts.slice();
    if (mode === 'featured') {
      visiblePosts = visiblePosts.filter(function (post) { return post.featured; });
      if (!visiblePosts.length) visiblePosts = posts.slice(0, 1);
    } else if (mode === 'archive') {
      visiblePosts.sort(function (left, right) {
        return new Date(left.date) - new Date(right.date);
      });
    }

    text('#user-interaction-header', ('OBSIDIAN ' + mode + ' FEED').toUpperCase());
    text('#globalization-header', 'BLOG GLOBALIZATION');
    text('#growth-header', 'READING PERFORMANCE');
    text('#media-header', 'POST SNAPSHOTS');
    text('#timer-header', 'TIME SINCE ARCHIVE BOOT');
    text('#ticker-text', 'BLOG');
    text('#ticker-ytd', posts.length + ' Posts');

    var interaction = document.querySelector('#interaction > div');
    if (interaction) {
      interaction.innerHTML = visiblePosts.map(function (post) {
        return '<ul class="interaction-data blog-interaction" data-post-slug="' + escapeHtml(post.slug) + '">' +
          '<li class="interaction-username">' + escapeHtml(post.category || 'post') + '</li>' +
          '<li class="interaction-title">' + escapeHtml(post.title) + '</li>' +
          '<li class="interaction-type">' + escapeHtml((post.tags || []).join(', ')) + '</li>' +
          '<li class="interaction-size">' + escapeHtml(post.readTime || '?') + 'm</li>' +
          '</ul>';
      }).join('');
    }

    html('#boardroom-readme-blog .content', [
      '<h2>BLOG STREAM INFO <span class="alt-1">.TXT</span><em>X CLOSE</em></h2>',
      '<p>This boardroom view is driven by local Obsidian Markdown instead of GitHub/Wikipedia feeds.</p>',
      '<p>The original globe and dashboard panels remain active as visual context for the archive.</p>',
      '<p>Select article rows to open a readable text pane.</p>'
    ].join(''));
  }

  function installEvents() {
    if (eventsInstalled) return;
    eventsInstalled = true;

    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-post-slug]');
      if (!trigger) return;
      if (trigger.closest('.folder-container')) return;
      event.preventDefault();
      event.stopPropagation();
      showPost(trigger.getAttribute('data-post-slug'));
    }, true);

    document.addEventListener('click', function (event) {
      var link = event.target.closest('a[href^="#post:"]');
      if (!link) return;
      event.preventDefault();
      showPost(link.getAttribute('href').replace('#post:', ''));
    });

    window.addEventListener('hashchange', openHashPost);
  }

  function openHashPost() {
    var match = window.location.hash.match(/^#\/post\/(.+)$/);
    if (match && postBySlug[match[1]]) {
      showPost(match[1]);
    }
  }

  function boot() {
    document.body.classList.add('blog-flex');
    installLightTableContent();
    installBoardroomContent();
    installEvents();
    window.showBlogPost = showPost;
    openHashPost();
  }

  function bootSequence() {
    boot();
    window.setTimeout(boot, 500);
    window.setTimeout(boot, 1500);
    window.setTimeout(boot, 3500);
    window.setTimeout(boot, 7000);
    window.setTimeout(boot, 11000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootSequence);
  } else {
    bootSequence();
  }
})();
