---
title: "ZMQ & Implement in LmCache"
date: 2026-10-30
description: "ZMQ 的概念、消息交流流程，以及在 LMCache 中的应用。"
summary: "从 Context、Socket、Poller 到 LMCache 的 MQC、ClientPollingLoop 与 MQS。"
categories: ["技术"]
tags: ["LMCache", "ZeroMQ", "ZMQ", "LLM Serving", "消息队列"]
draft: false
toc:
  enable: true
---

# ZMQ

ZeroMQ的简称

追求轻量，低开销，少运维负担的设计理念。关键特点是：不强制要求一个中心消息代理（broker），两个进程直接通过ZeroMQ通信，不必先启动一套消息队列服务器

```python
import zmq

context = zmq.Context()
socket = context.socket(zmq.PUSH)
socket.connect("tcp://127.0.0.1:5555")
socket.send_string("hello")
```

每个进程都需要内部嵌入一个ZMQ，通过每个进程的ZMQ对象，我们可以实现快速通信：

```text
进程 A                            进程 B
  ZMQ Context                      ZMQ Context
    └─ ZMQ Socket  ←── 通信 ──→      └─ ZMQ Socket
```

“”Context”” : 管理ZMQ运行资源，例如后台I/O thread，通常一个process共用一个

“”Socket””: 具体的通信端点，一个process可以创建多个

我们需要注意这里的端口：端口只是TCP的一部分，不是专属于ZMQ。我们还可以使用IPC：

| **ZMQ 传输方式** | **地址示例** | **是否需要 TCP 端口** |
| --- | --- | --- |
| TCP：同机或跨机器通信 | `tcp://127.0.0.1:5555` | 是 |
| IPC：同机跨进程通信 | `ipc:///tmp/my-zmq.sock` | 否 |
| inproc：同一进程、同一 Context 内通信 | `inproc://my-channel` | 否 |

不同的传输方式将会决定数据怎么运过去，底层会添加相应的传输包装

## Port

端口在这里的意义提供一个交流的窗口，其可以connect多个socket，但是仅仅可以bind一个socket

```py
客户端 A：127.0.0.1:41001 ←→ 服务端：127.0.0.1:5555
客户端 B：127.0.0.1:41002 ←→ 服务端：127.0.0.1:5555
```

也就是说可以有很多socket给一个端口发送消息，但是只有一个socket可以监听这个端口，收到消息

## 消息交流流程

以DEALER通过TCP向Router发消息为例子

```py
发送端应用
    │ dealer.send(b"hello")
    ↓
发送端 ZMQ
    │ 通过 TCP 发送
    ↓
接收端操作系统的 TCP 接收缓冲区
    │
    ↓
接收端 ZMQ 后台 I/O 线程
    │ 解析消息，放入内部接收队列
    ↓
接收端应用
      router.recv_multipart() → 取出消息
```

## Socket

socket最基本的意思是传输的数据单位，比如在操作系统socket中：

```text
进程 A 的 socket ←── 操作系统 / 网络 ──→ 进程 B 的 socket
```

但是在ZMQ socket中，其语义是一种传输方式，更像数据单位的上层包装抽象

在ZMQ中有很多种socket， 我们可以理解它们为不同的收发方式：

| **通信模式** | **Socket 类型** | **主要行为** |
| --- | --- | --- |
| 请求 / 回复 | `REQ` | 默认“发一个请求，收一个回复”，严格交替 |
| 请求 / 回复 | `REP` | 默认“收一个请求，发一个回复”，严格交替 |
| 异步双向通信 | `DEALER` | 收发不必交替；向多个对端轮询分发消息 |
| 按对端路由 | `ROUTER` | 接收时携带对端身份；发送时指定目标对端 |
| 发布 / 订阅 | `PUB` | 向匹配订阅的订阅者发布消息 |
| 发布 / 订阅 | `SUB` | 按设置的主题前缀过滤并接收消息 |
| 扩展发布 / 订阅 | `XPUB` | 类似 PUB，还能接收订阅 / 退订通知 |
| 扩展发布 / 订阅 | `XSUB` | 类似 SUB，可通过消息发送订阅 / 退订指令 |
| 任务流水线 | `PUSH` | 只发送，将消息分配给下游 |
| 任务流水线 | `PULL` | 只接收，从上游接收消息 |
| 一对一通信 | `PAIR` | 与单个对端双向通信，常用于简单线程间通信 |
| 原始字节流 | `STREAM` | 与普通 TCP 对端交换字节流，不要求对端使用 ZMQ |

## Poller

其可以同时监视多个socket是否有消息可读，是否可以发送的工具

如果我们使用：

```py
message = socket_a.recv()
```

那么，程序会一直等待socket\_a收到消息，即使socket\_b已经有消息，程序也会卡住

Poller可以等待多个socket：

```py
socket A ──┐
socket B ──┼── Poller ──→ 告诉程序哪些 socket 已就绪
socket C ──┘

poller = zmq.Poller()

# 注册：关注这两个 socket 是否有消息可读
#socket_a 和 socket_b 监听两个不同的地址
poller.register(socket_a, zmq.POLLIN)
poller.register(socket_b, zmq.POLLIN)

while True:
    # 最多等待 1000 毫秒；有事件时可以提前返回
    events = dict(poller.poll(timeout=1000)) #检查是否有事件（socket,事件位mask）

    if events.get(socket_a, 0) & zmq.POLLIN:
        message = socket_a.recv_multipart()
        print("A 收到：", message)

    if events.get(socket_b, 0) & zmq.POLLIN:
        message = socket_b.recv_multipart()
        print("B 收到：", message)
```

## In LmCache

在LmCache中，ZMQ的作用是链接vllm/sglang侧和lmcahe侧：

```py
【Worker 进程】                              【Server 进程】

ClientPollingLoop（1 个线程）                 MQS 主循环线程 "mq-server-thread"
├─ poller                                    ├─ poller
│   ├─ notifier fd   ← 敲铃传 ops            │   ├─ ROUTER socket   ← 就是客户端 DEALER
│   ├─ monitor ×N    ← 监听"MQS 是否掉线"     │   └─ output fd      ← 敲铃传响应帧
│   └─ DEALER ×N     ← 收 MQS 的回信          │       （eventfd/self-pipe）
├─ _ops_queue    ←→  _process_ops            ├─ output_queue  ←→  _send_responses
└─ _socket_to_client / _monitor_to_client    └─ handlers: dict[op → Sync/BlockingHandler]
                                             ├─ extra_pools（affinity/normal 线程池）
MQC（N 个实例）                               └─ streams 表（流式订阅）
├─ pending_futures[uid] → future
└─ input_queue → 发送
```

其主要有三个class构成信息交流过程：

- Message Queue Client
- ClientPollingLoop
- Message Queue Server

其中MQC和ClientPollingLoop构成Client侧，而MQS独自构成Server侧。其原因是client侧可以connect多个端口，而server侧一个端口只能被一个socket监听。因此我们无需知道server侧的路由

![Worker 与 LMCache Server 的 ZMQ 通信流程](../../images/zmq-lmcache-flow.png)

这里展示的是一个简化版本的流程图，但是已经包含必要流程。实现了worker和lmcache的交流
