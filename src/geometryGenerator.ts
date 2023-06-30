import { mat4, vec3 } from "wgpu-matrix"
import { TriangleMesh, Vertex } from "./TriangleMesh"

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

export class GeoemtryGenerator {
    constructor() {

    }

    createBox(device : GPUDevice, width : number, height : number, depth : number, numSubdivisions : number,uvScale : number) {
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
            new Vertex([-halfWidth, -halfHeight, -halfDepth], [-1.0, 0.0, 0.0],  [0.0, 0.0, 1.0], [1.0, 0.0]),
            new Vertex([-halfWidth, -halfHeight, +halfDepth], [-1.0, 0.0, 0.0],  [0.0, 0.0, 1.0], [1.0, 1.0]),
            new Vertex([-halfWidth, +halfHeight, +halfDepth], [-1.0, 0.0, 0.0],  [0.0, 0.0, 1.0], [0.0, 1.0]),
            new Vertex([-halfWidth, +halfHeight, -halfDepth], [-1.0, 0.0, 0.0],  [0.0, 0.0, 1.0], [0.0, 1.0]),

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

        const indices = new Int32Array([
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
        ])

        return new TriangleMesh(device, vertices, indices)
    }

    midPoint(v0 : Vertex, v1 : Vertex) {
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

    subdivide(mesh : TriangleMesh) {
        var inputCopy = deepCopy(mesh)
        mesh.vertices = []
        mesh.indices = new Int32Array([])

        var numTriangles = inputCopy.indexCount / 3

        for (let i = 0; i < numTriangles; i++) {
            var v0 = inputCopy.vertices[0]
            var v1 = inputCopy.vertices[1]
            var v2 = inputCopy.vertices[2]

            var m0 = this.midPoint(v0, v1)
            var m1 = this.midPoint(v1, v2)
            var m2 = this.midPoint(v0, v2)

            
        }
    }
}