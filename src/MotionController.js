var MotionController = {};

MotionController.create = function(deps) {
  deps = deps || {};
  
  var document = deps.document || window.document;
  var matchMedia = deps.matchMedia || window.matchMedia.bind(window);
  var IntersectionObserver = deps.IntersectionObserver || window.IntersectionObserver;
  var localStorage = deps.localStorage || window.localStorage;
  var onResume = deps.onResume || null; // Callback for resume transitions
  var injectToggle = deps.injectToggle !== false; // Default to true
  
  var REDUCED_EFFECTS_CADENCE = 250; // 4fps
  var STORAGE_KEY = 'encom-reduced-effects';
  
  var state = {
    documentHidden: document.hidden,
    boardroomOffscreen: false,
    readerOpen: false,
    prefersReducedMotion: false,
    reducedEffects: false
  };
  
  var lastTickTime = 0;
  var cleanupCallbacks = [];
  
  // Track previous blocked state to detect transitions
  function isBlocked() {
    return state.documentHidden || state.prefersReducedMotion || state.boardroomOffscreen || state.readerOpen;
  }
  
  var wasBlocked = isBlocked();
  
  function checkResumeTransition() {
    var nowBlocked = isBlocked();
    if (wasBlocked && !nowBlocked && onResume) {
      onResume();
    }
    wasBlocked = nowBlocked;
  }
  
  // Load reduced-effects preference from localStorage
  try {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') {
      state.reducedEffects = true;
    }
  } catch (e) {
    // localStorage may not be available in all environments
  }
  
  // Visibility API listener
  var onVisibilityChange = function() {
    state.documentHidden = document.hidden;
    checkResumeTransition();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  cleanupCallbacks.push(function() {
    document.removeEventListener('visibilitychange', onVisibilityChange);
  });
  
  // prefers-reduced-motion media query listener
  var reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  state.prefersReducedMotion = reducedMotionQuery.matches;
  
  var onReducedMotionChange = function(e) {
    state.prefersReducedMotion = e.matches;
    checkResumeTransition();
  };
  
  if (reducedMotionQuery.addEventListener) {
    reducedMotionQuery.addEventListener('change', onReducedMotionChange);
    cleanupCallbacks.push(function() {
      reducedMotionQuery.removeEventListener('change', onReducedMotionChange);
    });
  } else if (reducedMotionQuery.addListener) {
    // Fallback for older browsers
    reducedMotionQuery.addListener(onReducedMotionChange);
    cleanupCallbacks.push(function() {
      reducedMotionQuery.removeListener(onReducedMotionChange);
    });
  }
  
  // IntersectionObserver for boardroom offscreen detection
  var intersectionObserver = null;
  if (IntersectionObserver) {
    var boardroomElement = deps.boardroomElement;
    if (!boardroomElement && typeof document.getElementById === 'function') {
      boardroomElement = document.getElementById('boardroom');
    }
    if (boardroomElement) {
      intersectionObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          state.boardroomOffscreen = !entry.isIntersecting;
          checkResumeTransition();
        });
      }, { threshold: 0.1 });
      
      intersectionObserver.observe(boardroomElement);
      cleanupCallbacks.push(function() {
        intersectionObserver.disconnect();
      });
    }
  }
  
  // Manage the footer's existing reduced-effects control.
  var toggleElement = null;
  var toggleClickHandler = null;
  var createdToggle = false;

  if (document.body) {
    if (state.reducedEffects) {
      document.body.classList.add('reduced-effects');
    } else {
      document.body.classList.remove('reduced-effects');
    }
  }

  if (injectToggle) {
    toggleElement = deps.toggleElement ||
      (typeof document.getElementById === 'function' ? document.getElementById('reduced-effects-toggle') : null);
    var globeFooter = typeof document.getElementById === 'function' ? document.getElementById('globe-footer') : null;
    if (!toggleElement && globeFooter) {
      toggleElement = document.createElement('button');
      toggleElement.id = 'reduced-effects-toggle';
      toggleElement.textContent = 'Reduced Effects';
      globeFooter.appendChild(toggleElement);
      createdToggle = true;
    }

    if (toggleElement) {
      toggleElement.setAttribute('aria-pressed', state.reducedEffects);
      toggleClickHandler = function() {
        var newState = !state.reducedEffects;
        policy.setReducedEffects(newState);
        toggleElement.setAttribute('aria-pressed', newState);
      };
      toggleElement.addEventListener('click', toggleClickHandler);

      cleanupCallbacks.push(function() {
        toggleElement.removeEventListener('click', toggleClickHandler);
        if (createdToggle && toggleElement.parentNode) {
          toggleElement.parentNode.removeChild(toggleElement);
        }
      });
    }
  }
  
  var policy = {
    getState: function() {
      return {
        documentHidden: state.documentHidden,
        boardroomOffscreen: state.boardroomOffscreen,
        readerOpen: state.readerOpen,
        prefersReducedMotion: state.prefersReducedMotion,
        reducedEffects: state.reducedEffects
      };
    },
    
    shouldTick: function(view) {
      // Both LightTable and Boardroom are gated through the policy
      // Pause if document is hidden
      if (state.documentHidden) {
        return false;
      }
      
      // Pause if prefers-reduced-motion
      if (state.prefersReducedMotion) {
        return false;
      }
      
      // Boardroom-specific: pause if offscreen
      if (view === 'boardroom' && state.boardroomOffscreen) {
        return false;
      }
      
      // Boardroom-specific: pause if reader is open
      if (view === 'boardroom' && state.readerOpen) {
        return false;
      }
      
      // Throttle if reduced-effects mode is enabled
      if (state.reducedEffects) {
        var now = Date.now();
        if (now - lastTickTime < REDUCED_EFFECTS_CADENCE) {
          return false;
        }
        lastTickTime = now;
      }
      
      return true;
    },
    
    setReaderOpen: function(open) {
      state.readerOpen = open;
      checkResumeTransition();
    },
    
    setReducedEffects: function(enabled) {
      state.reducedEffects = enabled;
      try {
        localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
      } catch (e) {
        // localStorage may not be available
      }
      
      // Reset throttling clock when enabling to ensure first tick passes
      if (enabled) {
        lastTickTime = 0;
      }
      
      // Update body class
      if (document.body) {
        if (enabled) {
          document.body.classList.add('reduced-effects');
        } else {
          document.body.classList.remove('reduced-effects');
        }
      }
      
      // Sync toggle button if it exists
      if (toggleElement) {
        toggleElement.setAttribute('aria-pressed', enabled);
      }
    },
    
    resetAnimationClock: function() {
      lastTickTime = Date.now();
    },
    
    cleanup: function() {
      cleanupCallbacks.forEach(function(fn) {
        fn();
      });
      cleanupCallbacks = [];
    }
  };
  
  return policy;
};

module.exports = MotionController;
