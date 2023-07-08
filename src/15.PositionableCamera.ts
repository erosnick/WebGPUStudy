import screenShader from "./shaders/computeShader.wgsl?raw"
import common from "./shaders/Common.wgsl?raw"
import rayTracerKernel from "./shaders/PositionableCamera.wgsl?raw"
import { BVHNode } from "./BVHNode"
import { Sphere, SphereSize } from "./Sphere"
import { vec3 } from "wgpu-matrix"
import { Vec3 } from "wgpu-matrix/dist/1.x/vec3"
import { SurfaceMaterial } from "./SurfaceMaterial"

const Infinity = 10000.0

var sphereCountElement: HTMLElement | null
var renderTimeElement: HTMLElement | null
var inputSphereCountElement: HTMLInputElement | null
var useBVHElement: HTMLElement | null
var link: HTMLAnchorElement

class Renderer {

	canvas!: HTMLCanvasElement

	colorBuffer!: GPUTexture
	colorBufferView!: GPUTextureView
	sampler!: GPUSampler
	sceneData!: GPUBuffer	

	spheres!: Sphere[]
	nodes!: BVHNode[]
	sphereIndices!: number[]
	nodesUsed = 0
	sphereData!: GPUBuffer
	bvhBuffer!: GPUBuffer
	sphereLookupBuffer!: GPUBuffer

	useBVH = false

	device!: GPUDevice

	rayTracingPipeline!: GPUComputePipeline
	rayTracingBindGroup!: GPUBindGroup
	screenPipeline!: GPURenderPipeline
	screenBindGroup!: GPUBindGroup

	aspectRatio = 16.0 / 9.0
	imageWidth = 800
	imageHeight = 450

	sphereCount = 4
	maxBounces = 5
	samplePerPixels = 100

	backgroundColor = [1.0, 1.0, 1.0]

	constructor() {
	}

	async writeSphereData(sphere: Sphere, sphereData: GPUBuffer, offset: number) {
		this.device.queue.writeBuffer(sphereData, offset, new Float32Array([
		sphere.center[0], sphere.center[1], sphere.center[2], sphere.radius]))
		this.device.queue.writeBuffer(sphereData, offset + 16, new Float32Array([
																sphere.material.color[0], 
																sphere.material.color[1], 
																sphere.material.color[2]]))
		this.device.queue.writeBuffer(sphereData, offset + 28, new Int32Array([sphere.material.surfaceType]))
		this.device.queue.writeBuffer(sphereData, offset + 32, new Float32Array([sphere.material.fuzz, 
																				 sphere.material.indexOfRefraction]))
	}

