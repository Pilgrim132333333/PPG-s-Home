---
title: "ZMQ & Implement in LmCache"
date: 2026-10-30
description: "从 ZeroMQ 的 Context、Socket、Transport 与 Poller 出发，梳理 LMCache 中 Worker 和消息队列服务端的通信链路。"
summary: "为什么 LMCache 使用 DEALER/ROUTER？一次请求又如何找到正确的客户端与 Future？"
categories: ["技术"]
tags: ["LMCache", "ZeroMQ", "ZMQ", "LLM Serving", "消息队列"]
draft: false
toc:
  enable: true
---

读 LMCache 的消息队列实现时，我先被几个名字绕住了：`MessageQueueClient`、`ClientPollingLoop`、`MessageQueueServer`，再加上 ZMQ 的 `DEALER`、`ROUTER` 和 `Poller`。把它们放到一条请求链路上，关系就清楚了：**Worker 把操作发给 LMCache 服务端，服务端处理后把结果送回对应的客户端，再由请求 ID 找到等待中的 Future。**

## ZMQ 是什么

ZeroMQ（ZMQ）是一套轻量的消息通信库。它不强制要求独立的中心 broker；通信双方各自在进程内创建 ZMQ Context 和 Socket，就可以直接交换消息。

```text
Worker 进程                       LMCache Server 进程
  ZMQ Context                         ZMQ Context
    └─ DEALER Socket  ←── 消息 ──→      └─ ROUTER Socket
```

`Context` 管理后台 I/O 等运行资源，通常一个进程共用一个。`Socket` 是具体的通信端点，一个进程可以有多个。这里的 ZMQ Socket 还封装了收发和路由语义，比操作系统的 TCP socket 更高一层。

比如，下面的 `PUSH` Socket 就能连接到一个地址并发送消息：

```python
import zmq

context = zmq.Context()
socket = context.socket(zmq.PUSH)
socket.connect("tcp://127.0.0.1:5555")
socket.send_string("hello")
```

### Socket 模式与传输路径是两件事

Socket 类型决定**怎样收发**，Transport 决定**消息从哪里走**。

| Transport | 地址示例 | 范围 | TCP 端口 |
| --- | --- | --- | --- |
| TCP | `tcp://127.0.0.1:5555` | 同机或跨机器 | 需要 |
| IPC | `ipc:///tmp/my-zmq.sock` | 同机跨进程 | 不需要 |
| inproc | `inproc://my-channel` | 同进程、同 Context | 不需要 |

端口是 TCP 地址的一部分，并非 ZMQ 独有。同一个服务端地址可以接受多个客户端连接；服务端通常用一个 Socket `bind` 该地址，各客户端分别 `connect`。

```text
客户端 A：127.0.0.1:41001 ←→ 服务端：127.0.0.1:5555
客户端 B：127.0.0.1:41002 ←→ 服务端：127.0.0.1:5555
```

常见 Socket 模式包括严格交替收发的 `REQ/REP`、发布订阅的 `PUB/SUB`、单向任务分发的 `PUSH/PULL`。LMCache 这里更关键的是 **`DEALER/ROUTER`**：`DEALER` 可以异步收发，不必像 `REQ` 那样等一个回复才能发下一个请求；`ROUTER` 在接收时知道对端身份，发送时可以指定目标客户端。

## 一条消息是怎么到达的

以客户端 `DEALER` 通过 TCP 向服务端 `ROUTER` 发消息为例：

```text
应用调用 dealer.send(...)
  → 发送端 ZMQ / TCP
  → 接收端操作系统的 TCP 缓冲区
  → 接收端 ZMQ 后台 I/O 线程解析并入队
  → 应用调用 router.recv_multipart() 取出消息
```

网络 I/O 和业务处理因此可以分开。业务线程看到的是完整消息，而不需要自己处理 TCP 字节流的边界。

## 为什么需要 Poller

