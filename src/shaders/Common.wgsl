const Infinity = 100000.0;
const Epsilon = 0.00001;
const Pi = 3.14159265359;

struct SurfaceMaterial {
    color: vec3f,
    surfaceType: u32,
    fuzz: f32
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
    cameraPosition: vec4f,
    cameraForward: vec4f,
    cameraRight: vec4f,
    cameraUp: vec4f,
    sphereCount: u32,
    useBVH: u32,
    maxBounces: u32
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