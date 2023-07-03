const Infinity = 100000.0;
const Epsilon = 0.000001;

struct Sphere {
    center: vec4f,
    color: vec4f,
    radius: f32,
    surfaceType: u32
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
    color: vec3f,
    hit: bool,
    position: vec3f,
    normal: vec3f,
    frontFace: bool,
    surfaceType: u32
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

struct Seed {
    seed1: u32,
    seed2: u32,
    seed3: u32
}

@group(0) @binding(0) var colorBuffer: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var<uniform> sceneData: SceneData;
@group(0) @binding(2) var<storage, read> sphereData: SphereData;
@group(0) @binding(3) var<storage, read> bvh: BVH;
@group(0) @binding(4) var<storage, read> sphereLookup: ObjectIndices;

fn pointAt(ray: Ray, t: f32) -> vec3f {
    return ray.origin + ray.direction * t;
}

fn setFaceNormal(ray: Ray, outwardNormal: vec3f, hitResult: HitResult) -> HitResult {
    var tempHitResult = hitResult;

    tempHitResult.frontFace = dot(ray.direction, outwardNormal) < 0.0;

    if (tempHitResult.frontFace) {
        tempHitResult.normal = outwardNormal;
    }
    else {
        tempHitResult.normal = -outwardNormal;
    }
    
    return tempHitResult;
}

// 随机种子生成器
fn hash(seed: u32) ->u32 {
    var realSeed = seed;
    realSeed = (realSeed ^ 61u) ^ (realSeed >> 16u);
    realSeed *= 9u;
    realSeed = realSeed ^ (realSeed >> 4u);
    realSeed *= 0x27d4eb2du;
    realSeed = realSeed ^ (realSeed >> 15u);
    return realSeed;
}

fn hash3(seed: u32) -> vec3f {
    // integer hash copied from Hugo Elias
    var realSeed = seed;
	realSeed = (realSeed << 13) ^ realSeed;
    realSeed = realSeed * (realSeed * realSeed * 15731 + 789221) + 1376312589;
    var k = realSeed * vec3u(realSeed, realSeed * 16807, realSeed * 48271);
    return vec3f( k & vec3u(0x7fffffff)) / f32(0x7fffffff);
}

// 根据种子生成0-1之间的随机数
fn random(seed: u32) -> f32 {
    return f32(hash(seed)) / 4294967296.0; // 2^32
}

fn randomInRange(seed: u32, min: f32, max: f32) -> f32 {
    return random(seed) * (max - min) + min;
}

fn randomVector(seed: Seed) -> vec3f {
    return vec3f(random(seed.seed1), random(seed.seed2), random(seed.seed3));
}

fn randomVectorInRange(seed: Seed, min: f32, max: f32) -> vec3f {
    return vec3f(randomInRange(seed.seed1, min, max), randomInRange(seed.seed2, min, max), randomInRange(seed.seed3, min, max));
}

fn randomInUnitSphere(seed: Seed) -> vec3f {
    var p: vec3f;
    while (true) {
        p = randomVectorInRange(seed, -1.0, 1.0);
        if (dot(p, p) >= 1.0) {
            continue;
        }
        break;
    }
    return p;
}

fn randomUnitVector(seed: Seed) -> vec3f {
    return normalize(randomInUnitSphere(seed));
}

fn randomInHemisphere(seed: Seed, normal: vec3f) -> vec3f {
    var inUnitSphere = randomInUnitSphere(seed);
    // In the same hemisphere as the normal
    if (dot(inUnitSphere, normal) > 0.0) {
        return inUnitSphere;
    }
    else {
        return -inUnitSphere;
    }
}

fn hitSphere(ray: Ray, sphere: Sphere, tMin: f32, tMax: f32, oldHitResult: HitResult) -> HitResult {
    var center = sphere.center.xyz;
    let oc = ray.origin - center;
    let a: f32 = dot(ray.direction, ray.direction);
    let halfB: f32 = dot(ray.direction, oc);
    let c: f32 = dot(oc, oc) - sphere.radius * sphere.radius;
    let discriminant : f32 = halfB * halfB - a * c;

    var hitResult: HitResult;
    hitResult.color = oldHitResult.color;

    if (discriminant < 0.0) {
        hitResult.t = -1.0;
        hitResult.hit = false;
        return hitResult;
    }

    var sqrtd = sqrt(discriminant);

    // Find the nearest root that lies in the acceptable range
    var root = (-halfB - sqrtd) / a;

    if (root < tMin || tMax < root) {
        root = (-halfB + sqrtd) / a;
        if (root < tMin || tMax < root) {
            hitResult.t = -1.0;
            hitResult.hit = false;
            return hitResult;
        }
    }

    hitResult.t = root;
    hitResult.hit = true;
    hitResult.color = sphere.color.xyz;
    hitResult.position = pointAt(ray, hitResult.t);
    var outwardNormal = (hitResult.position - sphere.center.xyz) / sphere.radius;
    hitResult = setFaceNormal(ray, outwardNormal, hitResult);
    hitResult.surfaceType = sphere.surfaceType;
    return hitResult;
}

// fn hitSphere(ray: Ray, sphere: Sphere, tMin: f32, tMax: f32, oldHitResult: HitResult) -> HitResult {
//     let co: vec3<f32> = ray.origin - sphere.center.xyz;
//     let a: f32 = dot(ray.direction, ray.direction);
//     let b: f32 = 2.0 * dot(ray.direction, co);
//     let c: f32 = dot(co, co) - sphere.radius * sphere.radius;
//     let discriminant: f32 = b * b - 4.0 * a * c;

//     var hitResult: HitResult;
//     hitResult.color = oldHitResult.color;

//     if (discriminant > 0.0) {

//         let t: f32 = (-b - sqrt(discriminant)) / (2 * a);

//         if (t > tMin && t < tMax) {
//             hitResult.t = t;
//             hitResult.color = sphere.color;
//             hitResult.hit = true;
//             hitResult.position = pointAt(ray, t);
//             var outwardNormal = (hitResult.position - sphere.center.xyz) / sphere.radius;
//             hitResult = setFaceNormal(ray, outwardNormal, hitResult);

//             return hitResult;
//         }
//     }

//     hitResult.hit = false;

//     return hitResult;   
// }

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

fn hitWorld(ray: Ray, sphereCount: u32, hitData: GlobalData, contents: u32, useBVH: bool) -> GlobalData {
    var tempHitResult = hitData.hitResult;
    var nearestHit = hitData.nearestHit;
    var tempHitData: GlobalData;

    for (var i: u32 = 0; i < sphereCount; i++) {
        var sphereIndex = i;

        if (useBVH) {
            sphereIndex = u32(sphereLookup.sphereIndices[i + contents]);
        }

        var newHitResult = hitSphere(ray, sphereData.spheres[sphereIndex], Epsilon, nearestHit, tempHitResult);

        if (newHitResult.hit) {
            nearestHit = newHitResult.t;
            tempHitResult = newHitResult;
        }
    }

    tempHitData.hitResult = tempHitResult;
    tempHitData.nearestHit = nearestHit;

    return tempHitData;
}

fn rayColor(ray: Ray, seed: Seed) -> vec3f {
    var attenuation = 1.0;
    var newRay: Ray = ray;

    for (var i: u32 = 0; i < sceneData.maxBounces; i++) {
        var hitResult = trace(newRay);

        if (hitResult.hit) {
            // newRay.direction = normalize(reflect(newRay.direction, hitResult.normal));

            // Remove shadow acne
            newRay.origin = hitResult.position + hitResult.normal * Epsilon;

            if (hitResult.surfaceType == 0) {
                // A Simple Diffuse Material
                // var targetPosition = hitResult.position + hitResult.normal + randomInUnitSphere(seed);

                // True Lambertian Reflection
                var targetPosition = hitResult.position + hitResult.normal + randomUnitVector(seed);

                // An Alternative Diffuse Formulation
                // var targetPosition = hitResult.position + randomInHemisphere(seed, hitResult.normal);

                newRay.direction = targetPosition - hitResult.position;

                attenuation *= 0.5;

            }
            else if (hitResult.surfaceType == 1) {
                var reflected = reflect(normalize(newRay.direction), hitResult.normal);

                newRay.direction = reflected;
            }

            // Visualize normal
            // return 0.5 * (hitResult.normal + vec3f(1.0, 1.0, 1.0));
        }
        else {
            var d = normalize(newRay.direction);
            var t = 0.5 * (d.y + 1.0);
            var c = (1.0 - t) * vec3f(1.0, 1.0, 1.0) + t * vec3f(0.5, 0.7, 1.0);
            return attenuation * c;
        }
    }
    return vec3f(0.0, 0.0, 0.0);
}

fn trace(ray: Ray) -> HitResult {
    // Root node
    var node: Node = bvh.nodes[0];
    // Nodes to explore(log2(sphereCount))
    var stack: array<Node, 15>;
    var stackLocation = 0;

    var sphereIndex = 0;

    var hitData: GlobalData;
    hitData.nearestHit = Infinity;
    hitData.hitResult.color = vec3f(0.4, 0.6, 0.9);

    while (sceneData.useBVH > 0) {
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

            if (distance1 > hitData.nearestHit) {
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
                if (distance2 < hitData.nearestHit) {
                    stack[stackLocation] = child2;
                    stackLocation += 1;
                }
            }
        }
        else {
            hitData = hitWorld(ray, sphereCount, hitData, contents, true);

            if (stackLocation == 0) {
                break;
            }
            else {
                stackLocation -= 1;
                node = stack[stackLocation];
            }
        }
    }

