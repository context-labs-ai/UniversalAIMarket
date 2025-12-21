# Universal AI Market

<div align="center">
  <img src="./apps/market/public/logo.svg" width="200" alt="Universal AI Market Logo" />
  <h1>Universal AI Market</h1>
  <p><strong>AI Agent + ZetaChain = 无缝跨链购物体验</strong></p>
</div>


## 项目愿景

想象一下这样的场景：你在玩一款游戏，想购买一把强力武器 NFT。这个 NFT 在 Polygon 链上，而你的钱包里只有 Base 链上的 USDC。传统方式下，你需要：

1. 找一个跨链桥，把 USDC 转到 Polygon
2. 等待跨链确认（可能需要几分钟到几小时）
3. 在 Polygon 上换成 MATIC 付 Gas
4. 最后才能购买 NFT

**太麻烦了！**

我们的解决方案是：**让 AI Agent 替你完成一切**。

你只需要告诉 Agent："帮我买那把量子之剑"，剩下的事情全部自动完成——跨链支付、卖家收款、NFT 交付，一气呵成。

<div align="center">
  <a href="https://youtu.be/nE3dKHVTGT8">
    <img src="https://img.youtube.com/vi/nE3dKHVTGT8/maxresdefault.jpg" width="600" alt="Demo Video" />
  </a>
  <p><em>点击观看演示视频</em></p>
</div>

---

## 核心创新

### 1. AI 驱动的购物体验

买家不需要理解区块链的复杂性。AI Agent 会：
- 自动发现并浏览商品
- 与卖家 Agent 进行价格协商（支持多卖家竞价）
- 准备跨链交易参数
- 实时展示交易进度

### 2. ZetaChain 跨链结算

利用 ZetaChain 的 Universal App 架构，实现了真正的原子化跨链交易。

### 3. 无需信任的托管机制

NFT 由智能合约托管，只有在收到跨链消息后才会释放。卖家和买家都不需要信任对方——代码即法律。

### 4. 多 Agent 协作架构

系统由多个 AI Agent 协同工作，支持 LLM 驱动的自然语言砍价：

```
┌─────────────────────────────────────────────────────────────────┐
│                    Market Frontend (前端)                        │
│                 用户配置 Buyer Agent：钱包、预算、策略              │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────┴─────────────────────────────────┐
│                         Agent Hub (协调中心)                     │
│                    LLM: Qwen (可配置其他模型)                     │
└───────────────────────────────┬─────────────────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  Buyer Agent    │   │  Seller Agent 1 │   │  Seller Agent N │
│  (买家代理)      │   │  (可配置风格)    │   │  (可配置风格)    │
│  - 预算控制      │   │  - LLM 生成对话  │ … │  - LLM 生成对话  │
│  - 砍价策略      │   │  - 底价保护      │   │  - 底价保护      │
│  - 浏览器端签名  │   │  - 独立钱包      │   │  - 独立钱包      │
└─────────────────┘   └─────────────────┘   └─────────────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │   并行砍价 → 选择最低价  │
                    │      成交 & 跨链结算    │
                    └───────────────────────┘
```

**关键特性**：
- **多卖家并行砍价**：同时和 N 个 Seller Agent 谈判，选择最优价格
- **LLM 驱动对话**：使用 Qwen 等大模型生成自然的砍价对话
- **浏览器端签名**：私钥仅存储在用户浏览器内存中，从不发送到服务器
- **多链支持**：基于 ZetaChain，支持任意 EVM 兼容链
- **可扩展 Seller**：每个卖家可以部署独立的 Seller Agent 服务

详细架构说明见 [Agent Hub 文档](./apps/agent/README.md)。

### 5. MCP（Model Context Protocol）接入（可选 / 规划）

我们计划将市场网站作为 **agent 的入口**，对外提供 MCP Server（或 MCP over HTTP/SSE），让第三方 agent 以标准协议发现能力、调用工具、拿到流式结果。  
这个方向是**兼容而不是替换**：

- **保留 discovery**（`/.well-known/...`）作为市场元信息
- **新增 MCP endpoint**，把现有工具（如 `/api/agent/tool`）映射为 MCP tools
- **认证沿用签名挑战**（challenge/verify），MCP 调用携带 session

