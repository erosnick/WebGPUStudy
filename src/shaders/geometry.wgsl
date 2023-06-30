@group(0) @binding(0) var<uniform> modelMatrix : mat4x4f;
@group(0) @binding(1) var<uniform> viewMatrix : mat4x4f;
@group(0) @binding(2) var<uniform> projectionMatrix : mat4x4f;
@group(0) @binding(3) var<uniform> eye : vec4f;
@group(0) @binding(4) var<uniform> lightPosition : vec3f;

struct VertexOutput {
  @builtin(position) Position : vec4f,
  @location(0) worldPosition : vec3f,
  @location(1) normal : vec3f,
  @location(2) color : vec3f,
  @location(3) texcoord : vec2f
};

@vertex
fn vs_main(@location(0) position : vec3f, 
           @location(1) normal : vec3f, 
           @location(2) color : vec3f,
           @location(3) texcoord : vec2f) -> VertexOutput {
  var output : VertexOutput;
  output.Position = projectionMatrix * viewMatrix * modelMatrix * vec4f(position, 1.0);
  output.worldPosition = (modelMatrix * vec4f(position, 1.0)).xyz;
  output.normal = (modelMatrix * vec4(normal, 0.0)).xyz;
  output.color = color;
  output.texcoord = texcoord;
  return output;
}

@fragment
fn fs_main(@location(0) worldPosition : vec3f, 
           @location(1) normal : vec3f, 
           @location(2) color : vec3f,
           @location(3) texcoord : vec2f) -> @location(0) vec4f {
  var n = normalize(normal);
  // var l = normalize(vec3f(0.8, 0.9, 1.0));
  var l = normalize(lightPosition - worldPosition);
  var diffuse = max(dot(n, l), 0.0);
  var ambient = vec3f(0.1);

  var v = normalize(eye.xyz - worldPosition);

  var h = normalize(l + v);

  var specular = pow(max(dot(h, n), 0.0), 128.0);

  return vec4f(ambient + vec3f(diffuse) + vec3f(specular), 1.0);
  // return vec4f(vec3f(specular), 1.0);
  // return vec4f(worldPosition, 1.0);
  // return color;
  // return eye;
}