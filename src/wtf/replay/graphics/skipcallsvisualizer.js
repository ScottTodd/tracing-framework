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
      visualizer.latestProgramHandle_ = args['program'];
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
 * Returns whether this draw call should be skipped in playback.
 * @return {boolean} Whether the event should be skipped in playback.
 * @private
 */
wtf.replay.graphics.SkipCallsVisualizer.prototype.handleDrawCall_ = function() {
  return true;

  // if (this.latestProgramHandle_ == 5) {
  if (this.latestProgramHandle_ == 10 || this.latestProgramHandle_ == 130) {
    // Try skipping program handles 29, 11, 17 with BLK.
    return true;
  } else {
    return false;
  }
};


/**
 * Handles operations that could occur in place of any event.
 * @param {!wtf.db.EventIterator} it Event iterator.
 * @param {WebGLRenderingContext} gl The context.
 * @return {boolean} Whether the event should be skipped in playback.
 * @protected
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
