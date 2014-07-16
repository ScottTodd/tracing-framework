/**
 * Copyright 2014 Google, Inc. All Rights Reserved.
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

/**
 * @fileoverview FrameTimeVisualizer. Visualizer of frame times.
 *
 * @author scotttodd@google.com (Scott Todd)
 */

goog.provide('wtf.replay.graphics.FrameTimeVisualizer');

goog.require('wtf');
goog.require('wtf.replay.graphics.Playback');
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
   * Array of the latest recorded start times for frames.
   * @type {!Array.<number>}
   * @private
   */
  this.startTimes_ = [];

  /**
   * Array of the latest recorded end times for frames.
   * @type {!Array.<number>}
   * @private
   */
  this.endTimes_ = [];

  /**
   * Array of the latest recorded durations for frames.
   * @type {!Array.<number>}
   * @private
   */
  this.durations_ = [];

  /**
   * The current total time between all timed frames.
   * @type {number}
   * @private
   */
  this.currentTotalTime_ = 0;

  /**
   * The current number of timed frames.
   * @type {number}
   * @private
   */
  this.numTimedFrames_ = 0;

  playback.addListener(wtf.replay.graphics.Playback.EventType.STEP_CHANGED,
      this.recordTimes_, this);

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
 * Records frame times. Call when the step changes.
 * @private
 */
wtf.replay.graphics.FrameTimeVisualizer.prototype.recordTimes_ = function() {
  var currentStepIndex = this.playback.getCurrentStepIndex();

  if (currentStepIndex != this.latestStepIndex_) {
    if (this.latestStepIndex_ > 0 && this.playback.isPlaying()) {
      for (var contextHandle in this.contexts_) {
        this.contexts_[contextHandle].finish();
      }
      this.endTimes_[this.latestStepIndex_] = wtf.now();

      var startTime = this.startTimes_[this.latestStepIndex_];

      if (startTime) {
        var duration = this.endTimes_[this.latestStepIndex_] - startTime;

        this.durations_[this.latestStepIndex_] = duration;


        this.currentTotalTime_ += duration;
        this.numTimedFrames_++;

        var averageTime = this.currentTotalTime_ / this.numTimedFrames_;
        goog.global.console.log('averageTime: ' + averageTime.toFixed(3) +
            ', duration: ' + duration.toFixed(3));
      }

      this.startTimes_[currentStepIndex] = wtf.now();
    }

    this.latestStepIndex_ = currentStepIndex;
  }
};


/**
 * Runs this visualization on a substep of the current step.
 * @param {number=} opt_subStepIndex Target substep, or the current by default.
 * @override
 */
wtf.replay.graphics.FrameTimeVisualizer.prototype.applyToSubStep = function(
    opt_subStepIndex) {
  // TODO(scotttodd): startContinuous
  // TODO(scotttodd): Visualizer default for applyToSubStep, etc.
  //     do nothing, maybe log that that funciton is not implemented for that
  //     visualizer

  this.active = true;
};
