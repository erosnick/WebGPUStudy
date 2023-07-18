import { mat4, vec3 } from "wgpu-matrix"
import { TriangleMesh, Vertex } from "./TriangleMesh"
import { Material } from "./Material";

function deepCopy(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    const copy: any = Array.isArray(obj) ? [] : {};

    Object.keys(obj).forEach(key => {
        copy[key] = deepCopy(obj[key]);
    });

    return copy;
}

export function toUint32Array(array: number[]) {
    var bufferData = new Uint32Array(array.length * 4)

    for (let i = 0; i < array.length; i++) {
        bufferData[i] = array[i]
    }

    return bufferData
}

export function toFloat32Array(array: number[]) {
    var bufferData = new Float32Array(array.length * 4)

    for (let i = 0; i < array.length; i++) {
        bufferData[i] = array[i]
    }

    return bufferData
}

export class GeoemtryGenerator {
    device : GPUDevice

    constructor(device: GPUDevice) {
        this.device = device
    }

    createQuad(width: number, height: number, uvScale: number) {
        const halfWidth = 0.5 * width
        const halfHeight = 0.5 * height

        const vertices = [
            new Vertex([-halfWidth, -halfHeight, 0.0], [0.0, 0.0, 1.0], [1.0, 1.0, 1.0], [0.0, 0.0]),
            new Vertex([ halfWidth, -halfHeight, 0.0], [0.0, 0.0, 1.0], [1.0, 1.0, 1.0], [uvScale, 0.0]),
            new Vertex([ halfWidth,  halfHeight, 0.0], [0.0, 0.0, 1.0], [1.0, 1.0, 1.0], [uvScale, uvScale]),
            new Vertex([-halfWidth,  halfHeight, 0.0], [0.0, 0.0, 1.0], [1.0, 1.0, 1.0], [0.0, uvScale]),
        ]

        const indices = [0, 1, 2, 2, 3, 0]

        var indicesBufferData = toUint32Array(indices)

        return new TriangleMesh(this.device, vertices, indicesBufferData, new Material())
    }

