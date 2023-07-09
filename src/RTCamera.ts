import { Vec3 } from "wgpu-matrix/dist/1.x/vec3"
import { vec3 } from "wgpu-matrix"
import { radians } from "./Math"

export class RTCamera {
    lookFrom!: Vec3
    lookAt!: Vec3
    up!: Vec3
    verticalFOV!: number
    aspectRatio!: number
    aperture!: number
    focusDistance!: number
    viewportHeight!: number
    viewportWidth!: number
    w!: Vec3
    u!: Vec3
    v!: Vec3
    time0!: number
    time1!: number

    constructor(lookFrom: Vec3, lookAt: Vec3, up: Vec3, verticalFOV: number, aspectRatio: number, 
                aperture: number, focusDistance: number, time0: number, time1: number) {
        this.lookFrom = lookFrom
        this.lookAt = lookAt
        this.up = up
        this.verticalFOV = verticalFOV
        this.aspectRatio = aspectRatio
        this.aperture = aperture
        this.focusDistance = focusDistance

        var theta = radians(this.verticalFOV)
        var h = Math.tan(theta / 2.0)

        this.viewportHeight = 2.0 * h
        this.viewportWidth = this.aspectRatio * this.viewportHeight

        this.w = vec3.normalize(vec3.sub(this.lookFrom, this.lookAt))
        this.u = vec3.normalize(vec3.cross(this.up, this.w));
        this.v = vec3.cross(this.w, this.u);

        this.time0 = time0
        this.time1 = time1
    }
}