const Infinity = 10000.0;

struct Sphere {
    center: vec4f,
    color: vec3f,
    radius: f32
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
    sphereCount: u32
}

struct SphereData {
    spheres: array<Sphere>
}

struct HitResult {
    t: f32,
    color: vec3f,
    hit: bool
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

@group(0) @binding(0) var colorBuffer: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var<uniform> sceneData: SceneData;
@group(0) @binding(2) var<storage, read> sphereData: SphereData;
@group(0) @binding(3) var<storage, read> bvh: BVH;
@group(0) @binding(4) var<storage, read> sphereLookup: ObjectIndices;

fn pointAt(ray: Ray, t: f32) -> vec3f {
    return ray.origin + ray.direction * t;
}

// fn hitSphere(ray: Ray, sphere: Sphere, tMin: f32, tMax: f32, oldHitResult: HitResult) -> HitResult {
//     var center = sphere.center.xyz;
//     let oc = ray.origin - center;
//     let a: f32 = dot(ray.direction, ray.direction);
//     let b: f32 = 2.0 * dot(ray.direction, oc);
//     let c: f32 = dot(oc, oc) - sphere.radius * sphere.radius;
//     let discriminant : f32 = b * b - 4.0 * a * c;

//     var hitResult: HitResult;
//     hitResult.color = oldHitResult.color;

//     if (discriminant < 0.0) {
//         hitResult.t = -1.0;
//         hitResult.hit = false;
//         return hitResult;
//     } else {
//         hitResult.t = (-b - sqrt(discriminant)) / (2.0 * a);
//         hitResult.hit = true;
//         hitResult.color = sphere.color;
//         return hitResult;
//     }
// }

fn hitSphere(ray: Ray, sphere: Sphere, tMin: f32, tMax: f32, oldHitResult: HitResult) -> HitResult {
    let co: vec3<f32> = ray.origin - sphere.center.xyz;
    let a: f32 = dot(ray.direction, ray.direction);
    let b: f32 = 2.0 * dot(ray.direction, co);
    let c: f32 = dot(co, co) - sphere.radius * sphere.radius;
    let discriminant: f32 = b * b - 4.0 * a * c;

    var hitResult: HitResult;
    hitResult.color = oldHitResult.color;

    if (discriminant > 0.0) {

        let t: f32 = (-b - sqrt(discriminant)) / (2 * a);

        if (t > tMin && t < tMax) {
            hitResult.t = t;
            hitResult.color = sphere.color;
            hitResult.hit = true;
            return hitResult;
        }
    }

    hitResult.hit = false;
    return hitResult;   
}

fn hitAABB(ray: Ray, node: Node) -> f32 {
    var inverseDirection: vec3f = 1.0 / ray.direction;

    var t1: vec3f = (node.minCorner - ray.origin) * inverseDirection;
    var t2: vec3f = (node.maxCorner - ray.origin) * inverseDirection;

    var minT: vec3f = min(t1, t2);
    var maxT: vec3f = max(t1, t2);

    var tMin = max(max(minT.x, minT.y), minT.z);
    var tMax = min(min(maxT.x, maxT.y), maxT.z);

    if (tMin > tMax || tMax < 0.0) {
        return Infinity;
    }

    return tMin;
}

fn rayColor(ray: Ray) -> vec3f {
    var color = vec3f(0.1, 0.2, 0.3);

    var nearestHit = Infinity;
    var hitResult: HitResult;
    var hitSomething = false;

    // Root node
    var node: Node = bvh.nodes[0];
    // Nodes to explore(log2(sphereCount))
    var stack: array<Node, 15>;
    var stackLocation = 0;

    while (true) {        
        var sphereCount = u32(node.sphereCount);
        // If internal, it's position of child nodes,
        // if external, it's start position of sphere
        var contents = u32(node.leftChild);

        if (sphereCount == 0) {
            // left child + 1 = right child
            var child1: Node = bvh.nodes[contents];
            var child2: Node = bvh.nodes[contents + 1];

            var distance1 = hitAABB(ray, child1);
            var distance2 = hitAABB(ray, child2);

            if (distance1 > distance2) {
                var tempDistance = distance1;
                distance1 = distance2;
                distance2 = tempDistance;

                var tempChild = child1;
                child1 = child2;
                child2 = tempChild;
            }

            if (distance1 > nearestHit) {
                if (stackLocation == 0) {
                    break;
                }
                else {
                    stackLocation -= 1;
                    node = stack[stackLocation];
                }
            }
            else {
                node = child1;
                if (distance2 < nearestHit) {
                    stack[stackLocation] = child2;
                    stackLocation += 1;
                }
            }
        }
        else {
            for (var i: u32 = 0; i < sphereCount; i++) {
                var newHitResult = hitSphere(ray, sphereData.spheres[u32(sphereLookup.sphereIndices[i + contents])], 0.001, nearestHit, hitResult);

                // var newHitResult = hitSphere(ray, sphereData.spheres[i], 0.001, nearestHit, hitResult);

                if (newHitResult.hit) {
                    nearestHit = newHitResult.t;
                    hitResult = newHitResult;
                    hitSomething = true;
                    // var n = normalize(pointAt(ray, t) - sphere.center.xyz);
                    // n = (n + 1.0) * 0.5;
                    // pixelColor = n;
                    // var l = normalize(vec3f(0.8, 0.9, 1.0));

                    // var diffuse = max(dot(n,l), 0.0);

                    // pixelColor = vec3f(diffuse);
                }
            }

            if (stackLocation == 0) {
                break;
            }
            else {
                stackLocation -= 1;
                node = stack[stackLocation];
            }
        }
    }

    if (hitSomething) {
        color = hitResult.color;
    }

    return color;
}

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) globalInvocationID: vec3u) {
    let screenSize: vec2u = textureDimensions(colorBuffer);
    let screenPosition: vec2i = vec2i(i32(globalInvocationID.x), i32(globalInvocationID.y));

    let horizontalCoefficient: f32 = (f32(screenPosition.x) - f32(screenSize.x) / 2.0) / f32(screenSize.x);
    let verticalCoefficient: f32 = (f32(screenSize.y) / 2.0 - f32(screenPosition.y)) / f32(screenSize.x);

    let forward: vec3f = sceneData.cameraForward.xyz;
    let right: vec3f = sceneData.cameraRight.xyz;
    let up: vec3f = sceneData.cameraUp.xyz;

    var ray: Ray;

    ray.direction = normalize(forward + horizontalCoefficient * right + verticalCoefficient * up);
    ray.origin = vec3f(0.0, 0.0, 0.0);

    var pixelColor = rayColor(ray);

    // pixelColor = vec3f(f32(screenPosition.x) / f32(screenSize.x), f32(screenPosition.y) / f32(screenSize.y), 0.0);

    textureStore(colorBuffer, screenPosition, vec4f(pixelColor, 1.0));
}