    if (sceneData.useBVH <= 0) {
        hitData = hitWorld(ray, sceneData.sphereCount, hitData, 0, false);
    }

    return hitData.hitResult;
}

// @compute @workgroup_size(1, 1, 1)
// fn main(@builtin(global_invocation_id) globalInvocationID: vec3u) {
//     let screenSize: vec2u = textureDimensions(colorBuffer);
//     let screenPosition: vec2i = vec2i(i32(globalInvocationID.x), i32(globalInvocationID.y));

//     let horizontalCoefficient: f32 = (f32(screenPosition.x) - f32(screenSize.x) / 2.0) / f32(screenSize.x);
//     let verticalCoefficient: f32 = (f32(screenSize.y) / 2.0 - f32(screenPosition.y)) / f32(screenSize.x);

//     let forward: vec3f = sceneData.cameraForward.xyz;
//     let right: vec3f = sceneData.cameraRight.xyz;
//     let up: vec3f = sceneData.cameraUp.xyz;

//     var ray: Ray;

//     var seed1 = u32(screenPosition.x + screenPosition.y * 1000);
//     var seed2 = hash(seed1);
//     var seed3 = hash(seed2);

//     ray.direction = normalize(forward + horizontalCoefficient * right + verticalCoefficient * up);
//     ray.origin = vec3f(0.0, 0.0, 0.0);

