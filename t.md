# 用 TypeScript 开发 Uniswap MCP 服务：打造你的 AI 驱动 DeFi 助手
## 引言
在 AI 与区块链技术快速融合的今天，Model Context Protocol (MCP) 为 AI 模型提供了与外部工具和服务交互的能力。本文将带你一步步实现一个基于 Uniswap V1 的 MCP 服务，让 AI 助手能够直接帮你进行 DeFi 操作，如添加流动性和代币交换。

通过这个项目，你将学习如何将区块链功能与 AI 模型无缝集成，打造一个智能的 DeFi 助手。无论你是区块链开发者还是 AI 爱好者，这个教程都将为你展示两个前沿技术的强大组合。

让我们开始这段有趣的旅程，探索 AI 如何成为你的 DeFi 操作助手！

## 1 确认环境
node v21.7.3

## 2 准备VSCode
1 uniswap 本地精简版代码 http://github.com/baidang201/uniswap-V1

## 3 创建mcp服务项目目录
```bash
mkdir swapmcp && cd swapmcp
npm init -y
```

## 4 安装依赖
```bash
npm install @modelcontextprotocol/sdk ethers zod

npm install --save-dev typescript @types/node shx
```

## 5 创建一个具有以下配置的 tsconfig.json 文件：
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": [
    "./**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

## 6 确认package.json内容如下
```json
{
  "name": "swapmcp",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "type": "module",
  "bin": {
    "mcp-server-swap": "dist/index.js"
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsc && shx chmod +x dist/*.js",
    "prepare": "npm run build",
    "watch": "tsc --watch"
  },
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.9.0",
    "ethers": "6.13.1"
  },
  "devDependencies": {
    "@types/node": "^22",
    "shx": "^0.3.4",
    "typescript": "^5.3.3"
  }
}

```

## 7 创建index.ts
touch index.ts

## 8 导入依赖

```ts
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ethers, JsonRpcProvider, Signer, Contract} from "ethers";
```
## 9 定义常量和初始化evm代码

```ts

// 合约ABI - 简化版仅包含我们需要使用的函数
const EXCHANGE_ABI = [
  "function addLiquidity(uint256 amountOfToken) public payable returns (uint256)",
  "function tokenToEthSwap(uint256 tokensToSwap, uint256 minEthToReceive) public",
  "function getReserve() public view returns (uint256)"
];

// 合约地址 - 这里需要替换为你的实际部署地址
const EXCHANGE_ADDRESS = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";
const TOKEN_ADDRESS = "0x5fbdb2315678afecb367f032d93f642f64180aa3";

// ERC20 ABI
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

// 设置provider和signer
let provider: ethers.JsonRpcProvider;
let signer: Signer;
let exchangeContract: Contract;
let tokenContract: Contract;

// 初始化以太坊连接
async function initEthers() {
  try {
    provider = new ethers.JsonRpcProvider("http://localhost:8545"); // 本地开发环境，实际使用时替换为你的RPC URL
    signer = await provider.getSigner();
    exchangeContract = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
    tokenContract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signer);
  } catch (error) {
    console.error("初始化以太坊连接失败:", error);
  }
}

// 初始化ethers
initEthers();
```

## 10 创建MCP服务
```ts
// Create an MCP server
const server = new McpServer({
  name: "UniswapMCP",
  version: "1.0.0"
});
```

