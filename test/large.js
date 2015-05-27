require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var collection = require('./collection');

//
// Pointless function that will replace callbacks once they are executed to
// prevent double execution from ever happening.
//
function noop() { /* you waste your time by reading this, see, I told you.. */ }

/**
 * Asynchronously iterate over the given data.
 *
 * @param {Mixed} data The data we need to iterate over
 * @param {Function} iterator Function that's called for each item.
 * @param {Function} fn The completion callback
 * @param {Object} options Async options.
 * @api public
 */
exports.each = function each(data, iterator, fn, options) {
  options = options || {};

  var size = collection.size(data)
    , completed = 0
    , timeout;

  if (!size) return fn();

  collection.each(data, function iterating(item) {
    iterator.call(options.context || iterator, item, function done(err) {
      if (err) {
        fn(err);
        return fn = noop;
      }

      if (++completed === size) {
        fn();
        if (timeout) clearTimeout(timeout);
        return fn = noop;
      }
    });
  });

  //
  // Optional timeout for when the operation takes to long.
  //
  if (options.timeout) timeout = setTimeout(function kill() {
    fn(new Error('Operation timed out'));
    fn = noop;
  }, options.timeout);
};

},{"./collection":2}],2:[function(require,module,exports){
'use strict';

var hasOwn = Object.prototype.hasOwnProperty
  , undef;

/**
 * Get an accurate type check for the given Object.
 *
 * @param {Mixed} obj The object that needs to be detected.
 * @returns {String} The object type.
 * @api public
 */
function type(obj) {
  return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
}

/**
 * Iterate over a collection.
 *
 * @param {Mixed} collection The object we want to iterate over.
 * @param {Function} iterator The function that's called for each iteration.
 * @param {Mixed} context The context of the function.
 * @api public
 */
function each(collection, iterator, context) {
  var i = 0;

  if ('array' === type(collection)) {
    for (; i < collection.length; i++) {
      if (false === iterator.call(context || iterator, collection[i], i, collection)) {
        return; // If false is returned by the callback we need to bail out.
      }
    }
  } else {
    for (i in collection) {
      if (hasOwn.call(collection, i)) {
        if (false === iterator.call(context || iterator, collection[i], i, collection)) {
          return; // If false is returned by the callback we need to bail out.
        }
      }
    }
  }
}

/**
 * Checks if the given object is empty. The only edge case here would be
 * objects. Most object's have a `length` attribute that indicate if there's
 * anything inside the object.
 *
 * @param {Mixed} collection The collection that needs to be checked.
 * @returns {Boolean}
 * @api public
 */
function empty(obj) {
  if (undef === obj) return false;

  return size(obj) === 0;
}

/**
 * Determine the size of a collection.
 *
 * @param {Mixed} collection The object we want to know the size of.
 * @returns {Number} The size of the collection.
 * @api public
 */
function size(collection) {
  var x, i = 0;

  if ('object' === type(collection)) {
    for (x in collection) i++;
    return i;
  }

  return +collection.length;
}

/**
 * Wrap the given object in an array if it's not an array already.
 *
 * @param {Mixed} obj The thing we might need to wrap.
 * @returns {Array} We promise!
 * @api public
 */
function array(obj) {
  if ('array' === type(obj)) return obj;
  if ('arguments' === type(obj)) return Array.prototype.slice.call(obj, 0);

  return obj  // Only transform objects in to an array when they exist.
    ? [obj]
    : [];
}

/**
 * Find the index of an item in the given array.
 *
 * @param {Array} arr The array we search in
 * @param {Mixed} o The object/thing we search for.
 * @returns {Number} Index of the thing.
 * @api public
 */
function index(arr, o) {
  if ('function' === typeof arr.indexOf) return arr.indexOf(o);

  for (
    var j = arr.length,
        i = i < 0 ? i + j < 0 ? 0 : i + j : i || 0;
    i < j && arr[i] !== o;
    i++
  );

  return j <= i ? -1 : i;

}

/**
 * Merge all given objects in to one objects.
 *
 * @returns {Object}
 * @api public
 */
function copy() {
  var result = {}
    , depth = 2
    , seen = [];

  (function worker() {
    each(array(arguments), function each(obj) {
      for (var prop in obj) {
        if (hasOwn.call(obj, prop) && !~index(seen, obj[prop])) {
          if (type(obj[prop]) !== 'object' || !depth) {
            result[prop] = obj[prop];
            seen.push(obj[prop]);
          } else {
            depth--;
            worker(result[prop], obj[prop]);
          }
        }
      }
    });
  }).apply(null, arguments);

  return result;
}

//
// Expose the collection utilities.
//
exports.array = array;
exports.empty = empty;
exports.index = index;
exports.copy = copy;
exports.size = size;
exports.type = type;
exports.each = each;

},{}],3:[function(require,module,exports){
'use strict';

/**
 * Representation of one single file that will be loaded.
 *
 * @constructor
 * @param {String} url The file URL.
 * @param {Function} fn Optional callback.
 * @api private
 */
function File(url, fn) {
  if (!(this instanceof File)) return new File(url, fn);

  this.readyState = File.LOADING;
  this.start = +new Date();
  this.callbacks = [];
  this.dependent = 0;
  this.cleanup = [];
  this.url = url;

  if ('function' === typeof fn) {
    this.add(fn);
  }
}

//
// The different readyStates for our File class.
//
File.DEAD     = -1;
File.LOADING  = 0;
File.LOADED   = 1;

/**
 * Added cleanup hook.
 *
 * @param {Function} fn Clean up callback
 * @api public
 */
File.prototype.unload = function unload(fn) {
  this.cleanup.push(fn);
  return this;
};

/**
 * Add a new dependent.
 *
 * @param {Function} fn Completion callback.
 * @returns {Boolean} Callback successfully added or queued.
 * @api private
 */
File.prototype.add = function add(fn) {
  if (File.LOADING === this.readyState) {
    this.callbacks.push(fn);
  } else if (File.LOADED === this.readyState) {
    fn();
  } else {
    return false;
  }

  this.dependent++;
  return true;
};

/**
 * Remove a dependent. If all dependent's are removed we will automatically
 * destroy the loaded file from the environment.
 *
 * @returns {
 * @api private
 */
File.prototype.remove = function remove() {
  if (0 === --this.dependent) {
    this.destroy();
    return true;
  }

  return false;
};

/**
 * Execute the callbacks.
 *
 * @param {Error} err Optional error.
 * @api public
 */
File.prototype.exec = function exec(err) {
  this.readyState = File.LOADED;

  if (!this.callbacks.length) return this;
  for (var i = 0; i < this.callbacks.length; i++) {
    this.callbacks[i].apply(this.callbacks[i], arguments);
  }

  this.callbacks.length = 0;
  if (err) this.destroy();

  return this;
};

/**
 * Destroy the file.
 *
 * @api public
 */
File.prototype.destroy = function destroy() {
  this.exec(new Error('Resource has been destroyed before it was loaded'));

  if (this.cleanup.length) for (var i = 0; i < this.cleanup.length; i++) {
    this.cleanup[i]();
  }

  this.readyState = File.DEAD;
  this.cleanup.length = this.dependent = 0;

  return this;
};

/**
 * Asynchronously load JavaScript and Stylesheets.
 *
 * Options:
 *
 * - document: Document where elements should be created from.
 * - prefix: Prefix for the id that we use to poll for stylesheet completion.
 * - timeout: Load timeout.
 * - onload: Stylesheet onload supported.
 *
 * @constructor
 * @param {HTMLElement} root The root element we should append to.
 * @param {Object} options Configuration.
 * @api public
 */
function AsyncAsset(root, options) {
  if (!(this instanceof AsyncAsset)) return new AsyncAsset(root, options);
  options = options || {};

  this.document = 'document' in options ? options.document : document;
  this.prefix = 'prefix' in options ? options.prefix : 'pagelet_';
  this.timeout = 'timeout' in options ? options.timeout : 30000;
  this.onload = 'onload' in options ? options.onload : null;
  this.root = root || this.document.head || this.document.body;

  this.sheets = [];   // List of active stylesheets.
  this.files = {};    // List of loaded or loading files.
  this.meta = {};     // List of meta elements for polling.

  if (null === this.onload) {
    this.feature();
  }
}

/**
 * Remove a asset.
 *
 * @param {String} url URL we need to load.
 * @returns {AsyncAsset}
 * @api public
 */
AsyncAsset.prototype.remove = function remove(url) {
  var file = this.files[url];

  if (!file) return this;

  //
  // If we are fully removed, just nuke the reference.
  //
  if (file.remove()) {
    delete this.files[url];
  }

  return this;
};

/**
 * Load a new asset.
 *
 * @param {String} url URL we need to load.
 * @param {Function} fn Completion callback.
 * @returns {AsyncAsset}
 * @api public
 */
AsyncAsset.prototype.add = function add(url, fn) {
  var type = this.type(url);

  if (this.progress(url, fn)) return this;
  if ('js' === type) return this.script(url, fn);
  if ('css' === type) return this.style(url, fn);

  throw new Error('Unsupported file type: '+ type);
};

/**
 * Check if the given URL has already loaded or is currently in progress of
 * being loaded.
 *
 * @param {String} url URL that needs to be loaded.
 * @returns {Boolean} The loading is already in progress.
 * @api private
 */
AsyncAsset.prototype.progress = function progress(url, fn) {
  if (!(url in this.files)) return false;
  return this.files[url].add(fn);
};

/**
 * Trigger the callbacks for a given URL.
 *
 * @param {String} url URL that has been loaded.
 * @param {Error} err Optional error argument when shit fails.
 * @api private
 */
AsyncAsset.prototype.callback = function callback(url, err) {
  var file = this.files[url]
    , meta = this.meta[url];

  if (!file) return;

  file.exec(err);

  if (err) delete this.files[url];
  if (meta) {
    meta.parentNode.removeChild(meta);
    delete this.meta[url];
  }
};

/**
 * Determine the file type for a given URL.
 *
 * @param {String} url File URL.
 * @returns {String} The extension of the URL.
 * @api private
 */
AsyncAsset.prototype.type = function type(url) {
  return url.split('.').pop().toLowerCase();
};

/**
 * Load a new script with a source.
 *
 * @param {String} url The script file that needs to be loaded in to the page.
 * @param {Function} fn The completion callback.
 * @returns {AsyncAsset}
 * @api private
 */
AsyncAsset.prototype.script = function scripts(url, fn) {
  var script = this.document.createElement('script')
    , file = this.files[url] = new File(url, fn)
    , async = this;

  //
  // Add an unload handler which removes the DOM node from the root element.
  //
  file.unload(function unload() {
    script.onerror = script.onload = script.onreadystatechange = null;
    if (script.parentNode) script.parentNode.removeChild(script);
  });

  //
  // Required for FireFox 3.6 / Opera async loading. Normally browsers would
  // load the script async without this flag because we're using createElement
  // but these browsers need explicit flags.
  //
  script.async = true;

  //
  // onerror is not triggered by all browsers, but should give us a clean
  // indication of failures so it doesn't matter if you're browser supports it
  // or not, we still want to listen for it.
  //
  script.onerror = function onerror() {
    script.onerror = script.onload = script.onreadystatechange = null;
    async.callback(url, new Error('Failed to load the script.'));
  };

  //
  // All "latest" browser seem to support the onload event for detecting full
  // script loading. Internet Explorer 11 no longer needs to use the
  // onreadystatechange method for completion indication.
  //
  script.onload = function onload() {
    script.onerror = script.onload = script.onreadystatechange = null;
    async.callback(url);
  };

  //
  // Fall-back for older IE versions, they do not support the onload event on the
  // script tag and we need to check the script readyState to see if it's
  // successfully loaded.
  //
  script.onreadystatechange = function onreadystatechange() {
    if (this.readyState in { loaded: 1, complete: 1 }) {
      script.onerror = script.onload = script.onreadystatechange = null;
      async.callback(url);
    }
  };

  //
  // The src needs to be set after the element has been added to the document.
  // If I remember correctly it had to do something with an IE8 bug.
  //
  this.root.appendChild(script);
  script.src = url;

  return this;
};

/**
 * Load CSS files by using @import statements.
 *
 * @param {String} url URL to load.
 * @param {Function} fn Completion callback.
 * @returns {AsyncAsset}
 * @api private
 */
AsyncAsset.prototype.style = function style(url, fn) {
  if (!this.document.styleSheet) return this.link(url, fn);

  var file = this.file[url] = new File(url, fn)
    , sheet, i = 0;

  //
  // Internet Explorer can only have 31 style tags on a single page. One single
  // style tag is also limited to 31 @import statements so this gives us room to
  // have 961 style sheets totally. So we should queue style sheets. This
  // limitation has been removed in Internet Explorer 10.
  //
  // @see http://john.albin.net/ie-css-limits/two-style-test.html
  // @see http://support.microsoft.com/kb/262161
  // @see http://blogs.msdn.com/b/ieinternals/archive/2011/05/14/internet-explorer-stylesheet-rule-selector-import-sheet-limit-maximum.aspx
  //
  for (; i < this.sheets.length; i++) {
    if (this.sheets[i].imports.length < 31) {
      sheet = this.sheets[i];
      break;
    }
  }

  //
  // We didn't find suitable style Sheet to add another @import statement,
  // create a new one so we can leverage that instead.
  //
  // @TODO we should probably check the amount of `document.styleSheets.length`
  //       to check if we're allowed to add more style sheets.
  //
  if (!sheet) {
    sheet = this.document.createStyleSheet();
    this.sheets.push(sheet);
  }

  //
  // Remove the import from the stylesheet.
  //
  file.unload(function unload() {
    sheet.removeImport(i);
  });

  sheet.addImport(url);
  return this.setInterval(url);
};

/**
 * Load CSS by adding link tags on to the page.
 *
 * @param {String} url URL to load.
 * @param {Function} fn Completion callback.
 * @returns {AsyncAsset}
 * @api private
 */
AsyncAsset.prototype.link = function links(url, fn) {
  var link = this.document.createElement('link')
    , file = this.files[url] = new File(url, fn)
    , async = this;

  file.unload(function unload() {
    link.onload = link.onerror = null;
    link.parentNode.removeChild(link);
  });

  if (this.onload) {
    link.onload = function onload() {
      link.onload = link.onerror = null;
      async.callback(url);
    };

    link.onerror = function onerror() {
      link.onload = link.onerror = null;
      async.callback(url, new Error('Failed to load the stylesheet'));
    };
  }

  link.href = url;
  link.type = 'text/css';
  link.rel = 'stylesheet';

  this.root.appendChild(link);
  return this.setInterval(url);
};

/**
 * Poll our stylesheets to see if the style's have been applied.
 *
 * @param {String} url URL to check
 * @api private
 */
AsyncAsset.prototype.setInterval = function setIntervals(url) {
  if (url in this.meta) return this;

  //
  // Create a meta tag which we can inject in to the page and give it the id of
  // the prefixed CSS rule so we know when the style sheet is loaded based on the
  // style of this meta element.
  //
  var meta = this.meta[url] = this.document.createElement('meta')
    , async = this;

  meta.id = [
    this.prefix,
    url.split('/').pop().split('.').shift()
  ].join('').toLowerCase();

  this.root.appendChild(meta);

  if (this.setInterval.timer) return this;

  //
  // Start the reaping process.
  //
  this.setInterval.timer = setInterval(function interval() {
    var now = +new Date()
      , url, file, style, meta
      , compute = window.getComputedStyle;

    for (url in async.meta) {
      meta = async.meta[url];
      if (!meta) continue;

      file = async.files[url];
      style = compute ? getComputedStyle(meta) : meta.currentStyle;

      //
      // We assume that CSS added an increased style to the given prefixed CSS
      // tag.
      //
      if (file && style && parseInt(style.height, 10) > 1) {
        file.exec();
      }

      if (
           !file
        || file.readyState === File.DEAD
        || file.readyState === File.LOADED
        || (now - file.start > async.timeout)
      ) {
        if (file) file.exec(new Error('Stylesheet loading has timed out'));
        meta.parentNode.removeChild(meta);
        delete async.meta[url];
      }
    }

    //
    // If we can iterate over the async.meta object there are still objects
    // left that needs to be polled.
    //
    for (url in async.meta) return;

    clearInterval(async.setInterval.timer);
    delete async.setInterval.timer;
  }, 20);

  return this;
};

/**
 * Prefetch resources without executing them. This ensures that the next lookup
 * is primed in the cache when we need them. Of course this is only possible
 * when the server sends the correct caching headers.
 *
 * @param {Array} urls The URLS that need to be cached.
 * @returns {AsyncAsset}
 * @api private
 */
AsyncAsset.prototype.prefetch = function prefetch(urls) {
  //
  // This check is here because I'm lazy, I don't want to add an `isArray` check
  // to the code. So we're just going to flip the logic here. If it's an string
  // transform it to an array.
  //
  if ('string' === typeof urls) urls = [urls];

  var IE = navigator.userAgent.indexOf(' Trident/')
    , img = /\.(jpg|jpeg|png|gif|webp)$/
    , node;

  for (var i = 0, l = urls.length; i < l; i++) {
    if (IE || img.test(urls[i])) {
      new Image().src = urls[i];
      continue;
    }

    node = document.createElement('object');
    node.height = node.width = 0;

    //
    // Position absolute is required because it can still add some minor spacing
    // at the bottom of a page and that will break sticky footer
    // implementations.
    //
    node.style.position = 'absolute';
    document.body.appendChild(node);
  }

  return this;
};

/**
 * Try to detect if this browser supports the onload events on the link tag.
 * It's a known cross browser bug that can affect WebKit, FireFox and Opera.
 * Internet Explorer is the only browser that supports the onload event
 * consistency but it has other bigger issues that prevents us from using this
 * method.
 *
 * @returns {AsyncAsset}
 * @api private
 */
AsyncAsset.prototype.feature = function detect() {
  if (this.feature.detecting) return this;

  this.feature.detecting = true;

  var link = document.createElement('link')
    , async = this;

  link.rel = 'stylesheet';
  link.href = 'data:text/css;base64,';

  link.onload = function loaded() {
    link.parentNode.removeChild(link);

    link.onload = false;
    async.onload = true;
  };

  this.root.appendChild(link);

  return this;
};

//
// Expose the file instance.
//
AsyncAsset.File = File;

//
// Expose the asset loader
//
module.exports = AsyncAsset;

},{}],4:[function(require,module,exports){
'use strict';

/**
 * Create a function that will cleanup the instance.
 *
 * @param {Array|String} keys Properties on the instance that needs to be cleared.
 * @param {Object} options Additional configuration.
 * @returns {Function} Destroy function
 * @api public
 */
module.exports = function demolish(keys, options) {
  var split = /[, ]+/;

  options = options ||  {};
  keys = keys || [];

  if ('string' === typeof keys) keys = keys.split(split);

  /**
   * Run addition cleanup hooks.
   *
   * @param {String} key Name of the clean up hook to run.
   * @param {Mixed} selfie Reference to the instance we're cleaning up.
   * @api private
   */
  function run(key, selfie) {
    if (!options[key]) return;
    if ('string' === typeof options[key]) options[key] = options[key].split(split);
    if ('function' === typeof options[key]) return options[key].call(selfie);

    for (var i = 0, type, what; i < options[key].length; i++) {
      what = options[key][i];
      type = typeof what;

      if ('function' === type) {
        what.call(selfie);
      } else if ('string' === type && 'function' === typeof selfie[what]) {
        selfie[what]();
      }
    }
  }

  /**
   * Destroy the instance completely and clean up all the existing references.
   *
   * @returns {Boolean}
   * @api public
   */
  return function destroy() {
    var selfie = this
      , i = 0
      , prop;

    if (selfie[keys[0]] === null) return false;
    run('before', selfie);

    for (; i < keys.length; i++) {
      prop = keys[i];

      if (selfie[prop]) {
        if ('function' === typeof selfie[prop].destroy) selfie[prop].destroy();
        selfie[prop] = null;
      }
    }

    if (selfie.emit) selfie.emit('destroy');
    run('after', selfie);

    return true;
  };
};

},{}],5:[function(require,module,exports){
'use strict';

/**
 * Representation of a single EventEmitter function.
 *
 * @param {Function} fn Event handler to be called.
 * @param {Mixed} context Context for function execution.
 * @param {Boolean} once Only emit once
 * @api private
 */
function EE(fn, context, once) {
  this.fn = fn;
  this.context = context;
  this.once = once || false;
}

/**
 * Minimal EventEmitter interface that is molded against the Node.js
 * EventEmitter interface.
 *
 * @constructor
 * @api public
 */
function EventEmitter() { /* Nothing to set */ }

/**
 * Holds the assigned EventEmitters by name.
 *
 * @type {Object}
 * @private
 */
EventEmitter.prototype._events = undefined;

/**
 * Return a list of assigned event listeners.
 *
 * @param {String} event The events that should be listed.
 * @returns {Array}
 * @api public
 */
EventEmitter.prototype.listeners = function listeners(event) {
  if (!this._events || !this._events[event]) return [];
  if (this._events[event].fn) return [this._events[event].fn];

  for (var i = 0, l = this._events[event].length, ee = new Array(l); i < l; i++) {
    ee[i] = this._events[event][i].fn;
  }

  return ee;
};

/**
 * Emit an event to all registered event listeners.
 *
 * @param {String} event The name of the event.
 * @returns {Boolean} Indication if we've emitted an event.
 * @api public
 */
EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
  if (!this._events || !this._events[event]) return false;

  var listeners = this._events[event]
    , len = arguments.length
    , args
    , i;

  if ('function' === typeof listeners.fn) {
    if (listeners.once) this.removeListener(event, listeners.fn, true);

    switch (len) {
      case 1: return listeners.fn.call(listeners.context), true;
      case 2: return listeners.fn.call(listeners.context, a1), true;
      case 3: return listeners.fn.call(listeners.context, a1, a2), true;
      case 4: return listeners.fn.call(listeners.context, a1, a2, a3), true;
      case 5: return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
      case 6: return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
    }

    for (i = 1, args = new Array(len -1); i < len; i++) {
      args[i - 1] = arguments[i];
    }

    listeners.fn.apply(listeners.context, args);
  } else {
    var length = listeners.length
      , j;

    for (i = 0; i < length; i++) {
      if (listeners[i].once) this.removeListener(event, listeners[i].fn, true);

      switch (len) {
        case 1: listeners[i].fn.call(listeners[i].context); break;
        case 2: listeners[i].fn.call(listeners[i].context, a1); break;
        case 3: listeners[i].fn.call(listeners[i].context, a1, a2); break;
        default:
          if (!args) for (j = 1, args = new Array(len -1); j < len; j++) {
            args[j - 1] = arguments[j];
          }

          listeners[i].fn.apply(listeners[i].context, args);
      }
    }
  }

  return true;
};

/**
 * Register a new EventListener for the given event.
 *
 * @param {String} event Name of the event.
 * @param {Functon} fn Callback function.
 * @param {Mixed} context The context of the function.
 * @api public
 */
EventEmitter.prototype.on = function on(event, fn, context) {
  var listener = new EE(fn, context || this);

  if (!this._events) this._events = {};
  if (!this._events[event]) this._events[event] = listener;
  else {
    if (!this._events[event].fn) this._events[event].push(listener);
    else this._events[event] = [
      this._events[event], listener
    ];
  }

  return this;
};

/**
 * Add an EventListener that's only called once.
 *
 * @param {String} event Name of the event.
 * @param {Function} fn Callback function.
 * @param {Mixed} context The context of the function.
 * @api public
 */
EventEmitter.prototype.once = function once(event, fn, context) {
  var listener = new EE(fn, context || this, true);

  if (!this._events) this._events = {};
  if (!this._events[event]) this._events[event] = listener;
  else {
    if (!this._events[event].fn) this._events[event].push(listener);
    else this._events[event] = [
      this._events[event], listener
    ];
  }

  return this;
};

/**
 * Remove event listeners.
 *
 * @param {String} event The event we want to remove.
 * @param {Function} fn The listener that we need to find.
 * @param {Boolean} once Only remove once listeners.
 * @api public
 */
EventEmitter.prototype.removeListener = function removeListener(event, fn, once) {
  if (!this._events || !this._events[event]) return this;

  var listeners = this._events[event]
    , events = [];

  if (fn) {
    if (listeners.fn && (listeners.fn !== fn || (once && !listeners.once))) {
      events.push(listeners);
    }
    if (!listeners.fn) for (var i = 0, length = listeners.length; i < length; i++) {
      if (listeners[i].fn !== fn || (once && !listeners[i].once)) {
        events.push(listeners[i]);
      }
    }
  }

  //
  // Reset the array, or remove it completely if we have no more listeners.
  //
  if (events.length) {
    this._events[event] = events.length === 1 ? events[0] : events;
  } else {
    delete this._events[event];
  }

  return this;
};

/**
 * Remove all listeners or only the listeners for the specified event.
 *
 * @param {String} event The event want to remove all listeners for.
 * @api public
 */
EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
  if (!this._events) return this;

  if (event) delete this._events[event];
  else this._events = {};

  return this;
};

