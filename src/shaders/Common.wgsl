const Infinity = 100000.0;
const Epsilon = 0.001;
const Pi = 3.14159265359;

// surfaceType
// 0 Lambert Diffuse
// 1 Metal
// 2 Dielectrics
// 3 Light
struct SurfaceMaterial {
    color: vec3f,
    surfaceType: u32,
    fuzz: f32,
    indexOfRefraction: f32
}

struct Sphere {
    center: vec3f,
    radius: f32,
    material: SurfaceMaterial
}

struct Ray {
    direction: vec3f,
    origin: vec3f
}

// Uniform要按16字节的倍数进行对齐
struct SceneData {
    sphereCount: u32,
    useBVH: u32,
    maxBounces: u32,
    samplePerPixels: u32,
    backgroundColor: vec3f
}

struct SphereData {
    spheres: array<Sphere>
}

struct HitResult {
    t: f32,
    hit: bool,
    position: vec3f,
    normal: vec3f,
    frontFace: bool,
    material: SurfaceMaterial
}

struct GlobalData {
    hitResult: HitResult,
    nearestHit: f32
}

struct Node {
    minCorner: vec3f,
    leftChild: f32,
    maxCorner: vec3f,
    sphereCount: f32
}

struct BVH {
    nodes: array<Node>
}

struct ObjectIndices {
    sphereIndices: array<f32>
}

struct ScatterData {
    ray: Ray,
    albedo: vec3f,
    scatter: bool
}

struct Camera {
    lookFrom: vec4f,
    lookAt: vec4f,
    up: vec4f,
    verticalFOV: f32,
    aspectRatio: f32,
    aperture: f32,
    focusDistance: f32,
    viewportHeight: f32,
    viewportWidth: f32,
    w: vec4f,
    u: vec4f,
    v: vec4f
}

fn radians(angle: f32) ->f32 {
    return (Pi / 180.0) * angle;
}