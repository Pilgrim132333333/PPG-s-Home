---
title: "CUDA Programming Notes"
date: 2026-09-28
description: "A practical introduction to C++ templates, the CUDA programming model, memory access, synchronization, and asynchronous execution, with examples inspired by vLLM."
summary: "A practical guide to the C++ foundations and CUDA concepts used in high-performance LLM inference systems such as vLLM."
categories: ["Technology"]
tags: ["CUDA", "C++", "GPU", "vLLM"]
draft: false
toc:
  enable: true
---

These notes document CUDA-related code patterns and programming concepts. They start from the perspective of the vLLM project, so many examples resemble code found in high-performance LLM inference systems.

## C++ Foundations and Common Patterns

C++ was the first programming language I learned, so I already had a solid foundation. Still, several topics are worth revisiting before reading CUDA kernels and PyTorch extensions.

### Value Passing, Pointers, References, and Contiguous Memory

#### Pass by Value

```c++
void add_one(int x) {
    x += 1;
}

int main() {
    int a = 10;
    add_one(a);
    // a is still 10
}
```

When `x` is passed as an argument, the function receives a copy. This can become expensive when the object is a large vector or tensor because copying consumes both time and memory bandwidth.

That naturally leads to pointers and references.

#### Pointers

```c++
int a = 10;
int* p = &a;
```

Pointers give C and C++ direct control over memory. This capability is particularly important in systems code and GPU programming.

#### Arrays and Pointers

```c++
float data[4] = {1.0, 2.0, 3.0, 4.0};
float* p = data;

p[0] == data[0];
p[1] == data[1];
*(p + 2) == data[2];
```

Each `float` occupies four bytes, so adjacent elements are four bytes apart in memory. At the language level, however, adding one to a `float*` advances by one element. Pointer arithmetic therefore hides the byte width of the underlying type.

#### Input and Output Pointers

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

The `const` qualifier marks `input` as read-only through this pointer. The `output` pointer is not const-qualified, so the function can modify the destination buffer.

#### References

```c++
void add_one(int& x) {
    x += 1;
}

int main() {
    int a = 10;
    add_one(a);
    // a is now 11
}
```

A reference can be understood as an alias for another variable. The implementation works with the original object rather than a copy, while the syntax remains similar to ordinary value access.

### Const, Pointer Forms, Type Conversion, and Function Signatures

#### Const

The `const` keyword means that an object cannot be modified through that name or access path.

```c++
const int x = 10;
x = 20; // compile error
```

#### Four Common Pointer Forms

- Ordinary pointer:

```c++
float* p;
*p = 1.0f;
p = another_address;
```

Both the pointed-to value and the address stored in `p` may change.

- Pointer to read-only data:

```c++
const float* p;
float const* p; // equivalent spelling
*p = 1.0f;       // error: data cannot be changed through p
p = another_ptr; // valid: p may point elsewhere
```

- Pointer whose address cannot change:

```c++
float* const p = address;
*p = 1.0f;       // valid: the data may change
p = another_ptr; // error: p cannot point elsewhere
```

- Pointer whose address and data are both read-only:

```c++
const float* const p = address;
```

#### Const References

Here is a function signature similar to one used in vLLM:

```c++
torch::Tensor rms_norm(
    const torch::Tensor& input,
    const torch::Tensor& weight,
    double epsilon
);
```

This signature communicates several things:

- `input` and `weight` are passed by reference, avoiding tensor copies.
- Both tensors are read-only inside the function.
- `epsilon` is small enough to pass by value.

#### Integer Types and Type Conversion

```c++
int n;
int64_t num_elements;
size_t bytes;
```

An `int` is commonly 32 bits. An `int64_t` provides an explicitly sized 64-bit integer. `size_t` is an unsigned type commonly used for memory sizes and array lengths.

`static_cast` performs an ordinary, explicit conversion:

```c++
float x = 3.14f;
int y = static_cast<int>(x); // 3
```

`reinterpret_cast` does something fundamentally different:

```c++
void* raw_ptr = ...;
float* float_ptr = reinterpret_cast<float*>(raw_ptr);

float* data = ...;
float4* vectorized =
    reinterpret_cast<float4*>(data);
```

It does not perform a numerical conversion. Instead, it asks the compiler to interpret the same address or bit pattern as another type. In the second example, the same memory is viewed as groups of four floats.

#### `data_ptr<T>()`

In a C++ PyTorch extension, the following expression obtains a typed pointer to a tensor's underlying data:

