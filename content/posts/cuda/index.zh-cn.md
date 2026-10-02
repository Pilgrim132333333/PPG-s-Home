---
title: "CUDA 编程学习笔记"
date: 2026-09-28
description: "从 vLLM 代码出发，梳理 C++ 模板、CUDA 编程模型、线程层级、内存访问、同步与异步执行。"
summary: "从 vLLM 代码出发，系统梳理 C++ 基础、CUDA 线程与内存模型，以及同步和异步执行。"
categories: ["技术"]
tags: ["CUDA", "C++", "GPU", "vLLM"]
draft: false
toc:
  enable: true
---

这篇笔记详细记录CUDA相关的代码和模板。
需要注意的是：这篇笔记的起点是从vLLM项目出发的，所以更多例子将使用vLLM中的代码

## C++相关知识和模板
C++是我学习的第一个编程语言，所以基础较为扎实，但是仍然需要巩固一下：
### 值传递，指针，引用与连续内存
#### 值传递
```c++
void add_one(int x) {
    x += 1;
}

int main() {
    int a = 10;
    add_one(a);
    // a 仍然是 10
}
```
此处展示的是当x作为参数传递的时候，在函数内部会将其复制。
其坏处在于当x是一个维度很大的向量的时候，其会浪费非常多的时间在复制向量。
所以我们自然而然的会想到指针
#### 指针
```c++
int a = 10;
int* p = &a;
```
指针是C语言的最大特性，其赋予了C系列语言直接支配内存的能力，大大增强了可实用性
#### 数组与指针
```c++
float data[4] = {1.0, 2.0, 3.0, 4.0};
float* p = data;

p[0] == data[0];
p[1] == data[1];
*(p + 2) == data[2];
```
这里实际上每个 `float` 占用4个字节，所以在实际的内存level来看，每个元素需要跨4个字节
但是在程序层面，+1即可跨元素，相当于统一了不同数据类型在底层造成的差异
#### 输入指针与输出指针
```c++
void scale(
    const float* input,
    float* output,
    int n,
    float factor
) {
    for (int i = 0; i < n; ++i) {
        output[i] = input[i] * factor;
    }
}
```
这里用const标记input, 表示这个函数无法修改input，其为只读
而output没有const标记，表示可以修改输出
#### 引用
```c++
void add_one(int& x) {
    x += 1;
}

int main() {
    int a = 10;
    add_one(a);
    // a 现在是 11
}
```
引用可以理解为变量的别名。其本质是将地址传入进去，但是可以拿到地址的变量名
### Const和指针写法，类型转换，函数签名
#### Const
const关键词表示不可以通过这个变量，改变这个对象的值
```c++
const int x = 10;
x = 20; // 编译错误
```
#### 四种指针写法
- 普通指针
```c++
float* p;
*p = 1.0f;
p = another_address;
```
这里既可以改变p里面的值，又可以改变p指向的地址
- 指向只读数据的指针
```c++
const float* p;
float const* p; ##两个写法等价
*p = 1.0f;       // 错误：不能通过 p 修改数据
p = another_ptr; // 正确：p 可以指向别处
```
- 地址不可改变的指针
```c++
float* const p = address;
*p = 1.0f;       // 正确：数据可以修改
p = another_ptr; // 错误：p 不能指向别处
```
- 地址和数据都不可改变的指针
```c++
const float* const p = address;
```
#### Const引用
这里用一个vLLM中的例子：
```c++
torch::Tensor rms_norm(
    const torch::Tensor& input,
    const torch::Tensor& weight,
    double epsilon
);
```
这里表示了很多信息：
  - input和weight通过引用传递，不会复制值
  - 两者都是只读
  - epslion很小，可以直接复制
