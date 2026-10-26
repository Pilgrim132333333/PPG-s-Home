---
title: "The Memory-Layout Trap Between PyTorch Tensor Views and Custom Operators"
date: 2026-10-26
description: "A MiniServing KV-cache bug that shows why custom PyTorch operators must respect storage, shape, stride, and storage offset instead of assuming contiguous inputs."
summary: "A valid Tensor view is not necessarily contiguous memory—the assumption behind a subtle KV-cache write bug."
categories: ["Technology"]
tags: ["PyTorch", "CUDA", "C++", "Tensor", "KV Cache", "LLM Serving"]
draft: false
toc:
  enable: true
---

While implementing QKV projection and KV-cache writes in MiniServing, I encountered the first bug caused by a mismatch between framework semantics and physical memory semantics. The PyTorch tensors had the expected shapes, and the custom operator ran without an error, yet the K and V values written into the cache were wrong.

The matrix multiplication and cache allocation were both correct. The missing detail was that the custom operator treated its inputs as contiguous buffers, while PyTorch had passed non-contiguous tensor views.

## A Tensor Is More Than a Data Pointer

A PyTorch tensor is better described as:

```text
(storage, shape, stride, storage_offset)
```

- `storage` is the underlying memory;
- `shape` gives the length of each dimension;
- `stride` tells us how many elements to cross when advancing along a dimension;
- `storage_offset` tells us where the view starts inside the storage.

Operations such as `view`, `reshape`, `split`, and `permute` can change this metadata without copying the underlying data. That is efficient, but it also means two tensors with identical shapes may have completely different physical layouts.

```python
x = torch.arange(12).view(3, 4)
y = x.permute(1, 0)

print(x.shape, x.stride())  # torch.Size([3, 4]) (4, 1)
print(y.shape, y.stride())  # torch.Size([4, 3]) (1, 4)
```

The 12 elements are not rearranged when `y` is created. PyTorch simply interprets the same storage through a different shape and stride.

## How the Bug Appeared

MiniServing computes Q, K, and V together in one GEMM:

```python
qkv = layer.attn.c_attn(attn_input)             # [batch, seq, 2304]
q, k, v = qkv.split(self.dim, dim=-1)           # each [batch, seq, 768]

# Split heads: [batch, seq, 768] -> [batch, seq, H, D]
#              -> [batch, H, seq, D]
q = q.view(batch, seq_len, self.num_heads, self.head_dim).permute(0, 2, 1, 3)
k = k.view(batch, seq_len, self.num_heads, self.head_dim).permute(0, 2, 1, 3)
v = v.view(batch, seq_len, self.num_heads, self.head_dim).permute(0, 2, 1, 3)

self._write_to_cache(k, v, slot, layer_idx)
```

The PyTorch code is valid. The important detail is that `split` returns views. In the underlying `qkv` storage, values are arranged per token rather than as three globally independent buffers:

```text
token 0: [Q0 ...][K0 ...][V0 ...]
token 1: [Q1 ...][K1 ...][V1 ...]
token 2: [Q2 ...][K2 ...][V2 ...]
```

The K vector for one token is contiguous, but moving to the next token requires crossing the full QKV width. `permute` then changes the access order of the batch, head, sequence, and head-dimension axes. Although `k` and `v` have the logical shape `[batch, heads, seq, head_dim]`, flattening their pointers as contiguous arrays no longer preserves that logical order.

## The Incorrect Contiguous-Memory Assumption

The first cache-write kernel used addressing equivalent to this:

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

The expression `token_idx * vec_size + vec_idx` assumes both that each token vector is contiguous and that adjacent token vectors are next to each other in memory. The first condition may hold in this layout; the second does not. A QKV slice generally crosses `3 * vec_size` elements between tokens, and the later head split and permutation introduce additional stride requirements.

This class of bug is dangerous because the kernel does not have to crash. The wrong offset may still point into allocated storage, so the operator quietly reads valid values that belong to another logical position and writes them into the KV cache.

## Three Possible Fixes

### 1. Call `contiguous()` First

