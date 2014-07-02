/**
 * Copyright 2014 Google, Inc. All Rights Reserved.
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

/**
 * @fileoverview Overdraw. Visualizer for overdraw.
 *
 * @author scotttodd@google.com (Scott Todd)
 */

goog.provide('wtf.replay.graphics.Overdraw');

goog.require('goog.events');
goog.require('goog.webgl');
goog.require('wtf.replay.graphics.DrawCallVisualizer');
goog.require('wtf.replay.graphics.OverdrawSurface');
goog.require('wtf.replay.graphics.Program');



/**
 * Visualizer for overdraw.
 *
 * @param {!wtf.replay.graphics.Playback} playback The playback instance.
 * @constructor
 * @extends {wtf.replay.graphics.DrawCallVisualizer}
 */
wtf.replay.graphics.Overdraw = function(playback) {
  goog.base(this, playback);

  /**
   * The index of the latest step that was visualized.
   * @type {number}
   * @private
   */
  this.latestStepIndex_ = -1;

  /**
   * The index of the latest substep that was visualized.
   * @type {number}
   * @private
   */
  this.latestSubStepIndex_ = -1;

  /**
   * Latest recorded overdraw ratios. Keys are context handles.
   * @type {!Object.<string>}
   * @private
   */
  this.latestOverdraws_ = {};

  /**
   * Toggled value, used when toggling overdraw for the same step and substep.
   * @type {boolean}
   * @private
   */
  this.visible_ = false;

  /**
   * The previous this.visible_ value, used for toggling for the same substep.
   * @type {boolean}
   * @private
   */
  this.previousVisibility_ = false;

  this.calls['WebGLRenderingContext#clear'] = function(
      visualizer, gl, args, callFunction) {
    if (!visualizer.active) {
      return;
    }

    callFunction();

    if (!visualizer.modifyDraws) {
      return;
    }

    var contextHandle = visualizer.latestContextHandle;
    var visualizerSurface = visualizer.visualizerSurfaces[contextHandle];
    var drawToSurfaceFunction = function() {
      visualizerSurface.drawQuad();
    };

    var webGLState = visualizer.webGLStates[contextHandle];
    webGLState.backup();

    // Force states to mimic clear behavior.
    gl.colorMask(true, true, true, true);
    gl.depthMask(false);
    gl.disable(goog.webgl.DEPTH_TEST);
    gl.disable(goog.webgl.CULL_FACE);
    gl.frontFace(goog.webgl.CCW);

    visualizer.drawToSurface_(drawToSurfaceFunction);

    webGLState.restore();
  };
};
goog.inherits(wtf.replay.graphics.Overdraw,
    wtf.replay.graphics.DrawCallVisualizer);


/**
 * Events related to this visualization.
 * @enum {string}
 */
wtf.replay.graphics.Overdraw.EventType = {
  /**
   * Visibility changed.
   */
  VISIBILITY_CHANGED: goog.events.getUniqueId('visibility_changed')
};


/**
 * Returns if this visualizer is visible.
 * @return {boolean} Whether this visualizer is visible.
 */
wtf.replay.graphics.Overdraw.prototype.isVisible = function() {
  return this.visible_;
};


/**
 * Creates an OverdrawSurface and adds it to this.visualizerSurfaces.
 * @param {!number|string} contextHandle Context handle from event arguments.
 * @param {!WebGLRenderingContext} gl The context.
 * @param {number} width The width of the surface.
 * @param {number} height The height of the surface.
 * @protected
 * @override
 */
wtf.replay.graphics.Overdraw.prototype.createSurface = function(
    contextHandle, gl, width, height) {
  var args = {};
  args['stencil'] = true;
  var visualizerSurface = new wtf.replay.graphics.OverdrawSurface(gl,
      width, height, args);
  this.visualizerSurfaces[contextHandle] = visualizerSurface;
  this.registerDisposable(visualizerSurface);
};


/**
 * Creates a Program object with a overdraw variant.
 * @param {number} programHandle Program handle from event arguments.
 * @param {!WebGLProgram} originalProgram The original program.
 * @param {!WebGLRenderingContext} gl The associated rendering context.
 * @protected
 * @override
 */
wtf.replay.graphics.Overdraw.prototype.createProgram = function(
    programHandle, originalProgram, gl) {
  var program = new wtf.replay.graphics.Program(originalProgram, gl);
  this.registerDisposable(program);
  this.programs[programHandle] = program;

  var visualizerSurface = this.visualizerSurfaces[this.latestContextHandle];

  var overdrawFragmentSource = 'precision mediump float;' +
      'void main(void) { gl_FragColor = ' +
      visualizerSurface.getThresholdDrawColor() + '; }';

  program.createVariantProgram('overdraw', '', overdrawFragmentSource);
};


/**
 * Handles special logic associated with performing a draw call.
 * @param {function()} drawFunction The draw function to call.
 * @protected
 * @override
 */
wtf.replay.graphics.Overdraw.prototype.handleDrawCall = function(
    drawFunction) {
  if (!this.active) {
    this.previousVisibility_ = false;
    return;
  }

  // Render normally to the active framebuffer.
  drawFunction();

  var contextHandle = this.latestContextHandle;
  var programHandle = this.latestProgramHandle;

  if (!this.modifyDraws || !contextHandle || !programHandle) {
    return;
  }

  var program = this.programs[programHandle];
  var drawToSurfaceFunction = function() {
    program.drawWithVariant(drawFunction, 'overdraw');
  };

  var webGLState = this.webGLStates[contextHandle];
  webGLState.backup();

  this.drawToSurface_(drawToSurfaceFunction);

  webGLState.restore();
};