```c++
float* ptr = tensor.data_ptr<float>();
```

### Templates and dtype Dispatch

#### Templates

Templates let one implementation work with multiple types when the algorithm is otherwise identical.

```c++
template <typename T>
T add(T a, T b) {
    return a + b;
}

float x = add<float>(1.5f, 2.5f);
int y = add<int>(1, 2);
```

Templates can also accept non-type parameters:

```c++
template <int BLOCK_SIZE>
__global__ void kernel(float* data) {
    __shared__ float buffer[BLOCK_SIZE];
}

kernel<256><<<blocks, 256>>>(data);
```

The first angle-bracket pair contains the compile-time template argument. The triple-angle-bracket expression is the CUDA launch configuration.

Some types require specialized behavior:

```c++
template <typename T>
T convert(float value) {
    return static_cast<T>(value);
}

template <>
half convert<half>(float value) {
    return __float2half(value);
}
```

#### dtype Dispatch

A tensor is ultimately a region of memory containing numbers. Its dtype determines:

- how many bytes each element occupies;
- its numerical range and precision;
- which hardware instructions are used for computation.

Runtime dtype dispatch follows this sequence:

```text
Inspect the tensor dtype at runtime
                ↓
Select an already compiled template instance
                ↓
Run the corresponding CUDA kernel
```

A handwritten `switch` is the simplest implementation, but PyTorch provides dispatch macros to avoid repeating the same structure:

```c++
AT_DISPATCH_FLOATING_TYPES(
    input.scalar_type(),
    "scale",
    [&] {
        launch_scale<scalar_t>(input, output);
    }
);
```

Conceptually, the macro expands into code resembling:

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

Why is a macro used here? A macro performs source-level substitution, so it can introduce `scalar_t` directly into the scope containing the lambda. A normal helper function cannot make a locally declared type alias visible inside a lambda that was compiled in the caller's scope:

```c++
// Incorrect replacement for the dispatch macro
template <typename Func>
void dispatch(at::ScalarType t, Func fn) {
    switch (t) {
        case at::ScalarType::Float: {
            using scalar_t = float;
            fn();
            break;
        }
        case at::ScalarType::Double: {
            using scalar_t = double;
            fn();
            break;
        }
    }
}

dispatch(input.scalar_type(), [&] {
    launch_scale<scalar_t>(input, output);
    //           ^^^^^^^^ compile error: scalar_t is not declared here
});
```

### Macros, Header Files, and Conditional Compilation

Before normal compilation begins, the preprocessor handles macros, included headers, and conditional compilation.

#### Macros

Basic macro:

```c++
#define BLOCK_SIZE 256
```

Macro with an argument:

```c++
#define SQUARE(x) ((x) * (x))
```

Multi-line macro:

```c++
#define CHECK_INPUT(x)            \
    TORCH_CHECK(x.is_cuda());      \
    TORCH_CHECK(x.is_contiguous())
```

#### Conditional Compilation

Conditional compilation determines whether a section of code is included in a particular build:

```c++
#ifdef USE_CUDA
void launch_cuda_kernel();
#endif
```

CUDA code may also select different implementations for different GPU architecture levels:

```c++
#if defined(__CUDA_ARCH__) && __CUDA_ARCH__ >= 800
    // Device code for Ampere or newer architectures
#else
    // Implementation for older architectures
#endif
```

### `.cu`, `.cpp`, NVCC, and CMake

#### `.cpp` and `.cu` Files

A `.cpp` file contains ordinary C++ source and is compiled by a regular C++ compiler.

A `.cu` file may contain:

- CPU-side C++ code;
- GPU kernels;
- kernel launch code.

It is normally compiled by NVIDIA's CUDA compiler, NVCC.

#### NVCC

A `.cu` file contains two broad categories of code:

- device code, executed by the GPU;
- host code, executed by the CPU.

CUDA provides several function qualifiers:

- `__global__`: called from the CPU and executed on the GPU; launched with `<<<...>>>`.
- `__device__`: executed on the GPU and normally called from other GPU functions.
- `__host__`: executed on the CPU; ordinary C++ functions are host functions by default.

#### Compilation and Linking

Each source file is first compiled independently:

```text
torch_bindings.cpp
        ↓ C++ compiler
torch_bindings.obj

scale.cu
        ↓ NVCC
scale.obj
```

The resulting object files are linked with the required CUDA and PyTorch libraries:

