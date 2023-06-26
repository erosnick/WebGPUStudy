import { TriangleMesh } from "./TriangleMesh"
import { GeoemtryGenerator } from "./geometryGenerator"
import shader from "./shaders/camera.wgsl?raw"
import { mat4, vec3 } from "wgpu-matrix"

var eye = vec3.create(0.0, 1.0, 1.0)

var lightPosition = vec3.create(1.0, 2.0, 1.0)

const CameraSpeed = 0.1

var viewBuffer : GPUBuffer

var eyeBuffer : GPUBuffer

var cube : TriangleMesh

var geoemtryGenerator = new GeoemtryGenerator()

function updateViewMatrix(device : GPUDevice) {
	let target = vec3.create(0.0, 0.0, 0.0)
	let up = vec3.create(0.0, 1.0, 0.0)

	let camera = mat4.lookAt(eye, target, up)

	let viewMatrix = mat4.inverse(camera);
	device.queue.writeBuffer(viewBuffer, 0, viewMatrix)

	device.queue.writeBuffer(eyeBuffer, 0, new Float32Array([eye[0], eye[1], eye[2], 1.0]))
}

// 初始化WebGPU
async function initWebGPU(canvas: HTMLCanvasElement) {
	// 判断当前设备是否支持WebGPU
	if (!navigator.gpu) throw new Error("Not Support WebGPU")
	// 请求Adapter对象，GPU在浏览器中的抽象代理
	const adapter = await navigator.gpu.requestAdapter({
		/* 电源偏好
			high-performance 高性能电源管理
			low-power 节能电源管理模式 
		*/
		powerPreference: "high-performance",
	})
	if (!adapter) throw new Error("No Adapter Found")
	//请求GPU设备
	const device = await adapter.requestDevice()
	//获取WebGPU上下文对象
	const context = canvas.getContext("webgpu") as GPUCanvasContext
	//获取浏览器默认的颜色格式
	const format = navigator.gpu.getPreferredCanvasFormat()
	//设备分辨率
	const devicePixelRatio = window.devicePixelRatio || 1
	//canvas尺寸
	const size = {
		width: canvas.clientWidth * devicePixelRatio,
		height: canvas.clientHeight * devicePixelRatio,
	}
  	canvas.width = size.width
	canvas.height =size.height
	//配置WebGPU
	context.configure({
		device,
		format,
		// Alpha合成模式，opaque为不透明
		alphaMode: "opaque",
	})

	return { device, context, format, size }
}