/**
 * Calls drawFunction onto the active visualizerSurface using custom GL state.
 * The caller of this function is responsible for restoring state.
 * @param {!function()} drawFunction The draw function to call.
 * @private
 */
wtf.replay.graphics.Overdraw.prototype.drawToSurface_ = function(drawFunction) {
  var contextHandle = this.latestContextHandle;
  var gl = this.contexts[contextHandle];

  // Do not edit calls where the target is not the visible framebuffer.
  var originalFramebuffer = /** @type {WebGLFramebuffer} */ (
      gl.getParameter(goog.webgl.FRAMEBUFFER_BINDING));
  if (originalFramebuffer != null) {
    return;
  }

  var visualizerSurface = this.visualizerSurfaces[contextHandle];
  visualizerSurface.bindFramebuffer();

  gl.disable(goog.webgl.STENCIL_TEST);
  gl.enable(goog.webgl.BLEND);
  gl.blendFunc(goog.webgl.SRC_ALPHA, goog.webgl.ONE_MINUS_SRC_ALPHA);
  gl.blendEquation(goog.webgl.FUNC_ADD);
  gl.colorMask(true, true, true, true);

  drawFunction();
};


/**
 * Runs visualization, manipulating playback and surfaces as needed.
 * @param {Object.<string, !Object>=} opt_args Visualizer trigger arguments.
 * @override
 */
wtf.replay.graphics.Overdraw.prototype.trigger = function(opt_args) {
  var contextHandle = this.latestContextHandle;
  if (!contextHandle) {
    this.playback.finishVisualizer(this);
    return;
  }

  var currentStepIndex = this.playback.getCurrentStepIndex();
  var currentSubStepIndex = this.playback.getSubStepEventIndex();

  // If latest step and substep match current, toggle between views.
  if (currentStepIndex == this.latestStepIndex_ &&
      currentSubStepIndex == this.latestSubStepIndex_) {
    if (this.previousVisibility_) {
      this.restoreState();
      this.previousVisibility_ = false;
    } else {
      for (contextHandle in this.contexts) {
        this.drawOverdraw(this.visualizerSurfaces[contextHandle]);

        var overdrawAmount = this.latestOverdraws_[contextHandle];
        var message = 'Overdraw: ' + overdrawAmount;
        this.playback.changeContextMessage(contextHandle, message);
      }
      this.previousVisibility_ = true;
    }
    this.playback.finishVisualizer(this);
    return;
  }

  // Otherwise, clear surfaces, seek to the start of the step, and continue.
  this.reset();
  this.active = true;
  this.playback.seekStep(currentStepIndex);

  this.modifyDraws = true;
  this.playback.seekSubStepEvent(currentSubStepIndex);

  for (contextHandle in this.contexts) {
    var gl = this.contexts[contextHandle];
    var originalFramebuffer = /** @type {WebGLFramebuffer} */ (
        gl.getParameter(goog.webgl.FRAMEBUFFER_BINDING));
    gl.bindFramebuffer(goog.webgl.FRAMEBUFFER, null);

    this.playbackSurfaces[contextHandle].captureTexture();

    gl.bindFramebuffer(goog.webgl.FRAMEBUFFER, originalFramebuffer);
  }

  for (contextHandle in this.contexts) {
    // Draw without thresholding to calculate overdraw.
    this.visualizerSurfaces[contextHandle].drawTexture(false);

    // Calculate overdraw and update the context's message.
    var stats = this.visualizerSurfaces[contextHandle].calculateOverdraw();
    var overdrawAmount = stats['numOverdraw'] / stats['numPixels'];
    overdrawAmount = overdrawAmount.toFixed(2);
    this.latestOverdraws_[contextHandle] = overdrawAmount;
    var message = 'Overdraw: ' + overdrawAmount;
    this.playback.changeContextMessage(contextHandle, message);

    // Draw with thresholding for display.
    this.drawOverdraw(this.visualizerSurfaces[contextHandle]);

    this.visualizerSurfaces[contextHandle].disableResize();
    this.playbackSurfaces[contextHandle].disableResize();
  }

  this.latestStepIndex_ = currentStepIndex;
  this.latestSubStepIndex_ = currentSubStepIndex;
  this.previousVisibility_ = true;

  this.playback.finishVisualizer(this);
};


/**
 * Resets properties to a pre-visualization state.
 * @override
 */
wtf.replay.graphics.Overdraw.prototype.reset = function() {
  goog.base(this, 'reset');

  for (var handle in this.visualizerSurfaces) {
    this.visualizerSurfaces[handle].enableResize();
  }
  for (var handle in this.playbackSurfaces) {
    this.playbackSurfaces[handle].enableResize();
  }
};


/**
 * Draws the texture within surface, using overdraw settings.
 * @param {wtf.replay.graphics.OffscreenSurface} surface The surface to draw.
 */
wtf.replay.graphics.Overdraw.prototype.drawOverdraw = function(surface) {
  // Disable blending to overwrite the framebuffer.
  surface.drawOverdraw(false);
  this.visible_ = true;
  this.emitEvent(wtf.replay.graphics.Overdraw.EventType.VISIBILITY_CHANGED);
};


/**
 * Restores state back to standard playback.
 * @override
 */
wtf.replay.graphics.Overdraw.prototype.restoreState = function() {
  goog.base(this, 'restoreState');

  this.visible_ = false;
  this.emitEvent(wtf.replay.graphics.Overdraw.EventType.VISIBILITY_CHANGED);
};