#### 常见的整数类型和类型转换
```c++
int n;
int64_t num_elements;
size_t bytes;
```
int已经是最常见的数据类型了，默认为32位
而int64_t是64位，数值更大
size_t通常用于内存大小，数组长度，通常是unsigned_int类型
下面介绍最常见的类型转换函数 `static_cast` :
```c++
float x = 3.14f;
int y = static_cast<int>(x); // 3
```
还有一种转换函数：`reinterpret_cast`
```c++
void* raw_ptr = ...;
float* float_ptr = reinterpret_cast<float*>(raw_ptr);
float* data = ...;
float4* vectorized =
    reinterpret_cast<float4*>(data); ##用4个float的带宽读取一个float数据
```
其不进行正常的数值转换，而是要求编译器对同一地址用另一种类型解释同一地址或位模式
#### `data_ptr<T>()`
在c++中，这样的写法表示，tensor的底层数据是float
```c++
float* ptr = tensor.data_ptr<float>();
```
### 模板和dType分派
#### 模板
templete，其起到的作用是当一个函数可以接受很多数据类型作为参数，但内部逻辑完全一样时，我们可以使用template来统一写逻辑
```c++
template <typename T>
T add(T a, T b) {
    return a + b;
}
float x = add<float>(1.5f, 2.5f);
int y = add<int>(1, 2);
```
除了在处理不同数据类型时使用的类型模板参数，还存在一种非类型模板参数：
```c++
template <int BLOCK_SIZE>
__global__ void kernel(float* data) {
    __shared__ float buffer[BLOCK_SIZE];
}
kernel<256><<<blocks, 256>>>(data); #第一个<<>>是非类型模板参数，第二个是CUDA启动配置
```
接下来来讲模型特化。有时候，一些数据类型所对应的函数需要特殊处理：
```c++
template <typename T>
T convert(float value) {
    return static_cast<T>(value);
}
#这里特殊处理了当返回值是half时的函数
template <>
half convert<half>(float value) {
    return __float2half(value);
}
```
#### dType分派
data type. 指的是tensor里的每个元素用哪种数据格式来存储和计算
一个tensor的本质是一大块内存里面的数字，但是有数字，我们就需要知道每个数字的类型，占几个字节，怎么解读数字。所以dType决定了三件事：
  - 每个元素占多少字节
  - 数值范围和精度
  - 用什么硬件指令计算
继续刚才模板的内容，因为我们在写逻辑的时候更多的时候是写模板，所以当具体处理tensor的时候，我们就需要一个过程来判断里面的dType是什么：
运行时检查 tensor dtype
↓
选择已经编译好的模板实例
↓
运行对应 CUDA kernel
这个过程就是dType的分派层，其主要是检查tensor的dType，选择后续处理
而手写switch函数是最简单的实现，但是重复写就显得多余，所以Pytorch提供了dType分派宏：
```c++
AT_DISPATCH_FLOATING_TYPES(
    input.scalar_type(),
    "scale",
    [&] {
        launch_scale<scalar_t>(input, output); //这里的[&]表示这个函数可以通过引用来拿到input,output
    }
);
```
宏的内部大概相当于：
```c++
switch (input.scalar_type()) {
    case torch::kFloat:
        using scalar_t = float;
        launch_scale<scalar_t>(input, output);
        break;

    case torch::kDouble:
        using scalar_t = double;
        launch_scale<scalar_t>(input, output);
        break;
}
```
这里要写一下为什么要用宏，并且为什么必须用宏：
宏相对于普通函数，其等于文本替换，所以在lambda函数的参数scalar_t并没有提前声明的情况下可以通过编译
如果它在普通函数：
```c++
// ❌ 反例:用普通函数代替宏
template <typename Func>
void dispatch(at::ScalarType t, Func fn) {
    switch (t) {
        case at::ScalarType::Float: {
            using scalar_t = float;   // scalar_t 只活在这个 case 的作用域里
            fn();                     // 调用你的 lambda
            break;
        }
        case at::ScalarType::Double: {
            using scalar_t = double;
            fn();
            break;
        }
    }
}

// 调用处:
dispatch(input.scalar_type(), [&] {
    launch_scale<scalar_t>(input, output);
    //           ^^^^^^^^ ❌ 编译错误: "scalar_t" 未声明
});
```
在这里，函数在真正调用时，编译器会直接看launch_scale函数，其参数scalar_t没有声明，直接导致失败。
### 宏，头文件和条件编译
在正式compile之前，代码会先经过预处理器，在预处理中，会处理宏，头文件和条件编译
#### 宏
- 基础宏
```c++
#define BLOCK_SIZE 256
```
- 带参数宏
```c++
#define SQUARE(x) ((x) * (x))
```
- 多行宏
```c++
#define CHECK_INPUT(x)            \
    TORCH_CHECK(x.is_cuda());      \
    TORCH_CHECK(x.is_contiguous())
```
#### 条件编译
条件编译会决定某段代码会不会进入此次编译
```c++
#ifdef USE_CUDA
void launch_cuda_kernel();
#endif //如果定义了USE_CUDA,那么编译
```
在CUDA中，可能用来区分不同级别的实现：
```c++
#if defined(__CUDA_ARCH__) && __CUDA_ARCH__ >= 800
    // Ampere 或更高架构的 device 代码
#else
    // 较老架构实现
#endif
```
### CU,Cpp，NVCC，CMake
#### Cpp文件和Cu文件的区别
.cpp文件：其就是普通源文件，交给正常c++编译器
.cu文件：它同时包括：
  - CPU侧C++代码
  - GPU kernel
  - kernel 启动代码
