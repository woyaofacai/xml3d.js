

// Adapter for <shader>
org.xml3d.webgl.XML3DShaderRenderAdapter = function(factory, node) {
	org.xml3d.webgl.RenderAdapter.call(this, factory, node);
	this.program = null;
	this.gl = this.factory.handler.gl;
	
	this.renderer = this.factory.renderer;
	
	this.dataAdapter = this.renderer.dataFactory.getAdapter(this.node);
	if(this.dataAdapter)
		this.dataAdapter.registerObserver(this.renderer);
	else
		org.xml3d.debug.logError("Data adapter for a shader element could not be created!");
	
	//Collect textures (if any)
	this.textures = {};
	var dataTable = this.dataAdapter.createDataTable();
	for (var param in dataTable) {
		if (dataTable[param].isTexture) {
			this.textures[param] = {
				adapter : factory.getAdapter(dataTable[param].node, org.xml3d.webgl.Renderer.prototype),
				info	: { texUnit : 0 }
			};		
		}
	}
};

org.xml3d.webgl.XML3DShaderRenderAdapter.prototype = new org.xml3d.webgl.RenderAdapter();
org.xml3d.webgl.XML3DShaderRenderAdapter.prototype.constructor = org.xml3d.webgl.XML3DShaderRenderAdapter;

org.xml3d.webgl.XML3DShaderRenderAdapter.prototype.__defineGetter__(
		"shaderProgram", (function() {
		
			if (this.program) 
				return this.program;
			
			//Create the shader program for this node
			var sources = {vs:null, fs:null};
			
			if (this.node.hasAttribute("script"))
			{
				var scriptURL = this.node.getAttribute("script");
				if (new org.xml3d.URI(scriptURL).scheme == "urn") {
					//Internal shader
					this.getStandardShaderSource(scriptURL, sources);
					this.program = this.createShaderProgram(sources);
					this.gl.useProgram(this.program.handle);
					this.setStandardUniforms();
					return this.program;
				} else {
					//User-provided shader
					var vsScript = this.node.xml3ddocument.resolve(scriptURL
							+ "-vs");
					var fsScript = this.node.xml3ddocument.resolve(scriptURL
							+ "-fs");
					if (vsScript && fsScript) {
						vertexSource = vsScript.textContent;
						fragmentSource = fsScript.textContent;
					}
				}
			}
			
			this.program = this.createShaderProgram(vertexSource, fragmentSource);
			return this.program;

}));

org.xml3d.webgl.XML3DShaderRenderAdapter.prototype.notifyChanged = function(evt) {
	if (evt.attribute == "script") {
		this.destroy();
	}
};

org.xml3d.webgl.XML3DShaderRenderAdapter.prototype.isEmpty = function(obj) {
	for (var p in obj) {
		return false;
	}
	return true;
};

org.xml3d.webgl.XML3DShaderRenderAdapter.prototype.getStandardShaderSource = function(scriptURL, sources) {
	//Need to check for textures to decide which internal shader to use
	var vertexColors = false;
	var dataTable = this.dataAdapter.createDataTable();	

	if (scriptURL == "urn:xml3d:shader:phong" && !this.isEmpty(this.textures))
		scriptURL = "urn:xml3d:shader:texturedphong";
	
	if (dataTable.useVertexColor && dataTable.useVertexColor.data[0] == true)
		scriptURL += "vcolor";
	
	if (scriptURL == "urn:xml3d:shader:phong" || scriptURL == "urn:xml3d:shader:phongvcolor" || scriptURL == "urn:xml3d:shader:texturedphong")
	{
		// Workaround for lack of dynamic loops on ATI cards below the HD 5000 line
		var sfrag = g_shaders[scriptURL].fragment;
		var tail = sfrag.substring(68, sfrag.length);
		var maxLights = "#ifdef GL_ES\nprecision highp float;\n" +
				"#endif\n\n const int MAXLIGHTS = "+ this.renderer.lights.length.toString() + ";\n";

		var frag = maxLights + tail;
		
		sources.vs = g_shaders[scriptURL].vertex;
		sources.fs = frag;
	} 
	else if (g_shaders[scriptURL]) {
		sources.vs = g_shaders[scriptURL].vertex;
		sources.fs = g_shaders[scriptURL].fragment;
	}
};

