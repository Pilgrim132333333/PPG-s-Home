---
title: "PyTorch Tensor 视图与自定义算子的内存布局陷阱"
date: 2026-10-26
description: "从 MiniServing 的 KV Cache 写入问题出发，理解 PyTorch Tensor 的 storage、shape、stride 与 storage_offset，以及自定义算子为什么不能默认输入连续。"
summary: "一次 KV Cache 写入错误背后的核心问题：合法的 Tensor 视图，不等于连续的底层内存。"
categories: ["技术"]
tags: ["PyTorch", "CUDA", "C++", "Tensor", "KV Cache", "LLM Serving"]
draft: false
toc:
  enable: true
---

在 MiniServing 中实现 QKV 投影和 KV Cache 写入时，我遇到了第一个真正由“框架语义”和“底层内存语义”不一致引起的问题：PyTorch 里的 Tensor 看起来形状完全正确，自定义算子也能正常运行，但写入 Cache 的 K、V 却是错的。

问题不在矩阵乘法，也不在 Cache 本身，而在一个被忽略的前提：**自定义算子把输入当成了连续内存，但传入的 Tensor 实际上只是一个非连续视图。**

## Tensor 不只是一个数据指针

理解这个问题，首先要放下“Tensor 就是一块数组”的直觉。对 PyTorch 来说，一个 Tensor 更接近下面这个描述：

```text
(storage, shape, stride, storage_offset)
```

- `storage`：真正保存数据的底层内存；
- `shape`：每个维度的长度；
- `stride`：沿每个维度移动一步，需要跨过多少个元素；
- `storage_offset`：当前视图从底层 storage 的哪个位置开始。

`view`、`reshape`、`split` 和 `permute` 等操作经常只修改这些元数据，而不会复制底层数据。这样做很高效，但也意味着两个形状相同的 Tensor，内存布局可能完全不同。

例如：

```python
x = torch.arange(12).view(3, 4)
y = x.permute(1, 0)

print(x.shape, x.stride())  # torch.Size([3, 4]) (4, 1)
print(y.shape, y.stride())  # torch.Size([4, 3]) (1, 4)
```

`y` 没有重新排列内存中的 12 个元素。它只是用新的 `shape` 和 `stride`，以另一种方式解释同一块 storage。

## 问题是如何出现的

MiniServing 的注意力实现先用一次 GEMM 同时计算 Q、K、V：

```python
qkv = layer.attn.c_attn(attn_input)             # [batch, seq, 2304]
q, k, v = qkv.split(self.dim, dim=-1)           # 各 [batch, seq, 768]

# 拆头：[batch, seq, 768] -> [batch, seq, H, D]
#      -> [batch, H, seq, D]
q = q.view(batch, seq_len, self.num_heads, self.head_dim).permute(0, 2, 1, 3)
k = k.view(batch, seq_len, self.num_heads, self.head_dim).permute(0, 2, 1, 3)
v = v.view(batch, seq_len, self.num_heads, self.head_dim).permute(0, 2, 1, 3)

self._write_to_cache(k, v, slot, layer_idx)
```

这段 PyTorch 代码本身没有问题。问题在于 `split` 返回的是视图：底层 `qkv` 的最后一维按每个 token 的 Q、K、V 排列，而不是三块彼此独立、全局连续的缓冲区。

可以把 storage 简化成：

```text
token 0: [Q0 ...][K0 ...][V0 ...]
token 1: [Q1 ...][K1 ...][V1 ...]
token 2: [Q2 ...][K2 ...][V2 ...]
```

因此，`k` 在一个 token 内部是连续的，但从一个 token 跳到下一个 token 时，需要跨过完整的 QKV 宽度。后面的 `permute` 又改变了各维度的访问顺序。此时 `k` 和 `v` 的形状虽然是 `[batch, heads, seq, head_dim]`，却不满足“把地址当作一维连续数组即可正确展开”的假设。

## 错误的连续内存假设

最初的 Cache 写入算子采用了类似下面的寻址方式：

```cpp
const int64_t vec_idx = threadIdx.x + blockIdx.y * blockDim.x;

if (vec_idx < vec_size) {
    const int64_t src_k = token_idx * vec_size + vec_idx;
    const int64_t src_v = token_idx * vec_size + vec_idx;
    const int64_t dst = slot * vec_size + vec_idx;

    key_cache[dst] = key[src_k];
    value_cache[dst] = value[src_v];
}
```

`token_idx * vec_size + vec_idx` 隐含了两个条件：

1. 一个 token 的向量占据连续的 `vec_size` 个元素；
2. 相邻 token 的向量在内存中紧挨着。

第一个条件在当前布局中可能成立，第二个条件却不成立。对 QKV 的切片视图而言，相邻 token 之间的真实跨度通常是 `3 * vec_size`；经过拆头和 `permute` 后，还必须同时考虑 head、sequence 和 batch 对应的 stride。

