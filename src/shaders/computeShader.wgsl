@group(0) @binding(0) var screenSampler: sampler;
@group(0) @binding(1) var colorBuffer: texture_2d<f32>;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) texcoord: vec2f
};

@vertex
fn vs_main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
    var positions = array<vec2f, 6>(
	    vec2<f32>(-1.0,  1.0),
	    vec2<f32>(-1.0, -1.0),
	    vec2<f32>( 1.0, -1.0),
	    vec2<f32>(-1.0,  1.0),
	    vec2<f32>( 1.0, -1.0),
	    vec2<f32>( 1.0,  1.0)
    );

    var texcoords = array<vec2f, 6>(
        vec2<f32>(0.0, 0.0),
        vec2<f32>(0.0, 1.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(0.0, 0.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(1.0, 0.0)
    );

    var output: VertexOutput;
    output.position = vec4f(positions[VertexIndex], 0.0, 1.0);
    output.texcoord = texcoords[VertexIndex];
    return output;
}

@fragment
fn fs_main(@location(0) texcoord: vec2f) -> @location(0) vec4f {
    return textureSample(colorBuffer, screenSampler, texcoord);
}