org.xml3d.webgl.XML3DShaderRenderAdapter.prototype.createShaderProgram = function(sources) {
	var gl = this.gl;
	
	if (!sources.vs || !sources.fs) {
		return this.createShaderProgram( gl, g_shaders["urn:xml3d:shader:flat"].vertex, 
				 							 g_shaders["urn:xml3d:shader:flat"].fragment );	
	}
	
	var prg = gl.createProgram();
	
	var vShader = this.compileShader(gl.VERTEX_SHADER, sources.vs);
	var fShader = this.compileShader(gl.FRAGMENT_SHADER, sources.fs);
	
	if (vShader === null || fShader === null) {
		//Use a default flat shader instead
		return this.createShaderProgram( gl, g_shaders["urn:xml3d:shader:flat"].vertex, 
											 g_shaders["urn:xml3d:shader:flat"].fragment );
	}
	
	//Link shader program	
	gl.attachShader(prg, vShader);
	gl.attachShader(prg, fShader);
	gl.linkProgram(prg);
	
	if (gl.getProgramParameter(prg, gl.LINK_STATUS) == 0) {
		var errorString = "Shader linking failed: \n";
		errorString += gl.getProgramInfoLog(prg);
		errorString += "\n--------\n";
		org.xml3d.debug.logError(errorString);
		gl.getError();
		
		return this.createShaderProgram( gl, g_shaders["urn:xml3d:shader:flat"].vertex, 
				 							 g_shaders["urn:xml3d:shader:flat"].fragment );
	}
	
	var programObject = { 	attributes 	: {}, 
							uniforms 	: {}, 
							samplers	: {},
							handle		: prg };
	
	gl.useProgram(prg);
	
	//Tally shader attributes
	var numAttributes = gl.getProgramParameter(prg, gl.ACTIVE_ATTRIBUTES);
	for (var i=0; i<numAttributes; i++) {
		var att = gl.getActiveAttrib(prg, i);
		if (!att) continue;
		var attInfo = {};
		attInfo.name = att.name;
		attInfo.size = att.size;
		attInfo.glType = att.type;
		attInfo.location = gl.getAttribLocation(prg, att.name);
		programObject.attributes[att.name] = attInfo;
	}
	
	//TODO: shader not picking up light uniforms?
	//Tally shader uniforms and samplers
	var texCount = 0;
	var numUniforms = gl.getProgramParameter(prg, gl.ACTIVE_UNIFORMS);
	for (var i=0; i<numUniforms; i++) {
		var uni = gl.getActiveUniform(prg, i);
		if (!uni) continue;
		var uniInfo = {};	
		uniInfo.name = uni.name;
		uniInfo.size = uni.size;
		uniInfo.glType = uni.type;
		uniInfo.location = gl.getUniformLocation(prg, uni.name);
		
		if (uni.type == gl.SAMPLER_2D || uni.type == gl.SAMPLER_CUBE) {
			uniInfo.texUnit = texCount;
			this.textures[uni.name].info = uniInfo;

			programObject.samplers[uni.name] = uniInfo;
			texCount++;
		}
		else
			programObject.uniforms[uni.name] = uniInfo;
	}
	
	return programObject;
};

org.xml3d.webgl.XML3DShaderRenderAdapter.prototype.compileShader = function(type, shaderSource) {
	var gl = this.gl;
	
	var shd = gl.createShader(type);
	gl.shaderSource(shd, shaderSource);
	gl.compileShader(shd);
	
	if (gl.getShaderParameter(shd, gl.COMPILE_STATUS) == 0) {
		var errorString = "";
		if (type == gl.VERTEX_SHADER)
			errorString = "Vertex shader failed to compile: \n";
		else
			errorString = "Fragment shader failed to compile: \n";
		
		errorString += gl.getShaderInfoLog(shd) + "\n--------\n";
		org.xml3d.debug.logError(errorString);
		gl.getError();
		
		return null;
	}
	
	return shd;
	
};

org.xml3d.webgl.XML3DShaderRenderAdapter.prototype.bindProgram = function() {	
	this.gl.useProgram(this.shaderProgram.handle);
};

org.xml3d.webgl.XML3DShaderRenderAdapter.prototype.destroy = function() {
	if (this.shaderProgram)
		this.gl.deleteProgram(this.shaderProgram.handle);
};

org.xml3d.webgl.XML3DShaderRenderAdapter.prototype.dispose = function() {
	Array.forEach(this.textures, function(t) {
		t.adapter.destroy();
	});
	this.destroy();
};

