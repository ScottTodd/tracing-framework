/**
 * Copyright 2014 Google, Inc. All Rights Reserved.
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

/**
 * @fileoverview StateVisualizer. Visualizer for WebGL state.
 *
 * @author scotttodd@google.com (Scott Todd)
 */

goog.provide('wtf.replay.graphics.StateVisualizer');

goog.require('wtf.replay.graphics.Visualizer');
goog.require('wtf.replay.graphics.WebGLState');



/**
 * Visualizer for WebGL state.
 *
 * @param {!wtf.replay.graphics.Playback} playback The playback instance.
 * @constructor
 * @extends {wtf.replay.graphics.Visualizer}
 */
wtf.replay.graphics.StateVisualizer = function(playback) {
  goog.base(this, playback);

  /**
   * A mapping of handles to contexts.
   * Keys are context handles from event arguments.
   * @type {!Object.<!WebGLRenderingContext>}
   * @private
   */
  this.contexts_ = {};

  /**
   * WebGLStates for backup/restore, mapping of handles to WebGLStates.
   * Keys are context handles from event arguments.
   * @type {!Object.<!wtf.replay.graphics.WebGLState>}
   * @private
   */
  this.webGLStates_ = {};
};
goog.inherits(wtf.replay.graphics.StateVisualizer,
    wtf.replay.graphics.Visualizer);


/**
 * Adds mutators using registerMutator.
 * @protected
 * @override
 */
wtf.replay.graphics.StateVisualizer.prototype.setupMutators = function() {
  goog.base(this, 'setupMutators');

  this.registerMutator('wtf.webgl#setContext', {
    post: function(visualizer, gl, args) {
      // Track contexts and creates WebGLState objects.
      var contextHandle = args['handle'];

      if (!visualizer.contexts_[contextHandle]) {
        visualizer.contexts_[contextHandle] = gl;

        var webGLState = new wtf.replay.graphics.WebGLState(gl);
        visualizer.webGLStates_[contextHandle] = webGLState;
      }
    }
  });
};


/**
 * Runs this visualization on a substep of the current step.
 * @param {number=} opt_subStepIndex Target substep, or the current by default.
 * @override
 */
wtf.replay.graphics.StateVisualizer.prototype.applyToSubStep = function(
    opt_subStepIndex) {
  var playback = this.playback;
  var currentStepIndex = playback.getCurrentStepIndex();
  var currentSubStepIndex = playback.getSubStepEventIndex();
  var targetSubStepIndex = opt_subStepIndex || currentSubStepIndex;

  this.active = true;

  var currentStepIndex = this.playback.getCurrentStepIndex();
  this.playback.seekStep(0);
  this.playback.seekStep(currentStepIndex);
  this.playback.seekSubStepEvent(targetSubStepIndex);

  for (var contextHandle in this.webGLStates_) {
    this.webGLStates_[contextHandle].backup();
    this.webGLStates_[contextHandle].displayState();
  }

  this.latestStepIndex = currentStepIndex;
  this.latestSubStepIndex = currentSubStepIndex;
  this.latestTargetSubStepIndex = targetSubStepIndex;

  this.active = false;
};
