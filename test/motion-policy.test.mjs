import assert from 'node:assert/strict';

// Fake browser dependencies for testing
function createFakeBrowser() {
  let listeners = {};
  let hidden = false;
  let intersectionObservers = [];
  let mediaQueryInstances = {};
  let store = {}; // localStorage store
  return {
    document: {
      get hidden() { return hidden; },
      set hidden(val) { hidden = val; },
      addEventListener: (event, fn) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(fn);
      },
      removeEventListener: (event, fn) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter(l => l !== fn);
        }
      },
      triggerVisibility: (isHidden) => {
        hidden = isHidden;
        if (listeners['visibilitychange']) {
          listeners['visibilitychange'].forEach(fn => fn());
        }
      }
    },
    matchMedia: (query) => {
      if (!mediaQueryInstances[query]) {
        let currentMatches = false; // Default to not preferring reduced motion
        let listeners = [];
        
        mediaQueryInstances[query] = {
          get matches() { return currentMatches; },
          addListener: (fn) => {
            listeners.push(fn);
          },
          removeListener: (fn) => {
            listeners = listeners.filter(l => l !== fn);
          },
          addEventListener: (event, fn) => {
            if (event === 'change') listeners.push(fn);
          },
          removeEventListener: (event, fn) => {
            if (event === 'change') listeners = listeners.filter(l => l !== fn);
          },
          triggerChange: (matches) => {
            currentMatches = matches;
            listeners.forEach(fn => fn({ matches }));
          }
        };
      }
      return mediaQueryInstances[query];
    },
    IntersectionObserver: class FakeIntersectionObserver {
      constructor(callback, options) {
        this.callback = callback;
        this.options = options;
        this.elements = [];
        this.disconnected = false;
        intersectionObservers.push(this);
      }
      
      observe(element) {
        if (this.disconnected) return;
        this.elements.push(element);
      }
      
      unobserve(element) {
        this.elements = this.elements.filter(e => e !== element);
      }
      
      disconnect() {
        this.elements = [];
        this.disconnected = true;
        const index = intersectionObservers.indexOf(this);
        if (index !== -1) {
          intersectionObservers.splice(index, 1);
        }
      }
      
      trigger(entries) {
        if (this.disconnected) return;
        this.callback(entries);
      }
    },
    localStorage: {
      getItem: (key) => {
        return store[key] || null;
      },
      setItem: (key, value) => {
        store[key] = value;
      },
      removeItem: (key) => {
        delete store[key];
      }
    },
    get intersectionObservers() { return intersectionObservers; },
    clearObservers: () => { intersectionObservers = []; }
  };
}

// Load the MotionController
async function loadMotionController() {
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(__dirname, '..');
  
  // Load the actual MotionController implementation
  const motionControllerPath = path.join(repoRoot, 'src', 'MotionController.js');
  const motionControllerCode = await import('node:fs').then(fs => fs.readFileSync(motionControllerPath, 'utf8'));
  
  // Create a CommonJS-like environment for the controller
  const module = { exports: {} };
  const require = (name) => {
    if (name === './MotionController.js') return module.exports;
    return {};
  };
  
  // Execute the controller code in our test environment
  const fn = new Function('module', 'exports', 'require', motionControllerCode);
  fn(module, module.exports, require);
  
  return module.exports;
}

