@group(0) @binding(0) var<uniform> modelMatrix : mat4x4f;
@group(0) @binding(1) var<uniform> viewMatrix : mat4x4f;
@group(0) @binding(2) var<uniform> projectionMatrix : mat4x4f;

struct VertexOutput {
  @builtin(position) Position : vec4f,
  @location(0) normal : vec3f,
  @location(1) color : vec4f,
};

@vertex
fn vs_main(@location(0) position : vec4f, @location(1) normal : vec4f, @location(2) color : vec4f) -> VertexOutput {
  var output : VertexOutput;
  output.Position = projectionMatrix * viewMatrix * modelMatrix * position;
  output.normal = (modelMatrix * normal).xyz;
  output.color = color;
  return output;
}

@fragment
fn fs_main(@location(0) normal : vec3f, @location(1) color : vec4f) -> @location(0) vec4f {
  var n = normalize(normal);
  var l = normalize(vec3f(0.8, 0.9, 1.0));
  var diffuse = max(dot(n, l), 0.0);

  return vec4f(vec3f(diffuse), 1.0);
  // return vec4f(n, 1.0);
  // return color;
}