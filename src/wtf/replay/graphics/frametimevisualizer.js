/**
 * Copyright 2014 Google, Inc. All Rights Reserved.
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

/**
 * @fileoverview Records frame times during playback.
 *
 * @author scotttodd@google.com (Scott Todd)
 */

goog.provide('wtf.replay.graphics.FrameTimeVisualizer');

goog.require('goog.events');
goog.require('wtf.replay.graphics.Playback');
goog.require('wtf.replay.graphics.ReplayFrame');
goog.require('wtf.replay.graphics.Visualizer');



/**
 * Visualizer of time frames.
 *
 * @param {!wtf.replay.graphics.Playback} playback The playback instance.
 * @constructor
 * @extends {wtf.replay.graphics.Visualizer}
 */
wtf.replay.graphics.FrameTimeVisualizer = function(playback) {
  goog.base(this, playback);

  /**
   * The index of the latest step encountered.
   * @type {number}
   * @private
   */
  this.latestStepIndex_ = -1;

  /**
   * The id of the latest experiment.
   * Experiments are configurations of visualizer states which affect playback.
   * @type {number}
   * @private
   */
  this.latestExperimentId_ = 0;

  /**
   * Array of experiments containing arrays of frames recorded.
   * @type {!Array.<!Array.<!wtf.replay.graphics.ReplayFrame>>}
   * @private
   */
  this.frames_ = [];

  playback.addListener(wtf.replay.graphics.Playback.EventType.STEP_CHANGED,
      this.recordTimes_, this);

  playback.addListener(wtf.replay.graphics.Playback.EventType.PLAY_STOPPED,
      function() {
        var previousFrame = this.getPreviousFrame_();
        if (previousFrame) {
          previousFrame.cancelTiming();
        }
      }, this);

  /**
   * A mapping of handles to contexts.
   * Keys are context handles from event arguments.
   * @type {!Object.<!WebGLRenderingContext>}
   * @private
   */
  this.contexts_ = {};
};
goog.inherits(wtf.replay.graphics.FrameTimeVisualizer,
    wtf.replay.graphics.Visualizer);


/**
 * Events related to this Visualizer.
 * @enum {string}
 */
wtf.replay.graphics.FrameTimeVisualizer.EventType = {
  /**
   * Frame times changed.
   */
  FRAMES_UPDATED: goog.events.getUniqueId('frames_updated')
};


/**
 * Adds mutators using registerMutator.
 * @protected
 * @override
 */
wtf.replay.graphics.FrameTimeVisualizer.prototype.setupMutators = function() {
  goog.base(this, 'setupMutators');

  this.registerMutator('wtf.webgl#setContext', {
    post: function(visualizer, gl, args) {
      var contextHandle = args['handle'];
      if (!visualizer.contexts_[contextHandle]) {
        visualizer.contexts_[contextHandle] = gl;
      }
    }
  });
};


/**
 * Gets all frames.
 * @param {number} experimentId The experiment id.
 * @return {!Array.<!wtf.replay.graphics.ReplayFrame>} The recorded frames.
 */
wtf.replay.graphics.FrameTimeVisualizer.prototype.getFrames = function(
    experimentId) {
  return this.frames_[experimentId] || [];
};


/**
 * Gets a specific frame.
 * @param {number} experimentId The experiment id.
 * @param {number} number The frame number.
 * @return {wtf.replay.graphics.ReplayFrame} The requested frame, if it exists.
 */
wtf.replay.graphics.FrameTimeVisualizer.prototype.getFrame = function(
    experimentId, number) {
  if (!this.frames_[experimentId]) {
    return null;
  }
  return this.frames_[experimentId][number] || null;
};


/**
 * Gets the current Frame object, creating a new Frame if needed.
 * @return {!wtf.replay.graphics.ReplayFrame} The current frame.
 * @private
 */
wtf.replay.graphics.FrameTimeVisualizer.prototype.getCurrentFrame_ =
    function() {
  var experimentId = this.latestExperimentId_;
  var currentStepIndex = this.playback.getCurrentStepIndex();
  if (!this.frames_[experimentId]) {
    this.frames_[experimentId] = [];
  }
  if (!this.frames_[experimentId][currentStepIndex]) {
    this.frames_[experimentId][currentStepIndex] =
        new wtf.replay.graphics.ReplayFrame(currentStepIndex);
  }
  return this.frames_[experimentId][currentStepIndex];
};


/**
 * Gets the previous frame.
 * @return {!wtf.replay.graphics.ReplayFrame} The previous frame.
 * @private
 */
wtf.replay.graphics.FrameTimeVisualizer.prototype.getPreviousFrame_ =
    function() {
  if (!this.frames_[this.latestExperimentId_]) {
    this.frames_[this.latestExperimentId_] = [];
  }
  return this.frames_[this.latestExperimentId_][this.latestStepIndex_];
};


/**
 * Updates the latest step index to match playback's current step index.
 * @private
 */
wtf.replay.graphics.FrameTimeVisualizer.prototype.updateStepIndex_ =
    function() {
  var currentStepIndex = this.playback.getCurrentStepIndex();
  this.latestStepIndex_ = currentStepIndex;
};


/**
 * Records frame times. Call when the step changes.
 * @private
 */
wtf.replay.graphics.FrameTimeVisualizer.prototype.recordTimes_ = function() {
  if (this.playback.isPlaying()) {
    // Finish rendering in all contexts.
    for (var contextHandle in this.contexts_) {
      this.contexts_[contextHandle].finish();
    }

    // Record the end time for the previous step.
    var previousFrame = this.getPreviousFrame_();
    if (previousFrame) {
      previousFrame.stopTiming();
    }

    var currentFrame = this.getCurrentFrame_();
    currentFrame.startTiming();

    this.emitEvent(
        wtf.replay.graphics.FrameTimeVisualizer.EventType.FRAMES_UPDATED);
  }

  this.updateStepIndex_();
};
