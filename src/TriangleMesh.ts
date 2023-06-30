import { mat4, vec3 } from "wgpu-matrix"
import { Vec2 } from "wgpu-matrix/dist/1.x/vec2"
import { Vec3 } from "wgpu-matrix/dist/1.x/vec3"

export class Vertex {
    position : Vec3
    normal : Vec3
    color : Vec3
    texcoord : Vec2

    constructor(position : Vec3, normal : Vec3, color : Vec3, texcoord : Vec2) {
        this.position = position
        this.normal = normal
        this.color = color
        this.texcoord = texcoord
    }
}

export class TriangleMesh {
    vertexBuffer : GPUBuffer
    indexBuffer : GPUBuffer

    vertices : Vertex[]
    indices : Int32Array

    vertexCount : number
    indexCount : number

    constructor(device: GPUDevice, vertices: Vertex[], indices : Int32Array) {
        var vertexBufferData = new Float32Array(vertices.length * 32)

        for (let i = 0; i < vertices.length; i++) {
            var vertex = vertices[i]
            vertexBufferData[i * 11] = vertex.position[0];
            vertexBufferData[i * 11 + 1] = vertex.position[1];
            vertexBufferData[i * 11 + 2] = vertex.position[2];

            vertexBufferData[i * 11 + 3] = vertex.normal[0];
            vertexBufferData[i * 11 + 4] = vertex.normal[1];
            vertexBufferData[i * 11 + 5] = vertex.normal[2];

            vertexBufferData[i * 11 + 6] = vertex.color[0];
            vertexBufferData[i * 11 + 7] = vertex.color[1];
            vertexBufferData[i * 11 + 8] = vertex.color[2];

            vertexBufferData[i * 11 + 9] = vertex.texcoord[0];
            vertexBufferData[i * 11 + 10] = vertex.texcoord[1];
        }

        this.vertexBuffer = device.createBuffer({
            // 顶点长度
            size: vertexBufferData.byteLength,
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
        device.queue.writeBuffer(this.vertexBuffer, 0, vertexBufferData)
        device.queue.writeBuffer(this.indexBuffer, 0, indices)

        this.vertices = vertices
        this.indices = indices

        this.vertexCount = vertices.length / 13
        this.indexCount = indices.length
    }
}