其通常由CUDA的NVCC编译
#### nvcc
一个.cu文件中同时存在两种代码：
  - device code： 其由GPU执行
  - Host code： 其由CPU执行
下面说说CUDA函数的几个修饰符：
  - **global**: 由CPU发起调用，在GPU上执行，使用\<\<\>\>启动
  - **device**: 在GPU上执行，通常由其他GPU函数调用，不能直接使用普通CPU代码调用
  - **host**: 由CPU运行，普通c++函数就是host的，一般不显式写
#### 编译与链接
在链接各个头文件之前，每个文件都会单独编译：
torch_bindings.cpp
↓ 编译
torch_bindings.obj
`scale.cu`
↓ nvcc 编译
scale.obj
接着，其会链接生成动态扩展库：
torch_bindings.obj
scale.obj
CUDA/PyTorch 依赖库
↓ 链接
扩展动态库
而这个扩展动态库，python就可以加载，然后使用里面的算子
**既然我们已经有了扩展动态库，那为什么我们还需要注册算子和对应的实现呢？**
实际上有了扩展动态库仅仅是解决了代码可以跑的问题，并不能将算子优雅的融合到python端
这里的注册机制实际上更为复杂，在c++基础部分不再叙述了
#### CMake
cmake的一些功能：
- 哪些源文件需要编译
- 哪些文件是 CUDA
- include 路径在哪里
- 依赖哪些 PyTorch/CUDA 库
- 针对哪些 GPU 架构编译
- 最后生成什么动态库
较为复杂，也不再赘述

截至目前的内容，c++的基础已经差不多完成了。后面可以根据代码继续深入c++部分知识，上述内容了解后，对代码理解就不会造成太大阻碍了

## CUDA编程模型
这是一套关于怎么把计算任务组织成海量线程，放到GPU上并行执行的思维框架和编程范式
其涉及到异构，线程层级，内存层级
一个简单的心智图：
```javascript
    Host (CPU)                         Device (GPU)
┌──────────────┐                  ┌─────────────────────────┐
│ 1.分配显存    │                  │   Grid                  │
│ 2.拷入数据 ───┼── cudaMemcpy ──▶ │  ┌──────┐ ┌──────┐       │
│ 3.发射 kernel─┼── <<<g,b>>> ───▶ │  │Block │ │Block │ ...   │
│              │                  │  │ warp │ │ warp │       │
│ 5.拷回结果 ◀──┼── cudaMemcpy ────┤  │thread│ │thread│       │
└──────────────┘                  │  └──────┘ └──────┘       │
                                   │  各线程读写 global/shared│
                                   └─────────────────────────┘
```
在正式进入编程模型之前，我们需要一些基础知识：
- 异构
异构的核心是指一个程序同时使用CPU和GPU，但两者承担不同的工作
CPU称为Host，负责执行，控制，调度和启动任务
GPU称为Device，负责执行大规模并行运算
一个CUDA程序通常包含HostCode和DeviceCode，它们分别在CPU和GPU上运行

