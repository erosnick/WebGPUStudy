import { mat4, vec3 } from "wgpu-matrix"
import { Vec3 } from "wgpu-matrix/dist/1.x/vec3"
import { radians } from "./Math"

export enum CameraMovement {
    FORWARD,
    BACKWARD,
    LEFT,
    RIGHT,
    UP,
    DOWN
}

const YAW = -90.0
const PITCH = 0.0
const SPEED = 2.5
const SENSITIVITY = 0.1
const ZOOM = 60.0

// An abstract camera class that processes input and calculates the corresponding Euler Angles, Vectors and Matrices for use in OpenGL
export class Camera {
    // camera Attributes
    position: Vec3
    front: Vec3
    right: Vec3
    up: Vec3
    worldUp: Vec3
    // euler Angles
    yaw: number
    pitch: number
    // camera options
    movementSpeed: number
    mouseSensitivity: number
    zoom: number

    // constructor with vectors
    constructor(position: Vec3 = [0.0, 0.0, 0.0], up: Vec3 = [0.0, 1.0, 0.0], yaw: number = YAW, pitch: number = PITCH) {
        this.front = [0.0, 0.0, -1.0]
        this.right = [1.0, 0.0, 0.0]
        this.up = up
        this.movementSpeed = SPEED
        this.mouseSensitivity = SENSITIVITY
        this.zoom = ZOOM
        this.position = position
        this.worldUp = this.up
        this.yaw = yaw
        this.pitch = pitch

        this.updateCameraVectors()
    }

    // returns the view matrix calculated using Euler Angles and the LookAt Matrix
    getViewMatrix() {
        var target = vec3.add(this.position, this.front)
        let camera = mat4.lookAt(this.position, target, this.up)

        return mat4.inverse(camera);
    }

    // processes input received from any keyboard-like input system. Accepts input parameter in the form of camera defined ENUM (to abstract it from windowing systems)
    processKeyboard(direction: CameraMovement, deltaTime: number) {
        var velocity = this.movementSpeed * deltaTime

        if (direction == CameraMovement.FORWARD) {
            this.position = vec3.add(this.position, vec3.mulScalar(this.front, velocity))
        }

        if (direction == CameraMovement.BACKWARD) {
            this.position = vec3.sub(this.position, vec3.mulScalar(this.front, velocity))
        }

        if (direction == CameraMovement.LEFT) {
            this.position = vec3.sub(this.position, vec3.mulScalar(this.right, velocity))
        }

        if (direction == CameraMovement.RIGHT) {
            this.position = vec3.add(this.position, vec3.mulScalar(this.right, velocity))
        }

        if (direction == CameraMovement.UP) {
            this.position = vec3.add(this.position, vec3.mulScalar(this.up, velocity))
        }

        if (direction == CameraMovement.DOWN) {
            this.position = vec3.sub(this.position, vec3.mulScalar(this.up, velocity))
        }
    }

    // processes input received from a mouse input system. Expects the offset value in both the x and y direction.
    processMouseMovement(xoffset: number, yoffset: number, constrainPitch: boolean = true) {
        xoffset *= this.mouseSensitivity
        yoffset *= this.mouseSensitivity

        this.yaw += xoffset
        this.pitch += yoffset

        // make sure that when pitch is out of bounds, screen doesn't get flipped
        if (constrainPitch) {
            if (this.pitch > 89.0) {
                this.pitch = 89.0
            }

            if (this.pitch < -89.0) {
                this.pitch = -89.0
            }
        }

        // update Front, Right and Up Vectors using the updated Euler angles
        this.updateCameraVectors()
    }

    processMouseScroll(yoffset: number) {
        this.zoom -= yoffset

        if (this.zoom < 1.0) {
            this.zoom = 1.0
        }

        if (this.zoom > 60.0) {
            this.zoom = 60.0
        }
    }

    // calculates the front vector from the Camera's (updated) Euler Angles
    updateCameraVectors() {
        var front = [];
        front[0] = Math.cos(radians(this.yaw)) * Math.cos(radians(this.pitch))
        front[1] = Math.sin(radians(this.pitch))
        front[2] = Math.sin(radians(this.yaw)) * Math.cos(radians(this.pitch))
        this.front = vec3.normalize(front)
        // also re-calculate the right and up vector
        // normalize the vectors, because their length gets closer to 0 the more you 
        // look up or down which results in slower movement.
        this.right = vec3.normalize(vec3.cross(this.front, this.worldUp))
        this.up = vec3.normalize(vec3.cross(this.right, this.front))
    }
}