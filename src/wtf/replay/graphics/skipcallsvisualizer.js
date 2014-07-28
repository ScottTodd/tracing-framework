/**
 * Copyright 2014 Google, Inc. All Rights Reserved.
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

/**
 * @fileoverview Skips specific calls during playback.
 *
 * @author scotttodd@google.com (Scott Todd)
 */

goog.provide('wtf.replay.graphics.SkipCallsVisualizer');

goog.require('wtf.replay.graphics.Visualizer');



/**
 * Visualizer that allows for skipping calls during playback.
 *
 * @param {!wtf.replay.graphics.Playback} playback The playback instance.
 * @constructor
 * @extends {wtf.replay.graphics.Visualizer}
 */
wtf.replay.graphics.SkipCallsVisualizer = function(playback) {
  goog.base(this, playback);

  /**
   * A mapping of handles to contexts.
   * Keys are context handles from event arguments.
   * @type {!Object.<!WebGLRenderingContext>}
   * @private
   */
  this.contexts_ = {};

  /**
   * The program handle from event arguments for the latest used program.
   * @type {number}
   * @private
   */
  this.latestProgramHandle_ = 0;

  /**
   * Storage of which program handles should have their draw calls skipped.
   * Keys are program handles, values are whether the program handle is skipped.
   * @type {!Array.<boolean>}
   * @private
   */
  this.skippedProgramHandles_ = [];
};
goog.inherits(wtf.replay.graphics.SkipCallsVisualizer,
    wtf.replay.graphics.Visualizer);


/**
 * Adds mutators using registerMutator.
 * @protected
 * @override
 */
wtf.replay.graphics.SkipCallsVisualizer.prototype.setupMutators = function() {
  goog.base(this, 'setupMutators');

  this.registerMutator('wtf.webgl#setContext', {
    post: function(visualizer, gl, args) {
      var contextHandle = args['handle'];
      if (!visualizer.contexts_[contextHandle]) {
        visualizer.contexts_[contextHandle] = gl;
      }
    }
  });

  this.registerMutator('WebGLRenderingContext#useProgram', {
    post: function(visualizer, gl, args) {
      var programHandle = args['program'];
      visualizer.latestProgramHandle_ = programHandle;
      visualizer.skippedProgramHandles_[programHandle] =
          visualizer.skippedProgramHandles_[programHandle] || false;
    }
  });

  this.registerMutator('WebGLRenderingContext#drawArrays', {
    replace: function(visualizer, gl, args) {
      return visualizer.handleDrawCall_();
    }
  });

  this.registerMutator('WebGLRenderingContext#drawElements', {
    replace: function(visualizer, gl, args) {
      return visualizer.handleDrawCall_();
    }
  });

  this.registerMutator('ANGLEInstancedArrays#drawArraysInstancedANGLE', {
    replace: function(visualizer, gl, args) {
      return visualizer.handleDrawCall_();
    }
  });

  this.registerMutator('ANGLEInstancedArrays#drawElementsInstancedANGLE', {
    replace: function(visualizer, gl, args) {
      return visualizer.handleDrawCall_();
    }
  });

  this.registerMutator('WebGLRenderingContext#createBuffer', {
    replace: function(visualizer, gl, args) {
      return false;
    }
  });

  this.registerMutator('WebGLRenderingContext#bindBuffer', {
    replace: function(visualizer, gl, args) {
      return false;
    }
  });

  this.registerMutator('WebGLRenderingContext#bufferData', {
    replace: function(visualizer, gl, args) {
      return false;
    }
  });

  this.registerMutator('WebGLRenderingContext#vertexAttribPointer', {
    replace: function(visualizer, gl, args) {
      return false;
    }
  });

  this.registerMutator('WebGLRenderingContext#clear', {
    replace: function(visualizer, gl, args) {
      return false;
    }
  });
};


/**
 * Returns a hash of the current internal states which affect playback.
 * @return {string} Hash of the internal playback-affecting states.
 * @protected
 * @override
 */
wtf.replay.graphics.SkipCallsVisualizer.prototype.getStateHash = function() {
  if (!this.active) {
    return '';
  }

  var skipped = [];
  for (var i = 0; i < this.skippedProgramHandles_.length; ++i) {
    if (this.skippedProgramHandles_[i]) {
      skipped.push(i);
    }
  }
  return skipped.join(',');
};


/**
 * Returns whether this draw call should be skipped in playback.
 * @return {boolean} Whether the event should be skipped in playback.
 * @private
 */
wtf.replay.graphics.SkipCallsVisualizer.prototype.handleDrawCall_ = function() {
  return this.skippedProgramHandles_[this.latestProgramHandle_];
};


/**
 * Handles operations that could occur in place of any event.
 * @param {!wtf.db.EventIterator} it Event iterator.
 * @param {WebGLRenderingContext} gl The context.
 * @return {boolean} Whether the event should be skipped in playback.
 * @protected
 * @override
 */
wtf.replay.graphics.SkipCallsVisualizer.prototype.anyReplaceEvent = function(
    it, gl) {
  // FrameTimeVisualizer requires setContext.
  // if (it.getName() == 'wtf.webgl#setContext') {
  //   return true;
  // }
  // return false;
  return false;
};


/**
 * Runs this visualization on a substep of the current step.
 * @param {number=} opt_subStepIndex Target substep, or the current by default.
 * @override
 */
wtf.replay.graphics.SkipCallsVisualizer.prototype.applyToSubStep = function(
    opt_subStepIndex) {
  var currentSubStepIndex = this.playback.getSubStepEventIndex();
  var targetSubStepIndex = opt_subStepIndex || currentSubStepIndex;

  // Find the latest useProgram call before the target substep.
  // TODO(scotttodd): Make this work even when the latest useProgram call was
  //   from a previous step.
  var currentStep = this.playback.getCurrentStep();
  var it = currentStep.getEventIterator(true);

  var latestProgramHandle = 0;
  while (it.getIndex() < targetSubStepIndex && it.getIndex() < it.getCount()) {
    if (it.getName() == 'WebGLRenderingContext#useProgram') {
      var args = it.getArguments();
      latestProgramHandle = args['program'];
    }
    it.next();
  }

  // TODO(scotttodd): Update events somehow to let eventnavigatorsource know
  //   about disabled draw calls for display so that it can grey them out.

  this.skippedProgramHandles_[latestProgramHandle] =
      !this.skippedProgramHandles_[latestProgramHandle];

  this.emitEvent(wtf.replay.graphics.Visualizer.EventType.STATE_CHANGED);
};


/**
 * Restores state back to standard playback.
 */
wtf.replay.graphics.SkipCallsVisualizer.prototype.restoreState = function() {
  this.active = false;

  // Seek from the start to the current step to update all internal state.
  var currentStepIndex = this.playback.getCurrentStepIndex();
  var currentSubStepIndex = this.playback.getSubStepEventIndex();

  this.playback.seekStep(0);
  this.playback.seekStep(currentStepIndex);
  this.playback.seekSubStepEvent(currentSubStepIndex);
};