如果线程阻塞在 `socket_a.recv()`，即使 `socket_b` 已有消息，它仍会继续等待 A。`zmq.Poller` 让一个事件循环同时观察多个 Socket：

```python
poller = zmq.Poller()
poller.register(socket_a, zmq.POLLIN)
poller.register(socket_b, zmq.POLLIN)

while True:
    events = dict(poller.poll(timeout=1000))
    if events.get(socket_a, 0) & zmq.POLLIN:
        handle_a(socket_a.recv_multipart())
    if events.get(socket_b, 0) & zmq.POLLIN:
        handle_b(socket_b.recv_multipart())
```

LMCache 的轮询循环还要响应新操作通知、监视服务端连接状态，以及处理服务端回信。Poller 正好把这些事件源放进同一个等待点。

## LMCache 的三层分工

在我的笔记所分析的实现里，ZMQ 连起 vLLM/SGLang 一侧的 Worker 和 LMCache 的消息队列服务端。核心是三个角色：

| 角色 | 所在侧 | 做什么 |
| --- | --- | --- |
| `MessageQueueClient`（MQC） | Worker | 接收调用方的操作，用 `pending_futures[uid]` 等待对应结果 |
| `ClientPollingLoop` | Worker | 共享轮询线程，管理 `DEALER`、连接监视器和待发送操作 |
| `MessageQueueServer`（MQS） | Server | 用 `ROUTER` 收请求，分发给 Handler，再发送响应 |

```text
Worker                                      LMCache Server

MQC × N                                    MQS 主循环
├─ input_queue → 待发送操作                 ├─ Poller
└─ pending_futures[uid]                     │  ├─ ROUTER：收客户端请求
       │                                    │  └─ output fd：响应已就绪
       ↓                                    ├─ handlers[op]
ClientPollingLoop（共享线程）                 ├─ extra_pools：处理阻塞任务
├─ Poller                                   ├─ output_queue
│  ├─ notifier fd：有新操作                  └─ streams：流式订阅
│  ├─ monitor × N：连接状态                       ↑
│  └─ DEALER × N：服务端回信         请求 / 响应 ↔│
└─ _ops_queue → _process_ops
```

服务端在地址上绑定一个 `ROUTER`，多个客户端的 `DEALER` 都可以连接它。服务端通过连接身份把回复送回正确的客户端；至于具体由哪个 Handler 或线程池处理，是服务端内部的事。

## 一次请求的完整链路

1. 调用方通过 MQC 提交操作。MQC 为请求分配 `uid`，并在 `pending_futures` 中登记 Future。
2. 操作进入客户端队列，通知描述符唤醒 `ClientPollingLoop`。
3. 轮询线程取出操作，经对应的 `DEALER` 发往 MQS。
4. MQS 的 `ROUTER` 收到消息，识别客户端身份与操作类型，交给对应 Handler；阻塞任务可以进入额外线程池。
5. 结果放入服务端输出队列，输出通知唤醒 MQS 主循环。
6. `ROUTER` 按客户端身份发送响应；客户端轮询线程收到后转交 MQC。
7. MQC 用 `uid` 找到并完成相应 Future，调用方拿到结果。

这里有两层不同的“找回去”：**ROUTER identity 找到客户端连接，`uid` 找到这个客户端里等待的请求。** 把这两层分清，整个异步请求/响应流程就容易理解了。

## 总结

ZMQ 在这里提供进程间消息传输、异步收发和身份路由；LMCache 在它之上用 MQC、轮询线程、Handler 与 Future 组织请求生命周期。读代码时沿着 `input_queue → DEALER → ROUTER → Handler → ROUTER → DEALER → pending_futures[uid]` 追踪，往往比单独看每个类更直观。

本文根据我的 [LmCache Notion 笔记](https://app.notion.com/p/3e98c4633d288074a135e9278b7dfaef) 整理。具体类名和流程以所读版本的实现为准。
