---
title: "System Design from First Principles: Networks, Concurrency, Performance, and Data"
date: 2026-11-03
description: "A map of HTTP, TCP, DNS, proxies, load balancing, concurrency, latency, transactions, and caching."
summary: "Four questions for approaching a large system: how requests arrive, execute, are measured, and access data."
categories: ["Technology"]
tags: ["System Design"]
draft: false
toc:
  enable: true
---

A large system can be hard to approach. I want to start from its design motivations and build a foundation before studying the more advanced parts. My map has four questions: how does a request reach a service, how is it executed concurrently, how do we measure it, and how does it access durable data?

## 1. How a request reaches the service

### HTTP

HTTP is an application-level protocol for expressing requests and responses. An inference request might look like this:

```http
POST /v1/completions HTTP/1.1
Host: api.example.com
Content-Type: application/json
Authorization: Bearer xxx

{"prompt":"Hello","max_tokens":8}
```

The method (`GET`, `POST`, `PUT`, `DELETE`, and so on), URL, headers, and body tell the server what the client wants. The response includes a status code and possibly a body.

| Code | Meaning | Examples |
| --- | --- | --- |
| `2xx` | Success | `200 OK`, `201 Created` |
| `3xx` | Redirect | `301`, `302` |
| `4xx` | Client-side request problem | `400`, `401`, `403`, `404`, `429` |
| `5xx` | Server or upstream problem | `500`, `502`, `503`, `504` |

`400` means a malformed request, `401` missing valid authentication, `403` insufficient permission, and `429` rate limiting. `502` is an invalid upstream response, `503` temporary unavailability, and `504` an upstream timeout. These codes help locate the failing layer.

### TCP

HTTP describes messages; TCP provides a reliable, ordered byte stream. It uses retransmission, flow control, and congestion control. Opening a connection normally requires a three-way handshake: `SYN`, `SYN+ACK`, then `ACK`. New connections cost network round trips, so persistent connections reuse an existing connection where possible.

TCP numbers bytes and confirms receipt with ACKs. Lost data is retransmitted. But TCP does not recognize HTTP message boundaries: the application protocol must delimit its own messages.

```text
HTTP message → bytes → TCP segments → IP packets
```

Flow control prevents overwhelming the receiver; congestion control responds to an overloaded network path. A TCP connection is identified by source IP and port plus destination IP and port, for example `192.168.1.5:53124 → 10.0.0.8:8000`.

### DNS

The network ultimately needs an IP address rather than a domain name. DNS uses caches and a hierarchy of servers to resolve the name:

```text
Application → browser/OS cache → recursive resolver
            → root DNS → top-level-domain DNS → authoritative DNS → IP
```

The record's TTL controls how long it can remain cached. A longer TTL reduces queries but slows address changes; a shorter TTL propagates changes faster at the cost of more DNS lookups.

### Proxies and load balancing

A forward proxy acts on behalf of clients. A reverse proxy is the entry point in front of servers:

```text
Client → forward proxy → external server
Client → reverse proxy → backend server
```

A reverse proxy such as Nginx can route requests, terminate TLS, rate-limit, authenticate, compress, cache, set timeouts, retry, and log traffic. TLS protects confidentiality, authenticates the server, and checks message integrity. One deployment pattern terminates HTTPS at the proxy and uses HTTP on the internal hop:

```text
Client --HTTPS--> Nginx --HTTP--> Backend
```

Load balancing spreads requests across backends. L4 routing primarily uses transport-level information such as the connection's four-tuple. L7 routing can inspect HTTP paths and make application-specific choices:

```text
/v1/chat/completions → GPU inference pool
/health              → control service
/admin               → internal service
```

Common policies include round robin, weighted round robin, least connections, least requests, and consistent hashing. A sticky session keeps one user on a particular backend, but can make the service depend on that instance's local state. Moving shared state to Redis or a database generally makes failover easier.

## 2. How a request is executed concurrently

### Processes, threads, and coroutines