    createBox(width: number, height: number, depth: number, numSubdivisions: number, uvScale: number) {
        const halfWidth = 0.5 * width
        const halfHeight = 0.5 * height
        const halfDepth = 0.5 * depth

        const vertices = [
            // 前
            new Vertex([-halfWidth, -halfHeight, +halfDepth], [0.0, 0.0, 1.0], [0.0, 1.0, 0.0], [0.0, 0.0]),
            new Vertex([+halfWidth, -halfHeight, +halfDepth], [0.0, 0.0, 1.0], [0.0, 1.0, 0.0], [1.0, 0.0]),
            new Vertex([+halfWidth, +halfHeight, +halfDepth], [0.0, 0.0, 1.0], [0.0, 1.0, 0.0], [1.0, 1.0]),
            new Vertex([-halfWidth, +halfHeight, +halfDepth], [0.0, 0.0, 1.0], [0.0, 1.0, 0.0], [1.0, 1.0]),

            // 后
            new Vertex([+halfWidth, -halfHeight, -halfDepth], [0.0, 0.0, -1.0], [1.0, 0.0, 0.0], [0.0, 0.0]),
            new Vertex([-halfWidth, -halfHeight, -halfDepth], [0.0, 0.0, -1.0], [1.0, 0.0, 0.0], [1.0, 0.0]),
            new Vertex([-halfWidth, +halfHeight, -halfDepth], [0.0, 0.0, -1.0], [1.0, 0.0, 0.0], [1.0, 1.0]),
            new Vertex([+halfWidth, +halfHeight, -halfDepth], [0.0, 0.0, -1.0], [1.0, 0.0, 0.0], [1.0, 1.0]),

            // 左
            new Vertex([-halfWidth, -halfHeight, -halfDepth], [-1.0, 0.0, 0.0], [0.0, 0.0, 1.0], [1.0, 0.0]),
            new Vertex([-halfWidth, -halfHeight, +halfDepth], [-1.0, 0.0, 0.0], [0.0, 0.0, 1.0], [1.0, 1.0]),
            new Vertex([-halfWidth, +halfHeight, +halfDepth], [-1.0, 0.0, 0.0], [0.0, 0.0, 1.0], [0.0, 1.0]),
            new Vertex([-halfWidth, +halfHeight, -halfDepth], [-1.0, 0.0, 0.0], [0.0, 0.0, 1.0], [0.0, 1.0]),

            // 右
            new Vertex([+halfWidth, -halfHeight, +halfDepth], [1.0, 0.0, 0.0], [1.0, 0.0, 1.0], [1.0, 0.0]),
            new Vertex([+halfWidth, -halfHeight, -halfDepth], [1.0, 0.0, 0.0], [1.0, 0.0, 1.0], [1.0, 1.0]),
            new Vertex([+halfWidth, +halfHeight, -halfDepth], [1.0, 0.0, 0.0], [1.0, 0.0, 1.0], [0.0, 1.0]),
            new Vertex([+halfWidth, +halfHeight, +halfDepth], [1.0, 0.0, 0.0], [1.0, 0.0, 1.0], [0.0, 1.0]),

            // 上
            new Vertex([-halfWidth, +halfHeight, +halfDepth], [0.0, 1.0, 0.0], [0.0, 1.0, 1.0], [0.0, 1.0]),
            new Vertex([+halfWidth, +halfHeight, +halfDepth], [0.0, 1.0, 0.0], [0.0, 1.0, 1.0], [1.0, 1.0]),
            new Vertex([+halfWidth, +halfHeight, -halfDepth], [0.0, 1.0, 0.0], [0.0, 1.0, 1.0], [1.0, 0.0]),
            new Vertex([-halfWidth, +halfHeight, -halfDepth], [0.0, 1.0, 0.0], [0.0, 1.0, 1.0], [1.0, 0.0]),

            // 下
            new Vertex([-halfWidth, -halfHeight, -halfDepth], [0.0, -1.0, 0.0], [1.0, 1.0, 0.0], [0.0, 1.0]),
            new Vertex([+halfWidth, -halfHeight, -halfDepth], [0.0, -1.0, 0.0], [1.0, 1.0, 0.0], [1.0, 1.0]),
            new Vertex([+halfWidth, -halfHeight, +halfDepth], [0.0, -1.0, 0.0], [1.0, 1.0, 0.0], [1.0, 0.0]),
            new Vertex([-halfWidth, -halfHeight, +halfDepth], [0.0, -1.0, 0.0], [1.0, 1.0, 0.0], [1.0, 0.0]),
        ]

        const indices = [
            // 前
            0, 1, 2, 
            0, 2, 3,

            // 后
            4, 5, 6,
            4, 6, 7,

            // 左
            8, 9, 10,
            8, 10, 11,

            // 右
            12, 13, 14,
            12, 14, 15,

            // 上
            16, 17, 18,
            16, 18, 19,

            // 下
            20, 21, 22,
            20, 22, 23
        ]

        var indicesBufferData = toUint32Array(indices)

        return new TriangleMesh(this.device, vertices, indicesBufferData, new Material())
    }

