/**
 * Copyright 2014 Google, Inc. All Rights Reserved.
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

/**
 * @fileoverview Highlight. Visualizer for draw call highlighting.
 *
 * @author scotttodd@google.com (Scott Todd)
 */

// TODO(scotttodd): Create a Visualizer class that holds most of this logic.

goog.provide('wtf.replay.graphics.Highlight');

goog.require('goog.Disposable');
// goog.require('goog.asserts');
goog.require('goog.webgl');
goog.require('wtf.replay.graphics.IntermediateBuffer');
goog.require('wtf.replay.graphics.Program');
// goog.require('wtf.replay.graphics.WebGLState');



/**
 * Visualizer for draw call highlighting.
 *
 * @param {!wtf.replay.graphics.Playback} playback The playback instance.
 * @constructor
 * @extends {goog.Disposable}
 */
wtf.replay.graphics.Highlight = function(playback) {
  goog.base(this);

  /**
   * The playback instance. Manipulated when visualization is triggered.
   * @type {!wtf.replay.graphics.Playback}
   * @private
   */
  this.playback_ = playback;

  /**
   * A mapping of handles to contexts.
   * Keys are context handles from event arguments.
   * @type {!Object.<!WebGLRenderingContext>}
   * @private
   */
  this.contexts_ = {};

  /**
   * A mapping of handles to Programs.
   * Keys are program handles from event arguments.
   * @type {!Object.<!wtf.replay.graphics.Program>}
   * @private
   */
  this.programs_ = {};

  /**
   * Buffers for playback state, mapping of handles to IntermediateBuffers.
   * Keys are context handles from event arguments.
   * @type {!Object.<!wtf.replay.graphics.IntermediateBuffer>}
   * @private
   */
  this.playbackBuffers_ = {};

  /**
   * Buffers for highlighting, mapping of handles to IntermediateBuffers.
   * Keys are context handles from event arguments.
   * @type {!Object.<!wtf.replay.graphics.IntermediateBuffer>}
   * @private
   */
  this.highlightBuffers_ = {};
};
goog.inherits(wtf.replay.graphics.Highlight, goog.Disposable);


/**
 * @override
 */
wtf.replay.graphics.Highlight.prototype.disposeInternal = function() {
  // TODO(scotttodd): Add extra logic/deletions here?

  goog.base(this, 'disposeInternal');
};


/**
 * Track contexts, updating internal dimensions to match context parameters.
 * @param {!WebGLRenderingContext} gl The context.
 * @param {!number} contextHandle Context handle from event arguments.
 * @param {!number} width The width of the rendered area.
 * @param {!number} height The height of the rendered area.
 */
wtf.replay.graphics.Highlight.prototype.processSetContext = function(
    gl, contextHandle, width, height) {
  if (this.contexts_[contextHandle]) {
    this.playbackBuffers_[contextHandle].resize(width, height);
    this.highlightBuffers_[contextHandle].resize(width, height);
  } else {
    this.contexts_[contextHandle] = gl;

    var playbackBuffer = new wtf.replay.graphics.IntermediateBuffer(gl,
        width, height);
    this.playbackBuffers_[contextHandle] = playbackBuffer;
    this.registerDisposable(playbackBuffer);

    var highlightBuffer = new wtf.replay.graphics.IntermediateBuffer(gl,
        width, height);
    this.highlightBuffers_[contextHandle] = highlightBuffer;
    this.registerDisposable(highlightBuffer);
  }
};


/**
 * Create variant programs whenever a program is linked.
 * @param {!WebGLRenderingContext} gl The context for this program.
 * @param {!WebGLProgram} originalProgram The just linked program to mirror.
 * @param {!number} programHandle Program handle from event arguments.
 */
