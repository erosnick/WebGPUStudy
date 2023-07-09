import { Vec3 } from "wgpu-matrix/dist/1.x/vec3"
import { SurfaceMaterial } from "./SurfaceMaterial"

export const SphereSize = 48

export class Sphere {
    center!: Vec3
    radius!: number
    material!: SurfaceMaterial
    time0!: number
    time1!: number

    constructor(center: Vec3 = [], radius: number = 0.0, material: SurfaceMaterial, time0: number, time1: number) {
        this.center = center
        this.radius = radius
        this.material = material
        this.time0 = time0
        this.time1 = time1
    }
}