/**
 *
 * @constructor
 */
var ObjectSorter = function () {

};

var c_bbox = XML3D.math.bbox.create();
var c_center = XML3D.math.vec3.create();

XML3D.extend(ObjectSorter.prototype, {
    /**
     * @param {GLScene} scene
     * @param {Float32Array?} viewMatrix Matrix to apply to objects world space extend before sorting
     */
    sortScene: function (scene, viewMatrix) {
        var sourceObjectArray = scene.ready, opaque = {}, transparent = [];

        var transparentArray = [], obj;
        for (var i = 0, l = sourceObjectArray.length; i < l; i++) {
            obj = sourceObjectArray[i];
            if (obj.inFrustum === false) {
                continue;
            }
            if (obj.hasTransparency()) {
                transparentArray.push(obj);
            } else {
                var program = obj.getProgram();
                opaque[program.id] = opaque[program.id] || [];
                opaque[program.id].push(obj);
            }
        }

        // Sort opaque objects from front to back in order
        // to have earlier z-fails
        for (var progId in opaque) {
            var withinShader = opaque[progId];
            var sortedArray = new Array(withinShader.length);
            for (i = 0; i < withinShader.length; i++) {
                obj = withinShader[i];
                obj.getWorldSpaceBoundingBox(c_bbox);
                XML3D.math.bbox.center(c_center, c_bbox);
                viewMatrix && XML3D.math.vec3.transformMat4(c_center, c_center, viewMatrix);
                sortedArray[i] = {
                    obj: obj, depth: c_center[2]
                };
            }
            sortedArray.sort(function (a, b) {
                return b.depth - a.depth;
            });
            opaque[progId] = sortedArray.map(function(e) { return e.obj; });
        }

        var cameraPosition = scene.getActiveView().position;

        //Sort transparent objects from back to front
        var tlength = transparentArray.length;
        if (tlength > 1) {
            for (i = 0; i < tlength; i++) {
                obj = transparentArray[i];
                obj.getWorldSpaceBoundingBox(c_bbox);
                XML3D.math.bbox.center(c_center, c_bbox);
                viewMatrix && XML3D.math.vec3.transformMat4(c_center, c_center, viewMatrix);
                transparentArray[i] = [obj, c_center[2]];
            }

            transparentArray.sort(function (a, b) {
                return a[1] - b[1];
            });

            for (i = 0; i < tlength; i++) {
                addTransparent(transparent, transparentArray[i][0], cameraPosition);
            }
        } else if (tlength == 1) {
            addTransparent(transparent, transparentArray[0], cameraPosition);
        }
        return {
            opaque: opaque, transparent: transparent
        }
    }
});

function addTransparent(transparent, obj, cameraPosition) {
    if (obj.drawable.getType() == "volume") {
        obj.drawable._octree.getSortedNodes(obj, transparent, cameraPosition);
    } else {
        transparent.push(obj);
    }
}


module.exports = ObjectSorter;


