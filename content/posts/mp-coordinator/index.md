---
title: "MP Coordinator"
date: 2026-11-08
categories: ["Technology"]
tags: ["LMCache", "System Design"]
draft: false
toc:
  enable: true
---

# MP Coordinator

Coordinator 的创建和与Server的联系

MP Server是以每个机器为单位的，一般来说，一个机器会配套一个MP Server。它们构成了分布式系统的每个single node。而MP Coordinator是分布式系统的统一管理者，负责监控和协调属于其的MP Server。

因为MP Coordinator是独立的，并不是任何机器的独立进程，所以我们可以在任何位置开启这个相对独立的进程。而MP Server可以在创建时显式输入MP Coordinator的地址+端口，让server 和 coordinator链接起来

同时因为MP Coordinator是独立的，我们创建它的时候并不像一般的class一样。先在app里面创建一个FAST API进程，然后为这个进程绑定诸多有关系的模块。

## 模块

```py
mp_coordinator/
├── 配置层      MPCoordinatorConfig
├── 装配层      CoordinatorContext
├── 视图层      View → InstanceRegistry / KeyDirectory / CacheUsageManager / ServerConfigRegistry
├── 控制器层    Controller → FleetEvictionController / PrefetchManager
├── 事件摄取    CacheEventSource → HttpCacheEventSource / KafkaCacheEventSource
│              EventGate → CacheEventBroadcaster → CacheEventConsumer
├── 持久化      DurableComponent → MetadataPersister / CheckpointMonitor / QuiesceLock / ArtifactStore
├── 运行时      BackgroundLoops / EventLoopMonitor / ControllerRuntime / ControllerStatus
├── API 契约    api.py 里的 Pydantic 模型 + HttpRoutes Protocol
└── 周边        BlendIndex / BlendCoordinatorClient / Registry / events_replay(回放测试工具)
```

我们将起点定义为app.py里面的create\_app（）函数，其职责就是创建Thread并连接各个模块


深入这个函数，我们最需要搞清楚的是各个模块的职责以及它们是如何创建的：

- views

  其相当于fleet的view（和数据库里每个table的view相同概念）。里面包含着四个重要clas：


  - InstanceRegistry
  - KeyDirectory
  - CacheUsageManager
  - ServerConfigRegistry
- Controller

  controller和view对应：view负责展示数据，其不主动，等待别人来修改。controller主动做出动作，持有行动策略，在后台有drive\_loop驱动

- Token\_hasher

  将token\_ids进行哈希的工具

- 事件管线


  event\_broadcaster


  2. 消费者注册

     任何view/controller实现了消费者协议，都会被挂上


  quiesce


  4. event\_source 二选一
- 持久化装配
  ```py
  checkpoint_components = [event_gate, *views.durable, *controllers.durable, stream_position?]
  metadata_persister = MetadataPersister(...)          # 运维意图存储
  for component in controllers.durable_components()[METADATA]:
      metadata_persister.register(component)
  metadata_persister.load()                            # ★ 先恢复运维意图
  checkpoint_monitor.record_restore(load_checkpoint(...))  # ★ 再恢复派生状态
  ```
- 运行时组件

  `BackgroundLoops` （定时器池）、`EventLoopMonitor` （asyncio 阻塞监控）、`ControllerStatus` （哪个 controller 的`run()` 真正进入了）、`restored_instances` （从 checkpoint 恢复出的 emitter 集合 + 宽限期截止时间——之后没重新注册的会被摘除，防止 checkpoint“复活”死实例）、可选的 metrics 注册。

- ctx + lifespan + app + 路由 \[L184-345\]


## Runtime Period

### 注册

当我们将视角看回整个系统的时候，MP Server通过自己的函数 `keep_registered` 提交一个async任务，将一个包装好的Request数据包post到端口上。

而在 `instances_api.py` 文件里面，写好了这个端口处理数据的handler，这个handler经过一系列检查（现阶段先不深入），最后创建一个 `MP Instance` 实例，并且调用 `InstanceRegistry` 类的register函数。这个过程就成功地将server侧和Coordinator侧链接了起来