//     var pixelColor = vec3f(random(seed1), random(seed2), random(seed3));

//     pixelColor = rayColor(ray);

//     // pixelColor = vec3f(f32(screenPosition.x) / f32(screenSize.x), f32(screenPosition.y) / f32(screenSize.y), 0.0);

//     textureStore(colorBuffer, screenPosition, vec4f(pixelColor, 1.0));
// }

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) globalInvocationID: vec3u) {
    let screenSize: vec2u = textureDimensions(colorBuffer);
    let screenPosition: vec2u = vec2u(u32(globalInvocationID.x), u32(globalInvocationID.y));

    const aspect = 16.0 / 9.0;
    const viewportHeight = 2.0;
    const viewportWidth = aspect * viewportHeight;
    const focalLength = 1.0;

    const origin = vec3f(0.0, 0.0, 0.0);
    const horizontal = vec3f(viewportWidth, 0.0, 0.0);
    const vertical = vec3f(0.0, viewportHeight, 0.0);
    const lowerLeftCorner = origin - horizontal / 2.0 - vertical / 2.0 - vec3f(0.0, 0.0, focalLength);

    const samplePerPixels = 100;

    var seed1 = u32(screenPosition.x + screenPosition.y * 1000);
    var seed2 = hash(seed1);
    var seed3 = hash(seed2);

    var seed: Seed;
    seed.seed1 = seed1;
    seed.seed2 = seed2;
    seed.seed3 = seed3;

    var pixelColor = vec3f(0.0, 0.0, 0.0);

    for (var s = 0; s < samplePerPixels; s++) {
        var ray: Ray;

        seed1 = hash(seed1);
        seed2 = hash(seed2);
        seed3 = hash(seed3);

        let u = (f32(screenPosition.x) + random(seed1)) / f32(screenSize.x - 1);
        let v = (f32(screenSize.y - screenPosition.y) + random(seed2)) / f32(screenSize.y - 1);

        ray.origin = origin;
        ray.direction = lowerLeftCorner + u * horizontal + v * vertical - origin;

        var seed: Seed;
        seed.seed1 = seed1;
        seed.seed2 = seed2;
        seed.seed3 = seed3;

        pixelColor += rayColor(ray, seed);
    }

    pixelColor /= f32(samplePerPixels);

    pixelColor = sqrt(pixelColor);

    var hashSeed = hash3(screenPosition.x + screenSize.x * screenPosition.y + (screenSize.x * screenSize.y ) * 1000);

    seed.seed1 = u32(hashSeed.x);
    seed.seed2 = u32(hashSeed.y);
    seed.seed3 = u32(hashSeed.z);

    // pixelColor = vec3f(random(seed1), random(seed2), random(seed3));

    // pixelColor = vec3f(f32(screenPosition.x) / f32(screenSize.x), f32(screenPosition.y) / f32(screenSize.y), 0.0);

    textureStore(colorBuffer, screenPosition, vec4f(pixelColor, 1.0));
}