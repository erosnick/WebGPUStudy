import { Vec3 } from "wgpu-matrix/dist/1.x/vec3";

export class SurfaceMaterial {
    color!: Vec3
    surfaceType!: number
    fuzz!: number
    indexOfRefraction!: number

    constructor(color: Vec3, surfaceType: number, fuzz: number, indexOfRefraction: number) {
        this.color = color
        this.surfaceType = surfaceType
        this.fuzz = fuzz
        this.indexOfRefraction = indexOfRefraction
    }
}