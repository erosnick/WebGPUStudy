import { TriangleMesh } from "./TriangleMesh"
import { GeoemtryGenerator } from "./GeometryGenerator"
import shader from "./shaders/objLoader.wgsl?raw"
import { mat4, vec3 } from "wgpu-matrix"
import { Camera, CameraMovement } from "./Camera"
import { radians } from "./Math"
import ObjLoader from "./ObjLoader"
import { Material } from "./Material"

var objLoader: ObjLoader

var camera: Camera

var lightPosition = vec3.create(1.0, 2.0, 1.0)

const FrameTime = 0.0166667

const NearPlane = 0.1
const FarPlane = 1000.0

const MatrixSize = 64

var aspect: number

var leftMouseButtonDown = false

var mousePositionX = 0.0
var mousePositionY = 0.0

// 定义变量来存储按键状态
var keysPressed = new Map()

var viewBuffer: GPUBuffer
var projectionBuffer: GPUBuffer

var eyeBuffer: GPUBuffer

var cube: TriangleMesh

var geoemtryGenerator: GeoemtryGenerator

function updateViewMatrix(device: GPUDevice) {
	let viewMatrix = camera.getViewMatrix()

	device.queue.writeBuffer(viewBuffer, 0, viewMatrix)

	device.queue.writeBuffer(eyeBuffer, 0, new Float32Array([camera.position[0], camera.position[1], camera.position[2], 1.0]))
}

