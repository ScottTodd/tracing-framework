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

  // ctx.fillStyle = '#AA2222';
  // ctx.fillRect(0, 0, this.frameTimeVisualizer_.numTimedFrames_, 30);
  // ctx.fillRect(this.frameTimeVisualizer_.numTimedFrames_, 0, 20, 30);

  // TODO(scotttodd): figure out how to resize....

  var frames = this.frameTimeVisualizer_.getFrames();

  var timeScale = 1 / wtf.math.remap(45, 0, bounds.height, 0, 1);
  var latestFrameNumber = 0;

  ctx.beginPath();
  ctx.moveTo(bounds.left, bounds.top + bounds.height);

  for (var i = 0; i < frames.length; ++i) {
    var currentFrameNumber = i;
    var frame = frames[currentFrameNumber];
    if (frame) {
      var x = wtf.math.remap(currentFrameNumber, this.min_, this.max_,
          0, bounds.width);
      var y = Math.max(bounds.height - frame.getDuration() * timeScale, 0);

      ctx.strokeStyle = '#444444';
      ctx.lineTo(x, y);
      ctx.stroke();

      latestFrameNumber = currentFrameNumber;
    }
  }
};