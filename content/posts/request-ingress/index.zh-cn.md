---
title: "请求进入服务"
date: 2026-11-09
categories: ["技术"]
tags: ["System Design"]
draft: false
toc:
  enable: true
---

在最开始的阶段，我们先假设两端都是点对点，并且数量都是1:

```py
浏览器 Client
↓ ① DNS：找到入口的 IP
↓ ② 建立连接：TCP + TLS
反向代理 / 负载均衡
↓ ③ 转发请求
应用服务 Server
↓ ④ 路由到处理函数
业务逻辑 → 缓存 / 数据库
↓ ⑤ 返回响应
浏览器收到结果
```

先假设，我们在浏览器中点击“查看用户”，浏览器请求： https://api.example.com/users/123

这里用最简单的情况：我有一台服务器（电脑），IP是203.0.113.10，上面运行着HTTP服务，监听8000端口，那么，客户端发送的请求：

```py
GET /users/123 HTTP/1.1
Host: 203.0.113.10:8000
```

上面就是我们假设的最简单的request在HTTP层的请求，在真实情况中，其可能是：

```py
请求行：
POST /orders HTTP/1.1

请求头：
Host: api.example.com
Content-Type: application/json
Content-Length: 10 （代表编码后是10个字节）

空行

请求体：
{"id":123}
```

上述都是在HTTP层，为了方便人类所作出的格式，在真实传输时，其是一串字节流

接下来的传输过程，可以总结成五步：

- Client确定IP和端口：如果已经在访问的时候知道了目标IP，那么就不需要额外操作。但是如果访问的是域名，那么client需要先通过DNS获取可用的IP地址
- 建立网络连接：client和目标IP+端口建立连接：
  ```py
  Client                                  Server
    |                                       |
    |-------------- SYN ------------------->|
    |<------------- SYN + ACK --------------|
    |-------------- ACK ------------------->|
    |                                       |
    |             TCP 连接建立               |
  ```

  这里展示的是HTTP/1.1或者HTTP/2运行在TCP上的例子，服务器操作系统根据目标IP，端口和协议，找到监听该地址的socket。

  如果是HTTPS，TCP连接建立后，还需要进行TLS握手

  TLS指的是client和server在开始安全通信之前，用来验证身份，协商安全参数并建立加密密钥的过程。一个简化的示意图：

  ```py
  Client                                         Server
    │                                               │
    │── ClientHello ───────────────────────────────→│
    │   支持的协议、加密选项、密钥交换信息等          │
    │                                               │
    │←─ ServerHello 等握手消息 ────────────────────│
    │   选定的参数、密钥交换信息、证书等              │
    │                                               │
    │   验证服务器证书，并确认握手信息               │
    │                                               │
    │── Finished ─────────────────────────────────→│
    │                                               │
    │        双方开始使用建立的密钥保护应用数据       │
  ```
- 操作系统把连接交给服务

  当服务启动的时候，通常会创建socket，并绑定，监听一个端口：

  ```py
  # 示意代码，省略了错误处理等细节
  server_socket.bind(("0.0.0.0", 8000))
  server_socket.listen()

  connection, client_address = server_socket.accept()
  ```
- 服务解析HTTP请求并路由

  TCP提供的是字节流，我们需要分析字节流真正携带的信息。

  在解析以后，会根据携带的信息和服务所用的框架，找到对应的handler

- 执行业务逻辑并返回相应

  handler后面可能跟随着庞大的业务逻辑，在执行完业务逻辑以后，返回Response

### 反向代理

反向代理指的是在server侧多一层代理，其并不是必须的。对于一个只存在一个服务（python应用）的服务器来说，其没有必要存在。

但是，如果我们想要让一个服务器，可以同时暴露出两个及以上的服务，反向代理就会很有用：

```py
Client ──HTTP/HTTPS──→ Nginx ──HTTP──→ Python 应用
                      :80/:443          :8000
```

Nginx是一个很典型的反向代理，其可以根据发送来的request和其内部配置规则来进行端口区分。

例如：