function updateProjectionMatrix(device: GPUDevice) {
	let projectionMatrix = mat4.perspective(radians(camera.zoom), aspect, NearPlane, FarPlane)
	device.queue.writeBuffer(projectionBuffer, 0, projectionMatrix)
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
	canvas.height = size.height

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
	geoemtryGenerator = new GeoemtryGenerator(device)
	cube = geoemtryGenerator.createBox(1.0, 1.0, 1.0, 0, 1.0)

	let modelMatrix = mat4.scaling([0.5, 0.5, 0.5])

	const canvas = document.querySelector("canvas")

	if (!canvas) throw new Error("No Canvas")

	aspect = canvas.width / canvas.height

	camera = new Camera([0.0, 0.0, 5.0])

	objLoader = new ObjLoader()

	var objFile = await objLoader.load("models/bunny.obj")

	var { positions, uvs, normals, indices} = objLoader.parse(objFile)

	// 创建多个Float32Array
	const colors = new Float32Array(positions.length)
	colors.fill(1.0)

	const vertexBufferData = new Float32Array(
		positions.length + normals.length + colors.length + uvs.length
	);

	for (let i = 0; i < positions.length; i++) {
		vertexBufferData[i * 11] = positions[i * 3]
		vertexBufferData[i * 11 + 1] = positions[i * 3 + 1]
		vertexBufferData[i * 11 + 2] = positions[i * 3 + 2]

		vertexBufferData[i * 11 + 3] = normals[i * 3]
		vertexBufferData[i * 11 + 4] = normals[i * 3 + 1]
		vertexBufferData[i * 11 + 5] = normals[i * 3 + 2]

		vertexBufferData[i * 11 + 6] = colors[i * 3]
		vertexBufferData[i * 11 + 7] = colors[i * 3 + 1]
		vertexBufferData[i * 11 + 8] = colors[i * 3 + 2]

		vertexBufferData[i * 11 + 9] = uvs[i * 2]
		vertexBufferData[i * 11 + 10] = uvs[i * 2 + 1]
	}

	cube.initialize(device, vertexBufferData, indices, new Material())

	//模型矩阵的缓冲区
	const modelBuffer = device.createBuffer({
		size: MatrixSize, //行数 * 列数 * BYTES_PER_ELEMENT
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	})

	viewBuffer = device.createBuffer({
		size: MatrixSize, //行数 * 列数 * BYTES_PER_ELEMENT
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	})

	projectionBuffer = device.createBuffer({
		size: MatrixSize, //行数 * 列数 * BYTES_PER_ELEMENT
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	})

	device.queue.writeBuffer(modelBuffer, 0, modelMatrix)

	eyeBuffer = device.createBuffer({
		size: 4 * 4,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	})

	updateViewMatrix(device)

	updateProjectionMatrix(device)

	const lightPositionBuffer = device.createBuffer({
		size: 3 * 4,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	})

	device.queue.writeBuffer(lightPositionBuffer, 0, new Float32Array([lightPosition[0], lightPosition[1], lightPosition[2]]))

	// 创建深度测试状态对象
	const depthStencilState: GPUDepthStencilState = {
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
					arrayStride: 11 * 4,
					attributes: [
						{
							// 变量索引
							shaderLocation: 0,
							// 偏移
							offset: 0,
							// 参数格式
							format: "float32x3",
						},
						{
							// 变量索引
							shaderLocation: 1,
							// 偏移
							offset: 3 * 4,
							// 参数格式
							format: "float32x3",
						},
						{
							// 变量索引
							shaderLocation: 2,
							// 偏移
							offset: 6 * 4,
							// 参数格式
							format: "float32x3",
						},
						{
							// 变量索引
							shaderLocation: 3,
							// 偏移
							offset: 9 * 4,
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

	// const wireframeDescriptor = descriptor

	// if (wireframeDescriptor.primitive) {
	// 	wireframeDescriptor.primitive.topology = "line-list"
	// }

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
		depthView: GPUTextureView
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
			depthClearValue: 1.0,
			depthLoadOp: "clear",
			depthStoreOp: "store",
			stencilLoadOp: "load",
			stencilStoreOp: "store",
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
		processInput()
		updateViewMatrix(device)
		updateProjectionMatrix(device)
		draw(device, context, pipelineObj)
	})
}

function processInput() {
	// 根据按键状态更新物体的位置
	if (keysPressed.get('w')) {
		// 向前移动
		camera.processKeyboard(CameraMovement.FORWARD, FrameTime)
	}
	if (keysPressed.get('a')) {
		// 向左移动
		camera.processKeyboard(CameraMovement.LEFT, FrameTime)
	}
	if (keysPressed.get('s')) {
		// 向后移动
		camera.processKeyboard(CameraMovement.BACKWARD, FrameTime)
	}
	if (keysPressed.get('d')) {
		// 向右移动
		camera.processKeyboard(CameraMovement.RIGHT, FrameTime)
	}
	if (keysPressed.get('q')) {
		// 向右移动
		camera.processKeyboard(CameraMovement.UP, FrameTime)
	}
	if (keysPressed.get('e')) {
		// 向右移动
		camera.processKeyboard(CameraMovement.DOWN, FrameTime)
	}
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

	window.addEventListener("keydown", function (event) {
		keysPressed.set(event.key, true)

		console.log(event.key)

		// 灯光开关
		if (event.code == 'KeyL') {
		}

		// 摄像机动画开关
		if (event.code == 'KeyC') {
		}

		// 环境反射开关
		if (event.code == 'KeyR') {
		}

		// 环境折射开关
		if (event.code == 'KeyF') {
		}

		// 阴影调试开关
		if (event.code == 'Digit1') {
		}

		// 小车动画开关
		if (event.code == 'KeyM') {
		}

		// 层级摄像机动画开关
		if (event.code == 'KeyD') {
		}

		// 天空盒开关
		if (event.code == 'KeyE') {
		}

		// 阴影开关
		if (event.code == 'KeyS') {
		}
	})

	// 绑定keyup事件
	window.addEventListener("keyup", function (event) {
		keysPressed.set(event.key, false)
	})

	function handleMouseDown(event: MouseEvent) {
		// 左键：0
		// 中键：1
		// 右键：2
		if (event.button === 0) {
			leftMouseButtonDown = true
		}
		mousePositionX = event.clientX
		mousePositionY = event.clientY
		// console.log("Mouse up at:", event.clientX, event.clientY);
	}

	window.addEventListener("mousedown", handleMouseDown);

	function handleMouseUp(event: MouseEvent) {
		// 左键：0
		// 中键：1
		// 右键：2
		if (event.button === 0) {
			leftMouseButtonDown = false
		}
		// console.log("Mouse up at:", event.clientX, event.clientY);
	}

	window.addEventListener("mouseup", handleMouseUp);

	function handleMouseMove(event: MouseEvent) {
		if (leftMouseButtonDown) {
			var xoffset = event.clientX - mousePositionX
			var yoffset = mousePositionY - event.clientY

			camera.processMouseMovement(xoffset, yoffset, true)
			// console.log("Mouse moved to:", event.clientX, event.clientY);
		}

		mousePositionX = event.clientX
		mousePositionY = event.clientY
	}

	window.addEventListener("mousemove", handleMouseMove);

	function handleMouseWheel(event: WheelEvent) {
		camera.processMouseScroll(event.deltaY > 0.0 ? 1.0 : -1.0)
		console.log("Mouse wheel scrolled:", event.deltaY);
	}

	window.addEventListener("wheel", handleMouseWheel);

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