## 11 创建tools,用于增加流动性和交换代码 addLiquidity/tokenToEthSwap
```ts
// Add liquidity tool
server.tool("addLiquidity",
  {
    amountOfToken: z.string(), // ethers.js使用字符串处理大整数
    ethAmount: z.string()
  },
  async ({ amountOfToken, ethAmount }) => {
    try {
      // 检查token授权
      const userAddress = await signer.getAddress();
      const allowance = await tokenContract.allowance(userAddress, EXCHANGE_ADDRESS);
      
      if (allowance < ethers.parseUnits(amountOfToken, 18)) {
        // 如果授权不足，先进行授权
        const approveTx = await tokenContract.approve(
          EXCHANGE_ADDRESS, 
          ethers.parseUnits(amountOfToken, 18)
        );
        await approveTx.wait();
      }
      
      // 添加流动性
      const tx = await exchangeContract.addLiquidity(
        ethers.parseUnits(amountOfToken, 18),
        { value: ethers.parseUnits(ethAmount, 18) }
      );
      
      const receipt = await tx.wait();
      
      return {
        content: [{ 
          type: "text", 
          text: `成功添加流动性! 交易哈希: ${receipt.hash}\n添加了 ${ethAmount} ETH 和 ${amountOfToken} Token`
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      return {
        content: [{ 
          type: "text", 
          text: `添加流动性失败: ${errorMessage}`
        }]
      };
    }
  }
);

// Token 换 ETH 工具
server.tool("tokenToEthSwap",
  {
    tokensToSwap: z.string(),
    minEthToReceive: z.string()
  },
  async ({ tokensToSwap, minEthToReceive }) => {
    try {
      // 检查token授权
      const userAddress = await signer.getAddress();
      const allowance = await tokenContract.allowance(userAddress, EXCHANGE_ADDRESS);
      
      if (allowance < ethers.parseUnits(tokensToSwap, 18)) {
        // 如果授权不足，先进行授权
        const approveTx = await tokenContract.approve(
          EXCHANGE_ADDRESS, 
          ethers.parseUnits(tokensToSwap, 18)
        );
        await approveTx.wait();
      }
      
      // Token 换 ETH
      const tx = await exchangeContract.tokenToEthSwap(
        ethers.parseUnits(tokensToSwap, 18),
        ethers.parseUnits(minEthToReceive, 18)
      );
      
      const receipt = await tx.wait();
      
      return {
        content: [{ 
          type: "text", 
          text: `Token 换 ETH 成功! 交易哈希: ${receipt.hash}\n使用 ${tokensToSwap} Token 交换了 ETH` 
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      return {
        content: [{ 
          type: "text", 
          text: `Token 换 ETH 失败: ${errorMessage}` 
        }]
      };
    }
  }
);

```

## 12 定义资源,用于查看池子的token数量
```ts
// Query current liquidity resource
server.resource(
  "liquidity",
  new ResourceTemplate("liquidity://pool//{address}", { list: undefined }),
  async (uri, { address }) => {
    try {
      const reserve = await exchangeContract.getReserve();
      const ethBalance = await provider.getBalance(EXCHANGE_ADDRESS);
      
      return {
        contents: [{
          uri: uri.href,
          text: `当前池子状态:\nToken 余额: ${ethers.formatUnits(reserve, 18)}\nETH 余额: ${ethers.formatUnits(ethBalance, 18)}`
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      return {
        contents: [{
          uri: uri.href,
          text: `获取流动性信息失败: ${errorMessage}`
        }]
      };
    }
  }
);

```

## 13 初始化服务器

```ts
// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
```

### MCP 的 stdio 和 SSE 模式简介
在 Model Context Protocol (MCP) 中，服务器与客户端之间的通信有两种主要模式：stdio 模式和 SSE (Server-Sent Events) 模式。这两种模式各有特点和适用场景，下面我将为大家详细介绍。

#### stdio 模式
stdio（标准输入输出）模式是 MCP 服务器最基本的通信方式，它通过标准输入和标准输出流进行数据交换。

##### 特点
1. 简单直接 ：直接使用进程的标准输入和输出通道
2. 本地运行 ：通常在本地环境中运行，AI 模型直接与本地 MCP 服务通信
3. 权限较高 ：因为在本地运行，可以访问本地资源和执行本地操作
4. 适合开发和测试 ：便于快速开发和调试
##### 使用场景
- 本地开发和测试
- 个人使用的工具和助手
- 需要访问本地资源的应用（如文件系统、本地区块链节点等）

#### SSE 模式
SSE (Server-Sent Events) 模式是一种基于 HTTP 的单向通信技术，允许服务器向客户端推送数据。在 MCP 中，SSE 模式使服务器可以通过网络提供服务。

