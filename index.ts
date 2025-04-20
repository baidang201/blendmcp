import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ethers, JsonRpcProvider, Signer, Contract} from "ethers";

// Create an MCP server
const server = new McpServer({
  name: "BlendMCP",
  version: "1.0.0"
});

// Pool合约 ABI
const POOL_ABI = [
  // 存款相关
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external",
  "function withdraw(address asset, uint256 amount, address to) external returns (uint256)",
  // 借款相关
  "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external",
  "function repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf) external returns (uint256)",
  // 清算相关
  "function liquidationCall(address collateralAsset, address debtAsset, address user, uint256 debtToCover, bool receiveAToken) external",
  // 查询功能
  "function getUserAccountData(address user) external view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)"
];

// ERC20 ABI
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

// 支持的Token配置
interface TokenConfig {
  symbol: string;
  address: string;
  decimals: number;
}

const SUPPORTED_TOKENS: { [key: string]: TokenConfig } = {
  USDT: {
    symbol: 'USDT',
    address: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
    decimals: 6
  },
  DAI: {
    symbol: 'DAI', 
    address: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
    decimals: 18
  },
  USDC: {
    symbol: 'USDC',
    address: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6', 
    decimals: 6
  },
  WETH: {
    symbol: 'WETH',
    address: '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
    decimals: 18
  },
  WBTC: {
    symbol: 'WBTC',
    address: '0x610178dA211FEF7D417bC0e6FeD39F05609AD788',
    decimals: 8
  },
  BLEND: {
    symbol: 'BLEND',
    address: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',
    decimals: 18
  }
};

// 合约地址配置
const POOL_ADDRESS = "0xDC17C27Ae8bE831AF07CC38C02930007060020F4";

const YOUR_RPC_URL = "http://localhost:8545";

// 辅助函数 - 根据token获取精度
function getTokenDecimals(symbol: string): number {
  return SUPPORTED_TOKENS[symbol]?.decimals || 18;
}

// 辅助函数 - 根据token获取地址
function getTokenAddress(symbol: string): string {
  return SUPPORTED_TOKENS[symbol]?.address;
}

// Provider 和合约实例
let provider: JsonRpcProvider;
let signer: Signer;
let poolContract: Contract;
let wethContract: Contract;
let usdcContract: Contract;

// 初始化以太坊连接
async function initEthers() {
  try {
    provider = new JsonRpcProvider(YOUR_RPC_URL);
    signer = await provider.getSigner();
    poolContract = new Contract(POOL_ADDRESS, POOL_ABI, signer);
    wethContract = new Contract(getTokenAddress('WETH'), ERC20_ABI, signer);
    usdcContract = new Contract(getTokenAddress('USDC'), ERC20_ABI, signer);
  } catch (error) {
    console.error("初始化以太坊连接失败:", error);
  }
}

// 初始化ethers
initEthers();

