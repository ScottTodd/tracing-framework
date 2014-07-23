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

goog.require('wtf.events');
goog.require('wtf.math');
goog.require('wtf.replay.graphics.FrameTimeVisualizer');
goog.require('wtf.ui.Painter');



/**
 * Frame time painter.
 * @param {!HTMLCanvasElement} canvas Canvas element.
 * @param {number} min The smallest frame number.
 * @param {number} max The largest frame number.
 * @param {wtf.replay.graphics.FrameTimeVisualizer=} opt_visualizer Frame time
 *     visualizer that collects frame time data.
 * @constructor
 * @extends {wtf.ui.Painter}
 */
wtf.replay.graphics.ui.FrameTimePainter = function FrameTimePainter(canvas,
    min, max, opt_visualizer) {
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
   * The current frame number.
   * @type {number}
   * @private
   */
  this.currentFrame_ = -1;

  /**
   * The frame time visualizer.
   * @type {?wtf.replay.graphics.FrameTimeVisualizer}
   * @private
   */
  this.frameTimeVisualizer_ = opt_visualizer || null;

  if (this.frameTimeVisualizer_) {
    this.frameTimeVisualizer_.addListener(
        wtf.replay.graphics.FrameTimeVisualizer.EventType.FRAMES_UPDATED,
        this.requestRepaint, this);
  }

  /**
   * Current X of the mouse, if it is hovering over the context.
   * If this is zero then the mouse is not hovering.
   * @type {number}
   * @private
   */
  this.hoverX_ = 0;

  /**
   * Current Y of the mouse, if it is hovering over the context.
   * If this is zero then the mouse is not hovering.
   * @type {number}
   * @private
   */
  this.hoverY_ = 0;
};
goog.inherits(wtf.replay.graphics.ui.FrameTimePainter, wtf.ui.Painter);


/**
 * Gets the current frame number.
 * @return {number} The current frame number.
 */
wtf.replay.graphics.ui.FrameTimePainter.prototype.getCurrentFrame = function() {
  return this.currentFrame_;
};


/**
 * Sets the current frame number.
 * @param {number} frameNumber The current frame number.
 */
wtf.replay.graphics.ui.FrameTimePainter.prototype.setCurrentFrame = function(
    frameNumber) {
  this.currentFrame_ = frameNumber;
  this.requestRepaint();
};


/**
 * Contains colors used to draw frame time bars and other elements.
 * @type {!Object.<string>}
 * @const
 * @private
 */
wtf.replay.graphics.ui.FrameTimePainter.COLORS_ = {
  /**
   * The default background color of odd rows.
   */
  ODD_ROW_BACKGROUND: '#FFFFFF',

  /**
   * The default background color of even rows.
   */
  EVEN_ROW_BACKGROUND: '#FAFAFA',

  /**
   * The background color of the currently selected frame.
   */
  CURRENT_BACKGROUND: '#B6CCEF',

  /**
   * The background color of the currently selected frame.
   */
  HOVER_BACKGROUND: '#DCDCDC',

  /**
   * The color for lines at the 17ms and 33ms heights.
   */
  TIME_MARKERS: '#DDDDDD',

  /**
   * The background color of the currently selected frame.
   */
  FRAME_HOVER: '#666666',

  /**
   * The color for frames whose average duration is less than 17ms.
   */
  FRAME_TIME_17: '#4C993F',

  /**
   * The color for frames whose average duration is between 17ms and 33ms.
   */
  FRAME_TIME_33: '#ED9128',

  /**
   * The color for frames whose average duration is between 33ms and 50ms.
   */
  FRAME_TIME_50: '#F23838',

  /**
   * The color for frames whose average duration is greater than 50ms.
   */
  FRAME_TIME_50_PLUS: '#991E1E'
};


/**
 * @override
 */