// 创建渲染管线
async function initPipeline(device: GPUDevice, format: GPUTextureFormat) {
	cube = geoemtryGenerator.createBox(device, 1.0, 1.0, 1.0, 0, 1.0)

	let modelMatrix = mat4.scaling([0.5, 0.5, 0.5])

	const fov = 60.0 * Math.PI / 180.0

	const canvas = document.querySelector("canvas")

	if (!canvas) throw new Error("No Canvas")
	
	const aspect = canvas.width / canvas.height
	const near = 0.1
	const far = 1000.0

	let projectionMatrix = mat4.perspective(fov, aspect, near, far)

	//模型矩阵的缓冲区
	const modelBuffer = device.createBuffer({
		size: 4 * 4 * 4, //行数 * 列数 * BYTES_PER_ELEMENT
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	})

	viewBuffer = device.createBuffer({
		size: 4 * 4 * 4, //行数 * 列数 * BYTES_PER_ELEMENT
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	})

	const projectionBuffer = device.createBuffer({
		size: 4 * 4 * 4, //行数 * 列数 * BYTES_PER_ELEMENT
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	})

	device.queue.writeBuffer(modelBuffer, 0, modelMatrix)

	eyeBuffer = device.createBuffer({
		size: 4 * 4,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	})

	updateViewMatrix(device)

	device.queue.writeBuffer(projectionBuffer, 0, projectionMatrix)

	const lightPositionBuffer = device.createBuffer({
		size: 3 * 4,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	})

	device.queue.writeBuffer(lightPositionBuffer, 0, new Float32Array([lightPosition[0], lightPosition[1], lightPosition[2]]))

	// 创建深度测试状态对象
	const depthStencilState : GPUDepthStencilState = {
		depthWriteEnabled: true,
		depthCompare: "less",
		format: "depth24plus-stencil8",
		stencilFront: {
			compare: "always",
			failOp: "keep",
			depthFailOp: "keep",
			passOp: "keep"
		},
		stencilBack: {
			compare: "always",
			failOp: "keep",
			depthFailOp: "keep",
			passOp: "keep"
		}
	};

	// 创建深度缓冲区和深度测试状态
	const depthTexture = device.createTexture({
		size: {
			width: canvas.width,
			height: canvas.height,
			depthOrArrayLayers: 1
		},
		format: "depth24plus-stencil8",
		usage: GPUTextureUsage.RENDER_ATTACHMENT
	});

	const depthView = depthTexture.createView();

	const bindGroupLayout = device.createBindGroupLayout({
		entries:
		[
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX,
				buffer: {}
			},
			{
				binding: 1,
				visibility: GPUShaderStage.VERTEX,
				buffer: {}
			},
			{
				binding: 2,
				visibility: GPUShaderStage.VERTEX,
				buffer: {}
			},
			{
				binding: 3,
				visibility: GPUShaderStage.FRAGMENT,
				buffer: {}
			},
			{
				binding: 4,
				visibility: GPUShaderStage.FRAGMENT,
				buffer: {}
			}
		]
	});

	const pipelineLayout = device.createPipelineLayout({
		bindGroupLayouts: [bindGroupLayout]
	});

	const descriptor: GPURenderPipelineDescriptor = {
		// 顶点着色器
		vertex: {
			// 着色程序
			module: device.createShaderModule({
				code: shader,
			}),
			// 主函数
			entryPoint: "vs_main",
			//缓冲数据,1个渲染管道可最多传入8个缓冲数据
			buffers: [
				{
					// 顶点长度，以字节为单位
					arrayStride: 14 * 4,
					attributes: [
						{
							// 变量索引
							shaderLocation: 0,
							// 偏移
							offset: 0,
							// 参数格式
							format: "float32x4",
						},
						{
							// 变量索引
							shaderLocation: 1,
							// 偏移
							offset: 4 * 4,
							// 参数格式
							format: "float32x4",
						},
						{
							// 变量索引
							shaderLocation: 2,
							// 偏移
							offset: 8 * 4,
							// 参数格式
							format: "float32x4",
						},
						{
							// 变量索引
							shaderLocation: 3,
							// 偏移
							offset: 12 * 4,
							// 参数格式
							format: "float32x2",
						},
					],
				},
			],
		},
		// 片元着色器
		fragment: {
			// 着色程序
			module: device.createShaderModule({
				code: shader,
			}),
			// 主函数
			entryPoint: "fs_main",
			// 渲染目标
			targets: [
				{
					// 颜色格式
					format,
				},
			],
		},
		// 初始配置
		primitive: {
			//拓扑结构，triangle-list为绘制独立三角形
			topology: "triangle-list",
		},
		depthStencil: depthStencilState, // 在此处设置深度测试状态0
		// 渲染管线的布局
		layout: pipelineLayout,
	}
	// 创建异步管线
	const pipeline = await device.createRenderPipelineAsync(descriptor)

	// 对buffer进行组合
	const uniformGroup = device.createBindGroup({
		// 布局
		layout: bindGroupLayout,
		// 添加buffer
		entries: [
			//  模型矩阵
			{
				// 位置
				binding: 0,
				// 资源
				resource: {
					buffer: modelBuffer,
				},
			},
			{
				// 位置
				binding: 1,
				// 资源
				resource: {
					buffer: viewBuffer,
				},
			},
			{
				// 位置
				binding: 2,
				// 资源
				resource: {
					buffer: projectionBuffer,
				},
			},
			{
				// 位置
				binding: 3,
				// 资源
				resource: {
					buffer: eyeBuffer,
				},
			},
			{
				// 位置
				binding: 4,
				// 资源
				resource: {
					buffer: lightPositionBuffer,
				},
			}
		],
	})

	//返回异步管线、顶点缓冲区
	return { pipeline, cube, uniformGroup, depthView }
}
// create & submit device commands
// 编写绘图指令，并传递给本地的GPU设备
function draw(
	device: GPUDevice,
	context: GPUCanvasContext,
	pipelineObj: {
		pipeline: GPURenderPipeline
		cube: TriangleMesh
		uniformGroup: GPUBindGroup
		depthView : GPUTextureView
	}
) {
	// 创建指令编码器
	const commandEncoder = device.createCommandEncoder()
	// GPU纹理视图
	const view = context.getCurrentTexture().createView()

	// 渲染通道配置数据
	const renderPassDescriptor: GPURenderPassDescriptor = {
		// 颜色附件
		colorAttachments: [
			{
				view: view,
				// 绘图前是否清空view，建议清空clear
				loadOp: "clear", // clear/load
				// 清理画布的颜色
				clearValue: { r: 0.4, g: 0.6, b: 0.9, a: 1.0 },
				//绘制完成后，是否保留颜色信息
				storeOp: "store", // store/discard
			},
		],
		depthStencilAttachment: {
			view: pipelineObj.depthView,
			depthClearValue : 1.0,
			depthLoadOp : "clear",
			depthStoreOp : "store",
			stencilLoadOp : "load",
			stencilStoreOp : "store",
			stencilClearValue: 0,
		}
	}
	// 建立渲染通道，类似图层
	const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)
	// 传入渲染管线
	passEncoder.setPipeline(pipelineObj.pipeline)
	// 写入顶点缓冲区
	passEncoder.setVertexBuffer(0, pipelineObj.cube.vertexBuffer)
	passEncoder.setIndexBuffer(pipelineObj.cube.indexBuffer, "uint32")
	// 把含有颜色缓冲区的BindGroup写入渲染通道
	passEncoder.setBindGroup(0, pipelineObj.uniformGroup)
	// 绘图，3 个顶点
	passEncoder.drawIndexed(pipelineObj.cube.indexCount, 1, 0, 0, 0)
	// passEncoder.draw(pipelineObj.cube.vertexCount)
	// 结束编码
	passEncoder.end()
	// 结束指令编写,并返回GPU指令缓冲区
	const gpuCommandBuffer = commandEncoder.finish()
	// 向GPU提交绘图指令，所有指令将在提交后执行
	device.queue.submit([gpuCommandBuffer])

	requestAnimationFrame(() => {
		updateViewMatrix(device)
		draw(device, context, pipelineObj)
	})
}

