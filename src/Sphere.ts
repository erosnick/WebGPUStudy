import { Vec3 } from "wgpu-matrix/dist/1.x/vec3"
import { SurfaceMaterial } from "./SurfaceMaterial"

export const SphereSize = 48

export class Sphere {
    center!: Vec3
    radius!: number
    material!: SurfaceMaterial

    constructor(center: Vec3 = [], radius: number = 0.0, material: SurfaceMaterial) {
        this.center = center
        this.radius = radius
        this.material = material
    }
}