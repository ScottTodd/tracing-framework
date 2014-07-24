/**
 * Copyright 2013 Google, Inc. All Rights Reserved.
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

/**
 * @fileoverview Frame. A frame timed during playback. Can store multiple times.
 *
 * @author scotttodd@google.com (Scott Todd)
 */

goog.provide('wtf.replay.graphics.ReplayFrame');

goog.require('wtf');



/**
 * A frame timed using {@see wtf.replay.graphics.FrameTimeVisualizer}.
 *
 * @param {number} number Frame number in the trace.
 * @constructor
 */
wtf.replay.graphics.ReplayFrame = function(number) {
  /**
   * The frame number in the trace.
   * @type {number}
   * @private
   */
  this.number_ = number;

  /**
   * All recorded start times. Start times pair directly with stop times.
   * @type {!Array.<number>}
   * @private
   */
  this.startTimes_ = [];

  /**
   * All recorded stop times. Stop times pair directly with start times.
   * @type {!Array.<number>}
   * @private
   */
  this.stopTimes_ = [];

  /**
   * All recorded durations, computed as the difference between start and stop.
   * @type {!Array.<number>}
   * @private
   */
  this.durations_ = [];

  /**
   * Sum of all recorded durations. Tracked to help {@see #getAverageDuration}.
   * @type {number}
   * @private
   */
  this.totalDuration_ = 0;

  /**
   * Whether the latest timing is valid. Does not affect completed recordings.
   * @type {boolean}
   * @private
   */
  this.valid_ = false;

  /**
   * Latest start time for this frame.
   * @type {number}
   * @private
   */
  this.latestStartTime_ = 0;

  /**
   * Latest stop time for this frame.
   * @type {number}
   * @private
   */
  this.latestStopTime_ = 0;
};


/**
 * Gets the frame number.
 * @return {number} Frame number.
 */
wtf.replay.graphics.ReplayFrame.prototype.getNumber = function() {
  return this.number_;
};


/**
 * Starts timing for one recording.
 */
wtf.replay.graphics.ReplayFrame.prototype.startTiming = function() {
  this.latestStartTime_ = wtf.now();
  this.valid_ = true;
};


/**
 * Stops timing for one recording.
 */
wtf.replay.graphics.ReplayFrame.prototype.stopTiming = function() {
  if (!this.valid_) {
    return;
  }

  this.latestStopTime_ = wtf.now();

  this.startTimes_.push(this.latestStartTime_);
  this.stopTimes_.push(this.latestStopTime_);

  var duration = this.latestStopTime_ - this.latestStartTime_;
  this.durations_.push(duration);
  this.totalDuration_ += duration;

  this.valid_ = false;
};


/**
 * Cancels timing for the latest recording.
 */
wtf.replay.graphics.ReplayFrame.prototype.cancelTiming = function() {
  this.valid_ = false;
};


/**
 * Gets the average duration of the frame.
 * @return {number} Average frame duration in milliseconds.
 */
wtf.replay.graphics.ReplayFrame.prototype.getAverageDuration = function() {
  return this.totalDuration_ / this.durations_.length;
};


/**
 * Gets the tooltip message for this frame.
 * @return {string} Tooltip message.
 */
wtf.replay.graphics.ReplayFrame.prototype.getTooltip = function() {
  var tooltip = '';
  tooltip += 'Frame #' + this.number_ + '\n';
  if (this.durations_.length > 0) {
    tooltip += 'Average time: ' + this.getAverageDuration().toFixed(2) + 'ms\n';
    tooltip += 'All times:\n';
    for (var i = 0; i < this.durations_.length; ++i) {
      tooltip += '  ' + this.durations_[i].toFixed(2) + 'ms\n';
    }
  }
  return tooltip;
};