function processInput() {
	document.addEventListener("keydown", (event) => {
		switch (event.code) {
			case 'ArrowLeft':	// 左
				eye[0] -= CameraSpeed;
				console.log("Left");
			break;
			case 'ArrowRight':	// 右
				eye[0] += CameraSpeed;
				console.log("Right");
			break;
			case 'ArrowUp':		// 上
				eye[2] -= CameraSpeed;
				console.log("Up");
			break;
			case 'ArrowDown':	// 下
				eye[2] += CameraSpeed;
				console.log("Down");
			case 'KeyQ':
				eye[1] += CameraSpeed;
				break
			case 'KeyE':
				eye[1] -= CameraSpeed;
				break;
		}
	})
}

async function run() {
	const canvas = document.querySelector("canvas")
	if (!canvas) throw new Error("No Canvas")
	// 初始化WebGPU
	const { device, context, format } = await initWebGPU(canvas)
	// 初始化渲染管道
  	const pipelineObj = await initPipeline(device, format)
	//绘图
	requestAnimationFrame(() => {
		updateViewMatrix(device)
		draw(device, context, pipelineObj)
	})

	processInput();

	// 自适应窗口
	window.addEventListener("resize", () => {
    canvas.width = canvas.clientWidth * devicePixelRatio
    canvas.height = canvas.clientHeight * devicePixelRatio
		context.configure({
			device,
			format,
			alphaMode: "opaque",
		})
		draw(device, context, pipelineObj)
	})
}
run()