- [https://api.example.com:443/users/123](https://api.example.com/users/123) https默认使用端口443
- [http://api.example.com/users/123](http://api.example.com/users/123) http默认使用端口80

如果想要使用非默认端口，我们必须在请求的url中显式标注。

如果Nginx暴露443端口，其在接收到：[https://api.example.com:443/users/123](https://api.example.com/users/123) 这个请求的时候，它就会查询代理的配置规则：

```py
客户端请求：GET https://api.example.com/users/123
                         ↓
Nginx 收到 :443 上的请求
                         ↓
检查路径：/users/123
                         ↓
匹配 /users/* 规则
                         ↓
转发到 127.0.0.1:8001
```

这里展示一个Nginx的配置规则的例子：

```py
# 定义用户服务的后端
upstream user_service {
    server 127.0.0.1:8001;
}

# 定义订单服务的两个后端实例
upstream order_service {
    server 127.0.0.1:8002;
    server 127.0.0.1:8003;
}

server {
    # Nginx 对外监听 8080 端口
    listen 8080;

    # 只处理匹配这个域名的请求
    server_name api.example.com;

    # /users/ 开头的请求交给用户服务
    location /users/ {
        proxy_pass http://user_service;

        # 将原始 Host 和来源信息传给后端
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # /orders/ 开头的请求交给订单服务
    location /orders/ {
        proxy_pass http://order_service;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

需要注意的是，Nginx不仅可以代理同一个服务器上的不同端口，还可以代理转发别的服务器，我们将在负载均衡的section仔细说说

这里展示的是最好理解的，不同url携带的信息，走向不同的端口。而其中还隐藏着一种情况：假如一个服务器上开启了相同服务的多份，都监听不同的端口，我们该如何处理？

```py
upstream app_service {
    server 127.0.0.1:8001;
    server 127.0.0.1:8002;
    server 127.0.0.1:8003;
}

server {
    listen 8080;

    location / {
        proxy_pass http://app_service;
    }
}
```

### 负载均衡

负载均衡是我们处理高并发的入门阶段。其解决的是：当请求过多时，该如何分配请求和实例。

system中多处都存在负载均衡的地方，而在请求部分，我们要解决的问题要简单一些。

我们要先分清楚：一个应用，只要监听一个端口，就可以作为一个instance，它就作为了负载均衡的目标。这样我们就将各个不同服务器不同窗口统一在了一个单位：instance。

Nginx提供我们了一个方便的做法，其可以作为中间的中转站：

- 左侧是所有request
- 右侧是所有instance

```py
Client
   ↓
Nginx
   ├──→ 10.0.0.11:8000 → 服务器 A / 实例 1
   ├──→ 10.0.0.12:8000 → 服务器 B / 实例 2
   └──→ 10.0.0.13:8000 → 服务器 C / 实例 3
```

具体的配置规则：

```py
upstream app_service {
    server 127.0.0.1:8001;
    server 127.0.0.1:8002;
    server 127.0.0.1:8003;
}
```

这样，我们只需要向client侧暴露Nginx的端口，就可以收到request。负载均衡就集中体现在Nginx中了，其默认的算法是RoundBin算法。同时也存在一些别的算法，涉及到我们给instance设置的weight，或者least\_conn（连接数量），甚至ip\_hash(根据client的IP来选择background

### 服务发现

继续我们需要解决另外一个问题：当一个服务有多个instance的时候，并且instance可能会关闭/开启，动态变化。那调用方（反向代理器/负载均衡器）该如何找到当前可以访问的instance？

在之前的例子中，我们用的是静态配置规则：

```py
upstream order_service {
    server 10.0.0.11:8000;
    server 10.0.0.12:8000;
    server 10.0.0.13:8000;
}
```

而在真实系统中，instance可能随时启动，退出，重启或迁移

服务发现的核心：名称到地址的映射。

我们可以把服务发现理解成一个动态服务通讯录：

```py
user-service
├── 10.0.0.21:8000
└── 10.0.0.22:8000

order-service
├── 10.0.0.11:8000
├── 10.0.0.13:8000
└── 10.0.0.18:8000
```

服务名：指的是逻辑名称，例如order-service

实例地址：具体的网络位置（IP地址）。

一个服务名可以对应多个instance地址

 服务发现有一些组成部分：

```py
服务实例
   ↓ 注册
服务注册表
   ↑ 查询或订阅
调用方 / 代理 / 负载均衡器

健康信息 → 用来更新或筛选实例
```

- 注册部分：
  - 服务instance：一个IP+一个端口号 这样的组合代表一个instance
  - 注册表 Registry： 保存着服务与instance之间的关系：
    ```py
    order-service → [10.0.0.11:8000, 10.0.0.13:8000]
    ```
  - 注册方式：
    - instance自己注册
      ```py
      实例启动
         ↓
      向注册表发送：
      “我是 order-service，地址是 10.0.0.11:8000”
      ```
    - 平台代为登记
      ```py
      部署平台启动实例
         ↓
      平台记录实例地址和状态
         ↓
      平台更新服务发现信息
      ```
- 注销删除部分：

  删除部分更困难一点，因为instance如果因为意外注销，其是无法及时发送销毁信号的。因此需要结合健康信息和超时机制

  我们先看正常注销，这时instance可以正常退出，这样其可以停止接受新请求，在可用列表中移除，处理已经完成已有请求，最后退出

  通常，我们使用一种设计来保证意外退出：instance定期续约或发送心跳。instance每隔一段时间就像Registry确认自己还活着

  我们也可以进行健康检查，查看instance是否准备好接受Request：

  ```py
  GET /health
  ```

在讲完最基础的操作以后，我们需要看看Nginx所得知道的实际上Registry是如何更新的：

Registry的位置很多变，其可以是和Nginx在同一服务器，也可以是在一个单独的服务器。它更像是一个Service Address的集中管理中心

这里有两种做法：Pull 和 Watch/Push

- Pul表示Nginx定期拉取Registry
- Push表示：订阅变化

  订阅意味着：负责同步的组件先告诉服务发现系统：我要关注order-service的instance变化

  与Pul不一样的是，其不需要每隔几秒就完整查询一次，而是在变化的时候获取更新
