var Base = require("../base.js");

var Xflow = Base.Xflow;

/**
 * Content of this file:
 * Result classes of an Xflow graph which are received through Requests.
 */

/**
 * Abstract Result structure containing a (processed) result of the Xflow graph.
 * @abstract
 */
var Result = function(){
    this.loading = false;
    /** Valid is false if an error occurred during the processing of the result */
    this.valid = false;
    this._listeners = [];
    this._requests = [];
};

/**
 * @param {function(Xflow.Result, Xflow.RESULT_STATE)} callback
 */
Result.prototype.addListener = function(callback){
    this._listeners.push(callback);
};

/**
 * @param {function(Xflow.Result, Xflow.RESULT_STATE)} callback
 */
Result.prototype.removeListener = function(callback){
    Array.erase(this._listeners, callback);
};

/**
 * @param {function(Xflow.Result, Xflow.RESULT_STATE)} callback
 */
Result.prototype._addRequest = function(request){
    this._requests.push(request);
};

/**
 * @param {function(Xflow.Result, Xflow.RESULT_STATE)} callback
 */
Result.prototype._removeRequest = function(request){
    Array.erase(this._requests, request);
};


Result.prototype._notifyChanged = function(state){
    this.valid = false;
    for(var i = 0; i < this._requests.length; ++i){
        this._requests[i]._onResultChanged(state);
    }
    Xflow._queueResultCallback(this, state);
}

Result.prototype._onResultChanged = function(state){
    for(var i = 0; i < this._listeners.length; ++i){
        this._listeners[i](this, state);
    }
}



/**
 * ComputeResult contains a named map of typed values.
 * @constructor
 * @extends {Xflow.Result}
 */
var ComputeResult = function(){
    Xflow.Result.call(this);
    this._outputNames = [];
    /** @type {Object.<string,DataEntry>} */
    this._dataEntries = {};
};
Base.createClass(ComputeResult, Result);

Object.defineProperty(ComputeResult.prototype, "outputNames", {
    set: function(v){
        throw new Error("outputNames is readonly");
    },
    get: function(){ return this._outputNames; }
});

ComputeResult.prototype.getOutputData = function(name){
    return this._dataEntries[name];
};

/**
 * @returns {Object.<string,DataEntry>}
 */
ComputeResult.prototype.getOutputMap = function() {
    return this._dataEntries;
};



/**
 * VSDataResult is used to analyse the output of a VertexShader
 * Note that the VSDataResult is not used to generate the VertexShader directly.
 * For that, the Xflow.VertexShader structure must be created from Xflow.VertexShaderRequest
 * @constructor
 * @extends {Xflow.Result}
 */
var VSDataResult = function(){
    Xflow.Result.call(this);
    this._program = null;
    this._programData = null;
};
Base.createClass(VSDataResult, Result);

Object.defineProperty(VSDataResult.prototype, "outputNames", {
    set: function(v){
        throw new Error("shaderOutputNames is readonly");
    },
    get: function(){ return this._program.getOutputNames(); }
});

VSDataResult.prototype.isOutputUniform = function(name){
    return this._program.isOutputUniform(name);
}
VSDataResult.prototype.isOutputNull = function(name){
    return this._program.isOutputNull(name);
}
VSDataResult.prototype.getOutputType = function(name){
    return this._program.getOutputType(name);
}
VSDataResult.prototype.getVertexShader = function(vsConfig){
    return this._program.createVertexShader(this._programData, vsConfig);
}

module.exports = {
    ComputeResult:  ComputeResult,
    VSDataResult: VSDataResult
};