	async createAssets() {
		this.colorBuffer = this.device.createTexture({
			size:{
				width: this.canvas.width,
				height: this.canvas.height
			},
			format: "rgba8unorm",
			usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
		})

		this.colorBufferView = this.colorBuffer.createView()

		const samplerDescriptor: GPUSamplerDescriptor = {
			addressModeU: "repeat",
			addressModeV: "repeat",
			addressModeW: "repeat",
			magFilter: "nearest",
			minFilter: "nearest",
			mipmapFilter: "nearest",
			maxAnisotropy: 1
		}

		this.sampler = this.device.createSampler(samplerDescriptor)

		this.sceneData = this.device.createBuffer({
			size: 96,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		})

		this.device.queue.writeBuffer(this.sceneData, 64, new Int32Array([this.sphereCount, this.useBVH ? 1 : 0, 
																		  this.maxBounces, this.samplePerPixels]))

		this.sphereData = this.device.createBuffer({
			size: SphereSize * this.sphereCount,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
		})

		this.spheres = new Array(this.sphereCount)

		// for (let i = 0; i < this.sphereCount; i++) {
		// 	let x = ((Math.random() * 2.0) - 1.0) * 20.0
		// 	let y = ((Math.random() * 2.0) - 1.0) * 20.0
		// 	let z = Math.random() * -5.0 - 5.0
		// 	let r = Math.random()
		// 	let g = Math.random()
		// 	let b = Math.random()
		// 	let radius = Math.random() * 0.5 + 0.5

		// 	this.spheres[i] = new Sphere([x, y, z], radius, new SurfaceMaterial([r, b, g], 0, 0.0, 1.0))

		// 	this.writeSphereData(this.spheres[i], this.sphereData, SphereSize * i)
		// }

		// for (let i = 0; i < this.sphereCount; i++) {
		// 	let x = -50 + 100.0 * Math.random()
		// 	let y = -50.0 + 100.0 * Math.random()
		// 	let z = -50.0 + 100.0 * Math.random()
		// 	let r = Math.random()
		// 	let g = Math.random()
		// 	let b = Math.random()
		// 	let radius = 0.1 + 1.9 * Math.random();

		// 	this.spheres[i] = new Sphere([x, y, z], radius, new SurfaceMaterial([r, b, g], 1, 0.0, 1.0))

		// 	this.writeSphereData(this.spheres[i], this.sphereData, SphereSize * i)
		// }

		// this.spheres[0] = new Sphere([-1.0, 0.0, -1.0], 0.5, new SurfaceMaterial([0.8, 0.8, 0.8], 2, 0.0, 1.5))			// Left
		// this.spheres[1] = new Sphere([0.0, 0.0, -1.0], 0.5, new SurfaceMaterial([0.1, 0.2, 0.5], 0, 1.0, 1.0))			// Center
		// this.spheres[2] = new Sphere([1.0, 0.0, -1.0], 0.5, new SurfaceMaterial([0.8, 0.6, 0.2], 1, 0.0, 1.0))			// Right
		// this.spheres[3] = new Sphere([0.0, -100.5, -1.0], 100.0, new SurfaceMaterial([0.8, 0.8, 0], 0.0, 0.0, 1.0))		// FLoor

		// for (let i = 0; i < this.spheres.length; i++) {
		// 	this.writeSphereData(this.spheres[i], this.sphereData, SphereSize * i)
		// }

		this.spheres[0] = new Sphere([-1.0, 0.0, -1.0], 0.5, new SurfaceMaterial([1.0, 1.0, 1.0], 2, 0.0, 1.5))			// Left
		this.spheres[1] = new Sphere([ 0.0, 0.0, -1.0], 0.5, new SurfaceMaterial([0.1, 0.2, 0.5], 0, 0.0, 1.0))			// Center
		this.spheres[2] = new Sphere([ 1.0, 0.0, -1.0], 0.5, new SurfaceMaterial([0.8, 0.6, 0.2], 1, 0.0, 1.0))			// Right
		this.spheres[3] = new Sphere([0, -100.5, -1.0], 100.0, new SurfaceMaterial([0.8, 0.8, 0.0], 0, 0.0, 1.0))		// Ground

		for (let i = 0; i < this.spheres.length; i++) {
			this.writeSphereData(this.spheres[i], this.sphereData, SphereSize * i)
		}

		this.sceneData = this.device.createBuffer({
			size: 32,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		})

		this.device.queue.writeBuffer(this.sceneData, 0, new Int32Array([this.spheres.length, this.useBVH ? 1 : 0,
		this.maxBounces, this.samplePerPixels]))
		this.device.queue.writeBuffer(this.sceneData, 16, new Float32Array([this.backgroundColor[0], this.backgroundColor[1], this.backgroundColor[2]]))

		this.buildBVH()

		this.bvhBuffer = this.device.createBuffer({
			size: 32 * this.nodesUsed,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
		})

		const bvhData: Float32Array = new Float32Array(8 * this.nodesUsed)

		for (let i = 0; i < this.nodesUsed; i++) {
			bvhData[8 * i] = this.nodes[i].minCorner[0]
			bvhData[8 * i + 1] = this.nodes[i].minCorner[1]
			bvhData[8 * i + 2] = this.nodes[i].minCorner[2]
			bvhData[8 * i + 3] = this.nodes[i].leftChild
			bvhData[8 * i + 4] = this.nodes[i].maxCorner[0]
			bvhData[8 * i + 5] = this.nodes[i].maxCorner[1]
			bvhData[8 * i + 6] = this.nodes[i].maxCorner[2]
			bvhData[8 * i + 7] = this.nodes[i].sphereCount
		}
		this.device.queue.writeBuffer(this.bvhBuffer, 0, bvhData, 0, 8 * this.nodesUsed)

		this.sphereLookupBuffer = this.device.createBuffer({
			size: 4 * this.sphereCount,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
		})

		var sphereIndices = new Float32Array(this.sphereIndices)
		this.device.queue.writeBuffer(this.sphereLookupBuffer, 0, sphereIndices)
	}