//
// Alias methods names because people roll like that.
//
EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
EventEmitter.prototype.addListener = EventEmitter.prototype.on;

//
// This function doesn't apply anymore.
//
EventEmitter.prototype.setMaxListeners = function setMaxListeners() {
  return this;
};

//
// Expose the module.
//
EventEmitter.EventEmitter = EventEmitter;
EventEmitter.EventEmitter2 = EventEmitter;
EventEmitter.EventEmitter3 = EventEmitter;

//
// Expose the module.
//
module.exports = EventEmitter;

},{}],6:[function(require,module,exports){
'use strict';

var Container = require('containerization')
  , EventEmitter = require('eventemitter3')
  , iframe = require('frames');

/**
 * Fortress: Container and Image management for front-end code.
 *
 * @constructor
 * @param {Object} options Fortress configuration
 * @api private
 */
function Fortress(options) {
  if (!(this instanceof Fortress)) return new Fortress(options);
  options = options || {};

  //
  // Create a small dedicated container that houses all our iframes. This might
  // add an extra DOM node to the page in addition to each iframe but it will
  // ultimately result in a cleaner DOM as everything is nicely tucked away.
  //
  var scripts = document.getElementsByTagName('script')
    , append = scripts[scripts.length - 1] || document.body
    , div = document.createElement('div');

  append.parentNode.insertBefore(div, append);

  this.global = (function global() { return this; })() || window;
  this.containers = {};
  this.mount = div;

  scripts = null;

  EventEmitter.call(this);
}

//
// Fortress inherits from EventEmitter3.
//
Fortress.prototype = new EventEmitter();
Fortress.prototype.constructor = Fortress;

/**
 * Detect the current globals that are loaded in to this page. This way we can
 * see if we are leaking data.
 *
 * @param {Array} old Optional array with previous or known leaks.
 * @returns {Array} Names of the leaked globals.
 * @api private
 */
Fortress.prototype.globals = function globals(old) {
  var i = iframe(this.mount, 'iframe_'+ (+new Date()))
    , windoh = i.add().window()
    , global = this.global
    , result = [];

  i.remove();

  //
  // Detect the globals and return them.
  //
  for (var key in global) {
    var introduced = !(key in windoh);

    //
    // We've been given an array, so we should use that as the source of previous
    // and acknowledged leaks and only return an array that contains newly
    // introduced leaks.
    //
    if (introduced) {
      if (old && old.length && !!~old.indexOf(key)) continue;

      result.push(key);
    }
  }

  return result;
};

/**
 * List all active containers.
 *
 * @returns {Array} Active containers.
 * @api public
 */
Fortress.prototype.all = function all() {
  var everything = [];

  for (var id in this.containers) {
    everything.push(this.containers[id]);
  }

  return everything;
};

/**
 * Generate an unique, unknown id that we can use for our container storage.
 *
 * @returns {String}
 * @api private
 */
Fortress.prototype.id = function id() {
  for (var i = 0, generated = []; i < 4; i++) {
    generated.push(Math.random().toString(36).substring(2));
  }

  generated = 'fortress_'+ generated.join('_');

  //
  // Ensure that we didn't generate a pre-existing id, if we did, generate
  // another id.
  //
  if (generated in this.containers) return this.id();
  return generated;
};

/**
 * Create a new container.
 *
 * @param {String} code
 * @param {Object} options Options for the container
 * @returns {Container}
 * @api public
 */
Fortress.prototype.create = function create(code, options) {
  var container = new Container(this.mount, this.id(), code, options);
  this.containers[container.id] = container;

  return container;
};

/**
 * Get a container based on it's unique id.
 *
 * @param {String} id The container id.
 * @returns {Container}
 * @api public
 */
Fortress.prototype.get = function get(id) {
  return this.containers[id];
};

/**
 * Inspect a running Container in order to get more detailed information about
 * the process and the state of the container.
 *
 * @param {String} id The container id.
 * @api public
 */
Fortress.prototype.inspect = Fortress.prototype.top = function inspect(id) {
  var container = this.get(id);
  if (!container) return {};

  return container.inspect();
};

/**
 * Start the container with the given id.
 *
 * @param {String} id The container id.
 * @api public
 */
Fortress.prototype.start = function start(id) {
  var container = this.get(id);
  if (!container) return this;

  container.start();
  return this;
};

/**
 * Stop a running container, this does not fully destroy the container. It
 * merely stops it from running. Stopping an container will cause the container
 * to start from the beginning again once it's started. This is not a pause
 * function.
 *
 * @param {String} id The container id.
 * @api public
 */
Fortress.prototype.stop = function stop(id) {
  var container = this.get(id);
  if (!container) return this;

  container.stop();
  return this;
};

/**
 * Restart a container. Basically, just a start and stop.
 *
 * @param {String} id The container id.
 * @api public
 */
Fortress.prototype.restart = function restart(id) {
  var container = this.get(id);
  if (!container) return this;

  container.stop().start();

  return this;
};

/**
 * Completely remove and shutdown the given container id.
 *
 * @param {String} id The container id.
 * @api public
 */
Fortress.prototype.kill = function kill(id) {
  var container = this.get(id);
  if (!container) return this;

  container.destroy();
  delete this.containers[id];

  return this;
};

/**
 * Start streaming logging information and cached logs.
 *
 * @param {String} id The container id.
 * @param {String} method The log method name.
 * @param {Function} fn The function that needs to be called for each stream.
 * @api public
 */
Fortress.prototype.attach = function attach(id, method, fn) {
  var container = this.get(id);
  if (!container) return this;

  if ('function' === typeof method) {
    fn = method;
    method = 'attach';
  } else {
    method += 'attach::'+ method;
  }

  container.on(method, fn);

  return this;
};

/**
 * Stop streaming logging information and cached logs.
 *
 * @param {String} id The container id.
 * @param {String} method The log method name.
 * @param {Function} fn The function that needs to be called for each stream.
 * @api public
 */
Fortress.prototype.detach = function detach(id, method, fn) {
  var container = this.get(id);
  if (!container) return this;

  if ('function' === typeof method) {
    fn = method;
    method = 'attach';
  } else {
    method += 'attach::'+ method;
  }

  if (!fn) container.removeAllListeners(method);
  else container.on(method, fn);

  return this;
};

/**
 * Destroy all active containers and clean up all references. We expect no more
 * further calls to this Fortress instance.
 *
 * @api public
 */
Fortress.prototype.destroy = function destroy() {
  for (var id in this.containers) {
    this.kill(id);
  }

  this.mount.parentNode.removeChild(this.mount);
  this.global = this.mount = this.containers = null;
};

/**
 * Prepare a file or function to be loaded in to a Fortress based Container.
 * When the transfer boolean is set we assume that you want to load pass the
 * result of to a function or assign it a variable from the server to the client
 * side:
 *
 * ```
 * <script>
 * var code = <%- Fortress.stringify(code, true) %>
 * </script>
 * ```
 *
 * @param {String|Function} code The code that needs to be transformed.
 * @param {Boolean} transfer Prepare the code for transfer.
 * @returns {String}
 * @api public
 */
Fortress.stringify = function stringify(code, transfer) {
  if ('function' === typeof code) {
    //
    // We've been given a pure function, so we need to wrap it a little bit
    // after we've done a `toString` for the source retrieval so the function
    // will automatically execute when it's activated.
    //
    code = '('+ code.toString() +'())';
  } else {
    //
    // We've been given a string, so we're going to assume that it's path to file
    // that should be included instead.
    //
    code = require('fs').readFileSync(code, 'utf-8');
  }

  return transfer ? JSON.stringify(code) : code;
};

//
// Expose the module.
//
module.exports = Fortress;

},{"containerization":7,"eventemitter3":9,"frames":10,"fs":15}],7:[function(require,module,exports){
'use strict';

var EventEmitter = require('eventemitter3')
  , BaseImage = require('alcatraz')
  , slice = Array.prototype.slice
  , iframe = require('frames');

/**
 * Representation of a single container.
 *
 * Options:
 *
 * - retries; When an error occurs, how many times should we attempt to restart
 *   the code before we automatically stop() the container.
 * - stop; Stop the container when an error occurs.
 * - timeout; How long can a ping packet timeout before we assume that the
 *   container has died and should be restarted.
 *
 * @constructor
 * @param {Element} mount The element we should attach to.
 * @param {String} id A unique id for this container.
 * @param {String} code The actual that needs to run within the sandbox.
 * @param {Object} options Container configuration.
 * @api private
 */
function Container(mount, id, code, options) {
  if (!(this instanceof Container)) return new Container(mount, id, code, options);

  if ('object' === typeof code) {
    options = code;
    code = null;
  }

  options = options || {};

  this.i = iframe(mount, id);         // The generated iframe.
  this.mount = mount;                 // Mount point of the container.
  this.console = [];                  // Historic console.* output.
  this.setTimeout = {};               // Stores our setTimeout references.
  this.id = id;                       // Unique id.
  this.readyState = Container.CLOSED; // The readyState of the container.

  this.created = +new Date();         // Creation EPOCH.
  this.started = null;                // Start EPOCH.

  this.retries = 'retries' in options // How many times should we reload
    ? +options.retries || 3
    : 3;

  this.timeout = 'timeout' in options // Ping timeout before we reboot.
    ? +options.timeout || 1050
    : 1050;

  //
  // Initialise as an EventEmitter before we start loading in the code.
  //
  EventEmitter.call(this);

  //
  // Optional code to load in the container and start it directly.
  //
  if (code) this.load(code).start();
}

//
// The container inherits from the EventEmitter3.
//
Container.prototype = new EventEmitter();
Container.prototype.constructor = Container;

/**
 * Internal readyStates for the container.
 *
 * @type {Number}
 * @private
 */
Container.CLOSING = 1;
Container.OPENING = 2;
Container.CLOSED  = 3;
Container.OPEN    = 4;

/**
 * Start a new ping timeout.
 *
 * @api private
 */
Container.prototype.ping = function ping() {
  if (this.setTimeout.pong) clearTimeout(this.setTimeout.pong);

  var self = this;
  this.setTimeout.pong = setTimeout(function pong() {
    self.onmessage({
      type: 'error',
      scope: 'iframe.timeout',
      args: [
        'the iframe is no longer responding with ping packets'
      ]
    });
  }, this.timeout);

  return this;
};

/**
 * Retry loading the code in the iframe. The container will be restored to a new
 * state or completely reset the iframe.
 *
 * @api private
 */
Container.prototype.retry = function retry() {
  switch (this.retries) {
    //
    // This is our last attempt, we've tried to have the iframe restart the code
    // it self, so for our last attempt we're going to completely create a new
    // iframe and re-compile the code for it.
    //
    case 1:
      this.stop(); // Clear old iframe and nuke it's references
      this.i = iframe(this.mount, this.id);
      this.load(this.image.source).start();
    break;

    //
    // No more attempts left.
    //
    case 0:
      this.stop();
      this.emit('end');
    return;

    //
    // By starting and stopping (and there for removing and adding it back to
    // the DOM) the iframe will reload it's HTML and the added code.
    //
    default:
      this.stop().start();
    break;
  }

  this.emit('retry', this.retries);
  this.retries--;

  return this;
};

/**
 * Inspect the container to get some useful statistics about it and it's health.
 *
 * @returns {Object}
 * @api public
 */
Container.prototype.inspect = function inspect() {
  if (!this.i.attached()) return {};

  var date = new Date()
    , memory;

  //
  // Try to read out the `performance` information from the iframe.
  //
  if (this.i.window() && this.i.window().performance) {
    memory = this.i.window().performance.memory;
  }

  memory = memory || {};

  return {
    readyState: this.readyState,
    retries: this.retries,
    uptime: this.started ? (+date) - this.started : 0,
    date: date,
    memory: {
      limit: memory.jsHeapSizeLimit || 0,
      total: memory.totalJSHeapSize || 0,
      used: memory.usedJSHeapSize || 0
    }
  };
};


/**
 * Parse and process incoming messages from the iframe. The incoming messages
 * should be objects that have a `type` property. The main reason why we have
 * this as a separate method is to give us flexibility. We are leveraging iframes
 * at the moment, but in the future we might want to leverage WebWorkers for the
 * sand boxing of JavaScript.
 *
 * @param {Object} packet The incoming message.
 * @returns {Boolean} Message was handled y/n.
 * @api private
 */
Container.prototype.onmessage = function onmessage(packet) {
  if ('object' !== typeof packet) return false;
  if (!('type' in packet)) return false;

  packet.args = packet.args || [];

  switch (packet.type) {
    //
    // The code in the iframe used the `console` method.
    //
    case 'console':
      this.console.push({
        scope: packet.scope,
        epoch: +new Date(),
        args: packet.args
      });

      if (packet.attach) {
        this.emit.apply(this, ['attach::'+ packet.scope].concat(packet.args));
        this.emit.apply(this, ['attach', packet.scope].concat(packet.args));
      }
    break;

    //
    // An error happened in the iframe, process it.
    //
    case 'error':
      var failure = packet.args[0].stack ? packet.args[0] : new Error(packet.args[0]);
      failure.scope = packet.scope || 'generic';

      this.emit('error', failure);
      this.retry();
    break;

    //
    // The iframe and it's code has been loaded.
    //
    case 'load':
      if (this.readyState !== Container.OPEN) {
        this.readyState = Container.OPEN;
        this.emit('start');
      }
    break;

    //
    // The iframe is unloading, attaching
    //
    case 'unload':
      if (this.readyState !== Container.CLOSED) {
        this.readyState = Container.CLOSED;
        this.emit('stop');
      }
    break;

    //
    // We've received a ping response from the iframe, so we know it's still
    // running as intended.
    //
    case 'ping':
      this.ping();
      this.emit('ping');
    break;

    //
    // Handle unknown package types by just returning false after we've emitted
    // it as an `regular` message.
    //
    default:
      this.emit.apply(this, ['message'].concat(packet.args));
    return false;
  }

  return true;
};

/**
 * Small wrapper around sandbox evaluation.
 *
 * @param {String} cmd The command to executed in the iframe.
 * @param {Function} fn Callback
 * @api public
 */
Container.prototype.eval = function evil(cmd, fn) {
  var data;

  try {
    data = this.i.add().window().eval(cmd);
  } catch (e) {
    return fn(e);
  }

  return fn(undefined, data);
};

/**
 * Start the container.
 *
 * @returns {Container}
 * @api public
 */
Container.prototype.start = function start() {
  this.readyState = Container.OPENING;

  var self = this;

  /**
   * Simple argument proxy.
   *
   * @api private
   */
  function onmessage() {
    self.onmessage.apply(self, arguments);
  }

  //
  // Code loading is an sync process, but this COULD cause huge stack traces
  // and really odd feedback loops in the stack trace. So we deliberately want
  // to destroy the stack trace here.
  //
  this.setTimeout.start = setTimeout(function async() {
    var doc = self.i.document();

    //
    // No doc.open, the iframe has already been destroyed!
    //
    if (!doc.open || !self.i) return;

    //
    // We need to open and close the iframe in order for it to trigger an onload
    // event. Certain scripts might require in order to execute properly.
    //
    doc.open();

    doc.write([
      '<!doctype html>',
      '<html><head>',
      //
      // iFrames can generate pointless requests by searching for a favicon.
      // This can add up to three extra requests for a simple iframe. To battle
      // this, we need to supply an empty icon.
      //
      // @see http://stackoverflow.com/questions/1321878/how-to-prevent-favicon-ico-requests
      //
      '<link rel="icon" href="data:;base64,=">',
      '</head><body>'
    ].join('\n'));

    //
    // Introduce our messaging variable, this needs to be done before we eval
    // our code. If we set this value before the setTimeout, it doesn't work in
    // Opera due to reasons.
    //
    self.i.window()[self.id] = onmessage;
    self.eval(self.image.toString(), function evil(err) {
      if (err) return self.onmessage({
        type: 'error',
        scope: 'iframe.eval',
        args: [ err ]
      });
    });

    //
    // If executing the code results to an error we could actually be stopping
    // and removing the iframe from the source before we're able to close it.
    // This is because executing the code inside the iframe is actually an sync
    // operation.
    //
    if (doc.close) doc.close();
  }, 0);

  //
  // We can only write to the iframe if it's actually in the DOM. The `i.add()`
  // method ensures that the iframe is added to the DOM.
  //
  this.i.add();
  this.started = +new Date();

  return this;
};

/**
 * Stop running the code inside the container.
 *
 * @returns {Container}
 * @api private
 */
Container.prototype.stop = function stop() {
  if (this.readyState !== Container.CLOSED && this.readyState !== Container.CLOSING) {
    this.readyState = Container.CLOSING;
  }

  this.i.remove();

  //
  // Opera doesn't support unload events. So adding an listener inside the
  // iframe for `unload` doesn't work. This is the only way around it.
  //
  this.onmessage({ type: 'unload' });

  //
  // It's super important that this removed AFTER we've cleaned up all other
  // references as we might need to communicate back to our container when we
  // are unloading or when an `unload` event causes an error.
  //
  this.i.window()[this.id] = null;

  //
  // Clear the timeouts.
  //
  for (var timeout in this.setTimeout) {
    clearTimeout(this.setTimeout[timeout]);
    delete this.setTimeout[timeout];
  }

  return this;
};

/**
 * Load the given code as image on to the container.
 *
 * @param {String} code The code that should run on the container.
 * @returns {Container}
 * @api public
 */
Container.prototype.load = function load(code) {
  this.image = new BaseImage(this.id, code);

  return this;
};

/**
 * Completely destroy the given container and ensure that all references are
 * nuked so we can clean up as much memory as possible.
 *
 * @returns {Container}
 * @api private
 */
Container.prototype.destroy = function destroy() {
  if (!this.i) return this;
  this.stop();

  //
  // Remove all possible references to release as much memory as possible.
  //
  this.mount = this.image = this.id = this.i = this.created = null;
  this.console.length = 0;

  this.removeAllListeners();

  return this;
};

//
// Expose the module.
//
module.exports = Container;

},{"alcatraz":8,"eventemitter3":9,"frames":10}],8:[function(require,module,exports){
'use strict';

/**
 * Alcatraz is our source code sandboxing.
 *
 * @constructor
 * @param {String} method The global/method name that processes messages.
 * @param {String} source The actual code.
 * @param {String} domain The domain name.
 * @api private
 */
function Alcatraz(method, source, domain) {
  if (!(this instanceof Alcatraz)) return new Alcatraz(method, source);

  this.domain = domain || ('undefined' !== typeof document ? document.domain : '');
  this.method = 'if ('+method+') '+ method;
  this.source = source;
  this.compiled = null;
}

/**
 * Assume that the source of the Alcatraz is loaded using toString() so it will be
 * automatically transformed when the Alcatraz instance is concatenated or added to
 * the DOM.
 *
 * @returns {String}
 * @api public
 */
Alcatraz.prototype.toString = function toString() {
  if (this.compiled) return this.compiled;

  return this.compiled = this.transform();
};

/**
 * Apply source code transformations to the code so it can work inside an
 * iframe.
 *
 * @TODO allow custom code transformations.
 * @returns {String}
 * @api private
 */
Alcatraz.prototype.transform = function transform() {
  var code = ('('+ (function alcatraz(global) {
    //
    // When you toString a function which is created while in strict mode,
    // firefox will add "use strict"; to the body of the function. Chrome leaves
    // the source intact. Knowing this, we cannot blindly assume that we can
    // inject code after the first opening bracked `{`.
    //
    this.alcatraz();

    /**
     * Simple helper function to do nothing.
     *
     * @type {Function}
     * @api private
     */
    function noop() { /* I do nothing useful */ }

    /**
     * AddListener polyfill
     *
     * @param {Mixed} thing What ever we want to listen on.
     * @param {String} evt The event we're listening for.
     * @param {Function} fn The function that gets executed.
     * @api private
     */
    function on(thing, evt, fn) {
      if (thing.attachEvent) {
        thing.attachEvent('on'+ evt, fn);
      } else if (thing.addEventListener) {
        thing.addEventListener(evt, fn, false);
      } else {
        thing['on'+ evt] = fn;
      }

      return { on: on };
    }

    //
    // Force the same domain as our 'root' script.
    //
    try { if ('_alcatraz_domain_') document.domain = '_alcatraz_domain_'; }
    catch (e) { /* FireFox 26 throws an Security error for this as we use eval */ }

    //
    // Prevent common iframe detection scripts that do frame busting.
    //
    try { global.top = global.self = global.parent = global; }
    catch (e) { /* Damn, read-only */ }

    //
    // Add a error listener. Adding it on the iframe it self doesn't make it
    // bubble up to the container. So in order to capture errors and notifying
    // the container we need to add a `window.onerror` listener inside the
    // iframe it self.
    // @TODO add proper stack trace tool here?
    //
    global.onerror = function onerror() {
      var a = Array.prototype.slice.call(arguments, 0);
      this._alcatraz_method_({ type: 'error', scope: 'window.onerror', args: a });
      return true;
    };

    //
    // Eliminate the browsers blocking dialogs, we're in a iframe not a browser.
    //
    var blocking = ['alert', 'prompt', 'confirm', 'print', 'open'];
    for (var i = 0; i < blocking.length; i++) {
      try { global[blocking[i]] = noop; }
      catch (e) {}
    }

    //
    // Override the build-in console.log so we can transport the logging messages to
    // the actual page.
    //
    // @see https://github.com/DeveloperToolsWG/console-object/blob/master/api.md
    // for the minimum supported console.* methods.
    //
    var methods = [
        'debug', 'error', 'info', 'log', 'warn', 'dir', 'dirxml', 'table', 'trace'
      , 'assert', 'count', 'markTimeline', 'profile', 'profileEnd', 'time'
      , 'timeEnd', 'timeStamp', 'timeline', 'timelineEnd', 'group'
      , 'groupCollapsed', 'groupEnd', 'clear', 'select', 'exception'
      , 'isIndependentlyComposed'
    ], fconsole = typeof console !== 'undefined' ? console : {};
    global.console = {};

    /**
     * Helper method to polyfill our global console method so we can proxy it's
     * usage to the
     *
     * @param {String} method The console method we want to polyfill.
     * @api private
     */
    function polyconsole(method) {
      var attach = { debug: 1, error: 1, log: 1, warn: 1 };

      //
      // Ensure that this host environment always has working console.
      //
      global.console[method] = function polyfilled() {
        var args = Array.prototype.slice.call(arguments, 0);

        //
        // If the host supports this given method natively, execute it.
        //
        if (method in fconsole) fconsole[method].apply(fconsole, args);

        //
        // Proxy messages to the container.
        //
        this._alcatraz_method_({
          attach: method in attach,
          type: 'console',
          scope: method,
          args: args
        });
      };
    }

    for (i = 0; i < methods.length; i++) {
      polyconsole(methods[i]);
    }

    //
    // The setInterval allows us to detect if the iframe is still running of if
    // it has crashed or maybe it's just freezing up. We will be missing pings
    // or get extremely slow responses. Browsers will kill long running scripts
    // after 5 seconds of freezing:
    //
    // http://www.nczonline.net/blog/2009/01/05/what-determines-that-a-script-is-long-running/
    //
    setInterval(function ping() {
      this._alcatraz_method_({ type: 'ping' });
    }, 1000);

    //
    // Add load listeners so we know when the iframe is alive and working.
    //
    on(global, 'load', function () {
      this._alcatraz_method_({ type: 'load' });
    });

    //
    // Ideally we load this code after our `load` event so we know that our own
    // bootstrapping has been loaded completely. But the problem is that we
    // actually cause full browser crashes in chrome when we execute this.
    //
    var self = this;
    setTimeout(function timeout() {
      try { self.alcatraz(); }
      catch (e) {
        this._alcatraz_method_({ type: 'error', scope: 'iframe.start', args: [e] });
      }
    }, 0);
  })+').call({}, this)');

  //
  // Replace our "template tags" with the actual content.
  //
  return code
    .replace(/_alcatraz_domain_/g, this.domain)
    .replace(/this\._alcatraz_method_/g, this.method)
    .replace(/this\.alcatraz\(\);/g, 'this.alcatraz=function alcatraz() {'+ this.source +'};');
};

//
// Expose module.
//
module.exports = Alcatraz;

},{}],9:[function(require,module,exports){
'use strict';

/**
 * Minimal EventEmitter interface that is molded against the Node.js
 * EventEmitter interface.
 *
 * @constructor
 * @api public
 */
function EventEmitter() {
  this._events = {};
}

/**
 * Return a list of assigned event listeners.
 *
 * @param {String} event The events that should be listed.
 * @returns {Array}
 * @api public
 */
EventEmitter.prototype.listeners = function listeners(event) {
  return Array.apply(this, this._events[event] || []);
};

/**
 * Emit an event to all registered event listeners.
 *
 * @param {String} event The name of the event.
 * @returns {Boolean} Indication if we've emitted an event.
 * @api public
 */
EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
  if (!this._events || !this._events[event]) return false;

  var listeners = this._events[event]
    , length = listeners.length
    , handler = listeners[0]
    , len = arguments.length
    , args
    , i;

  if (1 === length) {
    switch (len) {
      case 1:
        handler.call(this);
      break;
      case 2:
        handler.call(this, a1);
      break;
      case 3:
        handler.call(this, a1, a2);
      break;
      case 4:
        handler.call(this, a1, a2, a3);
      break;
      case 5:
        handler.call(this, a1, a2, a3, a4);
      break;
      case 6:
        handler.call(this, a1, a2, a3, a4, a5);
      break;

      default:
        for (i = 1, args = new Array(len -1); i < len; i++) {
          args[i - 1] = arguments[i];
        }

        handler.apply(this, args);
    }

    if (handler.once) this.removeListener(event, handler);
  } else {
    for (i = 1, args = new Array(len -1); i < len; i++) {
      args[i - 1] = arguments[i];
    }

    for (i = 0; i < length; i++) {
      listeners[i].apply(this, args);
      if (listeners[i].once) this.removeListener(event, handler[i]);
    }
  }

  return true;
};

/**
 * Register a new EventListener for the given event.
 *
 * @param {String} event Name of the event.
 * @param {Functon} fn Callback function.
 * @api public
 */
EventEmitter.prototype.on = function on(event, fn) {
  if (!this._events) this._events = {};
  if (!this._events[event]) this._events[event] = [];
  this._events[event].push(fn);

  return this;
};

/**
 * Add an EventListener that's only called once.
 *
 * @param {String} event Name of the event.
 * @param {Function} fn Callback function.
 * @api public
 */
EventEmitter.prototype.once = function once(event, fn) {
  fn.once = true;
  return this.on(event, fn);
};

/**
 * Remove event listeners.
 *
 * @param {String} event The event we want to remove.
 * @param {Function} fn The listener that we need to find.
 * @api public
 */
EventEmitter.prototype.removeListener = function removeListener(event, fn) {
  if (!this._events || !this._events[event]) return this;

  var listeners = this._events[event]
    , events = [];

  for (var i = 0, length = listeners.length; i < length; i++) {
    if (fn && listeners[i] !== fn && listeners[i].fn !== fn) {
      events.push(listeners[i]);
    }
  }

  //
  // Reset the array, or remove it completely if we have no more listeners.
  //
  if (events.length) this._events[event] = events;
  else this._events[event] = null;

  return this;
};

/**
 * Remove all listeners or only the listeners for the specified event.
 *
 * @param {String} event The event want to remove all listeners for.
 * @api public
 */
EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
  if (!this._events) return this;

  if (event) this._events[event] = null;
  else this._events = {};

  return this;
};

