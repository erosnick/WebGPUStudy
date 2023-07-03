import { Vec3 } from "wgpu-matrix/dist/1.x/vec3"

export class Sphere {
    center!: Vec3
    color!: Vec3
    radius!: number
    surfaceType!: number
}