	updateAABB(nodeIndex: number) {
		var node = this.nodes[nodeIndex]
		node.minCorner = [Infinity, Infinity, Infinity]
		node.maxCorner = [-Infinity, -Infinity, -Infinity]

		for (let i = 0; i < node.sphereCount; i++) {
			const sphere = this.spheres[this.sphereIndices[node.leftChild + i]]
			const axis = [sphere.radius, sphere.radius, sphere.radius]

			var corner: Vec3 = [0.0, 0.0, 0.0]
			corner = vec3.sub(sphere.center, axis)
			node.minCorner = vec3.min(node.minCorner, corner)

			corner = vec3.add(sphere.center, axis)
			node.maxCorner = vec3.max(node.maxCorner, corner)
		}
	}

	subdivide(nodeIndex: number) {
		var node = this.nodes[nodeIndex]

		if (node.sphereCount <= 2) {
			return
		}

		var extent: Vec3 = [0.0, 0.0, 0.0]
		extent = vec3.sub(node.maxCorner, node.minCorner)
		var axis = 0;

		if (extent[1] > extent[axis]) {
			axis = 1
		}

		if (extent[2] > extent[axis]) {
			axis = 2
		}

		// In-place quick sort
		const splitPosition = node.minCorner[axis] + extent[axis] / 2.0

		var start = node.leftChild
		var end = start + node.sphereCount - 1

		while (start <= end) {
			if (this.spheres[this.sphereIndices[start]].center[axis] < splitPosition) {
				start += 1
			}
			else {
				var temp = this.sphereIndices[start]
				this.sphereIndices[start] = this.sphereIndices[end]
				this.sphereIndices[end] = temp
				end -= 1
			}
		}

		var leftCount = start - node.leftChild

		if (leftCount == 0 || leftCount == node.sphereCount) {
			return
		}

		const leftChildIndex = this.nodesUsed
		this.nodesUsed += 1
		const rightChildIndex = this.nodesUsed
		this.nodesUsed += 1

		this.nodes[leftChildIndex].leftChild = node.leftChild
		this.nodes[leftChildIndex].sphereCount = leftCount

		this.nodes[rightChildIndex].leftChild = start
		this.nodes[rightChildIndex].sphereCount = node.sphereCount - leftCount

		node.leftChild = leftChildIndex
		node.sphereCount = 0

		this.updateAABB(leftChildIndex)
		this.updateAABB(rightChildIndex)
		this.subdivide(leftChildIndex)
		this.subdivide(rightChildIndex)
	}

	buildBVH() {
		this.sphereIndices = new Array(this.spheres.length)
		for (let i = 0; i < this.spheres.length; i++) {
			this.sphereIndices[i] = i
		}

		this.nodes = new Array(2 * this.spheres.length - 1)

		for (let i = 0; i < 2 * this.spheres.length - 1; i++) {
			this.nodes[i] = new BVHNode()
		}

		var root = this.nodes[0]
		root.leftChild = 0
		root.sphereCount = this.spheres.length
		this.nodesUsed += 1

		this.updateAABB(0)
		this.subdivide(0)
	}

