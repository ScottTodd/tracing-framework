/**
 * Copyright 2014 Google, Inc. All Rights Reserved.
 *
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */

/**
 * @fileoverview IntermediateBuffer. Stores an offscreen framebuffer.
 * Supports drawing that buffer as a texture into the active framebuffer.
 *
 * @author scotttodd@google.com (Scott Todd)
 */

goog.provide('wtf.replay.graphics.IntermediateBuffer');

goog.require('goog.Disposable');
goog.require('goog.asserts');
goog.require('goog.webgl');
goog.require('wtf.replay.graphics.WebGLState');



/**
 * Stores an offscreen framebuffer that renders into a texture.
 * Buffers are created using dimensions width and height.
 * However, these can be resized after creation using the resize method.
 *
 * @param {!WebGLRenderingContext} gl The context to work with.
 * @param {!number} width The width of the rendered area.
 * @param {!number} height The height of the rendered area.
 * @constructor
 * @extends {goog.Disposable}
 */
wtf.replay.graphics.IntermediateBuffer = function(gl, width, height) {
  goog.base(this);

  /**
   * The WebGL context to backup and restore.
   * @type {!WebGLRenderingContext}
   * @private
   */
  this.context_ = gl;

  /**
   * The width of the rendered area.
   * @type {number}
   * @private
   */
  this.width_ = width;

  /**
   * The height of the rendered area.
   * @type {number}
   * @private
   */
  this.height_ = height;

  /**
   * A backup/restore utility for this context.
   * @type {!wtf.replay.graphics.WebGLState}
   * @private
   */
  this.webGLState_ = new wtf.replay.graphics.WebGLState(gl);

  /**
   * Whether or not resizing is enabled.
   * @type {boolean}
   * @private
   */
  this.resizeDisabled_ = false;

  /**
   * The intermediate framebuffer for rendering into.
   * @type {WebGLFramebuffer}
   * @private
   */
  this.framebuffer_ = null;

  /**
   * Texture that the framebuffer renders into.
   * @type {WebGLTexture}
   * @private
   */
  this.rtt_ = null;

  /**
   * Renderbuffer used for depth information in the intermediate framebuffer.
   * @type {WebGLRenderbuffer}
   * @private
   */
  this.renderbuffer_ = null;

  /**
   * A shader program that simply draws a texture.
   * @type {WebGLProgram}
   * @private
   */
  this.drawTextureProgram_ = null;

  /**
   * A buffer containing vertex positions arranged in a square.
   * @type {WebGLBuffer}
   * @private
   */
  this.squareVertexPositionBuffer_ = null;

  /**
   * A buffer containing texture coordinates arranged for a square.
   * @type {WebGLBuffer}
   * @private
   */
  this.squareTextureCoordBuffer_ = null;

  // Create the objects declared above.
  this.initialize_();
};
goog.inherits(wtf.replay.graphics.IntermediateBuffer, goog.Disposable);


/**
 * @override
 */
wtf.replay.graphics.IntermediateBuffer.prototype.disposeInternal = function() {
  var gl = this.context_;

  gl.deleteFramebuffer(this.framebuffer_);
  gl.deleteTexture(this.rtt_);
  gl.deleteRenderbuffer(this.renderbuffer_);
  gl.deleteProgram(this.drawTextureProgram_);
  gl.deleteBuffer(this.squareVertexPositionBuffer_);
  gl.deleteBuffer(this.squareTextureCoordBuffer_);

  goog.base(this, 'disposeInternal');
};


/**
 * Create framebuffer, render texture, drawTextureProgram, and buffers.
 * @private
 */
