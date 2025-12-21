# Scripts 使用指南

本目录包含部署、测试和维护 Universal AI Market 的各种脚本。

## 目录结构

```
scripts/
├── deploy/          # 部署脚本
├── utils/           # 工具脚本
└── demo/            # 演示脚本
```

---

## 🚀 部署脚本 (deploy/)

### setup_demo.ts
**用途**: 一键设置演示环境（MockWeaponNFT + UniversalEscrow + mint + deposit）

```bash
npx hardhat run scripts/deploy/setup_demo.ts --network polygon_amoy
```

| 参数 | 说明 |
|------|------|
| 无需修改 | 自动从 .env 读取配置 |

**运行时机**: 首次部署或需要重新部署演示环境时
**运行次数**: 通常只需 1 次
**输出**: 会打印合约地址，需要手动添加到 `.env`

---

### deploy_escrow.ts
**用途**: 只部署 UniversalEscrow 合约（可用于任意 EVM 链）

```bash
npx hardhat run scripts/deploy/deploy_escrow.ts --network polygon_amoy
npx hardhat run scripts/deploy/deploy_escrow.ts --network base_sepolia
```

**运行时机**: 卖家需要在新链上托管 NFT 时
**运行次数**: 每条链部署 1 次
**输出**: UniversalEscrow 合约地址

---

### deploy_zetachain.ts
**用途**: 部署 ZetaChain 上的 UniversalMarket 合约

```bash
npx hardhat run scripts/deploy/deploy_zetachain.ts --network zetaAthens
```

| 环境变量 | 必需 | 说明 |
|----------|------|------|
| ZETA_GATEWAY_ZEVM_ADDRESS | ✅ | ZetaChain Gateway 地址 |
| POLYGON_GAS_ZRC20 | ✅ | POL ZRC-20 地址 |
| DEPLOYER_PRIVATE_KEY | ✅ | 部署者私钥 |

**运行时机**: 首次部署或修改合约代码后
**运行次数**: 每次合约更新需重新部署
**输出**: 新的 ZETA_UNIVERSAL_MARKET 地址

---

### deploy_local.ts
**用途**: 本地开发环境部署（使用 localnet）

```bash
npx hardhat run scripts/deploy/deploy_local.ts --network localhost
```

**运行时机**: 本地开发测试时
**前置条件**: 需要先运行 `npx @zetachain/localnet start`

---

## 🔧 工具脚本 (utils/)

### check_balances.ts ⭐ 常用
**用途**: 检查所有相关地址的余额状态

```bash
npx ts-node scripts/utils/check_balances.ts
```

**检查内容**:
- Buyer/Seller 的 USDC 余额（Base Sepolia）
- UniversalMarket 的 POL/ETH/USDC ZRC-20 余额（ZetaChain）
- NFT 持有者状态（Polygon Amoy）

**运行时机**: 随时，用于检查当前状态
**运行次数**: 不限

---

### fund_market_eth.ts
**用途**: 将 ETH.BASESEP ZRC-20 转给 UniversalMarket（用于支付 withdraw 到 Base 的 gas）

```bash
npx ts-node scripts/utils/fund_market_eth.ts
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| transferAmount | 0.001 ETH | 修改脚本中的 `transferAmount` 变量 |

**运行时机**: 部署新 Market 合约后，或 Market 的 ETH.BASESEP 余额不足时
**运行次数**: 按需
**前置条件**: Deployer 需要有 ETH.BASESEP ZRC-20（可通过 swap_zeta_to_eth.ts 获取）

---

### fund_market.ts
**用途**: 将 POL ZRC-20 转给 UniversalMarket（用于支付 call Polygon 的 gas）

```bash
npx ts-node scripts/utils/fund_market.ts
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| amount | 0.015 POL | 修改脚本中的 `amount` 变量 |

**运行时机**: 部署新 Market 合约后，或 Market 的 POL ZRC-20 余额不足时
**运行次数**: 按需
**前置条件**: Deployer 需要有 POL ZRC-20

---

### reset_demo.ts ⭐ 常用
**用途**: 重置演示状态（将 NFT 转回 Escrow，USDC 转回 Buyer）

```bash
npx ts-node scripts/utils/reset_demo.ts
```

**操作内容**:
1. 将 Seller 的 USDC 转回 Buyer（需要 Seller 有 Base ETH）
2. 将 Buyer 的 NFT 转回 Escrow（需要 Buyer 有 Polygon POL）
3. 检查并补充 Market 的 POL ZRC-20

**运行时机**: 完成一次演示后，想要重置状态继续测试
**运行次数**: 每次演示后
**注意**: 需要各账户有足够的原生代币支付 gas

---

### encodeDeal.ts
**用途**: 编码 Deal 数据（调试用）

```bash
npx ts-node scripts/utils/encodeDeal.ts
```

**运行时机**: 调试跨链消息编码时

---

## 📋 完整部署流程

### 首次部署到 Testnet

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env，填入私钥和地址

# 2. 部署演示环境（NFT + Escrow + mint + deposit）
npx hardhat run scripts/deploy/setup_demo.ts --network polygon_amoy
# 将输出的地址添加到 .env

# 3. 部署 ZetaChain 合约
npx hardhat run scripts/deploy/deploy_zetachain.ts --network zetaAthens
# 将输出的地址添加到 .env

# 4. 给 Market 充值 gas tokens（需要先获取 ZRC-20）
# 可通过 ZetaChain Faucet 或手动跨链桥获取 POL/ETH ZRC-20
npx ts-node scripts/utils/fund_market.ts      # POL ZRC-20
npx ts-node scripts/utils/fund_market_eth.ts  # ETH.BASESEP ZRC-20

# 5. 检查状态
npx ts-node scripts/utils/check_balances.ts
```

### 日常测试流程

```bash
# 测试前检查
npx ts-node scripts/utils/check_balances.ts

# 测试后重置
npx ts-node scripts/utils/reset_demo.ts

# 如果 Market gas 不足，补充
npx ts-node scripts/utils/fund_market.ts
npx ts-node scripts/utils/fund_market_eth.ts
```

---

## ⚠️ 常见问题

### Q: `InsufficientGasToken` 错误
**原因**: UniversalMarket 的 ZRC-20 gas token 不足
**解决**:
```bash
npx ts-node scripts/utils/check_balances.ts  # 检查哪个不足
npx ts-node scripts/utils/fund_market.ts     # 补充 POL
npx ts-node scripts/utils/fund_market_eth.ts # 补充 ETH
```