```python
k = k.contiguous()
v = v.contiguous()
self._write_to_cache(k, v, slot, layer_idx)
```

This is the simplest fix and an excellent way to establish correctness. It copies each view into memory that is contiguous in the desired logical order, allowing the original flat indexing scheme to remain unchanged.

The cost is an extra allocation and copy. In an inference hot path, that cost repeats at every layer and generation step.

### 2. Use Three Separate GEMMs

Separate projections can produce independent contiguous Q, K, and V buffers directly. However, splitting one fused projection into three smaller matrix multiplications introduces additional launches and scheduling overhead, and loses the benefit of a fused QKV projection.

### 3. Make the Operator Stride-Aware

The most direct solution is to pass the layout information into the custom operator and calculate physical addresses from logical coordinates:

```cpp
const int64_t src_offset =
    batch_idx * stride_batch +
    head_idx  * stride_head +
    token_idx * stride_seq +
    dim_idx   * stride_dim;

const scalar_t value = input[src_offset];
```

The operator can now read K and V directly from the shared QKV storage without first materializing contiguous copies. This preserves a single QKV GEMM and avoids extra memory traffic.

The trade-off is a more complex interface and indexing implementation. The operator must correctly handle stride, storage offset, dtype, device, dimensionality, and output layout. A specialized high-performance kernel can accept only the strides it needs, provided its C++ entry point explicitly checks every other assumption.

## Defining the Custom-Operator Contract

This bug showed that shape and dtype checks are not enough. A reliable operator entry point should establish at least the following constraints:

```cpp
TORCH_CHECK(input.is_cuda(), "input must be a CUDA tensor");
TORCH_CHECK(input.scalar_type() == at::kHalf, "input must be fp16");
TORCH_CHECK(input.dim() == 4, "input must be [B, H, S, D]");
```

It must then explicitly choose between contiguous-only inputs and general strided inputs:

```cpp
// Path A: support contiguous inputs only
TORCH_CHECK(input.is_contiguous(), "input must be contiguous");

// Path B: read and use the actual strides
const auto stride_batch = input.stride(0);
const auto stride_head = input.stride(1);
const auto stride_seq = input.stride(2);
const auto stride_dim = input.stride(3);
```

Supporting only contiguous inputs is a valid design. The real mistake is exposing an interface that appears to accept arbitrary tensors while silently relying on contiguous memory.

## Verifying the Fix

Before optimizing, I kept the Python loop as a trusted reference and compared every output element against the custom operator:

```python
torch.testing.assert_close(
    custom_cache,
    reference_cache,
    rtol=0,
    atol=0,
)
```

A single shape is not enough. The test set should include:

- `seq_len = 1`, so batch behavior cannot hide an indexing error;
- several sequence lengths;
- multiple batches and heads;
- non-contiguous inputs produced by `permute`, `slice`, and `split`;
- contiguous inputs for compatibility with the original path;
- boundary slots and the final cache block.

With GPT2-small in FP16, prefill batch size 1, and 20 timing runs per case, the corrected custom operator matched the reference output element for element:

| `seq_len` | Python loop | Custom operator | Speedup | Correctness |
| ---: | ---: | ---: | ---: | :--- |
| 64  | 25.03 ± 1.00 ms | 10.46 ± 0.12 ms | 2.39× | Exact match |
| 128 | 40.73 ± 0.78 ms | 11.03 ± 0.10 ms | 3.69× | Exact match |
| 256 | 71.06 ± 1.51 ms | 11.79 ± 0.10 ms | 6.03× | Exact match |
| 512 | 130.76 ± 0.98 ms | 13.33 ± 0.20 ms | 9.81× | Exact match |

These measurements describe one implementation and environment rather than a general benchmark. The important result is that correctness and performance were measured on the same fixed path.

## Takeaway

The lesson is simple:

> A tensor can have a valid logical layout without contiguous physical memory. A custom operator must respect its strides or explicitly require a contiguous input.

PyTorch normally hides these layout details. A C++ or CUDA extension crosses that abstraction boundary. Once an operator takes a raw `data_ptr()`, shape alone no longer describes the data. Stride and storage offset are part of the tensor's contract too.