```text
torch_bindings.obj
scale.obj
CUDA and PyTorch libraries
        ↓ linker
shared extension library
```

Python can load this shared library and execute the operators it contains. The library alone, however, only makes the compiled code loadable. Operator registration is still required to expose the implementation cleanly to Python and PyTorch's dispatcher.

#### CMake

CMake describes:

- which source files must be compiled;
- which files contain CUDA;
- where include directories are located;
- which PyTorch and CUDA libraries are required;
- which GPU architectures should be targeted;
- which shared library should be generated.

With these C++ foundations in place, reading practical CUDA extension code becomes substantially easier.

## The CUDA Programming Model

The CUDA programming model is a way to organize a computation into a very large number of threads and execute them in parallel on a GPU. Its key ideas include heterogeneous execution, the thread hierarchy, and the memory hierarchy.

```text
    Host (CPU)                         Device (GPU)
┌──────────────┐                  ┌─────────────────────────┐
│ Allocate GPU │                  │   Grid                  │
│ Copy input ──┼── cudaMemcpy ──▶ │  ┌──────┐ ┌──────┐      │
│ Launch kernel┼── <<<g,b>>> ───▶ │  │Block │ │Block │ ...  │
│              │                  │  │ warp │ │ warp │      │
│ Copy result ◀┼── cudaMemcpy ────┤  │thread│ │thread│      │
└──────────────┘                  │  └──────┘ └──────┘      │
                                  │ global/shared memory    │
                                  └─────────────────────────┘
```

Before writing kernels, it helps to establish three basic concepts.

- **Heterogeneous execution:** one program uses both the CPU and GPU for different responsibilities. The CPU, called the host, controls execution, schedules work, and launches tasks. The GPU, called the device, performs massively parallel computation.
- **Thread hierarchy:** CUDA organizes work into threads, blocks, and grids.
- **Memory hierarchy:** data may live in host memory, global device memory, caches, shared memory, or registers.

A simplified memory hierarchy looks like this:

```text
Host / CPU
└── Host Memory
      ⇅ PCIe / NVLink
Device / GPU
├── Global Memory (VRAM/HBM/GDDR)
│   └── Accessible by every block and thread
├── L2 Cache
│   └── Shared by the entire GPU
└── SM
    ├── L1 Cache
    ├── Shared Memory
    │   └── Shared by threads in one block
    └── Registers
        └── Private to each thread
```

Global memory is explicitly allocated and released. It is relatively slow but large. L2 cache is hardware-managed, faster, and much smaller.

### Thread Indexing

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

The `__global__` qualifier means that the CPU launches this function and the GPU executes it. The function describes the work performed by one thread, while the kernel launch creates many threads that run the same function on different data.

#### Threads, Blocks, and Grids

A thread is the smallest execution unit. Each thread has an index such as `threadIdx.x`.

A block contains multiple threads. `blockIdx.x` identifies the block within the grid, while `blockDim.x` is the number of threads in the block.

A grid contains all blocks created by one kernel launch. `gridDim.x` reports the number of blocks in that grid.

```c++
scale_kernel<<<3, 4>>>(input, output, 10);
// One grid, three blocks, and four threads per block
```

The global one-dimensional thread index is:

```c++
int i = blockIdx.x * blockDim.x + threadIdx.x;
```

The bounds check prevents extra threads from accessing memory beyond the end of the input.

In practical LLM kernels, a block often processes an entire row rather than assigning exactly one thread to each input value:

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

### Warps and SIMT

GPU hardware does not schedule every thread independently. It groups 32 threads into a warp.

| Warp index in a block | `threadIdx.x` range |
| --- | --- |
| 0 | 0–31 |
| 1 | 32–63 |
| 2 | 64–95 |
| 3 | 96–127 |

The warp index and the position of a thread inside its warp can be calculated as follows:

```c++
int warp_id = threadIdx.x / 32;
int lane_id = threadIdx.x % 32;

warp_id = 1; // second warp in the block
lane_id = 5; // lane 5 in that warp
```

CUDA follows the SIMT model: Single Instruction, Multiple Threads. Threads in a warp execute the same instruction on different data.

When threads within one warp take different control-flow paths, the warp experiences **branch divergence**. Hardware tracks active lanes with an active mask:

```text
0xffffffffu → all 32 lanes are active
0x0000000fu → only the lowest four lanes are active
```

Warp-level synchronization is available when communication between those lanes is required:

```c++
__syncwarp();
```

### GPU Memory Hierarchy

At the thread level:

- **Registers** store temporary values private to a thread.
- **Local memory** may hold values that do not fit in registers, such as large local arrays. Despite its name, local memory is physically stored in device memory.

At the block level:

- **Shared memory** is accessible to all threads in the same block.

At the grid level:

- **Global memory** is accessible to all blocks and normally stores tensors.

At the SM level:

- L1 cache is close to an individual SM.
- L2 cache is shared by all SMs.

### Global Memory Access Patterns

Memory performance depends not only on how much data a warp requests, but also on whether those addresses are contiguous.

Suppose each of the 32 threads in a warp loads one float:

```c++
int lane = threadIdx.x % 32;
float x = input[lane];
```

Each float occupies four bytes, so the warp requests 128 contiguous bytes. NVIDIA describes global-memory coalescing in terms of the aligned 32-byte memory regions covered by the request. Eight floats fit into each region:

```text
Region 0: input[ 0] through input[ 7]
Region 1: input[ 8] through input[15]
Region 2: input[16] through input[23]
Region 3: input[24] through input[31]
```

The following access pattern is much less efficient:

```c++
float x = input[lane * 32];
```

The warp now reads `input[0]`, `input[32]`, `input[64]`, and so on. Although the useful data volume is unchanged, the request touches many more memory regions and wastes bandwidth.

Consider these two loops:

```c++
for (int k = 0; k < 4; ++k) {
    float x = input[lane * 4 + k];
    // use x
}
```

```c++
for (int k = 0; k < 4; ++k) {
    float x = input[lane + k * 32];
    // use x
}
```

For a fixed value of `k`, the second loop makes adjacent lanes request adjacent addresses. That arrangement usually produces better coalescing.

Vectorized loads can also reduce the number of explicit load operations:

```c++
const float4* input4 =
    reinterpret_cast<const float4*>(input);

float4 v = input4[i];
```

The reinterpretation groups four floats into each element:

```text
input4[0] → input[0],  input[1],  input[2],  input[3]
input4[1] → input[4],  input[5],  input[6],  input[7]
input4[2] → input[8],  input[9],  input[10], input[11]
```

Members can then be accessed individually:

```c++
v.x // input[4*i + 0]
v.y // input[4*i + 1]
v.z // input[4*i + 2]
v.w // input[4*i + 3]
```

Vectorized access requires suitable alignment and bounds handling, but when those requirements are satisfied it can reduce instruction overhead and improve memory throughput.

### Thread Synchronization

Synchronization ensures that threads observe shared data in the required order.

| Mechanism | Primary purpose |
| --- | --- |
| `__syncthreads()` | Synchronize threads in one block and establish memory ordering |
| `__syncwarp(mask)` | Synchronize selected lanes in one warp |
| `atomicAdd()` and other atomics | Prevent an update to shared data from being interrupted by another update |
| Consecutive kernels in one stream | Make the later kernel execute after the earlier kernel completes |

The most common block-level primitive is `__syncthreads()`:

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

In this example, 256 threads each load one value. Thread zero then sums the shared buffer. Without synchronization, thread zero might begin reading before the other threads have completed their writes.

`__syncthreads()` blocks each participating thread until all threads in the block have reached the same synchronization point.

`__syncwarp()` performs a similar operation within a warp, optionally restricted by a mask. CUDA does not provide an ordinary barrier that synchronizes every block in a grid because blocks may run independently and may not all be resident at the same time.

One way to establish a grid-wide phase boundary is to split the operation into separate kernels:

```c++
partial_sum<<<blocks, threads, 0, stream>>>(
    input, partials
);

finish_sum<<<1, threads, 0, stream>>>(
    partials, output
);
```

Kernels launched consecutively into the same stream execute in submission order, so the second kernel begins after the first one completes.

### Streams and Asynchronous Execution

At the host level, CUDA work is asynchronous: the CPU submits a task while the GPU executes it. Completion of the launch call does not mean the GPU has finished the computation.

```c++
scale_kernel<<<blocks, threads, 0, stream>>>(...);

printf("submitted\n");
```

The CPU may print `submitted` immediately after enqueuing the kernel. It is therefore important to distinguish three moments:

```text
Task submitted → GPU begins execution → GPU completes execution
```

Streams define ordering relationships between GPU operations. Operations in the same stream execute in order, while independent streams may overlap when dependencies and hardware resources allow it. Correct CUDA code must explicitly account for this asynchronous behavior whenever the host consumes GPU results or different streams exchange data.