wtf.replay.graphics.ui.FrameTimePainter.prototype.repaintInternal = function(
    ctx, bounds) {
  // The x-axis is frame number, the y-axis is frame duration.
  var yScale = 1 / wtf.math.remap(45, 0, bounds.height, 0, 1);
  var frameWidth = bounds.width / (this.max_ - this.min_);

  var colors = wtf.replay.graphics.ui.FrameTimePainter.COLORS_;
  var leftX, topY, duration;

  var hoverIndex = 0;
  if (this.hoverX_) {
    hoverIndex = this.hitTest_(this.hoverX_, this.hoverY_, bounds);
  }

  // Draw background bars in alternating shades of grey.
  for (var i = this.min_; i < this.max_; ++i) {
    leftX = wtf.math.remap(i - 0.5, this.min_, this.max_, 0, bounds.width);
    if (i == this.currentFrame_) {
      ctx.fillStyle = colors.CURRENT_BACKGROUND;
    } else if (hoverIndex && i == hoverIndex) {
      ctx.fillStyle = colors.HOVER_BACKGROUND;
    } else if (i % 2 == 0) {
      ctx.fillStyle = colors.EVEN_ROW_BACKGROUND;
    } else {
      ctx.fillStyle = colors.ODD_ROW_BACKGROUND;
    }
    ctx.fillRect(leftX, 0, frameWidth, bounds.height);
  }

  // Draw lines at 17ms and 33ms.
  ctx.fillStyle = colors.TIME_MARKERS;
  ctx.fillRect(bounds.left, bounds.height - 17 * yScale, bounds.width, 1);
  ctx.fillRect(bounds.left, bounds.height - 33 * yScale, bounds.width, 1);

  // Draw the frame times.
  if (this.frameTimeVisualizer_) {
    var frames = this.frameTimeVisualizer_.getFrames();

    ctx.beginPath();
    for (var i = this.min_; i < this.max_; ++i) {
      var frame = frames[i];
      if (frame) {
        duration = frame.getAverageDuration();
        leftX = wtf.math.remap(i - 0.5, this.min_, this.max_,
            0, bounds.width);
        topY = Math.max(bounds.height - duration * yScale, 0);

        // Draw a bar for this frame.
        if (duration < 17) {
          ctx.fillStyle = colors.FRAME_TIME_17;
        } else if (duration < 33) {
          ctx.fillStyle = colors.FRAME_TIME_33;
        } else if (duration < 50) {
          ctx.fillStyle = colors.FRAME_TIME_50;
        } else {
          ctx.fillStyle = colors.FRAME_TIME_50_PLUS;
        }
        ctx.fillRect(leftX, topY, frameWidth, duration * yScale);
      }
    }

    // Draw highlight for the frame that is hovered over.
    if (hoverIndex) {
      var hoverFrame = frames[hoverIndex];
      if (hoverFrame) {
        duration = hoverFrame.getAverageDuration();
        leftX = wtf.math.remap(hoverIndex - 0.5, this.min_, this.max_,
            0, bounds.width);
        topY = Math.max(bounds.height - duration * yScale, 0);

        ctx.lineWidth = 3;
        ctx.strokeStyle = colors.FRAME_HOVER;
        ctx.rect(leftX, topY, frameWidth, duration * yScale);
        ctx.stroke();
      }
    }
  }
};


/**
 * @override
 */
wtf.replay.graphics.ui.FrameTimePainter.prototype.onMouseMoveInternal =
    function(x, y, modifiers, bounds) {
  this.hoverX_ = x;
  this.hoverY_ = y;
  this.requestRepaint();
};


/**
 * @override
 */
wtf.replay.graphics.ui.FrameTimePainter.prototype.onMouseOutInternal =
    function() {
  this.hoverX_ = 0;
  this.hoverY_ = 0;
  this.requestRepaint();
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

  var commandManager = wtf.events.getCommandManager();
  commandManager.execute('goto_replay_frame', this, null, frameHit);

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

  if (this.frameTimeVisualizer_) {
    var frame = this.frameTimeVisualizer_.getFrame(frameHit);
    if (frame) {
      return frame.getTooltip();
    }
  }

  return 'Frame #' + frameHit;
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