同时要明确边界：
- **MCP 解决**：标准化工具接入、上下文传递、降低第三方 agent 接入成本
- **MCP 不解决**：认证、结算、风控/限额、幂等/回滚等业务安全逻辑（这些仍由我们定义）

---

## 技术架构详解

### 跨链交易流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           完整跨链交易流程                                    │
└─────────────────────────────────────────────────────────────────────────────┘

  Base Sepolia                    ZetaChain Athens                 Polygon Amoy
  (买家付款链)                      (编排层)                        (NFT 所在链)
       │                              │                                 │
       │  1. depositAndCall()         │                                 │
       │  (USDC + Deal 信息)          │                                 │
       │ ────────────────────────────>│                                 │
       │                              │                                 │
       │                    2. UniversalMarket.onCall()                 │
       │                       - 验证 Deal 信息                          │
       │                       - 验证付款金额                            │
       │                              │                                 │
       │     3. gateway.withdraw()    │                                 │
       │ <────────────────────────────│                                 │
       │   (USDC 转给卖家 Base 地址)   │                                 │
       │                              │                                 │
       │                              │    4. gateway.call()            │
       │                              │ ───────────────────────────────>│
       │                              │    (调用 Escrow.release)         │
       │                              │                                 │
       │                              │                      5. Escrow 释放 NFT
       │                              │                         给买家 Polygon 地址
       │                              │                                 │
       ▼                              ▼                                 ▼
   卖家收到 USDC                 交易完成事件                      买家收到 NFT
```

### 为什么选择 ZetaChain？

| 特性 | 传统跨链桥 | ZetaChain Universal App |
|------|-----------|------------------------|
| **原子性** | ❌ 分步执行，可能中途失败 | ✅ 一笔交易完成所有操作 |
| **多链支持** | ❌ 每对链需要独立桥 | ✅ 一个合约支持所有 EVM 链 |
| **编排逻辑** | ❌ 无法在中间层添加逻辑 | ✅ 可在 ZetaChain 上执行复杂业务逻辑 |
| **Gas 体验** | ❌ 需要目标链 Gas | ✅ 源链付款即可，目标链 Gas 自动处理 |
| **结算速度** | ⏱️ 几分钟到几小时 | ⚡ 1-3 分钟 |

### 合约架构

```
                           ┌─────────────────────────┐
                           │      ZetaChain          │
                           │  ┌─────────────────┐    │
                           │  │ UniversalMarket │    │  ← 核心编排合约（全链通用，只需 1 个）
                           │  │                 │    │
                           │  │ - onCall()      │    │     接收跨链消息
                           │  │ - 验证 Deal     │    │     验证交易参数
                           │  │ - 转账给卖家    │    │     调用 withdraw
                           │  │ - 触发 NFT 交付 │    │     调用 call
                           │  └────────┬────────┘    │
                           └───────────┼─────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              ▼                        ▼                        ▼
     ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
     │    Polygon      │      │    Ethereum     │      │      BSC        │
     │  ┌───────────┐  │      │  ┌───────────┐  │      │  ┌───────────┐  │
     │  │  Escrow   │  │      │  │  Escrow   │  │      │  │  Escrow   │  │
     │  │  + NFT    │  │      │  │  + NFT    │  │      │  │  + NFT    │  │
     │  └───────────┘  │      │  └───────────┘  │      │  └───────────┘  │
     └─────────────────┘      └─────────────────┘      └─────────────────┘
              │                        │                        │
              └────────────────────────┴────────────────────────┘
                                       │
                          每条链需要单独部署 Escrow
                          但合约代码完全通用！
