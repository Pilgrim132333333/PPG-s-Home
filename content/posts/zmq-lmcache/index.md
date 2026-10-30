---
title: "ZMQ & Implement in LmCache"
date: 2026-10-30
description: "How ZeroMQ connects workers to LMCache's message queue server, from sockets and polling to request routing and futures."
summary: "A walkthrough of DEALER/ROUTER, Poller, and the lifecycle of an LMCache request."
categories: ["Technology"]
tags: ["LMCache", "ZeroMQ", "ZMQ", "LLM Serving", "Message Queue"]
draft: false
toc:
  enable: true
---

While reading LMCache's message queue implementation, I kept encountering `MessageQueueClient`, `ClientPollingLoop`, and `MessageQueueServer` alongside ZMQ's `DEALER`, `ROUTER`, and `Poller`. The easiest way to understand them is to follow one request: **a worker sends an operation to the LMCache server, the server routes its reply to the right client, and a request ID completes the right Future.**

## The ZMQ basics

ZeroMQ is a lightweight messaging library. It does not require a separate central broker. Each process can create a ZMQ Context and Socket and communicate directly.

```text
Worker process                      LMCache server process
  ZMQ Context                         ZMQ Context
    └─ DEALER Socket  ← messages →       └─ ROUTER Socket
```

The `Context` manages runtime resources such as background I/O threads; a process typically shares one. A `Socket` is an endpoint with a particular messaging pattern. A process may create several sockets.

```python
import zmq

context = zmq.Context()
socket = context.socket(zmq.PUSH)
socket.connect("tcp://127.0.0.1:5555")
socket.send_string("hello")
```

### Pattern and transport

The socket type determines **how messages are exchanged**; the transport determines **where they travel**.

| Transport | Example | Scope | TCP port? |
| --- | --- | --- | --- |
| TCP | `tcp://127.0.0.1:5555` | Local or remote processes | Yes |
| IPC | `ipc:///tmp/my-zmq.sock` | Processes on one machine | No |
| inproc | `inproc://my-channel` | One process and Context | No |

A port belongs to TCP, not to ZMQ itself. A server typically binds one socket to an address while many clients connect to it from their own ephemeral ports.

```text
Client A: 127.0.0.1:41001 ←→ Server: 127.0.0.1:5555
Client B: 127.0.0.1:41002 ←→ Server: 127.0.0.1:5555
```

Other familiar patterns include alternating request/reply with `REQ/REP`, publish/subscribe with `PUB/SUB`, and one-way task distribution with `PUSH/PULL`. LMCache's important pair here is **client `DEALER` and server `ROUTER`**. A DEALER can send and receive asynchronously without waiting for one reply before sending the next request. A ROUTER sees the peer identity on incoming messages and can address a specific client when replying.

## From send to receive

For a DEALER sending over TCP to a ROUTER, the path is roughly:

```text
Application calls dealer.send(...)
  → Sender's ZMQ stack and TCP
  → Receiver's OS TCP buffer
  → Receiver's ZMQ background I/O thread parses and queues the message
  → Application calls router.recv_multipart()
```

The application consumes complete messages while ZMQ handles network I/O and internal queues.

## Why Poller matters

A thread blocked in `socket_a.recv()` cannot react to a ready `socket_b`. `zmq.Poller` waits on several sockets at once:

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

In LMCache, the polling loop also reacts to new-operation notifications, monitors server connections, and processes replies. These event sources can share one wait point.

## The three roles in LMCache

In the implementation covered by my notes, ZMQ connects a vLLM/SGLang worker to the LMCache message queue server.

| Role | Side | Responsibility |
| --- | --- | --- |
| `MessageQueueClient` (MQC) | Worker | Submits operations and maps `uid` to a pending Future |
| `ClientPollingLoop` | Worker | Shared polling thread for DEALER sockets, connection monitors, and queued operations |
| `MessageQueueServer` (MQS) | Server | Receives through ROUTER, dispatches handlers, and returns replies |

```text
Worker                                      LMCache server

MQC × N                                    MQS main loop
├─ input_queue                              ├─ Poller
└─ pending_futures[uid]                     │  ├─ ROUTER: client requests
       │                                    │  └─ output fd: replies ready
       ↓                                    ├─ handlers[op]
ClientPollingLoop (shared thread)            ├─ extra pools for blocking work
├─ Poller                                   ├─ output_queue
│  ├─ notifier fd: new operations           └─ streams
│  ├─ monitors × N: connection state             ↑
│  └─ DEALER × N: server replies       request/reply
└─ _ops_queue → _process_ops
```

The server binds one ROUTER socket at its address, and multiple client DEALER sockets can connect. The ROUTER identity determines which client receives a reply. Handler and thread-pool selection stay inside the server.

## One request, end to end

1. The caller submits an operation through MQC. MQC assigns a `uid` and registers a Future in `pending_futures`.
2. The operation enters the client queue, and a notification wakes `ClientPollingLoop`.
3. The polling thread sends the operation through the corresponding DEALER.
4. MQS receives it through ROUTER, identifies the client and operation, and dispatches the appropriate handler. Blocking work may run in an extra pool.
5. The result enters the server output queue; its notification wakes the MQS loop.
6. ROUTER sends the response to the client identity. The client polling thread receives it and passes it to MQC.
7. MQC finds the Future by `uid` and completes it.

There are two distinct return addresses: **ROUTER identity selects the client connection; `uid` selects the waiting request within that client.**

## Takeaway

ZMQ supplies inter-process messaging, asynchronous sockets, and identity-based routing. LMCache adds queues, handlers, polling loops, and Futures to manage the request lifecycle. A useful path to trace in the code is `input_queue → DEALER → ROUTER → Handler → ROUTER → DEALER → pending_futures[uid]`.

Adapted from my [LmCache Notion notes](https://app.notion.com/p/3e98c4633d288074a135e9278b7dfaef). Class names and flow describe the implementation version I studied.
