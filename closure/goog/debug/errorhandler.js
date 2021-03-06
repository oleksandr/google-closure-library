// Copyright 2007 The Closure Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Error handling utilities.
 *
*
 */

goog.provide('goog.debug.ErrorHandler');

goog.require('goog.debug');
goog.require('goog.debug.EntryPointMonitor');
goog.require('goog.debug.Trace');



/**
 * The ErrorHandler can be used to to wrap functions with a try/catch
 * statement. If an exception is thrown, the given error handler function will
 * be called.
 *
 * @param {Function} handler Handler for exceptions.
 * @constructor
 * @implements {goog.debug.EntryPointMonitor}
 */
goog.debug.ErrorHandler = function(handler) {
  /**
   * Handler for exceptions, which can do logging, reporting, etc.
   * @type {Function}
   * @private
   */
  this.errorHandlerFn_ = handler;
};


/**
 * Whether to add tracers when instrumenting entry points.
 * @type {boolean}
 * @private
 */
goog.debug.ErrorHandler.prototype.addTracersToProtectedFunctions_ = false;


/**
 * Enable tracers when instrumenting entry points.
 * @param {boolean} newVal See above.
 */
goog.debug.ErrorHandler.prototype.setAddTracersToProtectedFunctions =
    function(newVal) {
  this.addTracersToProtectedFunctions_ = newVal;
};


/** @override */
goog.debug.ErrorHandler.prototype.wrap = function(fn) {
  return this.protectEntryPoint(fn);
};


/**
 * Private helper function to return a span that can be clicked on to display
 * an alert with the current stack trace. Newlines are replaced with a
 * placeholder so that they will not be html-escaped.
 * @param {string} stackTrace The stack trace to create a span for.
 * @return {string} A span which can be clicked on to show the stack trace.
 * @private
 */
goog.debug.ErrorHandler.prototype.getStackTraceHolder_ = function(stackTrace) {
  var buffer = [];
  buffer.push('##PE_STACK_START##');
  buffer.push(stackTrace.replace(/(\r\n|\r|\n)/g, '##STACK_BR##'));
  buffer.push('##PE_STACK_END##');
  return buffer.join('');
};


/**
 * Installs exception protection for an entry point function. When an exception
 * is thrown from a protected function, a handler will be invoked to handle it.
 *
 * @param {Function} fn An entry point function to be protected.
 * @return {!Function} A protected wrapper function that calls the entry point
 *     function.
 */
goog.debug.ErrorHandler.prototype.protectEntryPoint = function(fn) {
  var protectedFnName =
      '__protected_' + goog.getUid(this) + '_' +
      this.addTracersToProtectedFunctions_ + '__';
  if (!fn[protectedFnName]) {
    fn[protectedFnName] = this.getProtectedFunction(fn);
  }
  return fn[protectedFnName];
};


/**
 * Helps {@link #protectEntryPoint} by actually creating the protected
 * wrapper function, after {@link #protectEntryPoint} determines that one does
 * not already exist for the given function.  Can be overriden by subclasses
 * that may want to implement different error handling, or add additional
 * entry point hooks.
 * @param {Function} fn An entry point function to be protected.
 * @return {!Function} protected wrapper function.
 * @protected
 */
goog.debug.ErrorHandler.prototype.getProtectedFunction = function(fn) {
  var that = this;
  var tracers = this.addTracersToProtectedFunctions_;
  if (tracers) {
    var stackTrace = goog.debug.getStacktraceSimple(15);
  }
  return function() {
    if (tracers) {
      var tracer = goog.debug.Trace.startTracer('protectedEntryPoint: ' +
        that.getStackTraceHolder_(stackTrace));
    }
    try {
      return fn.apply(this, arguments);
    } catch (e) {
      that.errorHandlerFn_(e);
      throw e;  // Re-throw it since this may be expected by the caller.
    } finally {
      if (tracers) {
        goog.debug.Trace.stopTracer(tracer);
      }
    }
  };
};


/**
 * Installs exception protection for window.setTimeout to handle exceptions.
 */
goog.debug.ErrorHandler.prototype.protectWindowSetTimeout =
    function() {
  var win = goog.getObjectByName('window');
  var originalSetTimeout = win.setTimeout;
  var that = this;
  win.setTimeout = function(fn, time) {
    // IE doesn't support .call for setTimeout, but it also doesn't care
    // what "this" is, so we can just call the original function directly
    fn = that.protectEntryPoint(fn);
    if (originalSetTimeout.call) {
      return originalSetTimeout.call(this, fn, time);
    } else {
      return originalSetTimeout(fn, time);
    }
  };
};


/**
 * Install exception protection for window.setInterval to handle exceptions.
 */
goog.debug.ErrorHandler.prototype.protectWindowSetInterval =
    function() {
  var win = goog.getObjectByName('window');
  var originalSetInterval = win.setInterval;
  var that = this;
  win.setInterval = function(fn, time) {
    // IE doesn't support .call for setInterval, but it also doesn't care
    // what "this" is, so we can just call the original function directly
    fn = that.protectEntryPoint(fn);
    if (originalSetInterval.call) {
      return originalSetInterval.call(this, fn, time);
    } else {
      return originalSetInterval(fn, time);
    }
  };
};