这就是最危险的地方：**代码不会因为索引公式错误而必然崩溃。** 地址仍可能落在已分配的 storage 内，算子会安静地读到“合法但属于别处”的值，然后把错误结果写入 KV Cache。

## 三种解决方案

### 方案一：先调用 `contiguous()`

```python
k = k.contiguous()
v = v.contiguous()
self._write_to_cache(k, v, slot, layer_idx)
```

这是最简单、也最适合先验证正确性的方案。它把当前视图复制成符合目标维度顺序的连续内存，自定义算子可以继续使用原来的扁平索引。

代价是额外的显存分配和数据复制。在推理热路径中，这份开销会在每一层、每一个 step 重复出现。

### 方案二：把 Q、K、V 分成三次 GEMM

这样可以直接生成三块独立的连续输出，但会把一次融合良好的大矩阵乘法拆成三次较小的矩阵乘法。它增加 kernel launch 和计算调度开销，也失去了 QKV 融合投影的优势，因此通常不是理想选择。

### 方案三：让算子理解 stride

更彻底的方案是把 Tensor 的布局信息传给自定义算子，并按逻辑坐标计算物理地址：

```cpp
const int64_t src_offset =
    batch_idx * stride_batch +
    head_idx  * stride_head +
    token_idx * stride_seq +
    dim_idx   * stride_dim;

const scalar_t value = input[src_offset];
```

这样，算子可以直接从 QKV 的共享 storage 中读取正确的 K、V，不需要先执行 `contiguous()`。它保留了一次 QKV GEMM，也避免了额外复制。

代价是接口和索引逻辑更复杂。除了 stride，还要正确处理 `storage_offset`、dtype、设备、维度数量和输出布局。对于只支持某一种固定布局的高性能算子，也可以只传必要的 stride，并在 C++ 入口处显式检查其他条件。

## 自定义算子的边界检查

这次问题让我意识到，自定义算子不能只检查 shape 和 dtype。一个可靠的入口至少应该明确处理以下内容：

```cpp
TORCH_CHECK(input.is_cuda(), "input must be a CUDA tensor");
TORCH_CHECK(input.scalar_type() == at::kHalf, "input must be fp16");
TORCH_CHECK(input.dim() == 4, "input must be [B, H, S, D]");
```

然后在“仅支持连续输入”和“支持任意 stride”之间做出明确选择：

```cpp
// 路线 A：算子只支持连续输入
TORCH_CHECK(input.is_contiguous(), "input must be contiguous");

// 路线 B：算子读取并使用真实 stride
const auto stride_batch = input.stride(0);
const auto stride_head = input.stride(1);
const auto stride_seq = input.stride(2);
const auto stride_dim = input.stride(3);
```

最糟糕的状态不是“只支持连续输入”，而是接口看起来接受任意 Tensor，内部却偷偷假设它连续。

## 如何验证修复是正确的

性能优化之前，先建立一个可信的参考实现。我的做法是保留 Python 循环版本，与自定义算子逐元素比较，并覆盖多种序列长度和非连续布局：

```python
torch.testing.assert_close(
    custom_cache,
    reference_cache,
    rtol=0,
    atol=0,
)
```

仅测试一个 shape 不够。至少还应该覆盖：

- `seq_len = 1`，避免错误被批量维度掩盖；
- 多个 sequence length；
- 多 batch、多 head；
- `permute`、`slice`、`split` 产生的非连续输入；
- 连续输入，确保兼容原有路径；
- 边界 slot 和最后一个 block。

在 GPT2-small、FP16、prefill batch 为 1、每个场景计时 20 次的测试中，修复后的自定义算子与参考输出逐位一致：

| `seq_len` | Python for 循环 | 自定义算子 | 加速比 | 正确性 |
| ---: | ---: | ---: | ---: | :--- |
| 64  | 25.03 ± 1.00 ms | 10.46 ± 0.12 ms | 2.39× | 输出逐位一致 |
| 128 | 40.73 ± 0.78 ms | 11.03 ± 0.10 ms | 3.69× | 输出逐位一致 |
| 256 | 71.06 ± 1.51 ms | 11.79 ± 0.10 ms | 6.03× | 输出逐位一致 |
| 512 | 130.76 ± 0.98 ms | 13.33 ± 0.20 ms | 9.81× | 输出逐位一致 |

这些数字只描述当时的实现和测试环境，不应被当作通用 benchmark。真正重要的是：正确性测试和性能测试使用了同一条修复后的路径。

## 总结

这次问题可以浓缩成一句话：

> Tensor 的逻辑布局合法，不代表它的物理内存连续；自定义算子必须尊重 Tensor 的 stride，或者明确要求连续输入。

PyTorch 帮我们隐藏了大量内存布局细节，而自定义 C++/CUDA 算子恰好跨过了这层抽象边界。一旦拿到 `data_ptr()`，shape 就不再足以描述数据。只有把 `stride` 和 `storage_offset` 一起纳入接口契约，算子看到的 Tensor 才是完整的 Tensor。