wtf.replay.graphics.Highlight.prototype.processLinkProgram = function(
    gl, originalProgram, programHandle) {
  // Programs can be linked multiple times. Avoid leaking objects.
  if (this.programs_[programHandle]) {
    this.deleteProgram(programHandle);
  }

  var program = new wtf.replay.graphics.Program(originalProgram, gl);
  this.programs_[programHandle] = program;

  var highlightFragmentSource = 'void main(void) { ' +
      'gl_FragColor = vec4(0.1, 0.1, 0.4, 1.0); }';
  program.createVariantProgram('highlight', '', highlightFragmentSource);
};


/**
 * Deletes the specified program.
 * @param {!number|string} programHandle Program handle from event arguments.
 */
wtf.replay.graphics.Highlight.prototype.deleteProgram = function(
    programHandle) {
  goog.dispose(this.programs_[programHandle]);
  delete this.programs_[programHandle];
};


/**
 * Handle any special logic associated with performing a draw call.
 * @param {?number} contextHandle Context handle from event arguments.
 * @param {!number} programHandle Program handle from event arguments.
 * @param {function()} drawFunction The draw function to call.
 */
wtf.replay.graphics.Highlight.prototype.processPerformDraw = function(
    contextHandle, programHandle, drawFunction) {
  if (!contextHandle) {
    return;
  }
  drawFunction();

  var gl = this.contexts_[contextHandle];

  var originalFramebuffer = /** @type {WebGLFramebuffer} */ (
      gl.getParameter(goog.webgl.FRAMEBUFFER_BINDING));

  // Change blend state? if yes, add backup/restore
  // gl.disable(goog.webgl.BLEND);
  // gl.disable(goog.webgl.CULL_FACE);
  // gl.frontFace(goog.webgl.CCW);
  // gl.disable(goog.webgl.DEPTH_TEST);
  // gl.disable(goog.webgl.DITHER);
  // gl.disable(goog.webgl.SCISSOR_TEST);
  // gl.disable(goog.webgl.STENCIL_TEST);
  // set clear color to transparent and clear?
  // gl.clear(goog.webgl.COLOR_BUFFER_BIT);

  var highlightBuffer = this.highlightBuffers_[contextHandle];
  highlightBuffer.bindFramebuffer();

  this.programs_[programHandle].drawWithVariant(drawFunction, 'highlight');

  gl.bindFramebuffer(goog.webgl.FRAMEBUFFER, originalFramebuffer);
};


/**
 * Run visualization, manipulating playback and buffers as needed.
 * @param {?number} contextHandle Context handle from event arguments.
 */
wtf.replay.graphics.Highlight.prototype.triggerVisualization = function(
    contextHandle) {
  if (!contextHandle) {
    return;
  }
  var playback = this.playback_;
  var highlightCallNumber = 51;

  var currentSubStepId = playback.getSubStepEventIndex();

  // Go to the previous substep event, displayed value is 1-indexed.
  playback.seekSubStepEvent(highlightCallNumber - 2);

  // Notify playback that we should be used for the next draw call.
  playback.setActiveVisualizer(this);
  // Advance to the highlight call and then return to regular playback.
  playback.seekSubStepEvent(highlightCallNumber - 1);
  playback.setActiveVisualizer(null);

  var highlightBuffer = this.highlightBuffers_[contextHandle];
  highlightBuffer.disableResize();
  playback.seekSubStepEvent(currentSubStepId);
  highlightBuffer.enableResize();

  var playbackBuffer = this.playbackBuffers_[contextHandle];
  playbackBuffer.captureTexture();
  playbackBuffer.disableResize();

  highlightBuffer.drawTexture(true);

  playback.setFinishedVisualizer(this);
};


/**
 * Finish a visualization, restoring state as needed.
 * @param {?number} contextHandle Context handle from event arguments.
 */
wtf.replay.graphics.Highlight.prototype.finishVisualization = function(
    contextHandle) {
  if (!contextHandle) {
    return;
  }
  var playbackBuffer = this.playbackBuffers_[contextHandle];
  playbackBuffer.drawTexture();
  playbackBuffer.enableResize();
};
