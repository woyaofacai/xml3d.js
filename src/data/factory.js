// data/factory.js
(function() {
    "use strict";
    
    /**
     * Class XML3D.webgl.XML3DDataAdapterFactory
     * extends: XML3D.data.AdapterFactory
     *
     * XML3DDataAdapterFactory creates DataAdapter instances for elements using generic data (<mesh>, <data>, <float>,...).
     * Additionally, it manages all DataAdapter instances so that for each node there is always just one DataAdapter. When
     * it creates a DataAdapter, it calls its init method. Currently, the following elements are supported:
     *
     * <ul>
     *      <li>mesh</li>
     *      <li>shader</li>
     *      <li>lightshader</li>
     *      <li>float</li>
     *      <li>float2</li>
     *      <li>float3</li>
     *      <li>float4</li>
     *      <li>int</li>
     *      <li>bool</li>
     *      <li>texture</li>
     *      <li>data</li>
     * </ul>
     *
     * @author Kristian Sons
     * @author Benjamin Friedrich
     *
     * @version  10/2010  1.0
     */

    /**
     * Constructor of XML3D.webgl.XML3DDataAdapterFactory
     *
     * @augments XML3D.data.AdapterFactory
     * @constructor
     *
     * @param handler
     */
    var XML3DDataAdapterFactory = function(handler)
    {
        XML3D.data.AdapterFactory.call(this);
        this.handler = handler;
    };
    XML3D.createClass(XML3DDataAdapterFactory, XML3D.data.AdapterFactory);

    /**
     * Returns a DataAdapter instance associated with the given node. If there is already a DataAdapter created for this node,
     * this instance is returned, otherwise a new one is created.
     *
     * @param   node  element node which uses generic data. The supported elements are listed in the class description above.
     * @returns DataAdapter instance
     */
    XML3DDataAdapterFactory.prototype.getAdapter = function(node)
    {
        return XML3D.data.AdapterFactory.prototype.getAdapter.call(this, node, XML3D.data.XML3DDataAdapterFactory.prototype);
    };

    var data = XML3D.data,
    reg = {
        mesh:          data.SinkDataAdapter,
        shader:        data.SinkDataAdapter,
        lightshader:   data.SinkDataAdapter,
        float:         data.ValueDataAdapter,
        float2:        data.ValueDataAdapter,
        float3:        data.ValueDataAdapter,
        float4:        data.ValueDataAdapter,
        float4x4:      data.ValueDataAdapter,
        int:           data.ValueDataAdapter,
        int4:          data.ValueDataAdapter,
        bool:          data.ValueDataAdapter,
        img:           data.ImgDataAdapter,
        texture:       data.TextureDataAdapter,
        data:          data.DataAdapter
    };
    /**
     * Creates a DataAdapter associated with the given node.
     *
     * @param   node  element node which uses generic data. The supported elements are listed in the class description above.
     * @returns DataAdapter instance
     */
    XML3DDataAdapterFactory.prototype.createAdapter = function(node)
    {
        XML3D.debug.logDebug("Creating adapter: " + node.localName);
        var adapterContructor = reg[node.localName];
        if(adapterContructor !== undefined) {
            return new adapterContructor(this, node);
        }
        XML3D.debug.logWarning("Not supported as data element: " + node.localName);
        return null;
    };

    // Export
    XML3D.data.XML3DDataAdapterFactory = XML3DDataAdapterFactory;

    
}());