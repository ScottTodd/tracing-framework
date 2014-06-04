/**
 * Copyright 2014 Google, Inc. All Rights Reserved.
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

/**
 * @fileoverview Program. Stores a WebGL shader program and its variants.
 * Variants typically replace the fragment shader.
 *
 * @author scotttodd@google.com (Scott Todd)
 */

goog.provide('wtf.replay.graphics.Program');

goog.require('goog.webgl');



/**
 * Stores a WebGL shader program and its variants.
 *
 * @param {!WebGLProgram} originalProgram Original WebGL shader program.
 *     Vertex and fragment shaders must already be attached.
 * @param {!WebGLRenderingContext} gl The context used by originalProgram.
 * @constructor
 */
wtf.replay.graphics.Program = function(originalProgram, gl) {
  /**
   * Unmodified WebGL shader program.
   * @type {!WebGLProgram}
   * @private
   */
  this.originalProgram_ = originalProgram;

  /**
   * The WebGL context used by the original and all variant programs.
   * @type {!WebGLRenderingContext}
   */
  this.context = gl;

  /**
   * A mapping of handles to WebGL objects.
   * @type {!Object.<!Object>}
   * @private
   */
  this.objects_ = {};

  // TODO(scotttodd): find these shaders on demand?
  /**
   * Original vertex shader used by originalProgram.
   * @type {WebGLShader}
   * @private
   */
  this.originalVertexShader_ = null;

  /**
   * Original fragment shader used by originalProgram.
   * @type {WebGLShader}
   * @private
   */
  this.originalFragmentShader_ = null;

  // Find and set originalVertexShader_ and originalFragmentShader_.
  var attachedShaders = /** @type {Array.<!WebGLShader>} */ (
      gl.getAttachedShaders(originalProgram));

  for (var i = 0; i < attachedShaders.length; ++i) {
    var shaderType = /** @type {number} */ (
        gl.getShaderParameter(attachedShaders[i], goog.webgl.SHADER_TYPE));

    if (shaderType == goog.webgl.VERTEX_SHADER) {
      this.originalVertexShader_ = attachedShaders[i];
    } else if (shaderType == goog.webgl.FRAGMENT_SHADER) {
      this.originalFragmentShader_ = attachedShaders[i];
    }
  }

  // TODO(scotttodd): create a mapping of <variantName, variantProgram>
  // TODO(scotttodd): initialize this on demand?
  /**
   * Modified shader program that draws all affected pixels with a solid color.
   * @type {WebGLProgram}
   * @private
   */
  this.highlightProgram_ = gl.createProgram();
  // objs[args['buffer']] = gl.createBuffer();
  // TODO(scotttodd): set playback owning context (__gl_context__)
  //     for programs + shaders

  // Create and link highlightProgram_.
  // Use the original vertex shader.
  gl.attachShader(this.highlightProgram_, this.originalVertexShader_);

  // Debug: Use a custom fragment shader (modified from learning-webgl-5).
  // var highlightFragmentSource = /** @type {string} */ (
  //     'precision mediump float;' +
  //     'varying vec2 vTextureCoord;' +
  //     'uniform sampler2D uSampler;' +
  //     'void main(void) {' +
  //     '    gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.t,' +
  //     '        vTextureCoord.s)).xyzw + vec4(0.0, 0.1, 0.0, 1.0);' +
  //     '}');
  // var highlightFragmentShader = /** @type {WebGLShader} */ (
  //     gl.createShader(goog.webgl.FRAGMENT_SHADER));
  // gl.shaderSource(highlightFragmentShader, highlightFragmentSource);
  // gl.compileShader(highlightFragmentShader);
  // gl.attachShader(this.highlightProgram_, highlightFragmentShader);

  // Use a custom fragment shader.
  var highlightFragmentSource = /** @type {string} */ (
      'void main(void) { gl_FragColor = vec4(0.1, 0.1, 0.4, 1.0); }');
  var highlightFragmentShader = /** @type {WebGLShader} */ (
      gl.createShader(goog.webgl.FRAGMENT_SHADER));
  gl.shaderSource(highlightFragmentShader, highlightFragmentSource);
  gl.compileShader(highlightFragmentShader);
  gl.attachShader(this.highlightProgram_, highlightFragmentShader);

  gl.linkProgram(this.highlightProgram_);

  this.syncPrograms_('blah', this.context);
};


/**
 * Prepares a variant program for drawing.
 * @param {!string} variantName The name of the variant program to sync.
 */
wtf.replay.graphics.Program.prototype.prepareToDraw =
    function(variantName) {
  // TODO(scotttodd): on-demand creation, error checking on variantName, etc.
  this.syncPrograms_(variantName, this.context);

  this.context.useProgram(this.highlightProgram_);
};


/**
 * Copies uniforms and attributes from the original program to a variant.
 * @param {!string} variantName The name of the variant program to sync.
 * @param {!WebGLRenderingContext} gl The WebGL rendering context.
 * @private
 */
