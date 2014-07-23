/**
 * Copyright 2013 Google, Inc. All Rights Reserved.
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

/**
 * @fileoverview Widget for seeking within a range of a playback's steps.
 *
 * @author chizeng@google.com (Chi Zeng)
 */

goog.provide('wtf.replay.graphics.ui.RangeSeeker');

goog.require('goog.dom.TagName');
goog.require('goog.dom.classes');
goog.require('goog.events');
goog.require('goog.events.EventType');
goog.require('goog.soy');
goog.require('goog.string');
goog.require('wtf.replay.graphics.ui.FrameTimePainter');
goog.require('wtf.replay.graphics.ui.graphicsRangeSeeker');
goog.require('wtf.timing');
goog.require('wtf.ui.Control');
goog.require('wtf.ui.Painter');



/**
 * Used for efficiently seeking within a range. Disabled by default.
 *
 * @param {number} min The smallest value for the range.
 * @param {number} max The largest value for the range.
 * @param {!Element} parentElement The parent element.
 * @param {wtf.replay.graphics.FrameTimeVisualizer=} opt_frameTimeVis The
 *     frame time visualizer that collects replay time data.
 * @constructor
 * @extends {wtf.ui.Control}
 */
wtf.replay.graphics.ui.RangeSeeker =
    function(min, max, parentElement, opt_frameTimeVis) {
  var dom = this.getDom();
  goog.base(this, parentElement, dom);

  /**
   * The minimum of the range.
   * @type {number}
   * @private
   */
  this.min_ = min;

  /**
   * The maximum of the range.
   * @type {number}
   * @private
   */
  this.max_ = max;

  /**
   * The viewport size monitor.
   * @type {!goog.dom.ViewportSizeMonitor}
   * @private
   */
  this.viewportSizeMonitor_ = wtf.events.acquireViewportSizeMonitor();

  /**
   * The range input element.
   * @type {!Element}
   * @private
   */
  // this.rangeElement_ = this.createSlider_();
  // this.getChildElement(goog.getCssName('graphicsReplayRangeSeekerSlider'))
  //     .appendChild(this.rangeElement_);

  /**
   * A widget that displays the value.
   * @type {!Element}
   * @private
   */
  this.valueDisplayer_ = this.createValueDisplayer_(parentElement);
  this.getChildElement(goog.getCssName('graphicsReplayRangeSeekerDisplayer'))
      .appendChild(this.valueDisplayer_);

  // this.setValue(min);

  /**
   * The frame time visualizer.
   * @type {?wtf.replay.graphics.FrameTimeVisualizer}
   * @private
   */
  this.frameTimeVisualizer_ = opt_frameTimeVis || null;

  /**
   * Range seeker canvas.
   * @type {!HTMLCanvasElement}
   * @private
   */
  this.seekerCanvas_ = /** @type {!HTMLCanvasElement} */ (
      this.getChildElement(goog.getCssName('canvas')));

  if (this.frameTimeVisualizer_) {
    var paintContext = new wtf.ui.Painter(this.seekerCanvas_);
    this.setPaintContext(paintContext);

    var frameTimePainter = new wtf.replay.graphics.ui.FrameTimePainter(
        this.seekerCanvas_, this.min_, this.max_, this.frameTimeVisualizer_);
    paintContext.addChildPainter(frameTimePainter);
  }

  /**
   * Whether the range seeker is enabled.
   * @type {boolean}
   * @private
   */
  this.enabled_ = false;
  this.setEnabled(false);

  // Relayout as required.
  this.getHandler().listen(
      this.viewportSizeMonitor_,
      goog.events.EventType.RESIZE,
      this.layout, false);

  wtf.timing.setImmediate(this.layout, this);
  this.requestRepaint();
};
goog.inherits(wtf.replay.graphics.ui.RangeSeeker, wtf.ui.Control);


/**
 * Events related to playing.
 * @enum {string}
 */