我们先分析MP instance这个实例。它只是一个data class，但是其连接了api handler和真实的InstanceRegistry：

```py
@dataclass
class MPInstance:
    instance_id: str                                # 身份
    ip: str                                         # ┐
    http_port: int                                  # ┘ 控制面回调地址
    registration_time: float                        # ┐ 两种时钟，两个用途
    last_heartbeat_time: float                      # ┘
    metadata: dict[str, str] = field(default_factory=dict)  # 自由扩展
    p2p_advertised_url: str = ""                    # ┐
    mq_port: int = 0                                # ┘ P2P 数据面地址（可选）
```

| MPInstance 字段 | 来源 |
| --- | --- |
| `instance_id` | 请求携带或 coordinator 生成 |
| `ip` / `http_port` / `metadata` / `p2p_advertised_url` / `mq_port` | 请求体直传 |
| `registration_time` | coordinator 填 `time.time()`（收到注册的时刻） |
| `last_heartbeat_time` | coordinator 填 `time.monotonic()`（注册即首次心跳） |


接着，我们就可以分析InstanceRigstry这个类了，这个class并不复杂，其相当于一个巨大的注册表，最关键的几个属性：

- lock：一个thread 锁
- instance： \{instance\_id: instance\}
- membership\_changes:一个可迭代的字典值，在变化的时候提供可观测性


截止到现在，我们已经跑通了一个注册流程，接下来需要着眼于具体的事件

### 事件流程

```py
MP Server (POST /events, JSON batches)
   ↓
events_api.report_cache_events     ← HTTP 入口，类型守卫
   ↓
HttpCacheEventSource.ingest        ← 薄委托，无自有资源
   ↓
EventGate.ingest_batches → ingest → _admit   ← 准入权威：排序/去重/fencing/gap
   ↓ (锁内)
CacheEventBroadcaster.broadcast    ← 扇出：按注册顺序、失败隔离
   ↓
consumers.consume / fence_instance ← Views + Controllers
```

我们可以先忽略Server侧，直接了解起post的request的主体：

request的主体是一个包信封，里面携带的信息如下（CacheEventBatch类）：

| 字段 | 谁盖的章 | gate 怎么用 |
| --- | --- | --- |
| `instance_id` / `incarnation` | subscriber 构造时固定（incarnation = 进程启动时间） | 查 `_cursors` / `_departed`，化身 fencing |
| `seq` | `flush()` 时从 `_seq` 分配，单调 | `seq <= last_seq` → DUPLICATE；跳号 → gap |
| `event_type` / `tier` / `backend` / `shared` | `_record()` 的批身份四元组 | consumer 决定更新哪个视图 |
| `entries` | 翻译存储层事件得到的 key 列表 | KeyDirectory/CacheUsageManager 的实际内容 |
| `ts` | `flush()` 时的 `time.time()` | gate 算 `event_delivery_delay_seconds` |
| `dropped_events` | `flush()` 时读 `sink.dropped_events` 计数器 | gate 增量检测发射端丢失 |
| `capacity_bytes` / `capacity_revision` | 仅 CONFIG 批 | ServerConfigRegistry 判“新声明 vs 续传” |

在发送CacheEventRequest以后，api的handler开始处理这个request，其会在检查数据以后交给GateEventSource类，其ingest（）函数负责处理。


这里先交给EventSource类管理，其相当于一个入口，负责筛选request的数据来源（Kafka或者Http），我们可以先不着重看这个类，直接到真正实现逻辑的类： `EventGate`


`EventGate` 类是真正的守门员函数，所有进入Coordinator的request最后一道关卡。它对每个CacheEventRequest进行分类判断，其中每个batch有三个命运：