wtf.replay.graphics.IntermediateBuffer.prototype.initialize_ = function() {
  var gl = this.context_;

  this.webGLState_.backup();

  // Create the intermediate framebuffer for rendering.
  this.framebuffer_ = gl.createFramebuffer();
  gl.bindFramebuffer(goog.webgl.FRAMEBUFFER, this.framebuffer_);

  // Create the texture that the framebuffer should render into.
  this.rtt_ = gl.createTexture();
  gl.bindTexture(goog.webgl.TEXTURE_2D, this.rtt_);
  gl.texParameteri(goog.webgl.TEXTURE_2D, goog.webgl.TEXTURE_MAG_FILTER,
      goog.webgl.LINEAR);
  gl.texParameteri(goog.webgl.TEXTURE_2D, goog.webgl.TEXTURE_MIN_FILTER,
      goog.webgl.LINEAR);
  gl.texParameteri(goog.webgl.TEXTURE_2D, goog.webgl.TEXTURE_WRAP_S,
      goog.webgl.CLAMP_TO_EDGE);
  gl.texParameteri(goog.webgl.TEXTURE_2D, goog.webgl.TEXTURE_WRAP_T,
      goog.webgl.CLAMP_TO_EDGE);
  gl.texImage2D(goog.webgl.TEXTURE_2D, 0, goog.webgl.RGBA, this.width_,
      this.height_, 0, goog.webgl.RGBA, goog.webgl.UNSIGNED_BYTE, null);
  gl.framebufferTexture2D(goog.webgl.FRAMEBUFFER,
      goog.webgl.COLOR_ATTACHMENT0, goog.webgl.TEXTURE_2D, this.rtt_, 0);

  // Create a renderbuffer for depth information.
  this.renderbuffer_ = gl.createRenderbuffer();
  gl.bindRenderbuffer(goog.webgl.RENDERBUFFER, this.renderbuffer_);
  gl.renderbufferStorage(goog.webgl.RENDERBUFFER,
      goog.webgl.DEPTH_COMPONENT16, this.width_, this.height_);
  gl.framebufferRenderbuffer(goog.webgl.FRAMEBUFFER,
      goog.webgl.DEPTH_ATTACHMENT, goog.webgl.RENDERBUFFER,
      this.renderbuffer_);

  // Create a program to draw a texture.
  var program = gl.createProgram();
  var drawTextureVertexSource = 'attribute vec2 aVertexPosition;' +
      'attribute vec2 aTextureCoord;' +
      'varying vec2 vTextureCoord;' +
      'void main(void) {' +
      '  vTextureCoord = aTextureCoord;' +
      '  gl_Position = vec4(aVertexPosition, 0.0, 1.0);' +
      '}';
  var drawTextureFragmentSource = 'precision mediump float;' +
      'varying vec2 vTextureCoord;' +
      'uniform sampler2D uSampler;' +
      'void main(void) {' +
      '  gl_FragColor = texture2D(uSampler,' +
      '      vec2(vTextureCoord.s, vTextureCoord.t));' +
      '}';

  // Compile shader sources.
  var drawTextureVertexShader = gl.createShader(goog.webgl.VERTEX_SHADER);
  gl.shaderSource(drawTextureVertexShader, drawTextureVertexSource);
  gl.compileShader(drawTextureVertexShader);

  var drawTextureFragmentShader = gl.createShader(goog.webgl.FRAGMENT_SHADER);
  gl.shaderSource(drawTextureFragmentShader, drawTextureFragmentSource);
  gl.compileShader(drawTextureFragmentShader);

  // Attach shaders and link the drawTexture program.
  gl.attachShader(program, drawTextureVertexShader);
  gl.attachShader(program, drawTextureFragmentShader);
  gl.linkProgram(program);
  goog.asserts.assert(gl.getProgramParameter(program, goog.webgl.LINK_STATUS));
  this.drawTextureProgram_ = program;

  gl.detachShader(program, drawTextureVertexShader);
  gl.detachShader(program, drawTextureFragmentShader);
  gl.deleteShader(drawTextureVertexShader);
  gl.deleteShader(drawTextureFragmentShader);

  // Setup attributes aVertexPosition and aTextureCoord
  this.squareVertexPositionBuffer_ = gl.createBuffer();
  gl.bindBuffer(goog.webgl.ARRAY_BUFFER, this.squareVertexPositionBuffer_);
  var vertices = [
    -1.0, -1.0,
    1.0, -1.0,
    -1.0, 1.0,
    -1.0, 1.0,
    1.0, -1.0,
    1.0, 1.0];
  gl.bufferData(goog.webgl.ARRAY_BUFFER, new Float32Array(vertices),
      goog.webgl.STATIC_DRAW);

  this.squareTextureCoordBuffer_ = gl.createBuffer();
  gl.bindBuffer(goog.webgl.ARRAY_BUFFER, this.squareTextureCoordBuffer_);
  var textureCoords = [
    0.0, 0.0,
    1.0, 0.0,
    0.0, 1.0,
    0.0, 1.0,
    1.0, 0.0,
    1.0, 1.0];
  gl.bufferData(goog.webgl.ARRAY_BUFFER, new Float32Array(textureCoords),
      goog.webgl.STATIC_DRAW);

  this.webGLState_.restore();
};


/**
 * Prevents resizing until enableResize is called.
 */
wtf.replay.graphics.IntermediateBuffer.prototype.disableResize = function() {
  this.resizeDisabled_ = true;
};


/**
 * Restore resizing.
 */
wtf.replay.graphics.IntermediateBuffer.prototype.enableResize = function() {
  this.resizeDisabled_ = false;
};


/**
 * Resize the render texture and renderbuffer.
 * @param {!number} width The new width of the rendered area.
 * @param {!number} height The new height of the rendered area.
 */
wtf.replay.graphics.IntermediateBuffer.prototype.resize = function(
    width, height) {
  var gl = this.context_;

  if (this.resizeDisabled_ ||
      (this.width_ === width && this.height_ === height)) {
    return;
  }

  this.webGLState_.backup();

  this.width_ = width;
  this.height_ = height;

  gl.bindTexture(goog.webgl.TEXTURE_2D, this.rtt_);
  gl.texImage2D(goog.webgl.TEXTURE_2D, 0, goog.webgl.RGBA, this.width_,
      this.height_, 0, goog.webgl.RGBA, goog.webgl.UNSIGNED_BYTE, null);

  gl.bindRenderbuffer(goog.webgl.RENDERBUFFER, this.renderbuffer_);
  gl.renderbufferStorage(goog.webgl.RENDERBUFFER,
      goog.webgl.DEPTH_COMPONENT16, this.width_, this.height_);

  this.webGLState_.restore();
};


