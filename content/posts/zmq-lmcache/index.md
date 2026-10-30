---
title: "ZMQ & Implement in LmCache"
date: 2026-10-30
description: "Notes on ZeroMQ concepts, message flow, and its use in LMCache."
summary: "Context, Socket, Poller, and the MQC–ClientPollingLoop–MQS communication path."
categories: ["Technology"]
tags: ["LMCache", "ZeroMQ", "ZMQ", "LLM Serving", "Message Queue"]
draft: false
toc:
  enable: true
---

# ZMQ

Short for ZeroMQ.

Its design aims to be lightweight, low overhead, and easy to operate. A key feature is that it does not require a central message broker: two processes can communicate directly through ZeroMQ without starting a separate message queue server.

```python
import zmq

context = zmq.Context()
socket = context.socket(zmq.PUSH)
socket.connect("tcp://127.0.0.1:5555")
socket.send_string("hello")
```

Each process embeds ZMQ. The ZMQ objects in the processes enable fast communication:

```text
Process A                          Process B
  ZMQ Context                       ZMQ Context
    └─ ZMQ Socket  ← communication →   └─ ZMQ Socket
```

“Context”: manages ZMQ runtime resources, such as background I/O threads. Usually one process shares one Context.

“Socket”: a communication endpoint. A process can create multiple Sockets.

The port here belongs to TCP, not specifically to ZMQ. IPC is another option:

| **ZMQ transport** | **Example address** | **Needs a TCP port?** |
| --- | --- | --- |
| TCP: same machine or across machines | `tcp://127.0.0.1:5555` | Yes |
| IPC: processes on the same machine | `ipc:///tmp/my-zmq.sock` | No |
| inproc: within one process and Context | `inproc://my-channel` | No |

The transport determines how data is carried and which transport framing is used underneath.

## Port

A port provides a point of communication. Multiple Sockets can connect to it, while one Socket binds to the listening address.

```text
Client A: 127.0.0.1:41001 ←→ Server: 127.0.0.1:5555
Client B: 127.0.0.1:41002 ←→ Server: 127.0.0.1:5555
```

In other words, many client Sockets can send messages to the same server port, while the server Socket listens at that address.

## Message flow

For example, a DEALER sends a message to a ROUTER over TCP:

```text
Sending application
    │ dealer.send(b"hello")
    ↓
Sender's ZMQ
    │ sends via TCP
    ↓
Receiver OS's TCP receive buffer
    ↓
Receiver ZMQ background I/O thread
    │ parses the message and queues it internally
    ↓
Receiving application
      router.recv_multipart() → takes the message
```

## Socket

An operating-system Socket is an endpoint for data transfer:

```text
Process A's socket ←── OS / network ──→ Process B's socket
```

A ZMQ Socket adds a higher-level communication pattern on top of that endpoint. The Socket types express different ways to send and receive:

| **Communication pattern** | **Socket type** | **Main behavior** |
| --- | --- | --- |
| Request / reply | `REQ` | Send one request, receive one reply, in strict alternation |
| Request / reply | `REP` | Receive one request, send one reply, in strict alternation |
| Asynchronous bidirectional | `DEALER` | Send and receive without alternation; distribute to multiple peers in round-robin fashion |
| Peer routing | `ROUTER` | Receive with peer identity; select a target peer when sending |
| Publish / subscribe | `PUB` | Publish to matching subscribers |
| Publish / subscribe | `SUB` | Receive messages filtered by a topic prefix |
| Extended publish / subscribe | `XPUB` | Like PUB, but also receives subscription and unsubscription notifications |
| Extended publish / subscribe | `XSUB` | Like SUB, but sends subscription and unsubscription commands as messages |
| Task pipeline | `PUSH` | Send only, distributing messages downstream |
| Task pipeline | `PULL` | Receive only, taking messages from upstream |
| One-to-one | `PAIR` | Bidirectional communication with one peer, often between threads |
| Raw byte stream | `STREAM` | Exchange bytes with an ordinary TCP peer that need not use ZMQ |

## Poller

A Poller monitors several Sockets at once for readable or writable events.

With a blocking receive:

```python
message = socket_a.recv()
```

The program waits for `socket_a` even when `socket_b` already has a message. A Poller can wait on both:

```python
socket A ──┐
socket B ──┼── Poller ──→ tells the program which Sockets are ready
socket C ──┘

poller = zmq.Poller()

# Watch these two Sockets for incoming messages.
# socket_a and socket_b listen at different addresses.
poller.register(socket_a, zmq.POLLIN)
poller.register(socket_b, zmq.POLLIN)

while True:
    # Wait up to 1000 ms; return sooner when an event occurs.
    events = dict(poller.poll(timeout=1000))

    if events.get(socket_a, 0) & zmq.POLLIN:
        message = socket_a.recv_multipart()
        print("A received:", message)

    if events.get(socket_b, 0) & zmq.POLLIN:
        message = socket_b.recv_multipart()
        print("B received:", message)
```

## In LmCache

In LMCache, ZMQ connects the vLLM/SGLang side with the LMCache side:

```text
【Worker process】                            【Server process】

ClientPollingLoop (one thread)                MQS main loop "mq-server-thread"
├─ poller                                    ├─ poller
│  ├─ notifier fd  ← wakes for operations    │  ├─ ROUTER socket ← client DEALER
│  ├─ monitor ×N   ← checks if MQS is down    │  └─ output fd     ← wakes for response frames
│  └─ DEALER ×N    ← receives MQS replies     │     (eventfd/self-pipe)
├─ _ops_queue    ↔ _process_ops              ├─ output_queue ↔ _send_responses
└─ _socket_to_client / _monitor_to_client    └─ handlers: dict[op → Sync/BlockingHandler]
                                             ├─ extra_pools (affinity/normal pools)
MQC (N instances)                            └─ streams table (streaming subscriptions)
├─ pending_futures[uid] → future
└─ input_queue → send
```

Three main classes make up the communication flow:

- Message Queue Client
- ClientPollingLoop
- Message Queue Server

MQC and ClientPollingLoop form the client side, while MQS forms the server side. Multiple clients can connect to the server's port, and a server Socket binds and listens there. The client does not need to know the server's internal routing.

![The original Worker to LMCache Server ZMQ flow diagram](../images/zmq-lmcache-flow.png)

This is a simplified flow diagram, but it contains the necessary steps for communication between the Worker and LMCache.
