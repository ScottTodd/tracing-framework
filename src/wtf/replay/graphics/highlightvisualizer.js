/**
 * Copyright 2014 Google, Inc. All Rights Reserved.
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

/**
 * @fileoverview HighlightVisualizer. Visualizer for draw call highlighting.
 *
 * @author scotttodd@google.com (Scott Todd)
 */

goog.provide('wtf.replay.graphics.HighlightVisualizer');

goog.require('goog.webgl');
goog.require('wtf.replay.graphics.DrawCallVisualizer');
goog.require('wtf.replay.graphics.OverdrawSurface');
goog.require('wtf.replay.graphics.Program');



/**
 * Visualizer for draw call highlighting.
 *
 * @param {!wtf.replay.graphics.Playback} playback The playback instance.
 * @constructor
 * @extends {wtf.replay.graphics.DrawCallVisualizer}
 */
wtf.replay.graphics.HighlightVisualizer = function(playback) {
  goog.base(this, playback);

  /**
   * If true, setup the stencil buffer for later draws to reference.
   * @type {boolean}
   * @private
   */
  this.firstDraw_ = true;

  this.mutators['WebGLRenderingContext#clear'] = /** @type
    {wtf.replay.graphics.Visualizer.Mutator} */ ({
        post: function(visualizer, gl, args) {
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
          // Let drawToSurface handle stencil for highlighting.
          gl.colorMask(true, true, true, true);
          gl.depthMask(false);
          gl.disable(goog.webgl.DEPTH_TEST);
          gl.disable(goog.webgl.CULL_FACE);
          gl.frontFace(goog.webgl.CCW);

          visualizer.drawToSurface_(drawToSurfaceFunction);

          webGLState.restore();
        }
      });
};
goog.inherits(wtf.replay.graphics.HighlightVisualizer,
    wtf.replay.graphics.DrawCallVisualizer);


/**
 * Creates an OverdrawSurface and adds it to this.visualizerSurfaces.
 * @param {number|string} contextHandle Context handle from event arguments.
 * @param {!WebGLRenderingContext} gl The context.
 * @param {number} width The width of the surface.
 * @param {number} height The height of the surface.
 * @protected
 * @override
 */
wtf.replay.graphics.HighlightVisualizer.prototype.createSurface = function(
    contextHandle, gl, width, height) {
  var visualizerSurface = new wtf.replay.graphics.OverdrawSurface(gl,
      width, height, {stencil: true});
  this.visualizerSurfaces[contextHandle] = visualizerSurface;
  this.registerDisposable(visualizerSurface);
};


/**
 * Creates a Program object with a highlight variant.
 * @param {number} programHandle Program handle from event arguments.
 * @param {!WebGLProgram} originalProgram The original program.
 * @param {!WebGLRenderingContext} gl The associated rendering context.
 * @protected
 * @override
 */
wtf.replay.graphics.HighlightVisualizer.prototype.createProgram = function(
    programHandle, originalProgram, gl) {
  var program = new wtf.replay.graphics.Program(originalProgram, gl);
  this.registerDisposable(program);
  this.programs[programHandle] = program;

  var visualizerSurface = this.visualizerSurfaces[this.latestContextHandle];

  var highlightFragmentSource = 'precision mediump float;' +
      'void main(void) { gl_FragColor = ' +
      visualizerSurface.getThresholdDrawColor() + '; }';

  program.createVariantProgram('highlight', '', highlightFragmentSource);
};


/**
 * Handles special logic associated with performing a draw call.
 * @param {function()} drawFunction The draw function to call.
 * @protected
 * @override
 */
