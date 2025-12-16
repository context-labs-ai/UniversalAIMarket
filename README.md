# Universal AI Market

> 用 AI Agent 改变跨链购物体验

## 项目愿景

想象一下这样的场景：你在玩一款游戏，想购买一把强力武器 NFT。这个 NFT 在 Polygon 链上，而你的钱包里只有 Base 链上的 USDC。传统方式下，你需要：

1. 找一个跨链桥，把 USDC 转到 Polygon
2. 等待跨链确认（可能需要几分钟到几小时）
3. 在 Polygon 上换成 MATIC 付 Gas
4. 最后才能购买 NFT

**太麻烦了！**

我们的解决方案是：**让 AI Agent 替你完成一切**。

你只需要告诉 Agent："帮我买那把量子之剑"，剩下的事情全部自动完成——跨链支付、卖家收款、NFT 交付，一气呵成。

## 核心创新

### 1. AI 驱动的购物体验

买家不需要理解区块链的复杂性。AI Agent 会：
- 自动发现并浏览商品
- 与卖家 Agent 进行价格协商
- 准备跨链交易参数
- 实时展示交易进度

### 2. ZetaChain 跨链结算

利用 ZetaChain 的 Universal App 架构，实现了真正的原子化跨链交易：

```
买家 (Base)           ZetaChain              卖家 (Base) + NFT (Polygon)
   |                      |                         |
   | 1. 付款 USDC         |                         |
   |--------------------->|                         |
   |                      | 2. 转账给卖家            |
   |                      |------------------------>|
   |                      | 3. 释放 NFT 给买家       |
   |<-------------------------------------------------|
   |                      |                    收到 NFT
```

三条链的操作在一次交易中完成，要么全部成功，要么全部回滚。

### 3. 无需信任的托管机制

NFT 由智能合约托管，只有在收到跨链消息后才会释放。卖家和买家都不需要信任对方——代码即法律。

## 技术架构

### 智能合约

| 合约 | 链 | 功能 |
|------|-----|------|
| UniversalMarket | ZetaChain Athens | 核心协调合约，处理跨链消息 |
| WeaponEscrow | Polygon Amoy | NFT 托管合约 |
| MockWeaponNFT | Polygon Amoy | 示例 NFT 合约 |

### 已部署地址 (Testnet)

- **MockWeaponNFT**: `0xE0EFF1C50040d7Fbcd56F5f0fcFCBad751c07c57` (Polygon Amoy)
- **WeaponEscrow**: `0x0BAD4C5E163A7f2831bDB83Eaf48DaD2B472906c` (Polygon Amoy)
- **UniversalMarket**: `0xE0EFF1C50040d7Fbcd56F5f0fcFCBad751c07c57` (ZetaChain Athens)

## 快速体验

### 环境要求

- Node.js >= 18
- pnpm

### 安装

```bash
pnpm install
```

### 运行演示

```bash
# 启动市场前端
pnpm market:dev

# 打开 http://localhost:3001
```

在界面右侧的 Agent 面板中：
1. 选择运行模式（模拟 / Testnet）
2. 点击「启动 Agent」
3. 观看 AI Agent 自动完成购物流程

### 模式说明

- **模拟模式**：无需真实资金，快速展示完整流程
- **Testnet 模式**：使用真实测试网进行跨链交易（需要配置私钥和测试代币）

## 项目结构

```
├── contracts/              # 智能合约
│   ├── zevm/              # ZetaChain 合约
│   └── polygon/           # Polygon 合约
├── apps/
│   ├── market/            # 市场前端 (Next.js)
│   ├── agent/             # Buyer hub (LangChain)
│   └── seller-agent/      # Seller agents (HTTP)
└── scripts/               # 部署和演示脚本
```

## 相关链接

- [ZetaChain 文档](https://www.zetachain.com/docs)
- [ZetaChain Explorer](https://athens.explorer.zetachain.com)

## License

MIT