- 线程层级
在CUDA模型当中，线程被分为了三个层级：Grid， Block， Thread
我们从小往大来说：
Thread
Thread是最小的执行单元，其存储在block中，每个thread都有自己的 `threadIdx.x`
Block
Block是由多个thread组成的，其在grid当中。
向上看，其有 `blockIdx.x` 获取在grid当中的编号。向下看，其有 `blockDim.x` 可以获取其存储了多少Thread
Grid
一次kernel启动产生的所有block共同组成一个grid，grid中block的数量由 `gridDim.x` 表示
全局thread索引
```c++
int i = blockIdx.x * blockDim.x + threadIdx.x; //这里的blockIdx从0开始，所以不用-1
```
- 内存层级
这里展示整体内存层级的简化图：
```text
Host / CPU
└── Host Memory
      ⇅ PCIe / NVLink
Device / GPU
├── Global Memory（显存/HBM/GDDR）
│   └── 所有 Block、所有 Thread 可访问
│
├── L2 Cache
│   └── 整个 GPU 共享
│
└── SM
    ├── L1 Cache
    ├── Shared Memory
    │   └── 同一个 Block 的 Thread 共享
    │
    └── Register
        └── 每个 Thread 私有
```
这里先说一下GlobalMemory和L2 Cache的区别：
两个的作用范围都是整个GPU，但是GlobalMemory需要手动分配到释放，速度慢，但是容量大，又被叫做显存。而L2 Cache是由硬件管理，速度较快，但是容量相对小
好的，现在我们已经了解了一下最基本的概念，现在要往下继续深入了解CUDA的编程范式。现在我们在了解的CUDA编程范式类似于操作系统的底层操作，其大量涉及到thread级别的操作。因此我们可以借鉴操作系统的部分来切入这一部分。
CUDA在操作什么？它的目标是什么？最基本在干什么？
### 线程模型和index计算
```c++
__global__ void scale_kernel(
    const float* input,
    float* output,
    int n
) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;

    if (i < n) {
        output[i] = input[i] * 2.0f;
    }
}
```
先看一个代码例子，在这个例子中，函数被标记为_global_，表示GPU将会执行这段代码。这个函数表示的是一个thread需要进行的操作，而kernel会将这个函数发配给多个thread
#### thread，block和grid
我们需要了解CUDA的基本操作对象。在理论上，其由三部分组成：thread, block, grid
一次常规的kernel启动会创建一个grid，grid包含多个block，每个block会包含多个thread
```c++
scale_kernel<<<3, 4>>>(input, output, 10);//1 grid里面3个block，每个block有4个thread
```
之前已经讨论过，每个对象都有其对应的id和dim来代表其存储数量和自身位置：
  - Thread → threadIdx.x
  - Block → blockIdx.x, blockDim.x
  - Grid → gridDim.x
一般来说，当输入是一个多dim的向量，我们就可以根据索引让很多thread来共同处理一个输入，提高计算速度（已经展示在例子当中）。而if判断是确保开启thread的数量要小于输入的维度，否则会报错
在看完这个最基础的例子，我们可以看一个更加贴合vLLM的例子，在实际应用中，可能不会细致到对每个输入都进行线程级别的拆分，所以我们会对block级别进行操作：
```c++
__global__ void scale_rows(
    const float* input,
    float* output,
    int hidden_size
) {
    int row = blockIdx.x;

    for (int col = threadIdx.x;
         col < hidden_size;
         col += blockDim.x) {

        int64_t offset =
            static_cast<int64_t>(row) * hidden_size + col;

        output[offset] = input[offset] * 2.0f;
    }
}
```
### warp与SIMT
当了解完最基本的操作对象，我们需要了解一下大量thread是如何在block上实现优化的
在上述基础模型中，各个thread之间是相对独立的。但是thread的颗粒度太细，往往GPU不会独立的调度每一个thread，而是将32个thread捆绑在一起，所以我们有这样的对应关系：

| block 内的 warp 编号 | `threadIdx.x` 范围 |
| --- | --- |
| 0 | 0～31 |
| 1 | 32～63 |
| 2 | 64～95 |
| 3 | 96～127 |

