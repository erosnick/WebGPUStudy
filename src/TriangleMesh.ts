import { mat4, vec3 } from "wgpu-matrix"
import { Vec2 } from "wgpu-matrix/dist/1.x/vec2"
import { Vec3 } from "wgpu-matrix/dist/1.x/vec3"
import { Material } from "./Material"

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
    vertexBuffer!: GPUBuffer
    indexBuffer!: GPUBuffer

    vertices!: Vertex[]
    indices!: Uint32Array

    vertexCount!: number
    indexCount!: number

    vertexBufferLayout!: GPUVertexBufferLayout

    material!: Material

    constructor(device: GPUDevice, vertices: Vertex[], indices: Uint32Array, material: Material) {
        var vertexBufferData = new Float32Array(vertices.length * 11)

        for (let i = 0; i < vertices.length; i++) {
            var vertex = vertices[i]
            vertexBufferData[i * 11] = vertex.position[0]
            vertexBufferData[i * 11 + 1] = vertex.position[1]
            vertexBufferData[i * 11 + 2] = vertex.position[2]

            vertexBufferData[i * 11 + 3] = vertex.normal[0]
            vertexBufferData[i * 11 + 4] = vertex.normal[1]
            vertexBufferData[i * 11 + 5] = vertex.normal[2]

            vertexBufferData[i * 11 + 6] = vertex.color[0]
            vertexBufferData[i * 11 + 7] = vertex.color[1]
            vertexBufferData[i * 11 + 8] = vertex.color[2]

            vertexBufferData[i * 11 + 9] = vertex.texcoord[0]
            vertexBufferData[i * 11 + 10] = vertex.texcoord[1]
        }

        this.initialize(device, vertexBufferData, indices, material)
    }

    initialize(device: GPUDevice, vertices: Float32Array, indices: Uint32Array, material: Material) {
        this.vertexBuffer = device.createBuffer({
            // 顶点长度
            size: vertices.length * 4,
            // 用途，用于顶点着色，可写
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        })

        this.indexBuffer = device.createBuffer({
            // 顶点长度
            size: indices.length * 4,
            // 用途，用于顶点着色，可写
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        })

        // 写入数据
        // device.queue.writeBuffer(this.vertexBuffer, 0, vertexBufferData)

        new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices)
        this.vertexBuffer.unmap()

        // device.queue.writeBuffer(this.indexBuffer, 0, indexData)

        new Uint32Array(this.indexBuffer.getMappedRange()).set(indices)
        this.indexBuffer.unmap()

        this.indices = indices

        this.vertexCount = (vertices.length * 4) / 44
        this.indexCount = indices.length

        this.vertexBufferLayout = {
            // 顶点长度，以字节为单位
            arrayStride: 11 * 4,
            attributes: [
                {
                    // 变量索引
                    shaderLocation: 0,
                    // 偏移
                    offset: 0,
                    // 参数格式
                    format: "float32x3",
                },
                {
                    // 变量索引
                    shaderLocation: 1,
                    // 偏移
                    offset: 3 * 4,
                    // 参数格式
                    format: "float32x3",
                },
                {
                    // 变量索引
                    shaderLocation: 2,
                    // 偏移
                    offset: 6 * 4,
                    // 参数格式
                    format: "float32x3",
                },
                {
                    // 变量索引
                    shaderLocation: 3,
                    // 偏移
                    offset: 9 * 4,
                    // 参数格式
                    format: "float32x2",
                },
            ],
        }

        this.material = material
    }
}