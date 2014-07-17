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
        goog.global.console.log('range seeker sees an update!');
        this.requestRepaint();
      }, this);
};
goog.inherits(wtf.replay.graphics.ui.FrameTimePainter, wtf.ui.Painter);


/**
 * @override
 */
wtf.replay.graphics.ui.FrameTimePainter.prototype.layoutInternal = function(
    availableBounds) {
  var newBounds = availableBounds.clone();
  // TODO(scotttodd): Set height to 0 if no frame times recorded.
  // if (this.frameList_.getCount()) {
  //   newBounds.height = 45;
  // } else {
  //   newBounds.height = 0;
  // }
  return newBounds;
};


/**
 * @override
 */
wtf.replay.graphics.ui.FrameTimePainter.prototype.repaintInternal = function(
    ctx, bounds) {

  ctx.fillStyle = '#AA2222';
  ctx.fillRect(0, 0, 200, 30);

  // var timeLeft = this.timeLeft;
  // var timeRight = this.timeRight;
  // var timeScale = 1 / wtf.math.remap(45, 0, bounds.height, 0, 1);

  // // Clip to extents.
  // this.clip(bounds.left, bounds.top, bounds.width, bounds.height);

  // // Draw frames.
  // // TODO(benvanik): only redraw if needed (data has changed)
  // // TODO(benvanik): custom pixel pushing? it'd be cool to color the chart by
  // //     frame time, but the single-color-per-path API of canvas makes that
  // //     difficult.
  // ctx.fillStyle = '#444444';
  // var pixelStep = (timeRight - timeLeft) / bounds.width;
  // var pixelStart = 0;
  // var pixelAccumulator = 0;
  // var lastX = 0;
  // ctx.beginPath();
  // ctx.moveTo(bounds.left, bounds.top + bounds.height);
  // this.frameList_.forEachIntersecting(timeLeft, timeRight, function(frame) {
  //   // Compute time of frame based on previous time.
  //   var previousFrame = this.frameList_.getPreviousFrame(frame);
  //   var frameTime = 0;
  //   if (previousFrame) {
  //     frameTime = frame.getEndTime() - previousFrame.getEndTime();
  //   }
  //   if (!frameTime) {
  //     return;
  //   }

  //   var endTime = frame.getEndTime();
  //   pixelAccumulator = Math.max(pixelAccumulator, frameTime);
  //   if (endTime > pixelStart + pixelStep) {
  //   var x = wtf.math.remap(pixelStart, timeLeft, timeRight, 0,
  //       bounds.width);
  //     lastX = x;
  //     var value = pixelAccumulator;
  //     var fy = Math.max(bounds.height - value * timeScale, 0);
  //     ctx.lineTo(bounds.left + x, bounds.top + fy);
  //     // Create a gap if the time is too large.
  //     var gapSize = endTime - pixelStart;
  //     pixelStart = endTime - (endTime % pixelStep);
  //     // goog.global.console.log(bounds.top + fy);
  //     if (gapSize > 33) {
  //       var xr = wtf.math.remap(endTime, timeLeft, timeRight, 0,
  //           bounds.width);
  //       ctx.lineTo(bounds.left + xr, bounds.top + fy);
  //       ctx.lineTo(bounds.left + xr, bounds.top + bounds.height);
  //       ctx.fill();
  //       ctx.fillStyle = '#FF0000';
  //       ctx.fillRect(bounds.left + x, bounds.top, 1, bounds.height);
  //       ctx.fillStyle = '#444444';
  //       // ctx.fillStyle = '#00aa44';
  //       ctx.beginPath();
  //       ctx.moveTo(bounds.left + wtf.math.remap(pixelStart,
  //           timeLeft, timeRight, 0, bounds.width), bounds.top +
  //           bounds.height);
  //       // goog.global.console.log(bounds.top + bounds.height);
  //     }
  //     pixelAccumulator = 0;
  //   }
  // }, this);
  // ctx.lineTo(bounds.left + lastX, bounds.top + bounds.height);
  // ctx.lineTo(bounds.left, bounds.top + bounds.height);
  // ctx.fill();

  // // Draw frame time limits.
  // ctx.fillStyle = '#DD4B39';
  // // ctx.fillStyle = '#FFFF00';
  // ctx.fillRect(
  //     bounds.left, bounds.top + Math.floor(bounds.height - 17 * timeScale),
  //     bounds.width, 1);
  // ctx.fillRect(
  //     bounds.left, bounds.top + Math.floor(bounds.height - 33 * timeScale),
  //     bounds.width, 1);

  // // Draw borders.
  // ctx.fillStyle = 'rgb(200,200,200)';
  // ctx.fillRect(
  //     bounds.left, bounds.top + bounds.height - 1,
  //     bounds.width, 1);

  // // Draw label on the left.
  // this.drawLabel('frame time');
};