These are different layers. A process isolates resources, a thread is a unit scheduled by the operating system, and a coroutine is a concurrent task scheduled by user-space code.

```text
Operating system
└── Process
    ├── Thread 1
    ├── Thread 2
    └── Thread 3
         ├── Coroutine A
         └── Coroutine B
```

A process owns a virtual address space and resources such as file descriptors. Multiple worker processes provide fault isolation: one can crash while others keep serving. Sharing data between them, however, requires inter-process communication.

Threads in one process share memory. That makes sharing easier but creates race conditions when concurrent threads modify the same state. Locks guard critical sections.

In Python `asyncio`, calling an `async` function creates a coroutine object that holds its execution position, locals, and waiting state. `asyncio.create_task()` schedules it as a Task; `asyncio.run()` runs an event loop until the top-level coroutine finishes. At an `await`, a coroutine can yield control so another ready task runs.

```python
task = asyncio.create_task(fetch_data())

while True:
    ready_io = wait_for_io()
    ready_tasks = get_ready_tasks(ready_io)
    for task in ready_tasks:
        task.run_until_next_await()
```

This loop is conceptual. Coroutines are useful while waiting for I/O; they do not themselves imply execution across multiple CPU cores.

## 3. How performance is measured

Latency is the time from the start to the completion of a request. Throughput is the amount of work completed per unit time. Concurrency is the number of requests still in progress.

An average can hide slow requests. Percentiles are more informative: p50 is the latency that 50% of requests do not exceed; p90 is the corresponding value for 90%. A request that depends on several downstream services can be held up by the slowest branch, which makes tail latency important.

Inference systems also track TTFT (time to first token), TPOT (average time per output token after the first), and ITL (the gap between consecutive output tokens).

Little's Law relates the three main quantities:

```text
Average concurrency = throughput × average response time
```

At a steady 100 completed requests per second and 0.2 seconds average response time, about 20 requests are in progress on average. Use consistent measurement boundaries and a stable operating period.

## 4. How data is saved and accessed quickly

### Indexes and transactions

An index helps find database records quickly, at a maintenance and write cost. A transaction treats several operations as one unit. A money transfer, for example, should debit and credit together:

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE name = 'A';
UPDATE accounts SET balance = balance + 100 WHERE name = 'B';
COMMIT;
```

On failure, `ROLLBACK` can undo the transaction. ACID stands for atomicity, consistency, isolation, and durability.

### Isolation levels

Concurrent transactions can cause dirty reads (uncommitted data), non-repeatable reads (a row changes between reads within a transaction), and phantom reads (a repeated predicate query returns a different set of rows). The standard SQL isolation-level summary is:

| Isolation level | Dirty read | Non-repeatable read | Phantom read |
| --- | --- | --- | --- |
| Read Uncommitted | Possible | Possible | Possible |
| Read Committed | Prevented | Possible | Possible |
| Repeatable Read | Prevented | Prevented | Possible by the standard |
| Serializable | Prevented | Prevented | Prevented |

Real database engines may differ in implementation, so their concurrency-control rules matter as well.

### Logging and caching

With write-ahead logging (WAL), relevant log records are persisted before the corresponding data pages are written to durable storage. Redo and undo information support recovery and rollback, though details vary by database.

A Buffer Pool keeps database pages in memory. External systems such as Redis can cache hot application data. The tradeoff is consistency: after a database update, a cache may still hold the old value. A common Cache-Aside pattern is:

```text
Read: check cache → on miss, read database → populate cache
Update: update database → delete the cache entry
```

Concurrent operations can still create a stale-data window, so the right policy depends on the application's consistency requirements.

## Closing thought

This gives me a path through a large system: follow a request through DNS, proxies, and network protocols; see which processes, threads, and coroutines execute it; measure latency and throughput; and trace its data through the database and cache. The next step is to ask why each system made its particular tradeoffs.

Adapted from my [System Design Notion notes](https://app.notion.com/p/3ef8c4633d28806f816ce8ea691266c2).