org.xml3d.webgl.XML3DShaderRenderAdapter.prototype.setStandardUniforms = function() {
	var sp = this.shaderProgram;
	var gl = this.gl;
	
	var uniform = null;
	
	//Diffuse color
	uniform = sp.uniforms.diffuseColor;
	if (uniform) { 
		this.setUniform(gl, uniform, [1.0, 1.0, 1.0]);
	}
	
	//Emissive color
	uniform = sp.uniforms.emissiveColor;
	if (uniform) { 
		this.setUniform(gl, uniform, [0.0, 0.0, 0.0]);
	}
	
	//Specular color
	uniform = sp.uniforms.specularColor;
	if (uniform) { 
		this.setUniform(gl, uniform, [0.0, 0.0, 0.0]);
	}
		
	//Shininess
	uniform = sp.uniforms.shininess;
	if (uniform) { 
		this.setUniform(gl, uniform, 0.2);
	}
	
	//Transparency
	uniform = sp.uniforms.transparency;
	if (uniform) { 
		this.setUniform(gl, uniform, 0.0);
	}
	
	//org.xml3d.webgl.checkError(this.gl);
};

org.xml3d.webgl.XML3DShaderRenderAdapter.prototype.enable = function(globalUniforms) {
	this.bindProgram();	
	this.setUniformVariables(globalUniforms);
	this.bindSamplers();
};

org.xml3d.webgl.XML3DShaderRenderAdapter.prototype.disable = function() {
	this.unbindSamplers();
};

org.xml3d.webgl.XML3DShaderRenderAdapter.prototype.setUniformVariables = function(globalUniforms) {
	var dataTable = this.dataAdapter.createDataTable();
	var sp = this.shaderProgram;
	var gl = this.gl;
	
	//TODO: implement a system (maybe in the dataAdapter) so only uniforms that have changed
	//since the last frame need to be set
	
	//Set shader-specific uniforms
	for (var uniform in dataTable) {
		var u = dataTable[uniform];	
		if (u.clean === true)
			continue;
		
		if (u.isTexture) {		
			this.setUniform(gl, sp.samplers[uniform], this.textures[uniform].info.texUnit);
		} 
		else if (sp.uniforms[uniform]) {
			var data = u.data.length == 1 ? u.data[0] : u.data;
			this.setUniform(gl, sp.uniforms[uniform], data);
		}
		
		this.dataAdapter.dataTable[uniform].clean = true;
	}
	
	//Set global uniforms (lights, space conversion matrices)
	for (var uniform in globalUniforms) {
		var uValue = globalUniforms[uniform];
		
		if (sp.uniforms[uniform]) {
			this.setUniform(gl, sp.uniforms[uniform], uValue);
		}
	}
	
};

org.xml3d.webgl.XML3DShaderRenderAdapter.prototype.setUniform = function(gl, u, value) {
	switch (u.glType) {
		case gl.BOOL:
		case gl.INT:		
		case gl.SAMPLER_2D:	gl.uniform1i(u.location, value); break;	
		
		case gl.BOOL_VEC2: 	
		case gl.INT_VEC2:	gl.uniform2iv(u.location, value); break;
		
		case gl.BOOL_VEC3:	
		case gl.INT_VEC3:	gl.uniform3iv(u.location, value); break;
		
		case gl.BOOL_VEC4:	
		case gl.INT_VEC4:	gl.uniform4iv(u.location, value); break;
		
		case gl.FLOAT:		gl.uniform1f(u.location, value); break;
		case gl.FLOAT_VEC2:	gl.uniform2fv(u.location, value); break;
		case gl.FLOAT_VEC3:	gl.uniform3fv(u.location, value); break;
		case gl.FLOAT_VEC4:	gl.uniform4fv(u.location, value); break;
		
		case gl.FLOAT_MAT2: gl.uniformMatrix2fv(u.location, gl.FALSE, value); break;
		case gl.FLOAT_MAT3: gl.uniformMatrix3fv(u.location, gl.FALSE, value); break;
		case gl.FLOAT_MAT4: gl.uniformMatrix4fv(u.location, gl.FALSE, value); break;
		
		default:
			org.xml3d.debug.logError("Unknown uniform type "+u.glType);
			break;
	}
};

org.xml3d.webgl.XML3DShaderRenderAdapter.prototype.bindSamplers = function() {	
	for (var name in this.textures) {
		var tex = this.textures[name];
		tex.adapter.bind(tex.info.texUnit);		
	}
};

org.xml3d.webgl.XML3DShaderRenderAdapter.prototype.unbindSamplers = function() {
	for (var name in this.textures) {
		var tex = this.textures[name];
		tex.adapter.unbind(tex.info.texUnit);
	}
};

