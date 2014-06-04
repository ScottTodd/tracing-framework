/**
 * Copyright 2014 Google, Inc. All Rights Reserved.
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

/**
 * @fileoverview Program. Stores a WebGL shader program and its variants.
 * Variants typically replace the fragment shader.
 * Syncs uniforms and attributes between the original program and the variants
 * whenever a variant is requested for usage.
 *
 * @author scotttodd@google.com (Scott Todd)
 */

goog.provide('wtf.replay.graphics.Program');

goog.require('goog.asserts');
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

  /**
   * A mapping of variant names to compiled variant shader programs.
   * @type {!Object.<!string, WebGLProgram>}
   * @private
   */
  this.variants_ = {};
};


/**
 * Creates and links the variant program specified.
 * @param {!string} variantName The name of the variant program to create.
 * @private
 */
wtf.replay.graphics.Program.prototype.createVariant_ =
    function(variantName) {
  // TODO(scotttodd): allow for optional custom variants

  var context = this.context;

  // Modified shader program that draws all affected pixels with a solid color.
  if (variantName === 'highlight') {
    this.variants_['highlight'] = /** @type {WebGLProgram} */ (
        context.createProgram());

    // Use the original vertex shader.
    context.attachShader(this.variants_['highlight'],
        this.originalVertexShader_);

    // Debug: Use the original fragment shader.
    // context.attachShader(this.variants_['highlight'],
    //     this.originalFragmentShader_);

    // Use a custom fragment shader.
    var highlightFragmentSource = /** @type {string} */ (
        'void main(void) { gl_FragColor = vec4(0.1, 0.1, 0.4, 1.0); }');
    var highlightFragmentShader = /** @type {WebGLShader} */ (
        context.createShader(goog.webgl.FRAGMENT_SHADER));
    context.shaderSource(highlightFragmentShader, highlightFragmentSource);
    context.compileShader(highlightFragmentShader);
    context.attachShader(this.variants_['highlight'], highlightFragmentShader);

    context.linkProgram(this.variants_['highlight']);

    // Detach and delete shaders programs after linking.
    context.detachShader(
        this.variants_['highlight'], this.originalVertexShader_);
    context.detachShader(
        this.variants_['highlight'], highlightFragmentShader);
    context.deleteShader(highlightFragmentShader);
  } else {
    goog.asserts.fail('Unsupported variant name.');
  }
};


/**
 * Delete all variant programs from the context and removes references to them.
 */
wtf.replay.graphics.Program.prototype.deleteVariants = function() {
  for (var variantName in this.variants_) {
    this.context.deleteProgram(this.variants_[variantName]);
  }

  this.variants_ = {};
};


// TODO(scotttodd): Replace prepareToDraw with a draw wrapper that takes a
//     function as an input parameter? Use goog.bind?
/**
 * Prepares a variant program for drawing.
 * @param {!string} variantName The name of the variant program to sync.
 */
wtf.replay.graphics.Program.prototype.prepareToDraw =
    function(variantName) {
  if (!this.variants_[variantName]) {
    this.createVariant_(variantName);
  }

  this.syncPrograms_(variantName);

  this.context.useProgram(this.variants_['highlight']);
};


/**
 * Copies uniforms and attributes from the original program to a variant.
 * @param {!string} variantName The name of the variant program to sync.
 * @private
 */
