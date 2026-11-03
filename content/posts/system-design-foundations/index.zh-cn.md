---
title: "System Design"
date: 2026-11-03
categories: ["技术"]
tags: ["System Design"]
draft: false
toc:
  enable: true
---

在面对一个庞大的系统的时候，我们往往无从下手。这次我的想法是从零开始，试图剖析一个巨大系统里的各种设计动机。这是一个漫长的工程，本身也需要设计

# Fondamental

这一部分我们要总体建立起分布式系统的基础，从多方面出发：计算机网络，数据库。。。等等方面。保证可以快速进行到后期进阶的部分

## HTTP,TCP, DNS,反向代理,负载均衡

首先我们来分析这五个基础的概念：

### HTTP

HTTP是一个应用级协议，规定客户端和服务器如何描述请求与享用

```json
Request
POST /v1/completions HTTP/1.1
Host: api.example.com
Content-Type: application/json
Authorization: Bearer xxx
Content-Length: 32

{"prompt":"Hello","max_tokens":8}

Response
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 42

{"text":"Hello, how can I help you?"}
```


HTTP 作为一个协议，其主要作用是描述传输的信息是什么。因此它包含这几个重要的指导信息：

- 请求方法： GET,POST,PUT,DELETE
- URL: 请求哪个资源
- Headers： meta data
- Body： 实际发送的数据


而Response里最重要的是状态码：

| **范围** | **含义** | **例子** |  |
| --- | --- | --- | --- |
| `2xx` | 成功 | `200 OK`、`201 Created` |  |
| `3xx` | 重定向 | `301`、`302` |  |
| `4xx` | 客户端问题 | `400`、`401`、`404`、`429` |  |
| `5xx` | 服务端问题 | `500`、`502`、`503`、`504` |  |

- `400 Bad Request`：请求格式错误。
- `401 Unauthorized`：没有有效身份认证。
- `403 Forbidden`：已认证，但没有权限。
- `429 Too Many Requests`：触发限流。
- `502 Bad Gateway`：代理收到后端无效响应。
- `503 Service Unavailable`：服务暂时不可用。
- `504 Gateway Timeout`：代理等待后端超时。

### TCP


TCP的职责不再是传输真实json或数据，而是提供传输这些数据的管道：

面向连接，可靠传输，按序到达，重传，流量控制，拥塞控制


TCP是面向两个端点的，一个发送方，一个接受方。为了可靠传输，引入三次握手机制：

- client发送链接请求SYN
- Server 返回SYN+ACK
- Client 最后再返回ACK


而这三次握手会造成延迟，我们称这个延迟为RTT，因此频繁创建链接很昂贵，TCP链接需要支持复用：

Connection: keep - alive


TCP的可靠性还可以体现在传输过程中，TCP为每个字节编号，server方通过ACK确认接受的数据。如果其中有数据丢失，TCP会重传丢失的数据，即使丢失数据后面的数据已经到达。但也因为这个机制，可能会导致队头堵塞


TCP不在意数据的样子，它只看得到连续字节stream：

HTTP message → bytes → TCP segments → IP packet

因此，当client连续发送两条信息的时候，TCP不会主动区分这两条数据，其本质是一个连续的字节stream。

As a result，应用层（HTTP)需要为每条message划定界限


TCP需要进行流量控制和拥塞控制：

- 流量控制：接收方处理不过来，发送方不要继续告诉发送
- 拥塞控制： 中间网络已经发生堵塞，发送方应该降低发送速度


TCP的经典四元组合：

```json
源 IP、源端口、目标 IP、目标端口
192.168.1.5:53124 → 10.0.0.8:8000
```


### DNS


DNS负责把域名映射到相关记录：

当我们访问api.com的时候，实际上网络需要的是IP

解析过程：