而我们为了方便定位thread在warp中的位置，我们有lane_id,也就是每个thread相对于自己的wrap的位置：
```c++
int warp_id = threadIdx.x / 32;
int lane_id = threadIdx.x % 32;
warp_id = 1;  // block 内第 2 个 warp
lane_id = 5;  // 该 warp 内编号为 5 的位置
```
这种模型称为SIMT：Single Instructuion, Multiple Threads
这种模型我们可以理解为每个warp会执行同一个命令，也就是说，多个thread都会执行同一个命令。区别在于，每个thread使用的数据不同。
在现代CUDA框架里，warp是重要的运行单位，但是其并不属于元数据，也就是说，其内部并不像thread一样可以当作单位对象处理
如果一个warp内部出现分歧，也就是有部分线程和另一部分线程不执行同一个代码，我们称之为  “分支发散“（branch divergence）
既然存在分支情况，我们就需要掌握哪些thread在做什么，是否在占用。因此我们需要：Active Mask
其是一个32位掩码，每一位对应一个lane_id，比如：
0xffffffffu → 表示32位都是1
0x0000000fu → 表示只有低4位是1
同样，因为存在分支情况，我们就不能忽略在同一个warp中的同步。所以我们通常会在写入和读取之间使用，这一部分会详细在Thread同步章节解释：
```c++
__syncwarp();
```
现在我们已经基本了解了整体的结构和具体的对象。现在我开始探究这些object是如何拿到和交出数据的：
### GPU内存层次
我们已经在之前的基础知识部分铺垫了内存的大致结构
```c++
Host / CPU
└── Host Memory（系统内存）
        ⇅ PCIe / NVLink
GPU / Device
├── Global Memory（显存：GDDR/HBM）
│   └── 容量最大、延迟较高
│
├── L2 Cache
│   └── 整个 GPU 的所有 SM 共享
│
└── SM（Streaming Multiprocessor，是系统负责处理block的processor）
    ├── L1 Cache
    ├── Shared Memory
    └── Register File
        └── 分配给各个 Thread
```
接下来我将从底部（thread）逐步扩展到顶部（Global）
- Thread级别
  - Register：Thread级别相当于元数据，所以我们需要内存来存储临时变量。
  - Local Memory：当数据是一个大型数组时，register可能无法存储，因此可能存储在localMemory。注意：其物理位置是在显存上
- Block级别
  - sharedMemory：一个block里面所有thread所公用的内存。
- Grid级别（也就是显存）
  - Global Memory： 所有block都可以访问其中的地址。通常也是tensor存储的地方
- L1,L2
  - L1和L2是在SM级别上的缓存，其负责处理processor和各个block之间的交互
  - L2是所有SM共享的，而L1更靠近单个SM