wtf.replay.graphics.Program.prototype.syncPrograms_ =
    function(variantName) {

  var context = this.context;

  // Sync uniforms.
  var activeUniformsCount = /** @type {number} */ (context.getProgramParameter(
      this.originalProgram_, goog.webgl.ACTIVE_UNIFORMS));

  for (var i = 0; i < activeUniformsCount; ++i) {
    var uniformInfo = /** @type {WebGLActiveInfo} */ (
        context.getActiveUniform(this.originalProgram_, i));

    // Get uniform value from the original program.
    var uniformLocationOriginal = /** @type {WebGLUniformLocation} */ (
        context.getUniformLocation(this.originalProgram_, uniformInfo.name));
    var uniformValue = /** @type {?} */ (
        context.getUniform(this.originalProgram_, uniformLocationOriginal));

    // Set uniform in variant.
    context.useProgram(this.variants_['highlight']);

    var uniformLocationVariant = /** @type {WebGLUniformLocation} */ (
        context.getUniformLocation(this.variants_['highlight'],
        uniformInfo.name));

    switch (uniformInfo.type) {
      case goog.webgl.BOOL:
        context.uniform1i(uniformLocationVariant, uniformValue);
        break;
      case goog.webgl.BOOL_VEC2:
        context.uniform2iv(uniformLocationVariant, uniformValue);
        break;
      case goog.webgl.BOOL_VEC3:
        context.uniform3iv(uniformLocationVariant, uniformValue);
        break;
      case goog.webgl.INT:
        context.uniform1i(uniformLocationVariant, uniformValue);
        break;
      case goog.webgl.INT_VEC2:
        context.uniform2iv(uniformLocationVariant, uniformValue);
        break;
      case goog.webgl.INT_VEC3:
        context.uniform3iv(uniformLocationVariant, uniformValue);
        break;
      case goog.webgl.INT_VEC4:
        context.uniform4iv(uniformLocationVariant, uniformValue);
        break;
      case goog.webgl.FLOAT:
        context.uniform1f(uniformLocationVariant, uniformValue);
        break;
      case goog.webgl.FLOAT_VEC2:
        context.uniform2fv(uniformLocationVariant, uniformValue);
        break;
      case goog.webgl.FLOAT_VEC3:
        context.uniform3fv(uniformLocationVariant, uniformValue);
        break;
      case goog.webgl.FLOAT_VEC4:
        context.uniform4fv(uniformLocationVariant, uniformValue);
        break;
      case goog.webgl.FLOAT_MAT2:
        context.uniformMatrix2fv(uniformLocationVariant, false, uniformValue);
        break;
      case goog.webgl.FLOAT_MAT3:
        context.uniformMatrix3fv(uniformLocationVariant, false, uniformValue);
        break;
      case goog.webgl.FLOAT_MAT4:
        context.uniformMatrix4fv(uniformLocationVariant, false, uniformValue);
        break;
      case goog.webgl.SAMPLER_2D:
        context.uniform1i(uniformLocationVariant, uniformValue);
        break;
      case goog.webgl.SAMPLER_CUBE:
        context.uniform1i(uniformLocationVariant, uniformValue);
        break;
      default:
        goog.asserts.fail('Unsupported uniform type.');
        break;
    }

    context.useProgram(this.originalProgram_);
  }

  // Sync attributes.
  var activeAttributesCount = /** @type {number} */ (
      context.getProgramParameter(this.originalProgram_,
      goog.webgl.ACTIVE_ATTRIBUTES));

  for (var i = 0; i < activeAttributesCount; ++i) {
    var attributeInfo = /** @type {WebGLActiveInfo} */ (
        context.getActiveAttrib(this.originalProgram_, i));

    var attribLocationOriginal = /** @type {number} */ (
        context.getAttribLocation(this.originalProgram_, attributeInfo.name));

    var attribArrayEnabled = /** @type {boolean} */ (context.getVertexAttrib(
        attribLocationOriginal, goog.webgl.VERTEX_ATTRIB_ARRAY_ENABLED));

    if (attribArrayEnabled) {
      // Get original vertex attribute array properties.
      var attribArraySize = /** @type {number} */ (context.getVertexAttrib(
          attribLocationOriginal, goog.webgl.VERTEX_ATTRIB_ARRAY_SIZE));
      var attribArrayType = /** @type {number} */ (context.getVertexAttrib(
          attribLocationOriginal, goog.webgl.VERTEX_ATTRIB_ARRAY_TYPE));
      var attribArrayNormalized = /** @type {boolean} */ (
          context.getVertexAttrib(attribLocationOriginal,
          goog.webgl.VERTEX_ATTRIB_ARRAY_NORMALIZED));
      var attribArrayStride = /** @type {number} */ (context.getVertexAttrib(
          attribLocationOriginal, goog.webgl.VERTEX_ATTRIB_ARRAY_STRIDE));
      var attribArrayOffset = /** @type {number} */ (
          context.getVertexAttribOffset(attribLocationOriginal,
          goog.webgl.VERTEX_ATTRIB_ARRAY_POINTER));
      var attribArrayBufferBinding = /** @type {WebGLBuffer} */ (
          context.getVertexAttrib(attribLocationOriginal,
          goog.webgl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING));

      // Set attribute in the variant program.
      context.useProgram(this.variants_['highlight']);

      var attribLocationVariant = /** @type {number} */ (
          context.getAttribLocation(this.variants_['highlight'],
          attributeInfo.name));
      // If the attribute is not used (compiled out) in the variant, ignore it.
      if (attribLocationVariant >= 0) {
        context.enableVertexAttribArray(attribLocationVariant);
        context.bindBuffer(goog.webgl.ARRAY_BUFFER, attribArrayBufferBinding);

        context.vertexAttribPointer(attribLocationVariant, attribArraySize,
            attribArrayType, attribArrayNormalized, attribArrayStride,
            attribArrayOffset);
      }

      context.useProgram(this.originalProgram_);
    }
  }
};