```

### 合约说明

| 合约 | 部署位置 | 数量 | 说明 |
|------|----------|------|------|
| **UniversalMarket** | ZetaChain | 1 个 | 核心编排合约，处理所有链的跨链交易 |
| **UniversalEscrow** | 每条 NFT 链 | N 个 | NFT 托管合约，**代码 100% 通用**，仅构造参数不同 |
| **NFT 合约** | 卖家选择 | 任意 | 支持任何 ERC-721 标准 NFT |

---

## 卖家接入指南

### 方式一：前端一键部署（推荐）

我们提供了 **一键部署** 功能，无需编写代码即可完成 NFT 铸造、托管和上架：

1. 访问 **http://localhost:3001/seller**（卖家中心）
2. 连接钱包并填写商品信息：
   - 商品名称、描述、价格
   - 卖家 Agent 名称和砍价策略
3. 点击 **"部署并上架"**，系统自动完成：
   - ✅ 铸造 NFT 到 Polygon
   - ✅ 部署/复用 Escrow 托管合约
   - ✅ 将 NFT 存入托管
   - ✅ 商品上架到市场

整个流程只需 **一次签名**，约 1-2 分钟完成。

### 方式二：手动部署（高级用户）

如果你是卖家，想在 Universal AI Market 上销售 NFT，需要完成以下准备：

#### 1. 部署 NFT 合约（如果还没有）

```solidity
// 任何标准 ERC-721 合约都可以
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MyNFT is ERC721 {
    // 你的 NFT 逻辑
}
```

#### 2. 部署 UniversalEscrow 托管合约

Escrow 合约需要部署在 **NFT 所在的链** 上。我们提供的 `UniversalEscrow.sol` 是 **100% 通用**的：

```solidity
// contracts/UniversalEscrow.sol
// 同一份代码，部署到任意 EVM 链，仅需修改构造参数
contract UniversalEscrow {
    constructor(address _gateway) {
        // _gateway: 该链上的 ZetaChain Gateway 地址
        // 不同链的 Gateway 地址不同，需要查询 ZetaChain 文档
        gateway = _gateway;
    }
}
```

**部署示例**：
```bash
# Polygon Amoy
npx hardhat run scripts/deploy/deploy_escrow.ts --network polygon_amoy

# Base Sepolia（同样的代码，不同的 gateway 地址）
npx hardhat run scripts/deploy/deploy_escrow.ts --network base_sepolia

# Ethereum Sepolia
npx hardhat run scripts/deploy/deploy_escrow.ts --network sepolia
```

**各链 Gateway 地址（Testnet）**：
| 链 | Gateway 地址 |
|----|-------------|
| Polygon Amoy | `0x0c487a766110c85d301d96e33579c5b317fa4995` |
| Base Sepolia | `0x0c487a766110c85d301d96e33579c5b317fa4995` |
| Ethereum Sepolia | 查询 [ZetaChain 文档](https://www.zetachain.com/docs) |

#### 3. 存入 NFT 到 Escrow

卖家需要将 NFT 存入 Escrow 合约，这样买家付款后，智能合约才能自动将 NFT 释放给买家。

**Demo 环境一键部署**（推荐）：

```bash
# 自动部署 NFT + Escrow 并存入示例 NFT
npx hardhat run scripts/deploy/setup_demo.ts --network polygon_amoy
```

**手动操作**（自定义 NFT）：

```bash
# 使用 Hardhat console 或编写脚本
npx hardhat console --network polygon_amoy

# 在 console 中：
> const nft = await ethers.getContractAt("IERC721", "你的NFT合约地址")
> const escrow = await ethers.getContractAt("UniversalEscrow", "Escrow合约地址")
> await nft.approve(escrow.target, tokenId)
> await escrow.deposit(nft.target, tokenId)
```

#### 4. Deal 信息传递

无需在 UniversalMarket 上预先注册 Escrow。所有交易信息都在 Deal 结构中动态传递：

| 字段 | 说明 |
|------|------|
| `buyer` | 买家地址（用于接收 Polygon 上的 NFT） |
| `sellerBase` | 卖家 Base 链地址（用于收款） |
| `polygonEscrow` | NFT 所在的 Escrow 合约地址 |
| `nft` | NFT 合约地址 |
| `tokenId` | NFT Token ID |
| `price` | 成交价格（USDC，6 位小数） |

这种设计让任何卖家都可以接入，无需中心化审批。

### Escrow 合约特性

我们的 Escrow 合约支持：

```solidity
// 1. 卖家存入 NFT
function deposit(address nft, uint256 tokenId) external;

// 2. 跨链释放（只有 ZetaChain Gateway 可调用）
function release(address buyer, address nft, uint256 tokenId, bytes32 dealId) external;

