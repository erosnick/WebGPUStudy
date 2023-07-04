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

// A psuedo random number. Initialized with init_rand(), updated with rand().
var<private> rnd : vec3u;

// Initializes the random number generator.
fn init_rand(invocation_id : vec3u, seed: vec3u) {
  const A = vec3(1741651 * 1009,
                 140893  * 1609 * 13,
                 6521    * 983  * 7 * 2);
  rnd = (invocation_id * A) ^ seed;
}

// Returns a random number between 0 and 1.
fn rand() -> f32 {
  const C = vec3(60493  * 9377,
                 11279  * 2539 * 23,
                 7919   * 631  * 5 * 3);

  rnd = (rnd * C) ^ (rnd.yzx >> vec3(4u));
  return f32(rnd.x ^ rnd.y) / f32(0xffffffff);
}

// Returns a random point within a unit sphere centered at (0,0,0).
fn rand_unit_sphere() -> vec3f {
    var u = rand();
    var v = rand();
    var theta = u * 2.0 * Pi;
    var phi = acos(2.0 * v - 1.0);
    var r = pow(rand(), 1.0/3.0);
    var sin_theta = sin(theta);
    var cos_theta = cos(theta);
    var sin_phi = sin(phi);
    var cos_phi = cos(phi);
    var x = r * sin_phi * sin_theta;
    var y = r * sin_phi * cos_theta;
    var z = r * cos_phi;
    return vec3f(x, y, z);
}

fn rand_concentric_disk() -> vec2f {
    let u = vec2f(rand(), rand());
    let uOffset = 2.f * u - vec2f(1, 1);

    if (uOffset.x == 0 && uOffset.y == 0){
        return vec2f(0, 0);
    }

    var theta = 0.0;
    var r = 0.0;
    if (abs(uOffset.x) > abs(uOffset.y)) {
        r = uOffset.x;
        theta = (Pi / 4) * (uOffset.y / uOffset.x);
    } else {
        r = uOffset.y;
        theta = (Pi / 2) - (Pi / 4) * (uOffset.x / uOffset.y);
    }
    return r * vec2f(cos(theta), sin(theta));
}