	// 初始化WebGPU
	async initWebGPU() {
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
		this.device = await adapter.requestDevice()
		const device = this.device

		//获取WebGPU上下文对象
		const context = this.canvas.getContext("webgpu") as GPUCanvasContext

		//获取浏览器默认的颜色格式
		const format = navigator.gpu.getPreferredCanvasFormat()

		//设备分辨率
		const devicePixelRatio = window.devicePixelRatio || 1

		//canvas尺寸
		this.canvas.width = this.imageWidth / devicePixelRatio
		this.canvas.height = this.imageHeight / devicePixelRatio

		//配置WebGPU
		context.configure({
			device,
			format,
			// Alpha合成模式，opaque为不透明
			alphaMode: "opaque",
		})

		return { device, context, format }
	}

	// 创建渲染管线
	async initPipeline(
		format: GPUTextureFormat
	): Promise<GPURenderPipeline> {
		const rayTracingBindGroupLayout = this.device.createBindGroupLayout(
		{
			entries: 
			[
				{
					binding: 0,
					visibility: GPUShaderStage.COMPUTE,
					storageTexture: {
						access: "write-only",
						format: "rgba8unorm",
						viewDimension: "2d"
					}
				},
				{
					binding: 1,
					visibility: GPUShaderStage.COMPUTE,
					buffer: 
					{
						type: "uniform"
					}
				},
				{
					binding: 2,
					visibility: GPUShaderStage.COMPUTE,
					buffer: {
						type: "read-only-storage",
						hasDynamicOffset: false
					}
				},
				{
					binding: 3,
					visibility: GPUShaderStage.COMPUTE,
					buffer: {
						type: "read-only-storage",
						hasDynamicOffset: false
					}
				},
				{
					binding: 4,
					visibility: GPUShaderStage.COMPUTE,
					buffer: {
						type: "read-only-storage",
						hasDynamicOffset: false
					}
				}
			]
		})

		this.rayTracingBindGroup = this.device.createBindGroup(
			{
				layout: rayTracingBindGroupLayout,
				entries:
				[
					{
						binding: 0,
						resource: this.colorBufferView
					},
					{
						binding: 1,
						resource: 
						{
							buffer: this.sceneData
						}
					},
					{
						binding: 2,
						resource:
						{
							buffer: this.sphereData
						}
					},
					{
						binding: 3,
						resource:
						{
							buffer: this.bvhBuffer
						}
					},
					{
						binding: 4,
						resource:
						{
							buffer: this.sphereLookupBuffer
						}
					}
				]
			}
		)

		const rayTracingPipelineLayout = this.device.createPipelineLayout({
			bindGroupLayouts: [rayTracingBindGroupLayout]
		})

		this.rayTracingPipeline = this.device.createComputePipeline({
			layout: rayTracingPipelineLayout,

			compute: {
				module: this.device.createShaderModule(
					{
						code: common + rayTracerKernel
					}
				),
				entryPoint: "main"
			}
		})

		const screenBindGroupLayout = this.device.createBindGroupLayout(
		{
			entries:
				[
					{
						binding: 0,
						visibility: GPUShaderStage.FRAGMENT,
						sampler: {}
					},
					{
						binding: 1,
						visibility: GPUShaderStage.FRAGMENT,
						texture: {}
					},
				]
		})

		this.screenBindGroup = this.device.createBindGroup(
		{
			layout: screenBindGroupLayout,
			entries:
				[
					{
						binding: 0,
						resource: this.sampler
					},
					{
						binding: 1,
						resource: this.colorBufferView
					}
				]
		}
		)

		const screenPipelineLayout = this.device.createPipelineLayout({
			bindGroupLayouts: [screenBindGroupLayout]
		})

		const descriptor: GPURenderPipelineDescriptor = {
			// 顶点着色器
			vertex: {
				// 着色程序
				module: this.device.createShaderModule({
					code: screenShader,
				}),
				// 主函数
				entryPoint: "vs_main",
			},
			// 片元着色器
			fragment: {
				// 着色程序
				module: this.device.createShaderModule({
					code: screenShader,
				}),
				// 主函数
				entryPoint: "fs_main",
				// 渲染目标
				targets: [
					{
						// 颜色格式
						format: format,
					},
				],
			},
			// 初始配置
			primitive: {
				//绘制独立三角形
				topology: "triangle-list",
			},
			// 渲染管线的布局
			layout: screenPipelineLayout
		}

		// 返回异步管线
		return await this.device.createRenderPipelineAsync(descriptor)
	}