//
// Alias methods names because people roll like that.
//
EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
EventEmitter.prototype.addListener = EventEmitter.prototype.on;

//
// This function doesn't apply anymore.
//
EventEmitter.prototype.setMaxListeners = function setMaxListeners() {
  return this;
};

//
// Expose the module.
//
EventEmitter.EventEmitter = EventEmitter;
EventEmitter.EventEmitter2 = EventEmitter;
EventEmitter.EventEmitter3 = EventEmitter;

try { module.exports = EventEmitter; }
catch (e) {}

},{}],10:[function(require,module,exports){
'use strict';

/**
 * Create a new pre-configured iframe.
 *
 * Options:
 *
 * visible: (boolean) Don't hide the iframe by default.
 * sandbox: (array) Sandbox properties.
 * document: (document) HTML Document we use to create the iframe element.
 *
 * @param {Element} el DOM element where the iframe should be added on.
 * @param {String} id A unique name/id for the iframe.
 * @param {String} options Options.
 * @return {Object}
 * @api private
 */
module.exports = function iframe(el, id, options) {
  options = options || {};

  var doc = options.doc || options.document || document
    , i;

  options.sandbox = options.sandbox || [
    'allow-pointer-lock',
    'allow-same-origin',
    'allow-scripts',
    'allow-popups',
    'allow-forms'
  ];

  try {
    //
    // Internet Explorer 6/7 require a unique name attribute in order to work.
    // In addition to that, dynamic name attributes cannot be added using
    // `i.name` as it will just ignore it. Creating it using this oddly <iframe>
    // element fixes these issues.
    //
    i = doc.createElement('<iframe name="'+ id +'">');
  } catch (e) {
    i = doc.createElement('iframe');
    i.name = id;
  }

  //
  // The iframe needs to be added in to the DOM before we can modify it, make
  // sure it's remains unseen.
  //
  if (!options.visible) {
    i.style.top = i.style.left = -10000;
    i.style.position = 'absolute';
    i.style.display = 'none';
  }

  i.setAttribute('frameBorder', 0);

  if (options.sandbox.length) {
    i.setAttribute('sandbox', (options.sandbox).join(' '));
  }

  i.id = id;

  return {
    /**
     * Return the document which we can use to inject or modify the HTML.
     *
     * @returns {Document}
     * @api public
     */
    document: function doc() {
      return this.window().document;
    },

    /**
     * Return the global or the window from the iframe.
     *
     * @returns {Window}
     * @api public
     */
    window: function win() {
      return i.contentWindow || (i.contentDocument
        ? i.contentDocument.parentWindow || {}
        : {}
      );
    },

    /**
     * Add the iframe to the DOM, use insertBefore first child to avoid
     * `Operation Aborted` error in IE6.
     *
     * @api public
     */
    add: function add() {
      if (!this.attached()) {
        el.insertBefore(i, el.firstChild);
      }

      return this;
    },

    /**
     * Remove the iframe from the DOM.
     *
     * @api public
     */
    remove: function remove() {
      if (this.attached()) {
        el.removeChild(i);
      }

      return this;
    },

    /**
     * Checks if the iframe is currently attached to the DOM.
     *
     * @returns {Boolean} The container is attached to the mount point.
     * @api private
     */
    attached: function attached() {
      return !!doc.getElementById(id);
    },

    /**
     * Reference to the iframe element.
     *
     * @type {HTMLIFRAMEElement}
     * @public
     */
    frame: i
  };
};

},{}],11:[function(require,module,exports){
'use strict';

/**
 * Return a function which will process changes on the instance based on the
 * object that is provided and emit a dedicated "change" event.
 *
 * @param {String} suffix The suffix for the event we emit.
 * @returns {Function}
 * @api public
 */
module.exports = function modification(suffix) {
  suffix = arguments.length ? suffix : '';

  /**
   * Changes processor.
   *
   * @param {Object} changed Properties that have to be changed.
   * @returns {That} What ever the value of `this` is.
   * @api public
   */
  return function change(changed) {
    var currently, previously
      , that = this
      , key;

    if (!changed) return that;

    for (key in changed) {
      if (key in that && that[key] !== changed[key]) {
        currently = changed[key];
        previously = that[key];

        that[key] = currently;
        that.emit(key + suffix, currently, previously);
      }
    }

    return that;
  };
};

},{}],12:[function(require,module,exports){
'use strict';

/**
 * Wrap callbacks to prevent double execution.
 *
 * @param {Function} fn Function that should only be called once.
 * @returns {Function} A wrapped callback which prevents execution.
 * @api public
 */
module.exports = function one(fn) {
  var called = 0
    , value;

  /**
   * The function that prevents double execution.
   *
   * @api private
   */
  function onetime() {
    if (called) return value;

    called = 1;
    value = fn.apply(this, arguments);
    fn = null;

    return value;
  }

  //
  // To make debugging more easy we want to use the name of the supplied
  // function. So when you look at the functions that are assigned to event
  // listeners you don't see a load of `onetime` functions but actually the
  // names of the functions that this module will call.
  //
  onetime.displayName = fn.displayName || fn.name || onetime.displayName || onetime.name;
  return onetime;
};

},{}],13:[function(require,module,exports){
'use strict';
/**
 * Cache the hasOwnProperty method.
 *
 * @type {Function}
 * @private
 */
var hasOwn = Object.prototype.hasOwnProperty;

/**
 * Detect various of bugs in browsers.
 *
 * @type {Object}
 * @api private
 */
var supports = (function supports() {
  var tests = {}
    , doc = document
    , div = doc.createElement('div')
    , select = doc.createElement('select')
    , input = doc.createElement('input')
    , option = select.appendChild(doc.createElement('option'))
    , documentElement = doc && (doc.ownerDocument || doc).documentElement;

  //
  // Older versions of WebKit return '' instead of 'on' for checked boxes that
  // have no value specified.
  //
  input.type = 'checkbox';
  tests.on = input.value !== '';

  //
  // Make sure that options inside a disabled select are not disabled. Which is
  // the case for WebKit.
  //
  select.disabled = true;
  tests.disabled = !option.disabled;

  //
  // Verify that getAttribute really returns attributes and not properties.
  //
  div.className = 'i';
  tests.attributes = !div.getAttribute('className');

  tests.xml = documentElement ? documentElement.nodeName !== "HTML" : false;
  tests.html = !tests.xml;

  return tests;
}());

/**
 * Get the text or inner text from a given element.
 *
 * @param {Element} element
 * @returns {String} text
 * @api public
 */
function text(element) {
  var type = element.nodeType
    , value = '';

  if (1 === type || 9 === type || 11 === type) {
    //
    // Use `textContent` instead of `innerText` as it's inconsistent with new
    // lines.
    //
    if ('string' === typeof element.textContent) return element.textContent;

    for (element = element.firstChild; element; element = element.nextSibling) {
      value += text(element);
    }
  }

  return 3 === type || 4 === type
  ? element.nodeValue
  : value;
}

/**
 * Trim a given string.
 *
 * @param {String} value
 * @returns {String}
 * @api public
 */
function trim(value) {
  return ((value || '') +'').replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
}

/**
 *
 *
 * @param {Element} element
 * @returns {String} The `.value` of the element.
 * @api private
 */
function attribute(element, name, val) {
  return supports.attributes || !supports.html
  ? element.getAttribute(name)
  : (val = element.getAttributeNode(name)) && val.specified ? val.value : '';
}

/**
 * Get the value from a given element.
 *
 * @param {Element} element The HTML element we need to extract the value from.
 * @returns {Mixed} The value of the element.
 * @api public
 */
function get(element) {
  var name = element.nodeName.toLowerCase()
    , value;

  if (get.parser[element.type] && hasOwn.call(get.parser, element.type)) {
    value = get.parser[element.type](element);
  } else if (get.parser[name] && hasOwn.call(get.parser, name)) {
    value = get.parser[name](element);
  }

  if (value !== undefined) return value;

  value = element.value;

  return 'string' === typeof value
  ? value.replace(/\r/g, '')
  : value === null ? '' : value;
}

/**
 * Dedicated value parsers to combat all the edge cases.
 *
 * @type {Object}
 * @private
 */
get.parser = {
  option: function option(element) {
    var value = attribute(element, 'value');

    return value === null
    ? trim(text(element))
    : value;
  },

  select: function select(element) {
    var values = []
      , options = element.options
      , index = element.selectedIndex
      , one = element.type === 'select-one' || index < 0;

    for (
      var length = one ? index + 1 : options.length
          , i = index < 0 ? length : one ? index : 0;
      i < length;
      i++
    ) {
      var opt = options[i]
        , value;

      //
      // IE 6-9 doesn't update the selected after a form reset. And don't return
      // options that are disabled or have an disabled option group.
      //
      if (
           (opt.selected || index === i)
        && (
           !supports.disabled
           ? opt.getAttribute('disabled') === null
           : !opt.disabled
        )
        && (
           !opt.parentNode.disabled
        || (opt.parentNode.nodeName || '').toLowerCase() !== 'optgroup'
        )
      ) {
        value = get(opt);
        if (one) return value;

        values.push(value);
      }
    }

    return values;
  }
};

//
// Parsers that require feature detection in order to work:
//
if (!supports.on) {
  get.parser.radio = get.parser.checkbox = function input(element) {
    return element.getAttribute('value') !== null
    ? element.value
    : 'on';
  };
}

//
// Expose the methods.
//
get.trim = trim;
get.text = text;

module.exports = get;

},{}],14:[function(require,module,exports){
'use strict';

var EventEmitter = require('eventemitter3')
  , collection = require('./collection')
  , AsyncAsset = require('async-asset')
  , Fortress = require('fortress')
  , async = require('./async')
  , val = require('parsifal')
  , one = require('one-time')
  , sandbox
  , undef;

//
// Async Asset loader.
//
var assets = new AsyncAsset(document.body, {
  prefix: '_'
});

/**
 * Representation of a single pagelet.
 *
 * @constructor
 * @param {BigPipe} bigpipe The BigPipe instance that was created.
 * @api public
 */
function Pagelet(bigpipe) {
  if (!(this instanceof Pagelet)) return new Pagelet(bigpipe);

  var self = this;

  //
  // Create one single Fortress instance that orchestrates all iframe based client
  // code. This sandbox variable should never be exposed to the outside world in
  // order to prevent leaking.
  //
  this.sandbox = sandbox = sandbox || new Fortress();
  this.bigpipe = bigpipe;

  //
  // Add an initialized method which is __always__ called when the pagelet is
  // either destroyed directly, errored or loaded.
  //
  this.initialized = one(function initialized() {
    self.broadcast('initialized');
  });
}

//
// Inherit from EventEmitter.
//
Pagelet.prototype = new EventEmitter();
Pagelet.prototype.constructor = Pagelet;

/**
 * Configure the Pagelet.
 *
 * @param {String} name The given name of the pagelet.
 * @param {Object} data The data of the pagelet.
 * @param {Object} state The state of the pagelet.
 * @param {Array} roots HTML root elements search for targets.
 * @api private
 */
Pagelet.prototype.configure = function configure(name, data, state, roots) {
  var bigpipe = this.bigpipe
    , pagelet = this;

  //
  // Pagelet identification.
  //
  pagelet.container = pagelet.sandbox.create(); // Create an application sandbox.
  pagelet.timeout = data.timeout || 25 * 1000;  // Resource loading timeout.
  pagelet.css = collection.array(data.css);     // CSS for the Page.
  pagelet.js = collection.array(data.js);       // Dependencies for the page.
  pagelet.append = data.append || false;        // Append content to the container.
  pagelet.loader = data.loader || '';           // Loading placeholder.
  pagelet.mode = data.mode;                     // Fragment rendering mode.
  pagelet.hash = data.hash;                     // MD5 of templates.
  pagelet.run = data.run;                       // Pagelet client code.
  pagelet.id = data.id;                         // ID of the pagelet.
  pagelet.data = state;                         // All the template state.
  pagelet.name = name;                          // Name of the pagelet.

  //
  // This pagelet was actually part of a parent pagelet, so set a reference to
  // the parent pagelet that was loaded.
  //
  var parent = pagelet.parent = data.parent ? bigpipe.get(data.parent) : void 0;

  //
  // Locate all the placeholders for this given pagelet.
  //
  pagelet.placeholders = pagelet.$('data-pagelet', name, roots);

  //
  // Destroy the pagelet as we've been given the remove flag.
  // However do not destroy assets as unauthorized pagelets won't register
  // assets in the first place and they might be used by other pagelets.
  //
  if (data.remove) return pagelet.destroy({
    assets: false,
    remove: true
  });

  //
  // If we don't have any loading placeholders we want to scan the current
  // placeholders for content and assume that this content should be used when
  // the pagelet is loading or re-loading content. This also needs to be done
  // BEFORE we render the template from the server or we will capture the wrong
  // piece of HTML.
  //
  if (!pagelet.loader) collection.each(pagelet.placeholders, function each(node) {
    if (pagelet.loader) return false;

    var html = (node.innerHTML || '').replace(/^\s+|\s+$/g, '');
    if (html.length) pagelet.loader = html;

    return !pagelet.loader;
  });

  async.each(this.css.concat(this.js), function download(url, next) {
    assets.add(url, next);
  }, function done(err) {
    if (err) return pagelet.initialized(), pagelet.broadcast('error', err);

    pagelet.broadcast('loaded');
    pagelet.render(pagelet.parse());

    //
    // All resources are loaded, but we have a parent element. When the parent
    // element renders it will most likely also nuke our placeholder references
    // preventing us from rendering updates again.
    //
    if (parent) parent.on('render', function render() {
      pagelet.placeholders = pagelet.$('data-pagelet', pagelet.name, parent.placeholders);
      pagelet.render(pagelet.parse() || pagelet.data);
    });

    pagelet.initialize();
  }, { context: bigpipe, timeout: this.timeout });

  pagelet.broadcast('configured', data);
};

/**
 * Get the template for a given type. We currently only support `client` and
 * `error` as types.
 *
 * @param {String} type Template type
 * @returns {Function}
 * @api private
 */
Pagelet.prototype.template = function template(type) {
  type = type || 'client';

  return this.bigpipe.templates[this.hash[type]];
};

/**
 * Get a pagelet loaded on the page.
 *
 * @param {String} name Name of the pagelet we need.
 * @returns {Pagelet|Undefined}
 */
Pagelet.prototype.pagelet = function pagelet(name) {
  return this.bigpipe.get(name, this.name);
};

/**
 * The Pagelet's resource has all been loaded.
 *
 * @api private
 */
Pagelet.prototype.initialize = function initialise() {
  this.broadcast('initialize');
  this.initialized();

  //
  // Only load the client code in a sandbox when it exists. There no point in
  // spinning up a sandbox if it does nothing
  //
  if (!this.code) return;
  this.sandbox(this.prepare(this.code));
};

/**
 * Broadcast an event that will be emitted on the pagelet and the page.
 *
 * @param {String} event The name of the event we should emit
 * @returns {Pagelet}
 * @api public
 */
Pagelet.prototype.broadcast = function broadcast(event) {
  var pagelet = this;

  /**
   * Broadcast the event with namespaced name.
   *
   * @param {String} name Event name.
   * @returns {Pagelet}
   * @api private
   */
  function shout(name) {
    pagelet.bigpipe.emit.apply(pagelet.bigpipe, [
      name.join(':'),
      pagelet
    ].concat(Array.prototype.slice.call(arguments, 1)));

    return pagelet;
  }

  EventEmitter.prototype.emit.apply(this, arguments);

  if (this.parent) shout([this.parent.name, this.name, event]);
  return shout([this.name, event]);
};

/**
 * Check if the event we're about to emit is a reserved event and should be
 * blocked.
 *
 * @param {String} event Name of the event we want to emit
 * @returns {Boolean}
 * @api public
 */
Pagelet.prototype.reserved = function reserved(event) {
  return event in this.reserved.events;
};

/**
 * The events that are used internally.
 *
 * @type {Object}
 * @api private
 */
Pagelet.prototype.reserved.events = {
  configured: 1,    // Pagelet has been configured.
  error: 1,         // Something when wrong in the Pagelet.
  loaded: 1,        // All assets has been loaded.
  submit: 1,        // We've submitted a form.
  initialize: 1,    // Pagelet has been fully initialized, ready to go.
  render: 1,        // Pagelet has rendered new HTML.
  destroy: 1        // Pagelet has been destroyed.
};

/**
 * Find the element based on the attribute and value.
 *
 * @param {String} attribute The name of the attribute we're searching.
 * @param {String} value The value that the attribute should equal to.
 * @param {Array} root Optional array of root elements.
 * @returns {Array} A list of HTML elements that match.
 * @api public
 */
Pagelet.prototype.$ = function $(attribute, value, roots) {
  var elements = [];

  collection.each(roots || [document], function each(root) {
    if ('querySelectorAll' in root) return Array.prototype.push.apply(
      elements,
      root.querySelectorAll('['+ attribute +'="'+ value +'"]')
    );

    //
    // No querySelectorAll support, so we're going to do a full DOM scan in
    // order to search for attributes.
    //
    for (var all = root.getElementsByTagName('*'), i = 0, l = all.length; i < l; i++) {
      if (value === all[i].getAttribute(attribute)) {
        elements.push(all[i]);
      }
    }
  });

  return elements;
};

/**
 * Invoke the correct render method for the pagelet.
 *
 * @param {String|Object} html The HTML or data that needs to be rendered.
 * @returns {Boolean} Successfully rendered a pagelet.
 * @api public
 */
Pagelet.prototype.render = function render(html) {
  if (!this.placeholders.length) return false;

  var mode = this.mode in this ? this[this.mode] : this.html
    , template = this.template('client');

  //
  // We have been given an object instead of pure HTML so we are going to make
  // the assumption that this is data for the client side template and render
  // that our selfs. If no HTML is supplied we're going to use the data that has
  // been send to the client
  //
  if (
       'function' === collection.type(template)
    && (
      'object' === collection.type(html)
      || undef === html && 'object' === collection.type(this.data)
      || html instanceof Error
    )) {
    try {
      if (html instanceof Error) throw html; // So it's captured an processed as error
      html = template(collection.copy(html || {}, this.data || {}));
    }
    catch (e) {
      html = this.template('error')(collection.copy(html || {}, this.data || {}, {
        reason: 'Failed to render: '+ this.name,
        message: e.message,
        stack: e.stack,
        error: e
      }));
    }
  }

  collection.each(this.placeholders, function each(root) {
    mode.call(this, root, html);
  }, this);

  //
  // Register the name of the rendered pagelet as child pagelets
  // might be waiting for it. The length of the collection
  // is also used to keep track of the number of rendered pagelets.
  //
  this.bigpipe.rendered.push(this.name);
  this.broadcast('render', html);

  return true;
};

/**
 * Render the fragment as HTML (default).
 *
 * @param {Element} root Container.
 * @param {String} content Fragment content.
 * @api public
 */
Pagelet.prototype.html = function html(root, content) {
  this.createElements(root, content);
};

/**
 * Create elements via a document fragment.
 *
 * @param {Element} root Container.
 * @param {String} content Fragment content.
 * @api private
 */
Pagelet.prototype.createElements = function createElements(root, content) {
  var fragment = document.createDocumentFragment()
    , div = document.createElement('div')
    , borked = this.bigpipe.IEV < 7;

  //
  // Clean out old HTML before we append our new HTML or we will get duplicate
  // DOM. Or there might have been a loading placeholder in place that needs
  // to be removed. If elements need to be appended only move the elements from
  // the root to the new fragment.
  //
  while (root.firstChild) {
    if (this.append) {
      fragment.appendChild(root.firstChild);
      continue;
    }

    root.removeChild(root.firstChild);
  }

  if (borked) root.appendChild(div);

  div.innerHTML = content;

  while (div.lastChild) {
    fragment.insertBefore(div.lastChild, fragment.firstChild);
  }

  root.appendChild(fragment);
  if (borked) root.removeChild(div);
};

/**
 * Parse the included template from the comment node so it can be injected in to
 * the page as initial rendered view.
 *
 * @returns {String} View.
 * @api private
 */
Pagelet.prototype.parse = function parse() {
  var node = this.$('data-pagelet-fragment', this.id)[0]
    , comment;

  //
  // The firstChild of the fragment should have been a HTML comment, this is to
  // prevent the browser from rendering and parsing the template.
  //
  if (!node.firstChild || node.firstChild.nodeType !== 8) return;

  comment = node.firstChild.nodeValue;

  return comment
    .substring(1, comment.length -1)
    .replace(/\\([\s\S]|$)/g, '$1');
};

/**
 * Set the pagelet in a loading state.
 *
 * @param {Boolean} unloading We're not loading, but unloading.
 * @returns {Pagelet}
 * @api public
 */
Pagelet.prototype.loading = function loading(unloading) {
  if (!unloading) this.render(
    'function' !== typeof this.loader
      ? this.loader || ''
      : this.loader()
  );

  collection.each(this.placeholders, !unloading ? function add(node) {
    var className = (node.className || '').split(' ');

    if (!~collection.index(className, 'loading')) {
      className.push('loading');
      node.className = className.join(' ');
    }

    node.style.cursor = 'wait';
  } : function remove(node) {
    var className = (node.className || '').split(' ')
      , index = collection.index(className, 'loading');

    if (~index) {
      className.splice(index, 1);
      node.className = className.join(' ');
    }

    node.style.cursor = '';
  });

  return this;
};

/**
 * Destroy the pagelet and clean up all references so it can be re-used again in
 * the future.
 *
 * Options:
 *
 * - assets: Also remove assets, true by default can be set to false to keep.
 * - remove: Remove the DOM node after deletion.
 *
 * @param {Object} options Destruction information.
 * @api public
 */
Pagelet.prototype.destroy = function destroy(options) {
  var pagelet = this;

  options = options || {};

  //
  // Execute any extra destroy hooks. This needs to be done before we remove any
  // elements or destroy anything as there might people subscribed to these
  // events.
  //
  this.initialized();
  this.broadcast('destroy', options);

  //
  // Remove all the HTML from the placeholders.
  //
  if (this.placeholders) collection.each(this.placeholders, function remove(root) {
    if (options.remove && root.parentNode) root.parentNode.removeChild(root);
    else while (root.firstChild) root.removeChild(root.firstChild);
  });

  //
  // Remove the sandboxing and prevent element leaking by deferencing them.
  //
  if (this.container) sandbox.kill(this.container.id);
  this.placeholders = this.container = null;

  //
  // Remove the CSS and JS assets.
  //
  if (options.assets !== false) {
    collection.each(this.css.concat(this.js), function remove(url) {
      assets.remove(url);
    });
  }

  //
  // Everything has been cleaned up, release it to our free list Pagelet pool.
  //
  this.bigpipe.free(this);

  return this;
};

//
// Expose the module.
//
module.exports = Pagelet;

},{"./async":1,"./collection":2,"async-asset":3,"eventemitter3":5,"fortress":6,"one-time":12,"parsifal":13}],15:[function(require,module,exports){

},{}],16:[function(require,module,exports){
/*!

 handlebars v3.0.2

Copyright (C) 2011-2014 by Yehuda Katz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

@license
*/
(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define(factory);
	else if(typeof exports === 'object')
		exports["Handlebars"] = factory();
	else
		root["Handlebars"] = factory();
})(this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {'use strict';

	var _interopRequireWildcard = __webpack_require__(6)['default'];

	exports.__esModule = true;
	/*global window */

	var _import = __webpack_require__(1);

	var base = _interopRequireWildcard(_import);

	// Each of these augment the Handlebars object. No need to setup here.
	// (This is done to easily share code between commonjs and browse envs)

	var _SafeString = __webpack_require__(2);

	var _SafeString2 = _interopRequireWildcard(_SafeString);

	var _Exception = __webpack_require__(3);

	var _Exception2 = _interopRequireWildcard(_Exception);

	var _import2 = __webpack_require__(4);

	var Utils = _interopRequireWildcard(_import2);

	var _import3 = __webpack_require__(5);

	var runtime = _interopRequireWildcard(_import3);

	// For compatibility and usage outside of module systems, make the Handlebars object a namespace
	function create() {
	  var hb = new base.HandlebarsEnvironment();

	  Utils.extend(hb, base);
	  hb.SafeString = _SafeString2['default'];
	  hb.Exception = _Exception2['default'];
	  hb.Utils = Utils;
	  hb.escapeExpression = Utils.escapeExpression;

	  hb.VM = runtime;
	  hb.template = function (spec) {
	    return runtime.template(spec, hb);
	  };

	  return hb;
	}

	var Handlebars = create();
	Handlebars.create = create;

	/*jshint -W040 */
	/* istanbul ignore next */
	var root = typeof global !== 'undefined' ? global : window,
	    $Handlebars = root.Handlebars;
	/* istanbul ignore next */
	Handlebars.noConflict = function () {
	  if (root.Handlebars === Handlebars) {
	    root.Handlebars = $Handlebars;
	  }
	};

	Handlebars['default'] = Handlebars;

	exports['default'] = Handlebars;
	module.exports = exports['default'];
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _interopRequireWildcard = __webpack_require__(6)['default'];

	exports.__esModule = true;
	exports.HandlebarsEnvironment = HandlebarsEnvironment;
	exports.createFrame = createFrame;

	var _import = __webpack_require__(4);

	var Utils = _interopRequireWildcard(_import);

	var _Exception = __webpack_require__(3);

	var _Exception2 = _interopRequireWildcard(_Exception);

	var VERSION = '3.0.1';
	exports.VERSION = VERSION;
	var COMPILER_REVISION = 6;

	exports.COMPILER_REVISION = COMPILER_REVISION;
	var REVISION_CHANGES = {
	  1: '<= 1.0.rc.2', // 1.0.rc.2 is actually rev2 but doesn't report it
	  2: '== 1.0.0-rc.3',
	  3: '== 1.0.0-rc.4',
	  4: '== 1.x.x',
	  5: '== 2.0.0-alpha.x',
	  6: '>= 2.0.0-beta.1'
	};

	exports.REVISION_CHANGES = REVISION_CHANGES;
	var isArray = Utils.isArray,
	    isFunction = Utils.isFunction,
	    toString = Utils.toString,
	    objectType = '[object Object]';

	function HandlebarsEnvironment(helpers, partials) {
	  this.helpers = helpers || {};
	  this.partials = partials || {};

	  registerDefaultHelpers(this);
	}

	HandlebarsEnvironment.prototype = {
	  constructor: HandlebarsEnvironment,

	  logger: logger,
	  log: log,

	  registerHelper: function registerHelper(name, fn) {
	    if (toString.call(name) === objectType) {
	      if (fn) {
	        throw new _Exception2['default']('Arg not supported with multiple helpers');
	      }
	      Utils.extend(this.helpers, name);
	    } else {
	      this.helpers[name] = fn;
	    }
	  },
	  unregisterHelper: function unregisterHelper(name) {
	    delete this.helpers[name];
	  },

	  registerPartial: function registerPartial(name, partial) {
	    if (toString.call(name) === objectType) {
	      Utils.extend(this.partials, name);
	    } else {
	      if (typeof partial === 'undefined') {
	        throw new _Exception2['default']('Attempting to register a partial as undefined');
	      }
	      this.partials[name] = partial;
	    }
	  },
	  unregisterPartial: function unregisterPartial(name) {
	    delete this.partials[name];
	  }
	};

	function registerDefaultHelpers(instance) {
	  instance.registerHelper('helperMissing', function () {
	    if (arguments.length === 1) {
	      // A missing field in a {{foo}} constuct.
	      return undefined;
	    } else {
	      // Someone is actually trying to call something, blow up.
	      throw new _Exception2['default']('Missing helper: "' + arguments[arguments.length - 1].name + '"');
	    }
	  });

	  instance.registerHelper('blockHelperMissing', function (context, options) {
	    var inverse = options.inverse,
	        fn = options.fn;

	    if (context === true) {
	      return fn(this);
	    } else if (context === false || context == null) {
	      return inverse(this);
	    } else if (isArray(context)) {
	      if (context.length > 0) {
	        if (options.ids) {
	          options.ids = [options.name];
	        }

	        return instance.helpers.each(context, options);
	      } else {
	        return inverse(this);
	      }
	    } else {
	      if (options.data && options.ids) {
	        var data = createFrame(options.data);
	        data.contextPath = Utils.appendContextPath(options.data.contextPath, options.name);
	        options = { data: data };
	      }

	      return fn(context, options);
	    }
	  });

	  instance.registerHelper('each', function (context, options) {
	    if (!options) {
	      throw new _Exception2['default']('Must pass iterator to #each');
	    }

	    var fn = options.fn,
	        inverse = options.inverse,
	        i = 0,
	        ret = '',
	        data = undefined,
	        contextPath = undefined;

	    if (options.data && options.ids) {
	      contextPath = Utils.appendContextPath(options.data.contextPath, options.ids[0]) + '.';
	    }

	    if (isFunction(context)) {
	      context = context.call(this);
	    }

	    if (options.data) {
	      data = createFrame(options.data);
	    }

	    function execIteration(field, index, last) {
	      if (data) {
	        data.key = field;
	        data.index = index;
	        data.first = index === 0;
	        data.last = !!last;

	        if (contextPath) {
	          data.contextPath = contextPath + field;
	        }
	      }

	      ret = ret + fn(context[field], {
	        data: data,
	        blockParams: Utils.blockParams([context[field], field], [contextPath + field, null])
	      });
	    }

	    if (context && typeof context === 'object') {
	      if (isArray(context)) {
	        for (var j = context.length; i < j; i++) {
	          execIteration(i, i, i === context.length - 1);
	        }
	      } else {
	        var priorKey = undefined;

	        for (var key in context) {
	          if (context.hasOwnProperty(key)) {
	            // We're running the iterations one step out of sync so we can detect
	            // the last iteration without have to scan the object twice and create
	            // an itermediate keys array.
	            if (priorKey) {
	              execIteration(priorKey, i - 1);
	            }
	            priorKey = key;
	            i++;
	          }
	        }
	        if (priorKey) {
	          execIteration(priorKey, i - 1, true);
	        }
	      }
	    }

	    if (i === 0) {
	      ret = inverse(this);
	    }

	    return ret;
	  });

	  instance.registerHelper('if', function (conditional, options) {
	    if (isFunction(conditional)) {
	      conditional = conditional.call(this);
	    }

	    // Default behavior is to render the positive path if the value is truthy and not empty.
	    // The `includeZero` option may be set to treat the condtional as purely not empty based on the
	    // behavior of isEmpty. Effectively this determines if 0 is handled by the positive path or negative.
	    if (!options.hash.includeZero && !conditional || Utils.isEmpty(conditional)) {
	      return options.inverse(this);
	    } else {
	      return options.fn(this);
	    }
	  });

	  instance.registerHelper('unless', function (conditional, options) {
	    return instance.helpers['if'].call(this, conditional, { fn: options.inverse, inverse: options.fn, hash: options.hash });
	  });

	  instance.registerHelper('with', function (context, options) {
	    if (isFunction(context)) {
	      context = context.call(this);
	    }

	    var fn = options.fn;

	    if (!Utils.isEmpty(context)) {
	      if (options.data && options.ids) {
	        var data = createFrame(options.data);
	        data.contextPath = Utils.appendContextPath(options.data.contextPath, options.ids[0]);
	        options = { data: data };
	      }

	      return fn(context, options);
	    } else {
	      return options.inverse(this);
	    }
	  });

	  instance.registerHelper('log', function (message, options) {
	    var level = options.data && options.data.level != null ? parseInt(options.data.level, 10) : 1;
	    instance.log(level, message);
	  });

	  instance.registerHelper('lookup', function (obj, field) {
	    return obj && obj[field];
	  });
	}

	var logger = {
	  methodMap: { 0: 'debug', 1: 'info', 2: 'warn', 3: 'error' },

	  // State enum
	  DEBUG: 0,
	  INFO: 1,
	  WARN: 2,
	  ERROR: 3,
	  level: 1,

	  // Can be overridden in the host environment
	  log: function log(level, message) {
	    if (typeof console !== 'undefined' && logger.level <= level) {
	      var method = logger.methodMap[level];
	      (console[method] || console.log).call(console, message); // eslint-disable-line no-console
	    }
	  }
	};

	exports.logger = logger;
	var log = logger.log;

	exports.log = log;

	function createFrame(object) {
	  var frame = Utils.extend({}, object);
	  frame._parent = object;
	  return frame;
	}

	/* [args, ]options */

/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	exports.__esModule = true;
	// Build out our basic SafeString type
	function SafeString(string) {
	  this.string = string;
	}

	SafeString.prototype.toString = SafeString.prototype.toHTML = function () {
	  return '' + this.string;
	};

	exports['default'] = SafeString;
	module.exports = exports['default'];

/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	exports.__esModule = true;

	var errorProps = ['description', 'fileName', 'lineNumber', 'message', 'name', 'number', 'stack'];

	function Exception(message, node) {
	  var loc = node && node.loc,
	      line = undefined,
	      column = undefined;
	  if (loc) {
	    line = loc.start.line;
	    column = loc.start.column;

	    message += ' - ' + line + ':' + column;
	  }

	  var tmp = Error.prototype.constructor.call(this, message);

	  // Unfortunately errors are not enumerable in Chrome (at least), so `for prop in tmp` doesn't work.
	  for (var idx = 0; idx < errorProps.length; idx++) {
	    this[errorProps[idx]] = tmp[errorProps[idx]];
	  }

	  if (Error.captureStackTrace) {
	    Error.captureStackTrace(this, Exception);
	  }

	  if (loc) {
	    this.lineNumber = line;
	    this.column = column;
	  }
	}

	Exception.prototype = new Error();

	exports['default'] = Exception;
	module.exports = exports['default'];

/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	exports.__esModule = true;
	exports.extend = extend;

	// Older IE versions do not directly support indexOf so we must implement our own, sadly.
	exports.indexOf = indexOf;
	exports.escapeExpression = escapeExpression;
	exports.isEmpty = isEmpty;
	exports.blockParams = blockParams;
	exports.appendContextPath = appendContextPath;
	/*jshint -W004 */
	var escape = {
	  '&': '&amp;',
	  '<': '&lt;',
	  '>': '&gt;',
	  '"': '&quot;',
	  '\'': '&#x27;',
	  '`': '&#x60;'
	};

	var badChars = /[&<>"'`]/g,
	    possible = /[&<>"'`]/;

	function escapeChar(chr) {
	  return escape[chr];
	}

	function extend(obj /* , ...source */) {
	  for (var i = 1; i < arguments.length; i++) {
	    for (var key in arguments[i]) {
	      if (Object.prototype.hasOwnProperty.call(arguments[i], key)) {
	        obj[key] = arguments[i][key];
	      }
	    }
	  }

	  return obj;
	}

	var toString = Object.prototype.toString;

	exports.toString = toString;
	// Sourced from lodash
	// https://github.com/bestiejs/lodash/blob/master/LICENSE.txt
	/*eslint-disable func-style, no-var */
	var isFunction = function isFunction(value) {
	  return typeof value === 'function';
	};
	// fallback for older versions of Chrome and Safari
	/* istanbul ignore next */
	if (isFunction(/x/)) {
	  exports.isFunction = isFunction = function (value) {
	    return typeof value === 'function' && toString.call(value) === '[object Function]';
	  };
	}
	var isFunction;
	exports.isFunction = isFunction;
	/*eslint-enable func-style, no-var */

	/* istanbul ignore next */
	var isArray = Array.isArray || function (value) {
	  return value && typeof value === 'object' ? toString.call(value) === '[object Array]' : false;
	};exports.isArray = isArray;

	function indexOf(array, value) {
	  for (var i = 0, len = array.length; i < len; i++) {
	    if (array[i] === value) {
	      return i;
	    }
	  }
	  return -1;
	}

	function escapeExpression(string) {
	  if (typeof string !== 'string') {
	    // don't escape SafeStrings, since they're already safe
	    if (string && string.toHTML) {
	      return string.toHTML();
	    } else if (string == null) {
	      return '';
	    } else if (!string) {
	      return string + '';
	    }

	    // Force a string conversion as this will be done by the append regardless and
	    // the regex test will do this transparently behind the scenes, causing issues if
	    // an object's to string has escaped characters in it.
	    string = '' + string;
	  }

	  if (!possible.test(string)) {
	    return string;
	  }
	  return string.replace(badChars, escapeChar);
	}

	function isEmpty(value) {
	  if (!value && value !== 0) {
	    return true;
	  } else if (isArray(value) && value.length === 0) {
	    return true;
	  } else {
	    return false;
	  }
	}

	function blockParams(params, ids) {
	  params.path = ids;
	  return params;
	}

	function appendContextPath(contextPath, id) {
	  return (contextPath ? contextPath + '.' : '') + id;
	}

/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _interopRequireWildcard = __webpack_require__(6)['default'];

	exports.__esModule = true;
	exports.checkRevision = checkRevision;

	// TODO: Remove this line and break up compilePartial

	exports.template = template;
	exports.wrapProgram = wrapProgram;
	exports.resolvePartial = resolvePartial;
	exports.invokePartial = invokePartial;
	exports.noop = noop;

	var _import = __webpack_require__(4);

	var Utils = _interopRequireWildcard(_import);

	var _Exception = __webpack_require__(3);

	var _Exception2 = _interopRequireWildcard(_Exception);

	var _COMPILER_REVISION$REVISION_CHANGES$createFrame = __webpack_require__(1);

	function checkRevision(compilerInfo) {
	  var compilerRevision = compilerInfo && compilerInfo[0] || 1,
	      currentRevision = _COMPILER_REVISION$REVISION_CHANGES$createFrame.COMPILER_REVISION;

	  if (compilerRevision !== currentRevision) {
	    if (compilerRevision < currentRevision) {
	      var runtimeVersions = _COMPILER_REVISION$REVISION_CHANGES$createFrame.REVISION_CHANGES[currentRevision],
	          compilerVersions = _COMPILER_REVISION$REVISION_CHANGES$createFrame.REVISION_CHANGES[compilerRevision];
	      throw new _Exception2['default']('Template was precompiled with an older version of Handlebars than the current runtime. ' + 'Please update your precompiler to a newer version (' + runtimeVersions + ') or downgrade your runtime to an older version (' + compilerVersions + ').');
	    } else {
	      // Use the embedded version info since the runtime doesn't know about this revision yet
	      throw new _Exception2['default']('Template was precompiled with a newer version of Handlebars than the current runtime. ' + 'Please update your runtime to a newer version (' + compilerInfo[1] + ').');
	    }
	  }
	}

	function template(templateSpec, env) {
	  /* istanbul ignore next */
	  if (!env) {
	    throw new _Exception2['default']('No environment passed to template');
	  }
	  if (!templateSpec || !templateSpec.main) {
	    throw new _Exception2['default']('Unknown template object: ' + typeof templateSpec);
	  }

	  // Note: Using env.VM references rather than local var references throughout this section to allow
	  // for external users to override these as psuedo-supported APIs.
	  env.VM.checkRevision(templateSpec.compiler);

	  function invokePartialWrapper(partial, context, options) {
	    if (options.hash) {
	      context = Utils.extend({}, context, options.hash);
	    }

	    partial = env.VM.resolvePartial.call(this, partial, context, options);
	    var result = env.VM.invokePartial.call(this, partial, context, options);

	    if (result == null && env.compile) {
	      options.partials[options.name] = env.compile(partial, templateSpec.compilerOptions, env);
	      result = options.partials[options.name](context, options);
	    }
	    if (result != null) {
	      if (options.indent) {
	        var lines = result.split('\n');
	        for (var i = 0, l = lines.length; i < l; i++) {
	          if (!lines[i] && i + 1 === l) {
	            break;
	          }

	          lines[i] = options.indent + lines[i];
	        }
	        result = lines.join('\n');
	      }
	      return result;
	    } else {
	      throw new _Exception2['default']('The partial ' + options.name + ' could not be compiled when running in runtime-only mode');
	    }
	  }

	  // Just add water
	  var container = {
	    strict: function strict(obj, name) {
	      if (!(name in obj)) {
	        throw new _Exception2['default']('"' + name + '" not defined in ' + obj);
	      }
	      return obj[name];
	    },
	    lookup: function lookup(depths, name) {
	      var len = depths.length;
	      for (var i = 0; i < len; i++) {
	        if (depths[i] && depths[i][name] != null) {
	          return depths[i][name];
	        }
	      }
	    },
	    lambda: function lambda(current, context) {
	      return typeof current === 'function' ? current.call(context) : current;
	    },

	    escapeExpression: Utils.escapeExpression,
	    invokePartial: invokePartialWrapper,

	    fn: function fn(i) {
	      return templateSpec[i];
	    },

	    programs: [],
	    program: function program(i, data, declaredBlockParams, blockParams, depths) {
	      var programWrapper = this.programs[i],
	          fn = this.fn(i);
	      if (data || depths || blockParams || declaredBlockParams) {
	        programWrapper = wrapProgram(this, i, fn, data, declaredBlockParams, blockParams, depths);
	      } else if (!programWrapper) {
	        programWrapper = this.programs[i] = wrapProgram(this, i, fn);
	      }
	      return programWrapper;
	    },

	    data: function data(value, depth) {
	      while (value && depth--) {
	        value = value._parent;
	      }
	      return value;
	    },
	    merge: function merge(param, common) {
	      var obj = param || common;

	      if (param && common && param !== common) {
	        obj = Utils.extend({}, common, param);
	      }

	      return obj;
	    },

	    noop: env.VM.noop,
	    compilerInfo: templateSpec.compiler
	  };

	  function ret(context) {
	    var options = arguments[1] === undefined ? {} : arguments[1];

	    var data = options.data;

	    ret._setup(options);
	    if (!options.partial && templateSpec.useData) {
	      data = initData(context, data);
	    }
	    var depths = undefined,
	        blockParams = templateSpec.useBlockParams ? [] : undefined;
	    if (templateSpec.useDepths) {
	      depths = options.depths ? [context].concat(options.depths) : [context];
	    }

	    return templateSpec.main.call(container, context, container.helpers, container.partials, data, blockParams, depths);
	  }
	  ret.isTop = true;

	  ret._setup = function (options) {
	    if (!options.partial) {
	      container.helpers = container.merge(options.helpers, env.helpers);

	      if (templateSpec.usePartial) {
	        container.partials = container.merge(options.partials, env.partials);
	      }
	    } else {
	      container.helpers = options.helpers;
	      container.partials = options.partials;
	    }
	  };

	  ret._child = function (i, data, blockParams, depths) {
	    if (templateSpec.useBlockParams && !blockParams) {
	      throw new _Exception2['default']('must pass block params');
	    }
	    if (templateSpec.useDepths && !depths) {
	      throw new _Exception2['default']('must pass parent depths');
	    }

	    return wrapProgram(container, i, templateSpec[i], data, 0, blockParams, depths);
	  };
	  return ret;
	}

	function wrapProgram(container, i, fn, data, declaredBlockParams, blockParams, depths) {
	  function prog(context) {
	    var options = arguments[1] === undefined ? {} : arguments[1];

	    return fn.call(container, context, container.helpers, container.partials, options.data || data, blockParams && [options.blockParams].concat(blockParams), depths && [context].concat(depths));
	  }
	  prog.program = i;
	  prog.depth = depths ? depths.length : 0;
	  prog.blockParams = declaredBlockParams || 0;
	  return prog;
	}

	function resolvePartial(partial, context, options) {
	  if (!partial) {
	    partial = options.partials[options.name];
	  } else if (!partial.call && !options.name) {
	    // This is a dynamic partial that returned a string
	    options.name = partial;
	    partial = options.partials[partial];
	  }
	  return partial;
	}

	function invokePartial(partial, context, options) {
	  options.partial = true;

	  if (partial === undefined) {
	    throw new _Exception2['default']('The partial ' + options.name + ' could not be found');
	  } else if (partial instanceof Function) {
	    return partial(context, options);
	  }
	}

	function noop() {
	  return '';
	}

	function initData(context, data) {
	  if (!data || !('root' in data)) {
	    data = data ? _COMPILER_REVISION$REVISION_CHANGES$createFrame.createFrame(data) : {};
	    data.root = context;
	  }
	  return data;
	}

/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	exports["default"] = function (obj) {
	  return obj && obj.__esModule ? obj : {
	    "default": obj
	  };
	};

	exports.__esModule = true;

/***/ }
/******/ ])
});
;
},{}],"bigpipe":[function(require,module,exports){
'use strict';

var EventEmitter = require('eventemitter3')
  , collection = require('./collection')
  , Pagelet = require('./pagelet')
  , destroy = require('demolish');

/**
 * BigPipe is the client-side library which is automatically added to pages which
 * uses the BigPipe framework.
 *
 * Options:
 *
 * - limit: The amount pagelet instances we can reuse.
 * - pagelets: The amount of pagelets we're expecting to load.
 * - id: The id of the page that we're loading.
 *
 * @constructor
 * @param {Object} options BigPipe configuration.
 * @api public
 */
function BigPipe(options) {
  if (!(this instanceof BigPipe)) return new BigPipe(options);

  options = options || {};

  this.expected = +options.pagelets || 0; // Pagelets that this page requires.
  this.allowed = +options.pagelets || 0;  // Pagelets that are allowed for this page.
  this.maximum = options.limit || 20;     // Max Pagelet instances we can reuse.
  this.readyState = BigPipe.LOADING;      // Current readyState.
  this.options = options;                 // Reference to the used options.
  this.templates = {};                    // Collection of templates.
  this.pagelets = [];                     // Collection of different pagelets.
  this.freelist = [];                     // Collection of unused Pagelet instances.
  this.rendered = [];                     // List of already rendered pagelets.
  this.progress = 0;                      // Percentage loaded.
  this.assets = {};                       // Asset cache.
  this.root = document.documentElement;   // The <html> element.

  EventEmitter.call(this);

  this.configure(options);
}

//
// Inherit from EventEmitter3, use old school inheritance because that's the way
// we roll. Oh and it works in every browser.
//
BigPipe.prototype = new EventEmitter();
BigPipe.prototype.constructor = BigPipe;

//
// The various of readyStates that our class can be in.
//
BigPipe.LOADING     = 1;    // Still loading pagelets.
BigPipe.INTERACTIVE = 2;    // All pagelets received, you can safely modify.
BigPipe.COMPLETE    = 3;    // All assets and pagelets loaded.

/**
 * The BigPipe plugins will contain all our plugins definitions.
 *
 * @type {Object}
 * @private
 */
BigPipe.prototype.plugins = {};

/**
 * Process a change in BigPipe.
 *
 * @param {Object} changed Data that is changed.
 * @returns {BigPipe}
 * @api private
 */
BigPipe.prototype.change = require('modification')(' changed');

/**
 * Configure the BigPipe.
 *
 * @param {Object} options Configuration.
 * @return {BigPipe}
 * @api private
 */
BigPipe.prototype.configure = function configure(options) {
  var bigpipe = this;

  //
  // Process the potential plugins.
  //
  for (var plugin in this.plugins) {
    this.plugins[plugin].call(this, this, options);
  }

  //
  // Setup our completion handler.
  //
  var remaining = this.expected;
  bigpipe.on('arrive', function arrived(name) {
    bigpipe.once(name +':initialized', function initialize() {
      if (!--remaining) {
        bigpipe.change({ readyState: BigPipe.COMPLETE });
      }
    });
  });

  return this;
};

/**
 * Horrible hack, but needed to prevent memory leaks caused by
 * `document.createDocumentFragment()` while maintaining sublime performance.
 *
 * @type {Number}
 * @private
 */
BigPipe.prototype.IEV = document.documentMode
  || +(/MSIE.(\d+)/.exec(navigator.userAgent) || [])[1];

/**
 * A new Pagelet is flushed by the server. We should register it and update the
 * content.
 *
 * @param {String} name The name of the pagelet.
 * @param {Object} data Pagelet data.
 * @param {Object} state Pagelet state
 * @returns {BigPipe}
 * @api public
 */
BigPipe.prototype.arrive = function arrive(name, data, state) {
  data = data || {};

  var index
    , bigpipe = this
    , parent = data.parent
    , remaining = data.remaining
    , rendered = bigpipe.rendered;

  bigpipe.progress = Math.round(((bigpipe.expected - remaining) / bigpipe.expected) * 100);
  bigpipe.emit('arrive', name, data, state);

  //
  // Create child pagelet after parent has finished rendering.
  //
  if (!bigpipe.has(name)) {
    if (parent !== 'bootstrap' && !~collection.index(bigpipe.rendered, parent)) {
      bigpipe.once(parent +':render', function render() {
        bigpipe.create(name, data, state, bigpipe.get(parent).placeholders);
      });
    } else {
      bigpipe.create(name, data, state);
    }
  }

  //
  // Keep track of how many pagelets have been fully initialized, e.g. assets
  // loaded and all rendering logic processed. Also count destroyed pagelets as
  // processed.
  //
  if (data.remove) bigpipe.allowed--;
  else bigpipe.once(name +':render', function finished() {
    if (rendered.length === bigpipe.allowed) return bigpipe.broadcast('finished');
  });

  //
  // Emit progress information about the amount of pagelet's that we've
  // received.
  //
  bigpipe.emit('progress', bigpipe.progress, remaining);

  //
  // Check if all pagelets have been received from the server.
  //
  if (remaining) return bigpipe;

  bigpipe.change({ readyState: BigPipe.INTERACTIVE });
  bigpipe.emit('received');

  return this;
};

/**
 * Create a new Pagelet instance.
 *
 * @param {String} name The name of the pagelet.
 * @param {Object} data Data for the pagelet.
 * @param {Object} state State for the pagelet.
 * @param {Array} roots Root elements we can search can search for.
 * @returns {BigPipe}
 * @api private
 */
BigPipe.prototype.create = function create(name, data, state, roots) {
  data = data || {};

  var bigpipe = this
    , pagelet = bigpipe.alloc();

  bigpipe.pagelets.push(pagelet);
  pagelet.configure(name, data, state, roots);

  //
  // A new pagelet has been loaded, emit a progress event.
  //
  bigpipe.emit('create', pagelet);
};

/**
 * Check if the pagelet has already been loaded.
 *
 * @param {String} name The name of the pagelet.
 * @returns {Boolean}
 * @api public
 */
BigPipe.prototype.has = function has(name) {
  return !!this.get(name);
};

/**
 * Get a pagelet that has already been loaded.
 *
 * @param {String} name The name of the pagelet.
 * @param {String} parent Optional name of the parent.
 * @returns {Pagelet|undefined} The found pagelet.
 * @api public
 */
BigPipe.prototype.get = function get(name, parent) {
  var found;

  collection.each(this.pagelets, function each(pagelet) {
    if (name === pagelet.name) {
      found = !parent || pagelet.parent && parent === pagelet.parent.name
        ? pagelet
        : found;
    }

    return !found;
  });

  return found;
};

/**
 * Remove the pagelet.
 *
 * @param {String} name The name of the pagelet that needs to be removed.
 * @returns {BigPipe}
 * @api public
 */
BigPipe.prototype.remove = function remove(name) {
  var pagelet = this.get(name)
    , index = collection.index(this.pagelets, pagelet);

  if (~index && pagelet) {
    this.emit('remove', pagelet);
    this.pagelets.splice(index, 1);
    pagelet.destroy();
  }

  return this;
};

/**
 * Broadcast an event to all connected pagelets.
 *
 * @param {String} event The event that needs to be broadcasted.
 * @returns {BigPipe}
 * @api public
 */
BigPipe.prototype.broadcast = function broadcast(event) {
  var args = arguments;

  collection.each(this.pagelets, function each(pagelet) {
    if (!pagelet.reserved(event)) {
      EventEmitter.prototype.emit.apply(pagelet, args);
    }
  });

  return this;
};

/**
 * Check if the event we're about to emit is a reserved event and should be
 * blocked.
 *
 * Assume that every <name>: prefixed event is internal and should not be
 * emitted by user code.
 *
 * @param {String} event Name of the event we want to emit
 * @returns {Boolean}
 * @api public
 */
BigPipe.prototype.reserved = function reserved(event) {
  return this.has(event.split(':')[0])
  || event in this.reserved.events;
};

/**
 * The actual reserved events.
 *
 * @type {Object}
 * @api private
 */
BigPipe.prototype.reserved.events = {
  remove: 1,    // Pagelet has been removed.
  received: 1,  // Pagelets have been received.
  finished: 1,  // Pagelets have been loaded, processed and rendered.
  progress: 1,  // Loaded a new Pagelet.
  create: 1     // Created a new Pagelet
};

/**
 * Allocate a new Pagelet instance, retrieve it from our pagelet cache if we
 * have free pagelets available in order to reduce garbage collection.
 *
 * @returns {Pagelet}
 * @api private
 */
BigPipe.prototype.alloc = function alloc() {
  return this.freelist.length
    ? this.freelist.shift()
    : new Pagelet(this);
};

/**
 * Free an allocated Pagelet instance which can be re-used again to reduce
 * garbage collection.
 *
 * @param {Pagelet} pagelet The pagelet instance.
 * @returns {Boolean}
 * @api private
 */
BigPipe.prototype.free = function free(pagelet) {
  if (this.freelist.length < this.maximum) {
    this.freelist.push(pagelet);
    return true;
  }

  return false;
};

/**
 * Check if we've probed the client for gzip support yet.
 *
 * @param {String} version Version number of the zipline we support.
 * @returns {Boolean}
 * @api public
 */
BigPipe.prototype.ziplined = function zipline(version) {
  if (~document.cookie.indexOf('zipline='+ version)) return true;

  try { if (sessionStorage.getItem('zipline') === version) return true; }
  catch (e) {}
  try { if (localStorage.getItem('zipline') === version) return true; }
  catch (e) {}

  var bigpipe = document.createElement('bigpipe')
    , iframe = document.createElement('iframe')
    , doc;

  bigpipe.style.display = 'none';
  iframe.frameBorder = 0;
  bigpipe.appendChild(iframe);
  this.root.appendChild(bigpipe);

  doc = iframe.contentWindow.document;
  doc.open().write('<body onload="' +
  'var d = document;d.getElementsByTagName(\'head\')[0].' +
  'appendChild(d.createElement(\'script\')).src' +
  '=\'\/zipline.js\'">');
  doc.close();

  return false;
};

/**
 * Completely destroy the BigPipe instance.
 *
 * @type {Function}
 * @returns {Boolean}
 * @api public
 */
BigPipe.prototype.destroy = destroy('options, templates, pagelets, freelist, rendered, assets, root', {
  before: function before() {
    var bigpipe = this;

    collection.each(bigpipe.pagelets, function remove(pagelet) {
      bigpipe.remove(pagelet.name);
    });
  },
  after: 'removeAllListeners'
});

//
// Expose the BigPipe client library and Pagelet constructor for easy extending.
//
BigPipe.Pagelet = Pagelet;
module.exports = BigPipe;

},{"./collection":2,"./pagelet":14,"demolish":4,"eventemitter3":5,"modification":11}]},{},[]);
