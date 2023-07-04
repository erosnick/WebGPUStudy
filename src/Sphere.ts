import { Vec3 } from "wgpu-matrix/dist/1.x/vec3"

export const SphereSize = 48

export class Sphere {
    center!: Vec3
    color!: Vec3
    radius!: number
    fuzz!: number
    surfaceType!: number

    constructor(center: Vec3 = [], color: Vec3 = [], radius: number = 0.0, fuzz: number = 0.0, surfaceType: number = 0) {
        this.center = center
        this.color = color
        this.radius = radius
        this.fuzz = fuzz
        this.surfaceType = surfaceType
    }
}