/**
 * Binds the internal framebuffer.
 */
wtf.replay.graphics.IntermediateBuffer.prototype.bindFramebuffer = function() {
  var gl = this.context_;

  gl.bindFramebuffer(goog.webgl.FRAMEBUFFER, this.framebuffer_);
};


/**
 * Captures the pixel contents of the active framebuffer in the texture.
 */
wtf.replay.graphics.IntermediateBuffer.prototype.captureTexture = function() {
  var gl = this.context_;

  var originalTextureBinding = /** @type {!WebGLTexture} */ (
      gl.getParameter(goog.webgl.TEXTURE_BINDING_2D));

  gl.bindTexture(goog.webgl.TEXTURE_2D, this.rtt_);
  gl.copyTexImage2D(goog.webgl.TEXTURE_2D, 0, goog.webgl.RGBA, 0, 0,
      this.width_, this.height_, 0);

  gl.bindTexture(goog.webgl.TEXTURE_2D, originalTextureBinding);
};


/**
 * Clears the framebuffer and the attached render texture.
 */
wtf.replay.graphics.IntermediateBuffer.prototype.clear = function() {
  var gl = this.context_;

  this.webGLState_.backup();

  this.bindFramebuffer();
  gl.clearColor(0.0, 0.0, 0.0, 0.0);
  gl.clear(goog.webgl.COLOR_BUFFER_BIT | goog.webgl.DEPTH_BUFFER_BIT);

  this.webGLState_.restore();
};


/**
 * Draws the render texture using an internal shader to the active framebuffer.
 * @param {boolean=} opt_blend If true, use alpha blending. Otherwise no blend.
 */
wtf.replay.graphics.IntermediateBuffer.prototype.drawTexture = function(
    opt_blend) {
  var gl = this.context_;

  this.webGLState_.backup();

  gl.useProgram(this.drawTextureProgram_);

  // Disable all attributes.
  var maxVertexAttribs = /** @type {number} */ (gl.getParameter(
      goog.webgl.MAX_VERTEX_ATTRIBS));
  for (var i = 0; i < maxVertexAttribs; i++) {
    gl.disableVertexAttribArray(i);
  }

  // Update vertex attrib settings.
  var vertexAttribLocation = gl.getAttribLocation(this.drawTextureProgram_,
      'aVertexPosition');
  gl.bindBuffer(goog.webgl.ARRAY_BUFFER, this.squareVertexPositionBuffer_);
  gl.enableVertexAttribArray(vertexAttribLocation);
  gl.vertexAttribPointer(vertexAttribLocation, 2, goog.webgl.FLOAT, false,
      0, 0);

  // Update texture coord attrib settings.
  var textureCoordAttribLocation = gl.getAttribLocation(
      this.drawTextureProgram_, 'aTextureCoord');
  gl.bindBuffer(goog.webgl.ARRAY_BUFFER, this.squareTextureCoordBuffer_);
  gl.enableVertexAttribArray(textureCoordAttribLocation);
  gl.vertexAttribPointer(textureCoordAttribLocation, 2, goog.webgl.FLOAT,
      false, 0, 0);

  // Disable instancing for attributes, if the extension exists.
  var ext = gl.getExtension('ANGLE_instanced_arrays');
  if (ext) {
    ext['vertexAttribDivisorANGLE'](vertexAttribLocation, 0);
    ext['vertexAttribDivisorANGLE'](textureCoordAttribLocation, 0);
  }

  var uniformLocation = gl.getUniformLocation(this.drawTextureProgram_,
      'uSampler');
  gl.activeTexture(goog.webgl.TEXTURE0);
  gl.bindTexture(goog.webgl.TEXTURE_2D, this.rtt_);
  gl.uniform1i(uniformLocation, 0);

  // Change states prior to drawing.
  gl.disable(goog.webgl.CULL_FACE);
  gl.frontFace(goog.webgl.CCW);
  gl.disable(goog.webgl.DEPTH_TEST);
  gl.disable(goog.webgl.DITHER);
  gl.disable(goog.webgl.SCISSOR_TEST);
  gl.disable(goog.webgl.STENCIL_TEST);
  gl.colorMask(true, true, true, true);

  if (opt_blend) {
    gl.enable(goog.webgl.BLEND);
    gl.blendFunc(goog.webgl.SRC_ALPHA, goog.webgl.ONE_MINUS_SRC_ALPHA);
  } else {
    gl.disable(goog.webgl.BLEND);
  }

  // Draw the intermediate buffer's render texture to the current framebuffer.
  gl.drawArrays(goog.webgl.TRIANGLES, 0, 6);

  this.webGLState_.restore();
};
