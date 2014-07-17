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
   * Start time for the frame.
   * @type {number}
   * @private
   */
  this.startTime_ = 0;

  /**
   * End time for the frame.
   * @type {number}
   * @private
   */
  this.endTime_ = 0;
};


/**
 * Gets the frame number.
 * @return {number} Frame number.
 */
wtf.replay.graphics.Frame.prototype.getNumber = function() {
  return this.number_;
};


/**
 * Gets the time the frame started at.
 * @return {number} Start time.
 */
wtf.replay.graphics.Frame.prototype.getStartTime = function() {
  return this.startTime_;
};


/**
 * Sets the time the frame started at.
 * @param {number} startTime The new start time.
 */
wtf.replay.graphics.Frame.prototype.setStartTime = function(startTime) {
  this.startTime_ = startTime;
};


/**
 * Gets the time the frame ended at.
 * @return {number} End time.
 */
wtf.replay.graphics.Frame.prototype.getEndTime = function() {
  return this.endTime_;
};


/**
 * Sets the time the frame ended at.
 * @param {number} endTime The new end time.
 */
wtf.replay.graphics.Frame.prototype.setEndTime = function(endTime) {
  this.endTime_ = endTime;
};


/**
 * Gets the duration of the frame.
 * @return {number} Frame duration.
 */
wtf.replay.graphics.Frame.prototype.getDuration = function() {
  return this.endTime_ - this.startTime_;
};
