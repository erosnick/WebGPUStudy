import { Vec3 } from "wgpu-matrix/dist/1.x/vec3";

export class BVHNode {
    minCorner!: Vec3
    leftChild!: number
    maxCorner!: Vec3
    sphereCount!: number
}