// 3. 管理员紧急释放（用于异常恢复）
function adminRelease(address buyer, address nft, uint256 tokenId) external onlyOwner;

// 4. 转移所有权
function transferOwnership(address newOwner) external onlyOwner;
```

---

## 已部署合约（Testnet）

### ZetaChain Athens
| 合约 | 地址 |
|------|------|
| UniversalMarket | `0xB7f7c2Dd2790741D5fF6b1965d37d0338cD01477` |

### Polygon Amoy
| 合约 | 地址 |
|------|------|
| UniversalEscrow | `0xC51ad62e3B794f9A9Caa349dec6C5c997c133922` |

### Base Sepolia
| 合约 | 地址 |
|------|------|
| Gateway | `0x0c487a766110c85d301d96e33579c5b317fa4995` |
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

---

## 快速体验

### 环境要求

- Node.js >= 18
- pnpm

### 安装

```bash
pnpm install
```

### 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入你的私钥和配置
```

### 启动服务

本项目采用多 Agent 架构，完整运行需要启动以下服务：

| 服务 | 端口 | 目录 | 启动命令 | 说明 |
|------|------|------|----------|------|
| **Market Frontend** | 3001 | `apps/market` | `pnpm dev` | 市场前端 UI |
| **Agent Hub** | 8080 | `apps/agent` | `pnpm dev` | Agent 协调中心，处理砍价流程 |
| **Seller Agent** | 8081 | `apps/seller-agent` | `pnpm dev` | 卖家 Agent 服务 |
| **Buyer Agent** | 8083 | `apps/buyer-agent` | `pnpm dev` | 买家 Agent（自托管服务） |

```bash
# 分别在不同终端启动
cd apps/market && pnpm dev          # 终端 1
cd apps/agent && pnpm dev           # 终端 2
cd apps/seller-agent && pnpm dev    # 终端 3
cd apps/buyer-agent && pnpm dev     # 终端 4
```

打开 http://localhost:3001 访问市场前端

### 体验流程

1. **配置 Buyer Agent**：在前端右侧边栏的 "Buyer Agent" 标签页中配置：
   - 钱包私钥（仅存于浏览器内存，从不发送到服务器）
   - 预算
   - 购物目标（如："帮我买一把量子之枪"）
   - 砍价策略
   - 支付链（支持多条 EVM 链）
2. **发起购买**：点击 "启动 Agent"，AI 自动搜索符合目标和预算的商品
3. **自动砍价**：观看 Buyer Agent 与多个 Seller Agent 实时砍价对话（LLM 生成）
4. **确认交易**：砍价成功后，确认跨链结算
5. **完成交付**：查看跨链交易进度，NFT 自动交付到你的钱包

### 模式说明

- **模拟模式**：无需真实资金，快速展示完整流程（默认）
- **Testnet 模式**：使用真实测试网进行跨链交易，需要在 `.env` 中配置私钥和测试币

---

## 项目结构

```
├── contracts/
│   ├── UniversalEscrow.sol      # 通用 NFT 托管合约（可部署到任意 EVM 链）
│   ├── zevm/
│   │   └── UniversalMarket.sol  # ZetaChain 核心编排合约（只需部署 1 个）
│   └── polygon/
│       └── MockWeaponNFT.sol    # 示例 NFT 合约（仅用于演示）
├── apps/
│   ├── market/                  # 市场前端 (Next.js)
│   ├── agent/                   # Agent Hub (协调中心)
│   ├── buyer-agent/             # 外部 Buyer Agent 服务
│   └── seller-agent/            # Seller Agent 服务
└── scripts/
    └── utils/                   # 工具脚本
        ├── check_balances.ts    # 检查余额
        ├── reset_demo.ts        # 重置演示状态
        └── swap_zeta_to_pol.ts  # Swap 工具
```

---


## 相关链接

- [ZetaChain 文档](https://www.zetachain.com/docs)
- [ZetaChain Explorer](https://explorer.zetachain.com)
- [Polygon Amoy Explorer](https://amoy.polygonscan.com)
- [Base Sepolia Explorer](https://sepolia.basescan.org)

---

## License

MIT