async function runTests() {
  const fakeBrowser = createFakeBrowser();
  const MotionController = await loadMotionController();
  
  // Inject fake browser dependencies
  const deps = {
    document: fakeBrowser.document,
    matchMedia: fakeBrowser.matchMedia,
    IntersectionObserver: fakeBrowser.IntersectionObserver,
    localStorage: fakeBrowser.localStorage,
    boardroomElement: { id: 'boardroom' }, // Fake element
    intersectionObservers: fakeBrowser.intersectionObservers,
    injectToggle: false // Disable toggle injection in tests
  };
  
  // Test 1: Full-rate visible mode
  console.log('Test 1: Full-rate visible mode');
  const policy1 = MotionController.create(deps);
  
  // Initially trigger intersection as visible
  if (deps.intersectionObservers.length > 0) {
    deps.intersectionObservers[0].trigger([{ isIntersecting: true, target: {} }]);
  }
  
  assert.strictEqual(policy1.shouldTick('boardroom'), true, 'should tick when visible and no restrictions');
  
  // Test 2: Hidden document pauses ticks
  console.log('Test 2: Hidden document pauses ticks');
  fakeBrowser.document.triggerVisibility(true);
  assert.strictEqual(policy1.shouldTick('boardroom'), false, 'should not tick when document hidden');
  
  // Test 3: Reduced motion pauses ticks
  console.log('Test 3: Reduced motion pauses ticks');
  fakeBrowser.document.triggerVisibility(false);
  const media = deps.matchMedia('(prefers-reduced-motion: reduce)');
  media.triggerChange(true);
  assert.strictEqual(policy1.shouldTick('boardroom'), false, 'should not tick when prefers-reduced-motion');
  
  // Test 4: Boardroom offscreen pauses ticks
  console.log('Test 4: Boardroom offscreen pauses ticks');
  media.triggerChange(false);
  const observer = deps.intersectionObservers[0];
  observer.trigger([{ isIntersecting: false, target: {} }]);
  assert.strictEqual(policy1.shouldTick('boardroom'), false, 'should not tick when boardroom offscreen');
  
  // Test 5: Reader open pauses ticks
  console.log('Test 5: Reader open pauses ticks');
  observer.trigger([{ isIntersecting: true, target: {} }]);
  policy1.setReaderOpen(true);
  assert.strictEqual(policy1.shouldTick('boardroom'), false, 'should not tick when reader is open');
  
  // Test 6: LightTable is not frozen when boardroom is offscreen
  console.log('Test 6: LightTable is not frozen when boardroom is offscreen');
  policy1.setReaderOpen(false);
  observer.trigger([{ isIntersecting: false, target: {} }]);
  assert.strictEqual(policy1.shouldTick('lighttable'), true, 'LightTable should tick even when boardroom offscreen');
  
  // Test 7: Reduced-effects throttles to 250ms cadence
  console.log('Test 7: Reduced-effects throttles to 250ms cadence');
  observer.trigger([{ isIntersecting: true, target: {} }]);
  policy1.setReducedEffects(true);
  assert.strictEqual(policy1.shouldTick('boardroom'), true, 'first tick should pass');
  assert.strictEqual(policy1.shouldTick('boardroom'), false, 'immediate second tick should be throttled');
  
  // Test 8: Resume callback resets clock
  console.log('Test 8: Resume callback resets clock');
  policy1.setReducedEffects(false); // Disable reduced-effects for this test
  policy1.resetAnimationClock();
  assert.strictEqual(policy1.shouldTick('boardroom'), true, 'tick should pass after clock reset');
  
  // Test 9: Preference changes
  console.log('Test 9: Preference changes');
  media.triggerChange(true);
  assert.strictEqual(policy1.shouldTick('boardroom'), false, 'should respect media query change');
  media.triggerChange(false);
  assert.strictEqual(policy1.shouldTick('boardroom'), true, 'should respect media query change back');
  
  // Test 10: Effects persistence
  console.log('Test 10: Effects persistence');
  fakeBrowser.localStorage.setItem('encom-reduced-effects', 'true');
  const policy2 = MotionController.create(deps);
  assert.strictEqual(policy2.getState().reducedEffects, true, 'should persist reduced-effects from localStorage');
  
  // Test 11: Toggle effects
  console.log('Test 11: Toggle effects');
  policy2.setReducedEffects(false);
  assert.strictEqual(fakeBrowser.localStorage.getItem('encom-reduced-effects'), 'false', 'should save disabled state');
  policy2.setReducedEffects(true);
  assert.strictEqual(fakeBrowser.localStorage.getItem('encom-reduced-effects'), 'true', 'should save enabled state');
  
  // Test 12: Cleanup
  console.log('Test 12: Cleanup');
  const observerCountBefore = deps.intersectionObservers.length;
  policy2.cleanup();
  assert.strictEqual(deps.intersectionObservers.length, observerCountBefore - 1, 'should disconnect intersection observer on cleanup');
  
  // Clean up policy1 as well
  policy1.cleanup();
  
  // Test 13: onResume callback is invoked on blocked->unblocked transitions
  console.log('Test 13: onResume callback is invoked on blocked->unblocked transitions');
  let resumeCallbackInvocations = [];
  const onResume = () => { resumeCallbackInvocations.push(Date.now()); };
  const depsWithCallback = {
    document: fakeBrowser.document,
    matchMedia: fakeBrowser.matchMedia,
    IntersectionObserver: fakeBrowser.IntersectionObserver,
    localStorage: fakeBrowser.localStorage,
    boardroomElement: { id: 'boardroom' },
    intersectionObservers: fakeBrowser.intersectionObservers,
    onResume: onResume,
    injectToggle: false
  };
  const policy3 = MotionController.create(depsWithCallback);
  
  // Trigger intersection as visible
  if (depsWithCallback.intersectionObservers.length > 0) {
    depsWithCallback.intersectionObservers[0].trigger([{ isIntersecting: true, target: {} }]);
  }
  
  // Test reader-close triggers resume
  policy3.setReaderOpen(true);
  policy3.setReaderOpen(false);
  assert.strictEqual(resumeCallbackInvocations.length, 1, 'onResume should be called on reader-close');
  
  // Test visibility change triggers resume
  fakeBrowser.document.triggerVisibility(true);
  fakeBrowser.document.triggerVisibility(false);
  assert.strictEqual(resumeCallbackInvocations.length, 2, 'onResume should be called on visibility change to visible');
  
  // Test reduced-motion change triggers resume
  const media3 = depsWithCallback.matchMedia('(prefers-reduced-motion: reduce)');
  media3.triggerChange(true);
  media3.triggerChange(false);
  assert.strictEqual(resumeCallbackInvocations.length, 3, 'onResume should be called on reduced-motion change to false');
  
  // Test intersection change triggers resume
  const observer3 = depsWithCallback.intersectionObservers[depsWithCallback.intersectionObservers.length - 1];
  observer3.trigger([{ isIntersecting: false, target: {} }]);
  observer3.trigger([{ isIntersecting: true, target: {} }]);
  assert.strictEqual(resumeCallbackInvocations.length, 4, 'onResume should be called on intersection change to visible');
  
  policy3.cleanup();
  
  // Test 14: LightTable is gated through policy (hidden pauses)
  console.log('Test 14: LightTable is gated through policy (hidden pauses)');
  const policy4 = MotionController.create(deps);
  if (deps.intersectionObservers.length > 0) {
    deps.intersectionObservers[0].trigger([{ isIntersecting: true, target: {} }]);
  }
  assert.strictEqual(policy4.shouldTick('lighttable'), true, 'LightTable should tick when visible');
  fakeBrowser.document.triggerVisibility(true);
  assert.strictEqual(policy4.shouldTick('lighttable'), false, 'LightTable should not tick when hidden');
  fakeBrowser.document.triggerVisibility(false);
  
  // Test 15: LightTable is gated through policy (reduced-motion pauses)
  console.log('Test 15: LightTable is gated through policy (reduced-motion pauses)');
  const media4 = deps.matchMedia('(prefers-reduced-motion: reduce)');
  media4.triggerChange(true);
  assert.strictEqual(policy4.shouldTick('lighttable'), false, 'LightTable should not tick when prefers-reduced-motion');
  media4.triggerChange(false);
  
  // Test 16: LightTable is throttled in reduced-effects mode
  console.log('Test 16: LightTable is throttled in reduced-effects mode');
  policy4.setReducedEffects(true);
  assert.strictEqual(policy4.shouldTick('lighttable'), true, 'first LightTable tick should pass in reduced-effects');
  assert.strictEqual(policy4.shouldTick('lighttable'), false, 'immediate second LightTable tick should be throttled');
  policy4.setReducedEffects(false);
  
  // Test 17: LightTable is not frozen by boardroom-only offscreen state
  console.log('Test 17: LightTable is not frozen by boardroom-only offscreen state');
  const observer4 = deps.intersectionObservers[deps.intersectionObservers.length - 1];
  observer4.trigger([{ isIntersecting: false, target: {} }]);
  assert.strictEqual(policy4.shouldTick('lighttable'), true, 'LightTable should tick even when boardroom offscreen');
  assert.strictEqual(policy4.shouldTick('boardroom'), false, 'Boardroom should not tick when offscreen');
  
  policy4.cleanup();
  
  // Test 18: Missing boardroom element is not a blocker
  console.log('Test 18: Missing boardroom element is not a blocker');
  const depsWithoutElement = {
    document: fakeBrowser.document,
    matchMedia: fakeBrowser.matchMedia,
    IntersectionObserver: fakeBrowser.IntersectionObserver,
    localStorage: fakeBrowser.localStorage,
    boardroomElement: null,
    intersectionObservers: fakeBrowser.intersectionObservers,
    injectToggle: false
  };
  const policy5 = MotionController.create(depsWithoutElement);
  assert.strictEqual(policy5.shouldTick('boardroom'), true, 'should tick without boardroom element (no offscreen detection)');
  policy5.cleanup();
  
  // Test 19: Existing effects control is reused without duplication
  console.log('Test 19: Existing effects control is reused without duplication');
  let createCount = 0;
  let appendCount = 0;
  let clickHandler = null;
  const attributes = {};
  const existingToggle = {
    addEventListener: (event, handler) => { if (event === 'click') clickHandler = handler; },
    removeEventListener: (event, handler) => {
      if (event === 'click' && clickHandler === handler) clickHandler = null;
    },
    setAttribute: (name, value) => { attributes[name] = String(value); }
  };
  const toggleDocument = {
    hidden: false,
    body: { classList: { add: () => {}, remove: () => {} } },
    addEventListener: fakeBrowser.document.addEventListener,
    removeEventListener: fakeBrowser.document.removeEventListener,
    getElementById: (id) => {
      if (id === 'reduced-effects-toggle') return existingToggle;
      if (id === 'globe-footer') return { appendChild: () => { appendCount++; } };
      return null;
    },
    createElement: () => { createCount++; return existingToggle; }
  };
  fakeBrowser.localStorage.setItem('encom-reduced-effects', 'true');
  const policy6 = MotionController.create({
    document: toggleDocument,
    matchMedia: fakeBrowser.matchMedia,
    IntersectionObserver: fakeBrowser.IntersectionObserver,
    localStorage: fakeBrowser.localStorage,
    boardroomElement: null
  });
  assert.equal(createCount, 0, 'should not create a second effects control');
  assert.equal(appendCount, 0, 'should not append an existing effects control again');
  assert.equal(typeof clickHandler, 'function', 'should bind the existing effects control');
  assert.equal(attributes['aria-pressed'], 'true', 'should synchronize persisted state');
  policy6.cleanup();
  assert.equal(clickHandler, null, 'cleanup should remove the bound handler');
  
  console.log('All motion policy behavior tests passed');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