wtf.replay.graphics.ui.RangeSeeker.EventType = {
  /**
   * The value of the slider changed. The change was not caused by
   * {@see setValue}.
   */
  VALUE_CHANGED: goog.events.getUniqueId('value_changed')
};


/**
 * @override
 */
wtf.replay.graphics.ui.RangeSeeker.prototype.createDom = function(dom) {
  return /** @type {!Element} */ (goog.soy.renderAsFragment(
      wtf.replay.graphics.ui.graphicsRangeSeeker.controller,
      undefined, undefined, dom));
};


/**
 * Creates the slider.
 * @return {!Element} A slider.
 * @private
 */
wtf.replay.graphics.ui.RangeSeeker.prototype.createSlider_ = function() {
  var slider = this.getDom().createElement(goog.dom.TagName.INPUT);
  slider.type = 'range';
  slider.step = 1;
  slider.min = this.min_;
  slider.max = this.max_;
  slider.value = this.min_;

  // Listen to when the value changes.
  this.getHandler().listen(slider, goog.events.EventType.CHANGE, function() {
    this.emitEvent(
        wtf.replay.graphics.ui.RangeSeeker.EventType.VALUE_CHANGED);
  }, undefined, this);

  return slider;
};


/**
 * Creates the value displayer.
 * @param {!Element} slider The slider for this displayer.
 * @return {!Element} A widget that displays the current value.
 * @private
 */
wtf.replay.graphics.ui.RangeSeeker.prototype.createValueDisplayer_ =
    function(slider) {
  var valueDisplayer = this.getDom().createElement(goog.dom.TagName.INPUT);
  goog.dom.classes.add(valueDisplayer, goog.getCssName('kTextField'));
  valueDisplayer.type = 'text';

  // Update the slider if displayer changes.
  this.getHandler().listen(valueDisplayer,
      goog.events.EventType.CHANGE, function() {
        var newValue = goog.string.parseInt(valueDisplayer.value);

        // Clamp the value.
        if (newValue < 0) {
          newValue = 0;
        } else if (newValue > this.max_) {
          newValue = this.max_;
        }

        this.setValue(newValue);
        this.emitEvent(
            wtf.replay.graphics.ui.RangeSeeker.EventType.VALUE_CHANGED);
      }, undefined, this);

  // Update the displayer if the slider changes.
  this.getHandler().listen(slider, goog.events.EventType.CHANGE, function() {
    valueDisplayer.value = slider.value;
  });

  return valueDisplayer;
};


/**
 * Determines if this range seeker is enabled.
 * @return {boolean} True if and only if this seeker is enabled.
 */
wtf.replay.graphics.ui.RangeSeeker.prototype.isEnabled = function() {
  return this.enabled_;
};


/**
 * Sets whether this range seeker is enabled.
 * @param {boolean} enabled The true/false enabled state of the range seeker.
 */
wtf.replay.graphics.ui.RangeSeeker.prototype.setEnabled = function(enabled) {
  // if (enabled) {
  //   // Enable.
  //   this.rangeElement_.removeAttribute('disabled');
  //   this.valueDisplayer_.removeAttribute('disabled');
  // } else {
  //   // Disable.
  //   this.rangeElement_.disabled = 'disabled';
  //   this.valueDisplayer_.disabled = 'disabled';
  // }
  this.enabled_ = enabled;
};


/**
 * Gets the value.
 * @return {number} The current value.
 */
wtf.replay.graphics.ui.RangeSeeker.prototype.getValue = function() {
  // The value is a string by default.
  return goog.string.parseInt(this.rangeElement_.value);
};


/**
 * Sets the value. Does not emit a value changed event.
 * @param {number} value The new value.
 */
wtf.replay.graphics.ui.RangeSeeker.prototype.setValue = function(value) {
  // this.rangeElement_.value = value;
  // this.valueDisplayer_.value = value;
};
