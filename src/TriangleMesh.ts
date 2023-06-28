import { mat4, vec3 } from "wgpu-matrix"
import { Vec2 } from "wgpu-matrix/dist/1.x/vec2"
import { Vec3 } from "wgpu-matrix/dist/1.x/vec3"

export class Vertex {
    position : Vec3
    normal : Vec3
    texcoord : Vec2

    constructor(position : Vec3, normal : Vec3, texcoord : Vec3) {
        this.position = position
        this.normal = normal
        this.texcoord = texcoord
    }
}

export class TriangleMesh {
    vertexBuffer : GPUBuffer
    indexBuffer : GPUBuffer

    vertices : Float32Array
    indices : Int32Array

    vertexCount : number
    indexCount : number

    constructor(device: GPUDevice, vertices: Float32Array, indices : Int32Array) {
        this.vertexBuffer = device.createBuffer({
            // 顶点长度
            size: vertices.byteLength,
            // 用途，用于顶点着色，可写
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        })

        this.indexBuffer = device.createBuffer({
            // 顶点长度
            size: indices.byteLength,
            // 用途，用于顶点着色，可写
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        })

        // 写入数据
        device.queue.writeBuffer(this.vertexBuffer, 0, vertices)
        device.queue.writeBuffer(this.indexBuffer, 0, indices)

        this.vertices = vertices
        this.indices = indices

        this.vertexCount = vertices.length / 14
        this.indexCount = indices.length
    }
}