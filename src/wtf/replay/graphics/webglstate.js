/**
 * Copyright 2014 Google, Inc. All Rights Reserved.
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

/**
 * @fileoverview WebGLState. Supports backup and restore for the WebGL state.
 * Initially, only a subset of the state will be supported.
 *
 * @author scotttodd@google.com (Scott Todd)
 */

goog.provide('wtf.replay.graphics.WebGLState');

goog.require('goog.Disposable');
goog.require('goog.asserts');
goog.require('goog.webgl');



/**
 * Backup and restore utility for the WebGL state.
 *
 * @param {!WebGLRenderingContext} gl The context to work with.
 * @constructor
 * @extends {goog.Disposable}
 */
wtf.replay.graphics.WebGLState = function(gl) {
  goog.base(this);

  /**
   * The WebGL context to backup and restore.
   * @type {!WebGLRenderingContext}
   * @private
   */
  this.context_ = gl;

  /**
   * Whether or not a backup has been stored. Cannot restore without a backup.
   * @type {boolean}
   * @private
   */
  this.backupStored_ = false;

  /**
   * All WebGL state enums that are used with gl.enable and gl.disable.
   * @type {Array.<number>}
   * @private
   */
  this.toggleStates_ = [
    goog.webgl.BLEND,
    goog.webgl.CULL_FACE,
    goog.webgl.DEPTH_TEST,
    goog.webgl.DITHER,
    goog.webgl.POLYGON_OFFSET_FILL,
    // goog.webgl.SAMPLE_ALPHA_TO_COVERAGE, // SAMPLE_COVERAGE_INVERT?
    // goog.webgl.SAMPLE_COVERAGE, // SAMPLE_COVERAGE_VALUE?
    goog.webgl.SCISSOR_TEST,
    goog.webgl.STENCIL_TEST];

  /**
   * Backup of states in toggleStates_. Mapping from enum to enabled/disabled.
   * @type {Object.<number, boolean>}
   * @private
   */
  this.savedToggleStates_ = {};

  /**
   * Backup of the active texture unit. Mapping from enum to enabled/disabled.
   * @type {Object.<number, boolean>}
   * @private
   */
  this.savedActiveTexture_ = null;

  /**
   * Backup of texture binding 2Ds. Mapping from texture unit to texture.
   * @type {Object.<number, WebGLTexture>}
   * @private
   */
  this.savedTextureBinding2Ds_ = {};

  /**
   * Backup of texture binding cube maps. Mapping from texture unit to texture.
   * @type {Object.<number, WebGLTexture>}
   * @private
   */
  this.savedTextureBindingCubeMaps_ = {};
};
goog.inherits(wtf.replay.graphics.WebGLState, goog.Disposable);


/**
 * @override
 */
wtf.replay.graphics.WebGLState.prototype.disposeInternal = function() {
  goog.base(this, 'disposeInternal');
};


/**
 * Backup selected portions of the current WebGL state.
 */
wtf.replay.graphics.WebGLState.prototype.backup = function() {
  var gl = this.context_;

  // Backup toggleable states.
  var toggleStatesLength = this.toggleStates_.length;
  for (var i = 0; i < toggleStatesLength; i++) {
    var toggleState = this.toggleStates_[i];
    this.savedToggleStates_[toggleState] = gl.getParameter(toggleState);
  }

  // Backup texture bindings.
  // TODO(scotttodd): Support parameterized number of texture units to backup.
  this.savedActiveTexture_ = /** @type {number} */ (gl.getParameter(
      goog.webgl.ACTIVE_TEXTURE));
  var maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
  for (var i = 0; i < maxTextureUnits; i++) {
    gl.activeTexture(goog.webgl.TEXTURE0 + i);
    this.savedTextureBinding2Ds_[i] = gl.getParameter(
        goog.webgl.TEXTURE_BINDING_2D);
    this.savedTextureBindingCubeMaps_[i] = gl.getParameter(
        goog.webgl.TEXTURE_BINDING_CUBE_MAP);
  }
  gl.activeTexture(this.savedActiveTexture_);

  this.backupStored_ = true;
};


/**
 * Restore the portions of the WebGL state that were saved.
 */
wtf.replay.graphics.WebGLState.prototype.restore = function() {
  goog.asserts.assert(this.backupStored_);

  var gl = this.context_;

  // Restore toggleable states.
  for (var savedState in this.savedToggleStates_) {
    this.savedToggleStates_[savedState] ?
        gl.enable(savedState) : gl.disable(savedState);
  }

  // Restore texture bindings
  var maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
  for (var i = 0; i < maxTextureUnits; i++) {
    gl.activeTexture(goog.webgl.TEXTURE0 + i);
    gl.bindTexture(goog.webgl.TEXTURE_2D, this.savedTextureBinding2Ds_[i]);
    gl.bindTexture(goog.webgl.TEXTURE_CUBE_MAP,
        this.savedTextureBindingCubeMaps_[i]);
  }
  gl.activeTexture(this.savedActiveTexture_);
};
