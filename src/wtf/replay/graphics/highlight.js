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

// TODO(scotttodd): Create a Visualizer class that defines an interface and
//                  implements common logic.

goog.provide('wtf.replay.graphics.Highlight');

goog.require('goog.Disposable');
goog.require('goog.webgl');
goog.require('wtf.replay.graphics.IntermediateBuffer');
goog.require('wtf.replay.graphics.Program');
goog.require('wtf.replay.graphics.WebGLState');



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

  /**
   * WebGLStates for backup/restore, mapping of handles to WebGLStates.
   * Keys are context handles from event arguments.
   * @type {!Object.<!wtf.replay.graphics.WebGLState>}
   * @private
   */
  this.webGLStates_ = {};

  /**
   * If true, render draw calls using an alternate color and blending.
   * @type {!boolean}
   * @private
   */
  this.secondaryHighlight_ = false;
};
goog.inherits(wtf.replay.graphics.Highlight, goog.Disposable);


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

    var webGLState = new wtf.replay.graphics.WebGLState(gl);
    this.webGLStates_[contextHandle] = webGLState;
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

  // TODO(scotttodd): Avoid name collision with vertex shader?
  var highlightFragmentSource = 'precision mediump float;' +
      'uniform vec4 highlightColor;' +
      'void main(void) { gl_FragColor = highlightColor; }';
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
  // Render normally to the active framebuffer.
  drawFunction();

  var gl = this.contexts_[contextHandle];

  var webGLState = this.webGLStates_[contextHandle];
  webGLState.backup();

  // Set state for highlight drawing.
  gl.disable(goog.webgl.DEPTH_TEST);

  // Render with the highlight program into the highlight buffer.
  var highlightBuffer = this.highlightBuffers_[contextHandle];
  highlightBuffer.bindFramebuffer();
  var program = this.programs_[programHandle];

  var originalProgram = /** @type {!WebGLProgram} */ (
      gl.getParameter(goog.webgl.CURRENT_PROGRAM));
  var hightlightVariantProgram = program.getVariantProgram('highlight');

  gl.useProgram(hightlightVariantProgram);
  var uniformLocation = gl.getUniformLocation(hightlightVariantProgram,
      'highlightColor');
  var highlightColor = [0.1, 0.2, 0.5, 1.0];
  if (this.secondaryHighlight_) {
    highlightColor = [0.05, 0.15, 0.05, 1.0];

    gl.enable(goog.webgl.BLEND);
    gl.blendEquation(goog.webgl.FUNC_ADD);
    gl.blendFunc(goog.webgl.DST_ALPHA, goog.webgl.ONE);
  }
  gl.uniform4fv(uniformLocation, highlightColor);
  gl.useProgram(originalProgram);

  program.drawWithVariant(drawFunction, 'highlight');

  webGLState.restore();
};


/**
 * Run visualization, manipulating playback and buffers as needed.
 * @param {?number} contextHandle Context handle from event arguments.
 * @param {!number} index The substep index to highlight.
 */
wtf.replay.graphics.Highlight.prototype.triggerVisualization = function(
    contextHandle, index) {
  if (!contextHandle) {
    return;
  }
  this.finishVisualization(contextHandle);

  var playback = this.playback_;

  var currentSubStepId = playback.getSubStepEventIndex();

  // Seek to the substep event immediately before the target index.
  playback.seekSubStepEvent(index - 1);

  var playbackBuffer = this.playbackBuffers_[contextHandle];
  // Notify playback that we should be used for the next draw call.
  playback.setActiveVisualizer(this);
  // Advance to the highlight call and then return to regular playback.
  playback.seekSubStepEvent(index);

  // If playback continues forward from here, continue drawing using
  // a secondary highlight. Otherwise, stop drawing.
  if (currentSubStepId > index) {
    this.secondaryHighlight_ = true;
  } else {
    playback.setActiveVisualizer(null);
  }

  // Prevent resizing during seek, since that would destroy buffer contents.
  var highlightBuffer = this.highlightBuffers_[contextHandle];
  highlightBuffer.disableResize();
  playback.seekSubStepEvent(currentSubStepId);
  highlightBuffer.enableResize();

  // Save the current framebuffer as a texture to restore when finished.
  playbackBuffer.captureTexture();

  // Draw the captured highlight texture.
  // Enable blending to not overwrite the rest of the framebuffer.
  highlightBuffer.drawTexture(true);

  playback.setActiveVisualizer(null);
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
  var highlightBuffer = this.highlightBuffers_[contextHandle];
  highlightBuffer.clear();

  var playbackBuffer = this.playbackBuffers_[contextHandle];
  playbackBuffer.drawTexture();

  this.secondaryHighlight_ = false;
};