##### 特点
1. 网络可访问 ：可以部署到服务器上，通过网络提供服务
2. 多用户支持 ：可以同时服务多个客户端
3. 会话共享问题 ：默认情况下，所有连接到同一 MCP 服务器的用户可能共享同一进程
4. 权限控制 ：通常需要实现授权机制，确保安全访问
5. 适合生产环境 ：可以作为公共服务提供给多个用户
##### 使用场景
- 公共服务和 API
- 多用户应用
- 需要通过网络访问的服务
- 生产环境部署
#### 两种模式的安全考虑
##### stdio 模式安全注意事项
1. 高权限风险 ：stdio 模式运行的 MCP 服务器具有与启动它的用户相同的权限
2. 来源可信 ：只安装来源可靠的 MCP 服务器
3. 代码审查 ：使用前应审查 MCP 服务器的代码，了解其行为
##### SSE 模式安全注意事项
1. 授权机制 ：实现适当的授权机制，确保只有授权用户能访问服务
2. 用户隔离 ：考虑如何隔离不同用户的会话和数据
3. 网络安全 ：使用 HTTPS 加密通信，防止数据被窃听
4. 资源限制 ：实施资源限制，防止滥用

## 14 部署uniswap本地测试环境
```bash
git clone https://github.com/baidang201/Uniswap-V1
cd Uniswap-V1
yarn
npx hardhat node
运行"node deploy"  或者 "npm run test" 部署uniswap的token和swap合约，获取最新的合约地址。
替换index.ts的合约常量
```

```ts
const EXCHANGE_ADDRESS = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";
const TOKEN_ADDRESS = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
```

## 15 启动mcp服务本地调试 
其中@modelcontextprotocol/inspector是mcp本地调试工具
```bash
npm install
npx build && build && npx @modelcontextprotocol/inspector node dist/index.js
```

##### 增加流动性
![alt text](image-2.png)
##### 交换token
![alt text](image-1.png)
##### 查看池子token数量
![alt text](image.png)

## 16 MCP服务本体调试通过了
接下来大家可以部署到公网玩耍拉。也可以结合其他MCP Client工具使用，比如Claude Desktop/Cline/Cherry Studio

## 17 完整代码
https://github.com/baidang201/swapmcp

## 18 注意事项
1. MCP Server 的 权限极大（尤其是 stdio 模式），他是一个你本地运行起来的 stdio 程序。所以，安装之前一定要 **慎重，慎重，慎重，**不要安装来历不明的 MCP Server.
2. 尽可能的确认 MCP Server 的每一步操作，明白他在做什么
3. SSE 模式的授权，一般是网页跳转，一定要留意跳转过程中发生的事情。在跳转过程中，谨慎连接其他的浏览器扩展。  
3. SSE 模式存在一个 会话共享的问题，这个是需要开发者需要注意的，即 所有连接到 MCP Sevrver 的用户很有可能是共享了一个进程的。所以，需要考虑好各个用户之间的隔离。

## 19 总结
通过本文，我们成功构建了一个基于 Uniswap V1 的 MCP 服务，使 AI 助手能够直接与区块链交互，执行添加流动性和代币交换等操作。这种集成不仅提高了 DeFi 操作的便捷性，也展示了 AI 与区块链技术结合的巨大潜力。

随着 MCP 协议的不断发展和完善，我们可以期待更多创新的应用场景。希望本教程能够启发你探索 AI 与区块链的更多可能性，创造出更多有价值的应用。

最后，请记住在使用 MCP 服务时注意安全问题，特别是在处理与资金相关的操作时。祝你在 AI 与区块链的融合之路上取得成功！


## 20 引用和资源
- https://github.com/modelcontextprotocol mcp协议官方账号
- https://github.com/v1xingyue/mcp-template  mcp ts项目模板
- https://github.com/punkpeye/awesome-mcp-servers mcp服务端资源
- https://github.com/punkpeye/awesome-mcp-clients mcp客户端资源