fn rand_cosine_weighted_hemisphere() -> vec3f {
    let d = rand_concentric_disk();
    let z = sqrt(max(0.0, 1.0 - d.x * d.x - d.y * d.y));
    return vec3f(d.x, d.y, z);
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

var<private> wseed: u32;

fn randomCore(seed: u32) -> f32 {
    var realSeed = seed;
    realSeed = (realSeed ^ 61) ^ (realSeed >> 16);
    realSeed *= 9;
    realSeed = realSeed ^ (realSeed >> 4);
    realSeed *= 0x27d4eb2d;
    wseed = realSeed ^ (realSeed >> 15);
    return f32(wseed) * (1.0 / 4294967296.0);
}

// https://www.shadertoy.com/view/llGSzw
// See these too: 
//
// - https://www.shadertoy.com/view/llGSzw
// - https://www.shadertoy.com/view/XlXcW4
// - https://www.shadertoy.com/view/4tXyWN
//
// Do NOT use this hash as a random number generator. Use it only to inialize
// the seed of a random number generator. Do NOT call this hash recursivelly,
// it is NOT a random number generator.
fn hash1(seed: u32) -> f32 {
    // integer hash copied from Hugo Elias
    var realSeed = seed;
	realSeed = (realSeed << 13) ^ realSeed;
    realSeed = realSeed * (realSeed * realSeed * 15731 + 789221) + 1376312589;
    return f32( realSeed & 0x7fffffff) / f32(0x7fffffff);
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
fn random() -> f32 {
    return randomCore(wseed);
}

fn randomInRange(min: f32, max: f32) -> f32 {
    return random() * (max - min) + min;
}

fn randomVector() -> vec3f {
    return vec3f(random(), random(), random());
}

fn randomVectorInRange(min: f32, max: f32) -> vec3f {
    return vec3f(randomInRange(min, max), randomInRange(min, max), randomInRange(min, max));
}

fn randomInUnitSphere() -> vec3f {
    var p: vec3f;
    while (true) {
        p = randomVectorInRange(-1.0, 1.0);
        if (dot(p, p) >= 1.0) {
            continue;
        }
        break;
    }
    return p;
}

fn randomUnitVector() -> vec3f {
    return normalize(randomInUnitSphere());
}

fn randomInHemisphere(normal: vec3f) -> vec3f {
    var inUnitSphere = randomInUnitSphere();
    // In the same hemisphere as the normal
    if (dot(inUnitSphere, normal) > 0.0) {
        return inUnitSphere;
    }
    else {
        return -inUnitSphere;
    }
}

fn  nearZero(vector: vec3f) -> bool {
    return (abs(vector.x) < Epsilon) && (abs(vector.y) < Epsilon) && (abs(vector.z) < Epsilon);
}

fn hitSphere(ray: Ray, sphere: Sphere, tMin: f32, tMax: f32, oldHitResult: HitResult) -> HitResult {
    var center = sphere.center;
    let oc = ray.origin - center;
    let a: f32 = dot(ray.direction, ray.direction);
    let halfB: f32 = dot(ray.direction, oc);
    let c: f32 = dot(oc, oc) - sphere.radius * sphere.radius;
    let discriminant : f32 = halfB * halfB - a * c;

    var hitResult: HitResult;
    hitResult.material = oldHitResult.material;

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
    hitResult.material = sphere.material;
    hitResult.position = pointAt(ray, hitResult.t);
    var outwardNormal = (hitResult.position - sphere.center.xyz) / sphere.radius;
    hitResult = setFaceNormal(ray, outwardNormal, hitResult);
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

fn lambertDiffuse(hitResult: HitResult) -> ScatterData {
    var direction = hitResult.normal + randomUnitVector();

    if (nearZero(direction)) {
        direction = hitResult.normal;
    }

    var data: ScatterData;
    data.ray.origin = hitResult.position;
    data.ray.direction = direction;
    data.albedo = hitResult.material.color;

    data.scatter = true;

    return data;
}

fn metal(ray: Ray, hitResult: HitResult) -> ScatterData {
    var reflected = reflect(normalize(ray.direction), hitResult.normal);

    var data: ScatterData;
    data.ray.origin = hitResult.position;
    data.ray.direction = reflected + hitResult.material.fuzz * randomInUnitSphere();
    data.albedo = hitResult.material.color;
    data.scatter = dot(reflected, hitResult.normal) > 0.0;

    return data;
}

// Use Schlick's approximation for reflectance
fn reflectance(cosine: f32, refractionIndex: f32) -> f32 {
    var r0 = (1.0 - refractionIndex) / (1.0 + refractionIndex);
    r0 = r0 * r0;
    return r0 + (1.0 - r0) * pow((1.0 - cosine), 5.0);
}

fn dielectrics(ray: Ray, hitResult: HitResult) -> ScatterData {
    var data : ScatterData;
    data.albedo = vec3f(1.0, 1.0, 1.0);

    var refractionRatio = hitResult.material.indexOfRefraction;

    if (hitResult.frontFace) {
        refractionRatio = 1.0 / hitResult.material.indexOfRefraction;
    }

    var unitDirection = normalize(ray.direction);

    var cosTheta = min(dot(-unitDirection, hitResult.normal), 1.0);
    var sinTheta = sqrt(1.0 - cosTheta * cosTheta);

    var cannotRefract = (refractionRatio * sinTheta) > 1.0;

    var direction: vec3f;

    if (cannotRefract || reflectance(cosTheta, refractionRatio) > random()) {
        direction = reflect(unitDirection, hitResult.normal);
    }
    else {
        direction = refract(unitDirection, hitResult.normal, refractionRatio);
    }

    data.ray.origin = hitResult.position;
    data.ray.direction = direction;

    data.scatter = true;

    return data;
}

fn rayColor(ray: Ray) -> vec3f {
    var attenuation = vec3f(1.0, 1.0, 1.0);
    var newRay: Ray = ray;

    for (var i: u32 = 0; i < sceneData.maxBounces; i++) {
        var hitResult = trace(newRay);

        if (hitResult.hit) {
            // newRay.direction = normalize(reflect(newRay.direction, hitResult.normal));

            if (hitResult.material.surfaceType == 0) {
                // A Simple Diffuse Material
                // var targetPosition = hitResult.position + hitResult.normal + randomInUnitSphere(seed);

                // True Lambertian Reflection
                // var targetPosition = hitResult.position + hitResult.normal + randomUnitVector(seed);

                // An Alternative Diffuse Formulation
                // var targetPosition = hitResult.position + randomInHemisphere(seed, hitResult.normal);

                var data = lambertDiffuse(hitResult);

                newRay = data.ray;

                attenuation *= data.albedo;
            }
            else if (hitResult.material.surfaceType == 1) {
                var data = metal(newRay, hitResult);

                if (data.scatter) {
                    newRay = data.ray;
                    attenuation *= data.albedo;
                }             
                else {
                    return vec3f(0.0, 0.0, 0.0);
                }
            }
            else if (hitResult.material.surfaceType == 2) {
                var data = dielectrics(newRay, hitResult);

                if (data.scatter) {
                    newRay = data.ray;
                    attenuation *= data.albedo;
                }
                else {
                    return vec3f(0.0, 0.0, 0.0);
                }
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
    // If we've exceeded the ray bounce limit, no more light is gathered.
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
    hitData.hitResult.material.color = vec3f(0.4, 0.6, 0.9);

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

    // var seed1 = u32(screenPosition.x + screenPosition.y * 1000);
    // var seed2 = hash(seed1);
    // var seed3 = hash(seed2);

    var hashSeed = hash3(screenPosition.x + screenSize.x * screenPosition.y + (screenSize.x * screenSize.y ) * 1000);

    init_rand(globalInvocationID, vec3u(hashSeed));

    wseed = u32((f32(screenPosition.x) / f32(screenSize.x)) * (f32(screenPosition.y) / f32(screenSize.y)) * 69557857);
    // wseed = u32(screenPosition.x + screenPosition.y * 1000);

    var pixelColor = vec3f(0.0, 0.0, 0.0);

    for (var s: u32 = 0; s < sceneData.samplePerPixels; s++) {
        var ray: Ray;
        
        let u = (f32(screenPosition.x) + rand()) / f32(screenSize.x - 1);
        let v = (f32(screenSize.y - screenPosition.y) + rand()) / f32(screenSize.y - 1);

        ray.origin = origin;
        ray.direction = lowerLeftCorner + u * horizontal + v * vertical - origin;

        pixelColor += rayColor(ray);
    }

    pixelColor /= f32(sceneData.samplePerPixels);

    pixelColor = sqrt(pixelColor);

    // pixelColor = vec3f(random(), random(), random());

    // pixelColor = vec3f(f32(screenPosition.x) / f32(screenSize.x), f32(screenPosition.y) / f32(screenSize.y), 0.0);

    textureStore(colorBuffer, screenPosition, vec4f(pixelColor, 1.0));
}