	async run() {
		const canvas = document.querySelector("canvas")
		if (!canvas) throw new Error("No Canvas")

		this.canvas = canvas

		// 初始化WebGPU
		const { context, format } = await this.initWebGPU()

		this.createAssets();

		// 渲染管道
		const pipeline = await this.initPipeline(format)
		// 绘图
		this.draw(context, pipeline)

		const device = this.device

		// 自适应窗口尺寸
		window.addEventListener("resize", () => {
			this.canvas.width = this.canvas.clientWidth * devicePixelRatio
			this.canvas.height = this.canvas.clientHeight * devicePixelRatio
			context.configure({
				device,
				format,
				alphaMode: "opaque",
			})
			this.draw(context, pipeline)
		})
	}

	// 编写绘图指令，并传递给本地的GPU设备
 	draw(
		context: GPUCanvasContext,
		pipeline: GPURenderPipeline) {

		let start = performance.now()

		// 创建指令编码器
		const commandEncoder = this.device.createCommandEncoder()
		const rayTracingPass: GPUComputePassEncoder = commandEncoder.beginComputePass()

		rayTracingPass.setPipeline(this.rayTracingPipeline)
		rayTracingPass.setBindGroup(0, this.rayTracingBindGroup)
		rayTracingPass.dispatchWorkgroups(this.canvas.width, this.canvas.height, 1)
		rayTracingPass.end()

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
		}
		// 建立渲染通道，类似图层
		const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)
		
		// 传入渲染管线
		passEncoder.setPipeline(pipeline)
		passEncoder.setBindGroup(0, this.screenBindGroup)

		// 绘图，3 个顶点
		passEncoder.draw(6)
		// 结束编码
		passEncoder.end()
		// 结束指令编写,并返回GPU指令缓冲区
		const gpuCommandBuffer = commandEncoder.finish()
		// 向GPU提交绘图指令，所有指令将在提交后执行
		this.device.queue.submit([gpuCommandBuffer])

		var imageURL = this.canvas.toDataURL("image/png", 1)
		link = document.createElement("a")
		link.href = imageURL

		this.device.queue.onSubmittedWorkDone().then(
			() => {
				let end = performance.now()
				if (renderTimeElement) {
					renderTimeElement.textContent = (end - start).toFixed(2)
				}

				link.download = "render_" + this.samplePerPixels + "spp_" +
					this.canvas.width + "x" + this.canvas.height + "_"
					+ renderTimeElement?.textContent + "ms.png" // 下载时的文件名

				var saveButton = document.getElementById("save")
				saveButton?.addEventListener("click", () => {
					saveImage()
				})
			}
		)

		// requestAnimationFrame(() => {
		// 	this.draw(context, pipeline)
		// })
	}
}

function initalizeUI() {
	sphereCountElement = document.getElementById("sphereCount")
	if (!sphereCountElement) throw new Error("No sphereCount element")

	renderTimeElement = document.getElementById("renderTime")

	if (!renderTimeElement) throw new Error("No renderTime element")

	inputSphereCountElement = document.getElementById("inputSphereCount") as HTMLInputElement

	if (!inputSphereCountElement) throw new Error("No inputSphereCount element")

	sphereCountElement.textContent = renderer.sphereCount.toString()

	useBVHElement = document.getElementById("useBVH");

	if (!useBVHElement) throw new Error("No useBVH element")

	useBVHElement.textContent = renderer.useBVH ? "Yes" : "No"

	inputSphereCountElement.addEventListener("input", function () {
		if (inputSphereCountElement) {
			var value = inputSphereCountElement.value
			renderer.sphereCount = parseInt(value)
			window.location.reload()
			console.log(value)
		}
		// 在这里可以执行其他操作，如更新页面内容或触发其他事件等
	});
}

var renderer = new Renderer()
initalizeUI()
renderer.run()

function saveImage() {
	link.click()
}

console.log('%c 记得设置合理的work group size', 'color:#f00;')