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
   * The hash of the latest experiment.
   * Experiments are configurations of visualizer states which affect playback.
   * @type {string}
   * @private
   */
  this.latestExperimentHash_ = playback.getVisualizerStateHash();

  /**
   * Array of experiments containing arrays of frames recorded.
   * @type {!Array.<!Array.<!wtf.replay.graphics.ReplayFrame>>}
   * @private
   */
  this.frames_ = [];

  /**
   * Collection of experiments. Each experiment is an array of frames recorded.
   * Keys are visualizer state hashes, compiled from all active visualizers.
   * @type {!Object.<!Array.<!wtf.replay.graphics.ReplayFrame>>}
   * @private
   */
  this.experiments_ = {};

  playback.addListener(wtf.replay.graphics.Playback.EventType.STEP_STARTED,
      this.recordStart_, this);

  playback.addListener(wtf.replay.graphics.Playback.EventType.STEP_CHANGED,
      this.recordStop_, this);

  playback.addListener(wtf.replay.graphics.Playback.EventType.PLAY_STOPPED,
      function() {
        var previousFrame = this.getPreviousFrame_();
        if (previousFrame) {
          previousFrame.cancelTiming();
        }
      }, this);

  playback.addListener(
      wtf.replay.graphics.Playback.EventType.VISUALIZER_STATE_CHANGED,
      this.updateStateHash_, this);

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
 * Gets all experiments.
 * @return {!Object.<!Array.<!wtf.replay.graphics.ReplayFrame>>} Experiments.
 */
wtf.replay.graphics.FrameTimeVisualizer.prototype.getExperiments = function() {
  return this.experiments_;
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
  var experimentHash = this.latestExperimentHash_;
  var currentStepIndex = this.playback.getCurrentStepIndex();
  if (!this.experiments_[experimentHash]) {
    this.experiments_[experimentHash] = [];
  }
  if (!this.experiments_[experimentHash][currentStepIndex]) {
    this.experiments_[experimentHash][currentStepIndex] =
        new wtf.replay.graphics.ReplayFrame(currentStepIndex);
  }
  return this.experiments_[experimentHash][currentStepIndex];
};


/**
 * Gets the previous frame.
 * @return {!wtf.replay.graphics.ReplayFrame} The previous frame.
 * @private
 */
wtf.replay.graphics.FrameTimeVisualizer.prototype.getPreviousFrame_ =
    function() {

  if (!this.experiments_[this.latestExperimentHash_]) {
    this.experiments_[this.latestExperimentHash_] = [];
  }
  return this.experiments_[this.latestExperimentHash_][this.latestStepIndex_];
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
 * Updates the latest experiment state hash.
 * @private
 */
wtf.replay.graphics.FrameTimeVisualizer.prototype.updateStateHash_ =
    function() {
  this.latestExperimentHash_ = this.playback.getVisualizerStateHash();
};


/**
 * Records end frame times. Call when the step changes.
 * @private
 */
wtf.replay.graphics.FrameTimeVisualizer.prototype.recordStop_ = function() {
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

    this.emitEvent(
        wtf.replay.graphics.FrameTimeVisualizer.EventType.FRAMES_UPDATED);
  }
};


/**
 * Records start frame times. Call when a new step begins.
 * @private
 */
wtf.replay.graphics.FrameTimeVisualizer.prototype.recordStart_ = function() {
  if (this.playback.isPlaying()) {
    var currentFrame = this.getCurrentFrame_();
    currentFrame.startTiming();
  }

  this.updateStepIndex_();
};
