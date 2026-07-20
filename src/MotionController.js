var MotionController = {};

MotionController.create = function(deps) {
  deps = deps || {};
  
  var document = deps.document || window.document;
  var matchMedia = deps.matchMedia || window.matchMedia.bind(window);
  var IntersectionObserver = deps.IntersectionObserver || window.IntersectionObserver;
  var localStorage = deps.localStorage || window.localStorage;
  
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
    var boardroomElement = deps.boardroomElement || document.getElementById('boardroom');
    if (boardroomElement) {
      intersectionObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          state.boardroomOffscreen = !entry.isIntersecting;
        });
      }, { threshold: 0.1 });
      
      intersectionObserver.observe(boardroomElement);
      cleanupCallbacks.push(function() {
        intersectionObserver.disconnect();
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
      // LightTable is not affected by boardroom-specific throttling
      if (view !== 'boardroom') {
        return true;
      }
      
      // Pause if document is hidden
      if (state.documentHidden) {
        return false;
      }
      
      // Pause if prefers-reduced-motion
      if (state.prefersReducedMotion) {
        return false;
      }
      
      // Pause if boardroom is offscreen
      if (state.boardroomOffscreen) {
        return false;
      }
      
      // Pause if reader is open
      if (state.readerOpen) {
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
    },
    
    setReducedEffects: function(enabled) {
      state.reducedEffects = enabled;
      try {
        localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
      } catch (e) {
        // localStorage may not be available
      }
      
      // Update body class
      if (document.body) {
        if (enabled) {
          document.body.classList.add('reduced-effects');
        } else {
          document.body.classList.remove('reduced-effects');
        }
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