wtf.replay.graphics.HighlightVisualizer.prototype.handleDrawCall = function(
    drawFunction) {
  var contextHandle = this.latestContextHandle;
  var programHandle = this.latestProgramHandle;

  if (!this.modifyDraws || !contextHandle || !programHandle) {
    return;
  }

  var program = this.programs[programHandle];
  var drawToSurfaceFunction = function() {
    program.drawWithVariant(drawFunction, 'highlight');
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
wtf.replay.graphics.HighlightVisualizer.prototype.drawToSurface_ = function(
    drawFunction) {
  var contextHandle = this.latestContextHandle;
  var gl = this.contexts[contextHandle];

  // Do not edit calls where the target is not the visible framebuffer.
  var originalFramebuffer = /** @type {WebGLFramebuffer} */ (
      gl.getParameter(goog.webgl.FRAMEBUFFER_BINDING));
  if (originalFramebuffer != null) {
    return;
  }

  // Render with the highlight program into the visualizer surface.
  var visualizerSurface = this.visualizerSurfaces[contextHandle];
  visualizerSurface.bindFramebuffer();

  gl.enable(goog.webgl.BLEND);
  gl.blendFunc(goog.webgl.SRC_ALPHA, goog.webgl.ONE_MINUS_SRC_ALPHA);
  gl.blendEquation(goog.webgl.FUNC_ADD);
  gl.enable(goog.webgl.STENCIL_TEST);
  if (this.firstDraw_) {
    gl.colorMask(true, true, true, true);
    gl.disable(goog.webgl.DEPTH_TEST);
    gl.disable(goog.webgl.CULL_FACE);
    // The stencil should already be cleared to all 0s.
    // Draw 1s into the stencil for the highlighted call.
    gl.stencilMask(0xff); // Allow writing to all bits in the buffer.
    gl.stencilFunc(goog.webgl.ALWAYS, 1, 0xff); // Always write 1.
    // Keep 0 on failure, replace with 1 on depth and stencil test success.
    gl.stencilOp(goog.webgl.KEEP, goog.webgl.KEEP, goog.webgl.REPLACE);
  } else {
    // Only draw where the stencil has a value of 1.
    gl.stencilFunc(goog.webgl.EQUAL, 1, 0xff);
    // Keep stencil buffer values no matter the test status.
    gl.stencilOp(goog.webgl.KEEP, goog.webgl.KEEP, goog.webgl.KEEP);
  }

  drawFunction();
};


/**
 * Runs visualization, manipulating playback and surfaces as needed.
 * @param {Object.<string, !Object>=} opt_args Visualizer trigger arguments.
 * @override
 */
wtf.replay.graphics.HighlightVisualizer.prototype.trigger = function(opt_args) {
  var index = Number(opt_args['index']);

  if (this.completed) {
    this.restoreState();
  }
  this.active = true;


  var playback = this.playback;
  var currentStepIndex = playback.getCurrentStepIndex();
  var currentSubStepIndex = playback.getSubStepEventIndex();
  // Seek from the start to the current step to update all internal state.
  playback.seekStep(0);
  playback.seekStep(currentStepIndex);

  this.setupSurfaces();

  // Seek to the substep event immediately before the target index.
  playback.seekSubStepEvent(index - 1);

  var contextHandle = this.latestContextHandle;
  if (!contextHandle) {
    this.completed = true;
    return;
  }

  this.modifyDraws = true;
  // Perform the call at the target index.
  this.firstDraw_ = true;
  playback.seekSubStepEvent(index);
  this.firstDraw_ = false;

  // If playback continues forward from here, continue modifying draw calls.
  // Otherwise, seek will go from the beginning, so do not modify draw calls.
  if (currentSubStepIndex <= index) {
    this.modifyDraws = false;
  }

  // Prevent resizing during seek, since that would destroy surface contents.
  for (contextHandle in this.contexts) {
    this.visualizerSurfaces[contextHandle].disableResize();
  }
  playback.seekSubStepEvent(currentSubStepIndex);
  this.modifyDraws = false;

  // Save current framebuffers as textures to restore when finished.
  for (contextHandle in this.contexts) {
    this.playbackSurfaces[contextHandle].captureTexture();
  }

  // Draw captured visualizer textures.
  for (contextHandle in this.contexts) {
    // Draw without thresholding to calculate overdraw.
    this.visualizerSurfaces[contextHandle].drawTexture(false);

    // Calculate overdraw and update the context's message.
    var stats = this.visualizerSurfaces[contextHandle].calculateOverdraw();
    if (stats) {
      var overdrawAmount;
      if (stats.numAffected < 0.001) {
        overdrawAmount = 0;
      } else {
        overdrawAmount = (stats.numOverdraw / stats.numAffected).toFixed(2);
      }

      var affectedPercent = stats.numAffected / stats.numPixels;
      affectedPercent = (affectedPercent * 100.0).toFixed(0);

      var message = 'Overdraw: ' + overdrawAmount + ', ' + affectedPercent +
          '% of screen';
      this.playback.changeContextMessage(contextHandle, message);
    }

    this.playbackSurfaces[contextHandle].drawTexture(false);
    // Draw for display, with thresholding and blending (to not overwrite).
    this.visualizerSurfaces[contextHandle].drawOverdraw(true);
    this.visualizerSurfaces[contextHandle].enableResize();
  }

  this.completed = true;
};