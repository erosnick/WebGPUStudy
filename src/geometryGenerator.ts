import { TriangleMesh } from "./TriangleMesh"

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

        const vertices = new Float32Array([
            // 前
            -halfWidth, -halfHeight, +halfDepth, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 0.0, 0.0,
            +halfWidth, -halfHeight, +halfDepth, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0,
            +halfWidth, +halfHeight, +halfDepth, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 1.0,
            -halfWidth, +halfHeight, +halfDepth, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 1.0,

            // 后
            +halfWidth, -halfHeight, -halfDepth, 1.0, 0.0, 0.0, -1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,
            -halfWidth, -halfHeight, -halfDepth, 1.0, 0.0, 0.0, -1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 0.0,
            -halfWidth, +halfHeight, -halfDepth, 1.0, 0.0, 0.0, -1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0,
            +halfWidth, +halfHeight, -halfDepth, 1.0, 0.0, 0.0, -1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0,

            // 左
            -halfWidth, -halfHeight, -halfDepth, 1.0, -1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 0.0,
            -halfWidth, -halfHeight, +halfDepth, 1.0, -1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0,
            -halfWidth, +halfHeight, +halfDepth, 1.0, -1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0,
            -halfWidth, +halfHeight, -halfDepth, 1.0, -1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0,

            // 右
            +halfWidth, -halfHeight, +halfDepth, 1.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 1.0, 0.0,
            +halfWidth, -halfHeight, -halfDepth, 1.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0,
            +halfWidth, +halfHeight, -halfDepth, 1.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,
            +halfWidth, +halfHeight, +halfDepth, 1.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,

            // 上
            -halfWidth, +halfHeight, +halfDepth, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 0.0, 1.0,
            +halfWidth, +halfHeight, +halfDepth, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0,
            +halfWidth, +halfHeight, -halfDepth, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0,
            -halfWidth, +halfHeight, -halfDepth, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0,

            // 下
            -halfWidth, -halfHeight, -halfDepth, 1.0, 0.0, -1.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.0, 1.0,
            +halfWidth, -halfHeight, -halfDepth, 1.0, 0.0, -1.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 1.0,
            +halfWidth, -halfHeight, +halfDepth, 1.0, 0.0, -1.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0,
            -halfWidth, -halfHeight, +halfDepth, 1.0, 0.0, -1.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0,
        ])

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

    midPoint()

    subdivide(mesh : TriangleMesh) {
        var inputCopy = deepCopy(mesh)
        mesh.vertices = new Float32Array([])
        mesh.indices = new Int32Array([])


    }
}