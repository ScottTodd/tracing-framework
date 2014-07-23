/**
 * Copyright 2014 Google, Inc. All Rights Reserved.
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

/**
 * @fileoverview Frame time painter for the range seeker control.
 *
 * @author scotttodd@google.com (Scott Todd)
 */

goog.provide('wtf.replay.graphics.ui.FrameTimePainter');

goog.require('wtf.math');
goog.require('wtf.replay.graphics.FrameTimeVisualizer');
goog.require('wtf.ui.Painter');



/**
 * Frame time painter.
 * @param {!HTMLCanvasElement} canvas Canvas element.
 * @param {number} min The smallest frame number.
 * @param {number} max The largest frame number.
 * @param {!wtf.replay.graphics.FrameTimeVisualizer} visualizer Frame time
 *     visualizer that collects frame time data.
 * @constructor
 * @extends {wtf.ui.Painter}
 */
wtf.replay.graphics.ui.FrameTimePainter = function FrameTimePainter(canvas,
    min, max, visualizer) {
  goog.base(this, canvas);

  /**
   * The minimum frame number.
   * @type {number}
   * @private
   */
  this.min_ = min;

  /**
   * The maximum frame number.
   * @type {number}
   * @private
   */
  this.max_ = max;

  /**
   * The frame time visualizer.
   * @type {!wtf.replay.graphics.FrameTimeVisualizer}
   * @private
   */
  this.frameTimeVisualizer_ = visualizer;

  this.frameTimeVisualizer_.addListener(
      wtf.replay.graphics.FrameTimeVisualizer.EventType.FRAMES_UPDATED,
      function() {
        this.requestRepaint();
      }, this);
};
goog.inherits(wtf.replay.graphics.ui.FrameTimePainter, wtf.ui.Painter);


/**
 * @override
 */
wtf.replay.graphics.ui.FrameTimePainter.prototype.repaintInternal = function(
    ctx, bounds) {

  // ctx.fillStyle = '#AA2222';
  // ctx.fillRect(0, 0, this.frameTimeVisualizer_.numTimedFrames_, 30);
  // ctx.fillRect(this.frameTimeVisualizer_.numTimedFrames_, 0, 20, 30);

  // TODO(scotttodd): figure out how to resize....

  var frames = this.frameTimeVisualizer_.getFrames();

  // The y-axis is frame duration.
  var yScale = 1 / wtf.math.remap(45, 0, bounds.height, 0, 1);
  var frameWidth = bounds.width / (this.max_ - this.min_);

  // The x-axis is frame number.

  ctx.beginPath();
  for (var i = 0; i < frames.length; ++i) {
    var currentFrameNumber = i;
    var frame = frames[currentFrameNumber];
    if (frame) {
      var duration = frame.getAverageDuration();
      var leftX = wtf.math.remap(currentFrameNumber - 0.5,
          this.min_, this.max_, 0, bounds.width);
      var topY = Math.max(bounds.height - duration * yScale, 0);

      // Draw a bar for this frame.
      // TODO(scotttodd): More colors? Using the same colors from overdraw.
      if (duration < 17) {
        ctx.fillStyle = '#4C993F';
      } else if (duration < 33) {
        ctx.fillStyle = '#ED9128';
      } else if (duration < 50) {
        ctx.fillStyle = '#F23838';
      } else {
        ctx.fillStyle = '#991E1E';
      }
      ctx.fillRect(leftX, topY, frameWidth, duration * yScale);
    }
  }

  // Draw label on the left.
  // this.drawLabel('frames');
};


/**
 * @override
 */
wtf.replay.graphics.ui.FrameTimePainter.prototype.onClickInternal =
    function(x, y, modifiers, bounds) {
  var frameHit = this.hitTest_(x, y, bounds);
  if (!frameHit) {
    return false;
  }

  goog.global.console.log('clicked on frame #' + frameHit);

  return true;
};


/**
 * @override
 */
wtf.replay.graphics.ui.FrameTimePainter.prototype.getInfoStringInternal =
    function(x, y, bounds) {
  var frameHit = this.hitTest_(x, y, bounds);
  if (!frameHit) {
    return undefined;
  }


  var frame = this.frameTimeVisualizer_.getFrame(frameHit);
  if (frame) {
    return frame.getTooltip();
  }

  return undefined;
};


/**
 * Finds the frame at the given point.
 * @param {number} x X coordinate, relative to canvas.
 * @param {number} y Y coordinate, relative to canvas.
 * @param {!goog.math.Rect} bounds Draw bounds.
 * @return {number} Frame number at the given point.
 * @private
 */
wtf.replay.graphics.ui.FrameTimePainter.prototype.hitTest_ = function(
    x, y, bounds) {
  return Math.round(wtf.math.remap(x, bounds.left, bounds.left + bounds.width,
      this.min_, this.max_));
};