    createSphere(radius: number, sliceCount: number, stackCount: number, uvScale: number) {
        //
        // Compute the vertices stating at the top pole and moving down the stacks.
        //

        // Poles: note that there will be texture coordinate distortion as there is
        // not a unique point on the texture map to assign to the pole when mapping
        // a rectangular texture onto a sphere.
        var topVertex = new Vertex([0.0, radius, 0.0], [0.0, 1.0, 0.0], [1.0, 1.0, 1.0], [0.0, 0.0])
        var bottomVertex = new Vertex([0.0, radius, 0.0], [0.0, -1.0, 0.0], [1.0, 1.0, 1.0], [0.0, 1.0])

        var vertices = []

        vertices.push(topVertex)

        var phiStep = Math.PI / stackCount
        var thetaStep = 2.0 * Math.PI / sliceCount

        for (let i = 0; i <= stackCount; i++) {
            var phi = i * phiStep
            
            // Vertices of ring
            for (let j = 0; j <= sliceCount; j++) {
                var theta = j * thetaStep

			    // spherical to cartesian
                var position = [0.0, 0.0, 0.0]
                position[0] = radius * Math.sin(phi) * Math.cos(theta)
                position[1] = radius * Math.cos(phi)
                position[2] = radius * Math.sin(phi) * Math.sin(theta)

			    // Partial derivative of P with respect to theta
                // tangent
                var normal = vec3.normalize(position)

                var color = [1.0, 1.0, 1.0, 1.0]

                var texcoord = [0.0, 0.0]
                texcoord[0] = theta / (Math.PI * 2.0)
                texcoord[1] = phi / (Math.PI)

                var vertex = new Vertex(position, normal, color, texcoord)

                vertices.push(vertex)
            }
        }

        vertices.push(bottomVertex)

        //
        // Compute indices for top stack.  The top stack was written first to the vertex buffer
        // and connects the top pole to the first ring.
        //

        // Offset the indices to the index of the first vertex in the first ring.
	    // This is just skipping the top pole vertex.
        var baseIndex = 1
        var ringVertexCount = sliceCount + 1
        var indices = []
        for (let i = 0; i < stackCount; i++) {
            for (let j = 0; j < sliceCount; j++) {
                indices.push(baseIndex + i * ringVertexCount + j)
                indices.push(baseIndex + i * ringVertexCount + j + 1)
                indices.push(baseIndex + (i + 1) * ringVertexCount + j)

                indices.push(baseIndex + (i + 1) * ringVertexCount + j)
                indices.push(baseIndex + i * ringVertexCount + j + 1)
                indices.push(baseIndex + (i + 1) * ringVertexCount + j + 1)
            }
        }

        //
        // Compute indices for bottom stack.  The bottom stack was written last to the vertex buffer
        // and connects the bottom pole to the bottom ring.
        //

        // South pole vertex was added last.
        var southPoleIndex = vertices.length - 1

	    // Offset the indices to the index of the first vertex in the last ring.
        baseIndex = southPoleIndex - ringVertexCount

        for (let i = 0; i < sliceCount; i++) {
            indices.push(southPoleIndex)
            indices.push(baseIndex + i)
            indices.push(baseIndex + i + 1)
        }

        var indicesBufferData = toUint32Array(indices)
        
        return new TriangleMesh(this.device, vertices, indicesBufferData, new Material())
    }

    midPoint(v0: Vertex, v1: Vertex) {
        var p0 = v0.position
        var p1 = v1.position

        var n0 = v0.normal
        var n1 = v1.normal

        var c0 = v0.color
        var c1 = v1.color

        var t0 = v0.texcoord
        var t1 = v1.texcoord

        var position = vec3.add(p0, p1)
        position = vec3.mulScalar(position, 0.5)

        var normal = vec3.add(n0, n1)
        normal = vec3.mulScalar(normal, 0.5)
        normal = vec3.normalize(normal)

        var color = vec3.add(c0, c1)
        color = vec3.mulScalar(color, 0.5)

        var texcoord = vec3.add(t0, t1)
        texcoord = vec3.mulScalar(texcoord, 0.5)

        return new Vertex(position, normal, color, texcoord)
    }

    subdivide(mesh: TriangleMesh) {
        var inputCopy = deepCopy(mesh)
        mesh.vertices = []
        var indices = []

        var numTriangles = inputCopy.indexCount / 3

        for (let i = 0; i < numTriangles; i++) {
            var v0 = inputCopy.vertices[inputCopy.indices[i * 3 + 0]]
            var v1 = inputCopy.vertices[inputCopy.indices[i * 3 + 1]]
            var v2 = inputCopy.vertices[inputCopy.indices[i * 3 + 2]]

    		// Generate the midpoints.
            var m0 = this.midPoint(v0, v1)
            var m1 = this.midPoint(v1, v2)
            var m2 = this.midPoint(v0, v2)

            // Add new geometry
            mesh.vertices.push(v0);
            mesh.vertices.push(v1);
            mesh.vertices.push(v2);
            mesh.vertices.push(m0);
            mesh.vertices.push(m1);
            mesh.vertices.push(m2);

            indices.push(i * 6 + 0)
            indices.push(i * 6 + 3)
            indices.push(i * 6 + 5)

            indices.push(i * 6 + 3)
            indices.push(i * 6 + 4)
            indices.push(i * 6 + 5)

            indices.push(i * 6 + 5)
            indices.push(i * 6 + 4)
            indices.push(i * 6 + 2)

            indices.push(i * 6 + 3)
            indices.push(i * 6 + 1)
            indices.push(i * 6 + 4)
        }

        mesh.indices = toUint32Array(indices)
    }
}