| **判定** | **条件** | **结果** |
| --- | --- | --- |
| incarnation 围栏 | batch 的 incarnation 落后于游标记录的（emitter 重启前的旧流） | `STALE_INCARNATION`，丢弃 |
| seq 去重 | `batch.seq <= cursor.last_seq`（重复投递） | `DUPLICATE`，丢弃 |
| 准许 | 通过上述检查 | `ADMITTED`，广播给消费者 |


| 判定 | 条件 | 结果 |
| --- | --- | --- |
| incarnation 围栏 | batch 的 incarnation 落后于游标记录的（emitter 重启前的旧流） | `STALE_INCARNATION`，丢弃 |
| seq 去重 | `batch.seq <= cursor.last_seq`（重复投递） | `DUPLICATE`，丢弃 |
| 准许 | 通过上述检查 | `ADMITTED`，广播给消费者 |


在深入每个判定的条件之前，我们需要先了解一下background：

```py
Gate 记忆:                                Batch 自带:
┌─ _cursors[instance_id] ─┐              instance_id   我是谁
│  incarnation  见过的最新代 │    vs        incarnation  我哪次启动(time_ns)
│  last_seq     已准入的最高seq│             seq          我在该代的第几批(单调递增)
└──────────────────────────┘              tier          我描述的是 L1(内存)还是 L2(持久)
┌─ _departed[instance_id] ─┐
│  离开时的 incarnation     │
└──────────────────────────┘
```

- incarnation条件：在instance注销或者心跳超时被驱逐时，\`drop\_instance\`会记录它离开时的incarnation，之后如果\<这个值，那么就判定为旧进程的幽灵。注意：只驱逐l1内存

  或者，其\<cursor见过的值

- Duplicate条件：同一incarnation下，seq是单调递增的。如果seq\<last\_seq，则判定为Duplicate
- Admitted： 兜底允许
  ```py
  batch 到达
    │
    ├─ 在 departed 名单? ──┬─ incarnation 更大 → 除名,继续 ↓ (实例回来了)
    │                      └─ incarnation ≤ 离开值 且 tier==L1 → STALE ❌
    │
    ├─ 有游标? ──┬─ incarnation < 游标值 → STALE ❌ (旧流重放)
    │            ├─ incarnation > 游标值 → fence + 重建游标 (重启,继续 ↓)
    │            └─ incarnation == 游标值:
    │                 └─ seq ≤ last_seq → DUPLICATE ❌
    │
    └─ 跳号/丢包审计 → 更新游标 → broadcast → ADMITTED ✅
  ```


判定之后，将batch推送到event\_broadcastor里的broadcast函数。这里我们就讲Gate的守门机制讲完了，接下来继续深入broadcastor类：

`Event_broadcaster` 位于Gate之后，本质上是一个进程内的发布-订阅扇出器（observer的极简实现）。大致结构为：

```py
                     ┌─→ Consumer A：更新 KeyDirectory
一个缓存事件 ─→ 扇出器 ├─→ Consumer B：更新 CacheUsageManager
                     └─→ Consumer C：交给 Controller 处理
```

每个Consumer都用@runtime\_checkable支持检查，只要满足协议就认定为是Consumer

```py
@runtime_checkable
class CacheEventConsumer(Protocol):
    """One downstream consumer of gate-admitted cache-event batches."""

    def consume(self, batch: CacheEventBatch) -> None:
        """Apply one gate-admitted batch to this consumer's state.

        Called once per admitted batch, in admission order. Only
        per-instance ordering is guaranteed, and skipping irrelevant
        tiers and event types is the consumer's own job.

        Args:
            batch: The admitted batch.
        """
        ...

    def fence_instance(self, instance_id: str) -> None:
        """Discard the **L1** state ``instance_id`` reported, before any
        batch of its new incarnation is consumed.

        Called on a restart or a departure. L2 bytes outlive the
        reporting process, so L2-only consumers no-op.

        Args:
            instance_id: The instance whose reported L1 state is void.
        """
        ...
```

每个注册到Broadcaster的consumer，都会被broadcaster调用其自己的 `consumer` 函数，然后处理batch