wtf.replay.graphics.Program.prototype.syncPrograms_ =
    function(variantName, gl) {

  // Sync uniforms.
  var activeUniformsCount = /** @type {number} */ (gl.getProgramParameter(
      this.originalProgram_, goog.webgl.ACTIVE_UNIFORMS));
  // goog.global.console.log('activeUniformsCount: ' + activeUniformsCount);

  for (var i = 0; i < activeUniformsCount; ++i) {
    var uniform = /** @type {WebGLActiveInfo} */ (
        gl.getActiveUniform(this.originalProgram_, i));
    // goog.global.console.log(uniform);

    // http://www.javascripture.com/WebGLActiveInfo
    // WebGLActiveInfo {name: "uMVMatrix", type: 35676, size: 1}
    // type is FLOAT, FLOAT_MAT2, FLOAT_VEC4, SAMPLER_2D, etc.
    // call uniform1f, uniform2fv, etc.?

    // Get uniform value from the original program.
    var uniformLocationOriginal = /** @type {WebGLUniformLocation} */ (
        gl.getUniformLocation(this.originalProgram_, uniform.name));
    var uniformValue = /** @type {*} */ (
        gl.getUniform(this.originalProgram_, uniformLocationOriginal));
    // goog.global.console.log(uniformValue);

    // Set uniform in variant.
    gl.useProgram(this.highlightProgram_);

    var uniformLocationVariant = /** @type {WebGLUniformLocation} */ (
        gl.getUniformLocation(this.highlightProgram_, uniform.name));

    if (uniform.type == goog.webgl.FLOAT_MAT4) {
      gl.uniformMatrix4fv(uniformLocationVariant, false, uniformValue);
    } else if (uniform.type == goog.webgl.SAMPLER_2D) {
      gl.uniform1i(uniformLocationVariant, uniformValue);
    } else {
      goog.global.console.log('Syncing uniform of type <' + uniform.type +
          '> is not implemented yet.');
    }

    gl.useProgram(this.originalProgram_);
  }

  // Sync attributes.
  var activeAttributesCount = /** @type {number} */ (gl.getProgramParameter(
      this.originalProgram_, goog.webgl.ACTIVE_ATTRIBUTES));
  // goog.global.console.log('activeAttributesCount: ' + activeAttributesCount);

  for (var i = 0; i < activeAttributesCount; ++i) {
    var attribute = /** @type {WebGLActiveInfo} */ (
        gl.getActiveAttrib(this.originalProgram_, i));
    // goog.global.console.log(attribute);

    var attribLocationOriginal = /** @type {number} */ (
        gl.getAttribLocation(this.originalProgram_, attribute.name));

    var attribArrayEnabled = /** @type {boolean} */ (gl.getVertexAttrib(
        attribLocationOriginal, goog.webgl.VERTEX_ATTRIB_ARRAY_ENABLED));

    if (attribArrayEnabled) {
      // Get original vertex attribute array properties.
      var attribArraySize = /** @type {number} */ (gl.getVertexAttrib(
          attribLocationOriginal, goog.webgl.VERTEX_ATTRIB_ARRAY_SIZE));
      var attribArrayType = /** @type {number} */ (gl.getVertexAttrib(
          attribLocationOriginal, goog.webgl.VERTEX_ATTRIB_ARRAY_TYPE));
      var attribArrayNormalized = /** @type {boolean} */ (gl.getVertexAttrib(
          attribLocationOriginal, goog.webgl.VERTEX_ATTRIB_ARRAY_NORMALIZED));
      var attribArrayStride = /** @type {number} */ (gl.getVertexAttrib(
          attribLocationOriginal, goog.webgl.VERTEX_ATTRIB_ARRAY_STRIDE));
      var attribArrayOffset = /** @type {number} */ (gl.getVertexAttribOffset(
          attribLocationOriginal, goog.webgl.VERTEX_ATTRIB_ARRAY_POINTER));
      var attribArrayBufferBinding = /** @type {WebGLBuffer} */ (
          gl.getVertexAttrib(attribLocationOriginal,
          goog.webgl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING));

      // Set attribute in the variant program.
      gl.useProgram(this.highlightProgram_);

      var attribLocationVariant = /** @type {number} */ (
          gl.getAttribLocation(this.highlightProgram_, attribute.name));
      // If the attribute is not used (compiled out) in the variant, ignore it.
      if (attribLocationVariant >= 0) {
        gl.enableVertexAttribArray(attribLocationVariant);
        gl.bindBuffer(gl.ARRAY_BUFFER, attribArrayBufferBinding);

        gl.vertexAttribPointer(attribLocationVariant, attribArraySize,
            attribArrayType, attribArrayNormalized, attribArrayStride,
            attribArrayOffset);
      }

      gl.useProgram(this.originalProgram_);
    }
  }
};