// 存款工具
server.tool("supply",
  {
    token: z.enum(['USDT', 'DAI', 'USDC', 'WETH', 'WBTC', 'BLEND']),
    amount: z.string(),
    onBehalfOf: z.string().optional()
  },
  async ({ token, amount, onBehalfOf }) => {
    try {
      const tokenConfig = SUPPORTED_TOKENS[token];
      const tokenContract = new Contract(tokenConfig.address, ERC20_ABI, signer);
      const userAddress = await signer.getAddress();
      const targetAddress = onBehalfOf || userAddress;
      
      // 检查授权
      const allowance = await tokenContract.allowance(userAddress, POOL_ADDRESS);
      if (allowance < ethers.parseUnits(amount, tokenConfig.decimals)) {
        const approveTx = await tokenContract.approve(POOL_ADDRESS, ethers.MaxUint256);
        await approveTx.wait();
      }
      
      // 执行存款
      const tx = await poolContract.supply(
        tokenConfig.address,
        ethers.parseUnits(amount, tokenConfig.decimals),
        targetAddress,
        0
      );
      const receipt = await tx.wait();
      
      return {
        content: [{
          type: "text",
          text: `存款成功!\n交易哈希: ${receipt.hash}\n存入: ${amount} ${token}`
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      return {
        content: [{
          type: "text",
          text: `存款失败: ${errorMessage}`
        }]
      };
    }
  }
);

// 借款工具
server.tool("borrow",
  {
    token: z.enum(['USDT', 'DAI', 'USDC', 'WETH', 'WBTC', 'BLEND']),
    amount: z.string(),
    interestRateMode: z.number().min(1).max(2).describe('1=稳定利率, 2=浮动利率'),
    onBehalfOf: z.string().optional()
  },
  async ({ token, amount, interestRateMode, onBehalfOf }) => {
    try {
      const tokenConfig = SUPPORTED_TOKENS[token];
      const userAddress = await signer.getAddress();
      const targetAddress = onBehalfOf || userAddress;
      
      const tx = await poolContract.borrow(
        tokenConfig.address,
        ethers.parseUnits(amount, tokenConfig.decimals),
        interestRateMode,
        0,
        targetAddress
      );
      const receipt = await tx.wait();
      
      return {
        content: [{
          type: "text",
          text: `借款成功!\n交易哈希: ${receipt.hash}\n借出: ${amount} ${token}\n利率模式: ${interestRateMode === 1 ? '稳定' : '浮动'}`
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      return {
        content: [{
          type: "text",
          text: `借款失败: ${errorMessage}`
        }]
      };
    }
  }
);

// 还款工具
server.tool("repay",
  {
    token: z.enum(['USDT', 'DAI', 'USDC', 'WETH', 'WBTC', 'BLEND']),
    amount: z.string(),
    rateMode: z.number().min(1).max(2).describe('1=稳定利率, 2=浮动利率'),
    onBehalfOf: z.string().optional()
  },
  async ({ token, amount, rateMode, onBehalfOf }) => {
    try {
      const tokenConfig = SUPPORTED_TOKENS[token];
      const tokenContract = new Contract(tokenConfig.address, ERC20_ABI, signer);
      const userAddress = await signer.getAddress();
      const targetAddress = onBehalfOf || userAddress;
      
      // 检查授权
      const allowance = await tokenContract.allowance(userAddress, POOL_ADDRESS);
      if (allowance < ethers.parseUnits(amount, tokenConfig.decimals)) {
        const approveTx = await tokenContract.approve(POOL_ADDRESS, ethers.MaxUint256);
        await approveTx.wait();
      }
      
      const tx = await poolContract.repay(
        tokenConfig.address,
        ethers.parseUnits(amount, tokenConfig.decimals),
        rateMode,
        targetAddress
      );
      const receipt = await tx.wait();
      
      return {
        content: [{
          type: "text",
          text: `还款成功!\n交易哈希: ${receipt.hash}\n还款: ${amount} ${token}`
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      return {
        content: [{
          type: "text",
          text: `还款失败: ${errorMessage}`
        }]
      };
    }
  }
);

// 提款工具
server.tool("withdraw",
  {
    token: z.enum(['USDT', 'DAI', 'USDC', 'WETH', 'WBTC', 'BLEND']),
    amount: z.string(),
    to: z.string().optional()
  },
  async ({ token, amount, to }) => {
    try {
      const tokenConfig = SUPPORTED_TOKENS[token];
      const userAddress = await signer.getAddress();
      const targetAddress = to || userAddress;
      
      const tx = await poolContract.withdraw(
        tokenConfig.address,
        ethers.parseUnits(amount, tokenConfig.decimals),
        targetAddress
      );
      const receipt = await tx.wait();
      
      return {
        content: [{
          type: "text",
          text: `提款成功!\n交易哈希: ${receipt.hash}\n提取: ${amount} ${token}`
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      return {
        content: [{
          type: "text",
          text: `提款失败: ${errorMessage}`
        }]
      };
    }
  }
);

// 清算工具
server.tool("liquidate",
  {
    collateralToken: z.enum(['USDT', 'DAI', 'USDC', 'WETH', 'WBTC', 'BLEND']),
    debtToken: z.enum(['USDT', 'DAI', 'USDC', 'WETH', 'WBTC', 'BLEND']),
    user: z.string(),
    debtToCover: z.string(),
    receiveAToken: z.boolean()
  },
  async ({ collateralToken, debtToken, user, debtToCover, receiveAToken }) => {
    try {
      const debtTokenConfig = SUPPORTED_TOKENS[debtToken];
      const collateralTokenConfig = SUPPORTED_TOKENS[collateralToken];
      const tokenContract = new Contract(debtTokenConfig.address, ERC20_ABI, signer);
      const userAddress = await signer.getAddress();
      
      // 检查授权
      const allowance = await tokenContract.allowance(userAddress, POOL_ADDRESS);
      if (allowance < ethers.parseUnits(debtToCover, debtTokenConfig.decimals)) {
        const approveTx = await tokenContract.approve(POOL_ADDRESS, ethers.MaxUint256);
        await approveTx.wait();
      }
      
      const tx = await poolContract.liquidationCall(
        collateralTokenConfig.address,
        debtTokenConfig.address,
        user,
        ethers.parseUnits(debtToCover, debtTokenConfig.decimals),
        receiveAToken
      );
      const receipt = await tx.wait();
      
      return {
        content: [{
          type: "text",
          text: `清算成功!\n交易哈希: ${receipt.hash}\n清算金额: ${debtToCover} ${debtToken}\n抵押品: ${collateralToken}`
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      return {
        content: [{
          type: "text",
          text: `清算失败: ${errorMessage}`
        }]
      };
    }
  }
);

// 查询用户状态资源
server.resource(
  "userStatus",
  new ResourceTemplate("blend://user/{address}", { list: undefined }),
  async (uri, { address }) => {
    try {
      const {
        totalCollateralETH,
        totalDebtETH,
        availableBorrowsETH,
        currentLiquidationThreshold,
        ltv,
        healthFactor
      } = await poolContract.getUserAccountData(address);
      
      return {
        contents: [{
          uri: uri.href,
          text: `用户状态:\n` +
                `总抵押品价值(ETH): ${ethers.formatUnits(totalCollateralETH, 18)}\n` +
                `总债务(ETH): ${ethers.formatUnits(totalDebtETH, 18)}\n` +
                `可借额度(ETH): ${ethers.formatUnits(availableBorrowsETH, 18)}\n` +
                `清算阈值: ${currentLiquidationThreshold}\n` +
                `抵押率: ${ltv}\n` +
                `健康因子: ${ethers.formatUnits(healthFactor, 18)}`
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      return {
        contents: [{
          uri: uri.href,
          text: `获取用户状态失败: ${errorMessage}`
        }]
      };
    }
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);