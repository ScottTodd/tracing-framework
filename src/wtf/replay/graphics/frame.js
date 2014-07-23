/**
 * Copyright 2013 Google, Inc. All Rights Reserved.
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

/**
 * @fileoverview Frame.
 *
 * @author scotttodd@google.com (Scott Todd)
 */

goog.provide('wtf.replay.graphics.Frame');

goog.require('wtf');



/**
 * A frame timed using {@see wtf.replay.graphics.FrameTimeVisualizer}.
 *
 * @param {number} number Frame number.
 * @constructor
 */
wtf.replay.graphics.Frame = function(number) {
  /**
   * Frame number.
   * @type {number}
   * @private
   */
  this.number_ = number;

  /**
   * All recorded start times.
   * @type {!Array.<number>}
   * @private
   */
  this.startTimes_ = [];

  /**
   * All recorded stop times.
   * @type {!Array.<number>}
   * @private
   */
  this.stopTimes_ = [];

  /**
   * All recorded durations.
   * @type {!Array.<number>}
   * @private
   */
  this.durations_ = [];

  /**
   * Sum of all recorded durations.
   * @type {number}
   * @private
   */
  this.totalDuration_ = 0;

  /**
   * Whether the current timing is valid.
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
wtf.replay.graphics.Frame.prototype.getNumber = function() {
  return this.number_;
};


/**
 * Starts timing for one recording.
 */
wtf.replay.graphics.Frame.prototype.startTiming = function() {
  this.latestStartTime_ = wtf.now();
  this.valid_ = true;
};


/**
 * Stops timing for one recording.
 */
wtf.replay.graphics.Frame.prototype.stopTiming = function() {
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
 * Cancels timing for one recording.
 */
wtf.replay.graphics.Frame.prototype.cancelTiming = function() {
  this.valid_ = false;
};


/**
 * Gets the average duration of the frame.
 * @return {number} Average frame duration in milliseconds.
 */
wtf.replay.graphics.Frame.prototype.getAverageDuration = function() {
  return this.totalDuration_ / this.durations_.length;
};

/**
 * Gets the tooltip message for this frame.
 * @return {string} Tooltip message.
 */
wtf.replay.graphics.Frame.prototype.getTooltip = function() {
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
