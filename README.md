# BlendMCP

BlendMCP 是一个基于 Model Context Protocol (MCP) 实现的 Blend 协议交互服务。它提供了一套完整的接口，用于与 Blend 借贷协议进行交互。

## 主要功能

- **存款(Supply)**: 支持用户向协议存入各种代币作为抵押品
- **借款(Borrow)**: 允许用户基于其抵押品借出其他代币
- **还款(Repay)**: 用于偿还已借出的代币
- **提款(Withdraw)**: 允许用户提取其存入的代币
- **清算(Liquidate)**: 支持清算健康因子低于阈值的不健康头寸
- **状态查询**: 查看用户的抵押品价值、债务情况、健康因子等信息

## 支持的代币

- USDT (精度: 6)
- DAI (精度: 18)
- USDC (精度: 6)
- WETH (精度: 18)
- WBTC (精度: 8)
- BLEND (精度: 18)

## 部署指南

### 部署 blend-contract 测试网

```bash
git clone https://github.com/Blend-Blend/blend-contract.git
cd blend-contract
vim .env
```

配置环境变量:
```
PRIVATE_KEY=0x01xxx
MARKET_NAME=Commons
```


安装依赖并启动本地节点:
```bash
yarn
npx hardhat node
```

### 运行 MCP 服务

安装依赖:
```bash
yarn
```

更新SUPPORTED_TOKENS, POOL_ADDRESS 合约地址

构建并启动服务:
```bash
yarn build && npx @modelcontextprotocol/inspector node dist/index.js
```

## 接口说明

### 存款(Supply)
用于向协议存入代币。
- 参数:
  - token: 代币类型(USDT/DAI/USDC/WETH/WBTC/BLEND)
  - amount: 存款金额
  - onBehalfOf: (可选)接收存款的地址

### 借款(Borrow)
用于从协议借出代币。
- 参数:
  - token: 代币类型
  - amount: 借款金额
  - interestRateMode: 利率模式(1=稳定利率, 2=浮动利率)
  - onBehalfOf: (可选)接收借款的地址

### 还款(Repay)
用于偿还借出的代币。
- 参数:
  - token: 代币类型
  - amount: 还款金额
  - rateMode: 利率模式(1=稳定利率, 2=浮动利率)
  - onBehalfOf: (可选)还款目标地址

### 提款(Withdraw)
用于提取存入的代币。
- 参数:
  - token: 代币类型
  - amount: 提款金额
  - to: (可选)接收提款的地址

### 清算(Liquidate)
用于清算不健康头寸。
- 参数:
  - collateralToken: 抵押品代币类型
  - debtToken: 债务代币类型
  - user: 被清算用户地址
  - debtToCover: 清算的债务金额
  - receiveAToken: 是否接收 aToken

### 用户状态查询
查询用户在协议中的状态信息。
- 返回信息:
  - 总抵押品价值(ETH)
  - 总债务(ETH)
  - 可借额度(ETH)
  - 清算阈值
  - 抵押率
  - 健康因子