应用
↓
浏览器/操作系统 DNS 缓存
↓
本地 DNS Resolver
↓
根 DNS
↓
.com 顶级域 DNS
↓
[example.com](http://example.com/) 权威 DNS
↓
返回 IP


TTL： DNS记录会设置DDL，其表示之前多久的DNS记录作为缓存可以存下来：

TTL = 300s

if TTL 变长： 减少DNS查询，但是更新生效慢

else TTL 变短： 切换更快，但是DNS查询更多


### 反向代理

我们需要分清楚正向代理和反向代理：

- 正向代理：

  代理client：


  ```json
  客户端 → 正向代理 → 外部服务器
  ```

  常见的VPN都属于正向代理

- 反向代理：

  代理服务器：


  ```json
  客户端 → 反向代理 → 后端服务器
  ```


  常见的有Nginx等。客户端只知道统一入口，不知道后面有多少个服务器


  其作用有很多：

  - 路由请求
  - TLS终止

    需要解释的是TLS，这是一种传输层和应用层中间的协议，负责安全，保护client和server之间的网络通信。具体来说，需要确认这三个问题：

    - 机密性，加密： TLS负责将明文的HTTP数据进行加密，保证只有持有session 密钥的双方能够解密
    - 身份认证：

      client需要确认我链接的真的是api.com，而不是伪造的服务器吗？


      server会在TLS握手期间发送数字证书：证书颁发机构CA，服务器公钥等。。。

    - 完整性： 防止数据被修改

      攻击者即使看不懂密文，也可以修改。TLS进行完整性校验


    一种常见的架构：


    ```json
    Client --HTTPS--> Nginx --HTTP--> Backend
    ```


    Nginx负责证书和解密，Backend只需要处理HTTP

  - load Balance
  - 限流
  - 身份认证
  - 压缩
  - 缓存
  - 超时和重试
  - 隐藏内部服务器拓扑
  - 记录访问日志


  ### 负载均衡 load Balance

负载均衡的主要作用可以总结为： 将多个请求分布在最优的backend上，保证性能


有两种负载均衡的方式：

- L4传输层（TCP）负载均衡

  通常与协议无关，只根据四元组进行分发。性能高，转发开销低

- L7应用层（HTTP）

  更多和写的backend代码有关：


  ```json
  /v1/chat/completions → GPU inference pool
  /health              → control service
  /admin               → internal service
  ```


常见的一些load balance算法：

- Round Robin: slice到了就切换，顺序切换直到全部完成
- Weighted Round Robin： 不同instance分配不同的权重
- Least Connections: 选择链接最少的instance
- Least Request： 选择当前正在处理Request数量最少的instance
- Consistent Hashing：根据某个key稳定选择backend


Sticky Session

有时候，可能会存在一个user需要一直访问同一个后端。这表明User可能需要访问此时backend的状态，需要注意的是，这并不算优秀的操作，因为instance故障可能会导致使用不了

更通用的做法是把状态放在 Redis，数据库等外部村属

[Redis](https://app.notion.com/p/3ef8c4633d288020bf7fd6d6f189d5b4)


## 进程、线程、协程、锁、I/O、多路复用


这里我们需要先看进程，线程，协程这三部分，这三部分从上到下作为三个资源：

- Process：资源隔离和分配的基本单位
- Thread： 操作系统调度CPU执行的基本单位
- Coroutine： 用户态程序调度的并发任务

```json
操作系统
└── 进程 Process
    ├── 线程 Thread 1
    ├── 线程 Thread 2
    └── 线程 Thread 3
         ├── 协程 Coroutine A
         ├── 协程 Coroutine B
         └── 协程 Coroutine C
```


当创建一个程序的时候，比如 `server.py` ，OS会为它创建一个Process：为这个process创建独立的虚拟地址空间，代码段，堆，全局变量，文件描述富符号，网络socket，PID

我们着重说一下socket，在操作系统中，这是OS给Process之间通信所用的抽象。而在网络中，TCP/IP 可以帮传送socket，来进行server和client之间的通信


Process可以理解成一个强隔离的容器，注意，process不应该作为计算单位。但同时，强隔离性带来了通信的困难，Inner Process Communication。

MultiProcess Server。 在一个server中，我们可以制作多个worker，每个worker为一个process，一个worker崩溃别的worker仍然可以继续工作

接下来我们说运算单位：Thread。在同一个process中可能存在多个thread，他们之间存在共享内容，不像process的高隔离性


而这样的低隔离性也会带来新的问题：Race Condition。 当两个thread同时修改一个数据的时候，thread不同的修改逻辑加上每次thread的先后顺序的不确定性，可能会导致问题

为了解决这个问题，我们引入Lock，保证同一时间只有一个thread或的数据的访问权


我们的重点是Coroutine，其对应的是python的 `async` package

- async 修饰的函数：协程函数。 这时候这个函数会变成写成coroutine function
- Coroutine 对象： 当我们调用一个协程函数的时候，得到的是一个coroutine object，这里面保存了：
  - 当前执行到哪里
  - 局部变量
  - 等待的对象
  - 恢复执行所需要的状态
- Task： task是EventLoop直接调度的单位：
  ```py
  task = asyncio.create_task(fetch_data())
  ```
- async.run( fuc()) 当调用这个函数的时候，Thread创建一个EventLoop持续运行.

  而这个EventLoop执行这个Coroutine，一直到run()携带的Coroutine Object运行完毕


Coroutine的Event Loop主要调度方式是协作式调度，其会按顺序调度async对象，一直运行直到async 对象让出调度权。但注意的是Coroutine的本质是用户态的调度单元，而不是像thread或Process那样的OS级别单元


我们可以这么理解EventLoop：

```py
while True:
    ready_io = wait_for_io()
    ready_tasks = get_ready_tasks(ready_io)

    for task in ready_tasks:
        task.run_until_next_await()
```


## 延迟、吞吐量、并发量、Little’s Law

这一部分属于系统性能，我们需要了解这几个基本概念，好在以后的系统中做出取舍

- 延迟： 一个请求需要多长时间

  从请求开始，一直到请求完成所经历的时间


  平均延迟：对于一定数量的请求的延迟取平均


  但是平均延迟有的时候无法表达突然出现的高延迟：90%的请求只有10ms，但剩下的到达910ms


  因此系统经常使用p50/p90 … 来表示：

  p50 = %50的请求延迟不超过这个值


  这种表示是长尾延迟，在分布式系统中，一个用户的请求可能依赖多个下游服务，所以，延迟由最长的延迟来决定。因此，长尾延迟可以更好的表达


  一些常见的Inference Engine里面的延迟：

  - TTFT： Time to First Token 用户从客户端发出请求，到收到第一个token的时间
  - TPOT： Time Per Output Token： 第一个token之后，平均每生成一个新token的时间
  - ITL: Inter-Token

- Throughput： 单位时间能完成多少请求或者工作量
- 并发量： 系统中同时有多少个未完成请求
- Little’s Law： 并发量 = 吞吐量\*平均延迟

## 数据库索引，事务、隔离级别、日志与缓存


这部分我们需要系统的了解一个database的知识

- 索引：快速查找数据库的一种数据结构
- Transaction 事务：把一组数据库操作作为一个整体执行的机制
  ```py
  BEGIN;  -- 开始事务

  UPDATE accounts
  SET balance = balance - 100
  WHERE name = 'A';

  UPDATE accounts
  SET balance = balance + 100
  WHERE name = 'B';

  COMMIT; -- 提交事务
  ```


  如果中途出错，程序可以回滚


  ```py
  ROLLBACK; -- 回滚事务
  ```


  我们通常用ACID四个特性来描述Transaction：

  - Atomically： 事务中的操作要么全部生效，要不全都不生效
  - COnsistency：事务应当让数据库从一个满足业务约束的状态，进入另一个满足约束的状态
  - Isolation：多个事务兵法执行的时候，他们之间的影响应该收到控制
  - Durability：事务一旦成功提交，其结果就应当被持久保存

- 隔离级别

  隔离级别对应上述四个特性中的Isolation，规定多个Transaction同时执行时，一个Transaction能看到其他Transaction的哪些变化，以及需要防止哪些并发问题


  - 为什么需要隔离？

    假如存在两个事务：


    ```py
    事务 T1：给 A 转入 50 元
    事务 T2：读取 A 的余额
    ```


    如果同时读取，就会发生错误，错误可以大概分为几种：

    - dirty Read：一个Transaction读到了另外一个Transaction尚未提交的数据
    - Non-repeatable Read： 同一个Transaction里，两次读取同一行，结果不同
    - Phantom Read： 同一个transaction里，两次执行相同条件的查询，符合条件的记录集合发生了变化


  因此，存在四种标准隔离级别：


  | **隔离级别** | **脏读** | **不可重复读** | **幻读** |
  | --- | --- | --- | --- |
  | Read Uncommitted（读未提交） | 可能 | 可能 | 可能 |
  | Read Committed（读已提交） | 不允许 | 可能 | 可能 |
  | Repeatable Read（可重复读） | 不允许 | 不允许 | 标准上仍可能 |
  | Serializable（可串行化） | 不允许 | 不允许 | 不允许 |
- 日志

  日志用来记录发生的操作，数据的变化。


  数据库通常会遵守WAL（Write-Ahead Logging），相关日志先持久化，再允许对应的数据页写入持久存储。存在两种日志：Redo Log && Undo Log

- 缓存

  缓存解决的事快速访问的问题：数据库从磁盘或远程数据库读取数据，通常比从内存中读取慢


  数据库通常会在内存中维护数据页缓存，也常被称为Buffer Pool：

  比如第一次查询到某个用户时，数据库可能需要读取磁盘，之后相同的数据页仍在内存中，访问就可能更快


  有时候，也会使用Redis等外部系统缓存热点数据


  缓存会带来Consistency方面的问题：假如数据库里的user name已经更新，但是Redis里还是旧名字，用户就可能读到过期数据。一种常见做法是Cache-Aside


  ```py
  读取：
    先查缓存 → 未命中则查数据库 → 将结果写入缓存

  更新：
    先更新数据库 → 再删除对应缓存
  ```
