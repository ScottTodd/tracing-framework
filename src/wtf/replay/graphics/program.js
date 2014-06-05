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
  var attachedShaders = gl.getAttachedShaders(originalProgram);

  for (var i = 0; i < attachedShaders.length; ++i) {
    var shaderType = gl.getShaderParameter(attachedShaders[i],
        goog.webgl.SHADER_TYPE);

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
 * Creates and links a variant program.
 * If optional sources are not defined, the original shaders are used.
 * @param {!string} variantName The name of the variant program to create.
 * @param {string=} opt_vertexShaderSource Custom vertex shader source.
 * @param {string=} opt_fragmentShaderSource Custom fragment shader source.
 */
wtf.replay.graphics.Program.prototype.createVariantProgram =
    function(variantName, opt_vertexShaderSource, opt_fragmentShaderSource) {
  // TODO(scotttodd): Prevent overriding internal variants (reserved names?).

  var context = this.context;

  // Do not recreate an already existing variant.
  if (this.variants_[variantName]) {
    return;
  }

  this.variants_[variantName] = context.createProgram();

  // Create the vertex shader if needed and attach it.
  var variantVertexShader = null;
  if (opt_vertexShaderSource) {
    variantVertexShader = context.createShader(goog.webgl.VERTEX_SHADER);
    context.shaderSource(variantVertexShader, opt_vertexShaderSource);
    context.compileShader(variantVertexShader);
  } else {
    variantVertexShader = this.originalVertexShader_;
  }
  context.attachShader(this.variants_[variantName], variantVertexShader);

  // Create the fragment shader if needed and attach it.
  var variantFragmentShader = null;
  if (opt_fragmentShaderSource) {
    variantFragmentShader = context.createShader(goog.webgl.FRAGMENT_SHADER);
    context.shaderSource(variantFragmentShader, opt_fragmentShaderSource);
    context.compileShader(variantFragmentShader);
  } else {
    variantFragmentShader = this.originalFragmentShader_;
  }
  context.attachShader(this.variants_[variantName], variantFragmentShader);

  // Link the program, now that all shaders are attached.
  context.linkProgram(this.variants_[variantName]);

  // Detach all shaders and delete any custom shaders.
  context.detachShader(this.variants_[variantName], variantVertexShader);
  context.detachShader(this.variants_[variantName], variantFragmentShader);
  if (opt_vertexShaderSource) {
    context.deleteShader(variantVertexShader);
  }
  if (opt_fragmentShaderSource) {
    context.deleteShader(variantFragmentShader);
  }
};


/**
 * Creates and links an internally defined variant program.
 * @param {!string} variantName The name of the variant program to create.
 * @private
 */
wtf.replay.graphics.Program.prototype.createInternalVariant_ =
    function(variantName) {
  // highlight: Draws all affected pixels with a solid color.
  if (variantName === 'highlight') {
    // Use a custom fragment shader with the original vertex shader.
    var highlightFragmentSource = 'void main(void) { ' +
        'gl_FragColor = vec4(0.1, 0.1, 0.4, 1.0); }';

    this.createVariantProgram('highlight', undefined, highlightFragmentSource);
  } else if (variantName === 'overdraw') {
    // Use a custom fragment shader with the original vertex shader.
    var overdrawFragmentSource = 'void main(void) { ' +
        'gl_FragColor = vec4(0.1, 0.1, 0.1, 0.4); }';

    this.createVariantProgram('overdraw', undefined, overdrawFragmentSource);
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


/**
 * Calls the specified draw function using the specified variant program.
 * @param {function()} drawFunction The draw function to call.
 * @param {!string} variantName The name of the variant program to use.
 */
wtf.replay.graphics.Program.prototype.drawWithVariant =
    function(drawFunction, variantName) {
  if (!this.variants_[variantName]) {
    this.createInternalVariant_(variantName);
  }

  this.syncPrograms_(variantName);

  this.context.useProgram(this.variants_[variantName]);

  drawFunction();

  this.context.useProgram(this.originalProgram_);
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
    var uniformInfo = context.getActiveUniform(this.originalProgram_, i);

    // Get uniform value from the original program.
    var uniformLocationOriginal = context.getUniformLocation(
        this.originalProgram_, uniformInfo.name);
    var uniformValue = /** @type {?} */ (context.getUniform(
        this.originalProgram_, uniformLocationOriginal));

    // Set uniform in variant.
    context.useProgram(this.variants_[variantName]);

    var uniformLocationVariant = context.getUniformLocation(
        this.variants_[variantName], uniformInfo.name);

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
    var attributeInfo = context.getActiveAttrib(this.originalProgram_, i);

    var attribLocationOriginal = context.getAttribLocation(
        this.originalProgram_, attributeInfo.name);

    var attribArrayEnabled = context.getVertexAttrib(
        attribLocationOriginal, goog.webgl.VERTEX_ATTRIB_ARRAY_ENABLED);

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
      context.useProgram(this.variants_[variantName]);

      var attribLocationVariant = context.getAttribLocation(
          this.variants_[variantName], attributeInfo.name);
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