### 显存访问模式
这里我们继续深入warp访问内存的方式，在一个warp中的各个thread，它们各自访问哪些地址，这些地址是否集中
我们先看一个常见的例子，由此我们可以了解到CUDA的内存访问机制：
假设一个warp的32个线程各读取一个float类型数据：
```c++
int lane = threadIdx.x % 32;
float x = input[lane];
```
一个float会占用4字节的内存，所以经过简单的乘法，我们最终将需要访问：4\*32 = 128字节的内容。所以，这次访问我们需要在连续的128字节的内存上进行访问。
而根据 [https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#coalesced-access-to-global-memory](https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#coalesced-access-to-global-memory) 官方指南，硬件会根据：这些请求覆盖多少个对齐的32字节区域，来访问合并内存。也就是说其以区域为基本单位，一个区域占据32字节。
所以经过简单的计算，每个区域将会存储8个float数据：
```c++
区域 0：input[ 0] ～ input[ 7]
区域 1：input[ 8] ～ input[15]
区域 2：input[16] ～ input[23]
区域 3：input[24] ～ input[31]
```
因为这样的区域设置，我们可能会浪费部分带宽，现在我们可以看一种具体情况：
```c++
float x = input[lane * 32];
```
在这个例子中，我们需要访问input\[0\],input\[32\].input\[64\] …,每个访问的元素都是一个区域的第一个元素。和上个例子对比来看，我们访问的总数据量没有变化，都是lane的数量\*4，但是需要访问的区域数增加了很多。因此，我们说这种访问浪费了很多带宽
有时候这种错误是显而易见的，但是在具体写代码的时候，我们往往需要仔细考虑一下：
```c++
for (int k = 0; k < 4; ++k) {
    float x = input[lane * 4 + k];
    // 使用 x
}
```
在这个例子中，每个warp会连续访问内存： lan0: 0，1，2，3. lan1:4,5,6,7
而下面这个例子：
```c++
for (int k = 0; k < 4; ++k) {
    float x = input[lane + k * 32];
    // 使用 x
}
```
我们以k为单位来观察，当k==0时，其访问是连续的：lan0 =  0, lan1 = 1 … lan31 = 31
当一个warp处理同一个load时候，涉及到内存访问，它们会将需要访问的地址同时提交，也就是当k==0的时候，一个warp中的32个thread会提交它们的访问地址，而在这个例子中，访问地址是在一个区域内连续的，因此我们说会相对节省时间花销
在我们明白分区域的访问形式以后，我们可以折回到上一层，想想如何从load次数上减少地址访问的时间开销：
  - 标量读取：
```c++
float x = input[i];
```
这是我们最常见的访问方式，但是在面对一个足够长的tensor的时候，加入一共有n个元素，那么我们就需要进行n次访问操作
  - 向量化读取
```c++
const float4* input4 = //这个const表示不能通过指针修改其存储的值
    reinterpret_cast<const float4*>(input); //这里表示目标类型，也就是转换为只读指针

float4 v = input4[i];
```
这里面我们相当于将input减少了维度：
```c++
input4[0] → input[0], input[1], input[2], input[3]
input4[1] → input[4], input[5], input[6], input[7]
input4[2] → input[8], input[9], input[10], input[11]
```
在读取后我们通常使用这样的成员访问：
```c++
v.x  // input[4*i + 0]
v.y  // input[4*i + 1]
v.z  // input[4*i + 2]
v.w  // input[4*i + 3]
```
这样的操作不仅可以减少load的数量，还可以每个thread访问一个input4\[i\]，正好对应32个字节，也就是一个区域的大小
最后，我们往上看一层，探究在内存和基本thread基础上，各个对象是如何互相配合的
### Thread同步
线程同步是最基本的，同时也是最重要的部分。其广泛指当Thread对数据进行更改时，怎么让其他thread知道，并不出现错误。在CUDA中，存在着这几个容易混淆的机制：

| 机制 | 主要作用 |
| --- | --- |
| `__syncthreads()` | 同一个 block 内的线程会合，并建立内存访问顺序 |
| `__syncwarp(mask)` | 同一个 warp 中指定的线程会合，并建立内存访问顺序 |
| `atomicAdd()` 等原子操作 | 保证某次共享数据更新不会被其他更新打断 |
| 同一 stream 中先后启动 kernel | 让后一个 kernel 在前一个完成后执行 |

我们从最常见的 `__syncthreads()` 开始讲解：
```c++
buffer[t] = input[t];

__syncthreads();

if (t == 0) {
    float sum = 0.0f;

    for (int j = 0; j < 256; ++j) {
        sum += buffer[j];
    }

    output[0] = sum;
}
```
这是一个很基础的例子，目标是256个线程各读取一个数据，然后第一个线程计算出这些线程的总和
这个代码存在一个问题：如果t==0的thread在其他thread还没有读取的时候就计算总和，其就会出现计算错误
> 这里 `__syncthreads` 的作用是：让thread等待，直到block中所有thread都到达_syncthreads()的调用点。

在基于block内同步之后，我们往下看基于warp的同步： `__syncwarp()` :
这个函数会同步warp里面所有的thread，但无法保证除了自己之外的warp
其还可以作为 `__syncwarp(mask)`
下面我们讨论block级别的同步：
在CUDA中没有像thread和warp这种函数可以直接同步block。因为grid并不属于一个实体，其可以看作和kernel是一个级别的。所以，我们可以把任务拆分成两个不同的kernel：
```c++
partial_sum<<<blocks, threads, 0, stream>>>(
    input, partials
);

finish_sum<<<1, threads, 0, stream>>>(
    partials, output
);
```
这里写kernel的顺序已经确保了运行顺序的正确
### stream和异步执行
现在我们要把视角再放大，从kernel级别的操作扩招到CPU是如何提交任务的，并且多个kernel是如何先后执行
这一部分的开始，我们应该将重点放在异步执行会造成什么：
异步：CPU提交任务，GPU执行任务。而CPU提交完成，并不代表GPU计算完成
```c++
scale_kernel<<<blocks, threads, 0, stream>>>(...);

printf("submitted\n");
```
在这段host代码中，CPU负责提交任务给GPU。当CPU提交完成以后，其就直接到达printf函数，不保证GPU运算完成。
因此我们需要区分以下三个时刻：
  任务被提交 → GPU 开始执行 → GPU 执行完成
