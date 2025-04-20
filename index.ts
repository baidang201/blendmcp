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

// 合约地址配置
const POOL_ADDRESS = "YOUR_POOL_ADDRESS";
const WETH_ADDRESS = "YOUR_WETH_ADDRESS";
const USDC_ADDRESS = "YOUR_USDC_ADDRESS";

// Provider 和合约实例
let provider: JsonRpcProvider;
let signer: Signer;
let poolContract: Contract;
let wethContract: Contract;
let usdcContract: Contract;

// 初始化以太坊连接
async function initEthers() {
  try {
    provider = new JsonRpcProvider("YOUR_RPC_URL");
    signer = await provider.getSigner();
    poolContract = new Contract(POOL_ADDRESS, POOL_ABI, signer);
    wethContract = new Contract(WETH_ADDRESS, ERC20_ABI, signer);
    usdcContract = new Contract(USDC_ADDRESS, ERC20_ABI, signer);
  } catch (error) {
    console.error("初始化以太坊连接失败:", error);
  }
}

// 初始化ethers
initEthers();

// 存款工具
server.tool("supply",
  {
    asset: z.string(),
    amount: z.string(),
    onBehalfOf: z.string().optional()
  },
  async ({ asset, amount, onBehalfOf }) => {
    try {
      const tokenContract = new Contract(asset, ERC20_ABI, signer);
      const userAddress = await signer.getAddress();
      const targetAddress = onBehalfOf || userAddress;
      
      // 检查授权
      const allowance = await tokenContract.allowance(userAddress, POOL_ADDRESS);
      if (allowance < ethers.parseUnits(amount, 18)) {
        const approveTx = await tokenContract.approve(POOL_ADDRESS, ethers.MaxUint256);
        await approveTx.wait();
      }
      
      // 执行存款
      const tx = await poolContract.supply(asset, ethers.parseUnits(amount, 18), targetAddress, 0);
      const receipt = await tx.wait();
      
      return {
        content: [{
          type: "text",
          text: `存款成功!\n交易哈希: ${receipt.hash}\n存入金额: ${amount}`
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
    asset: z.string(),
    amount: z.string(),
    interestRateMode: z.number().min(1).max(2),
    onBehalfOf: z.string().optional()
  },
  async ({ asset, amount, interestRateMode, onBehalfOf }) => {
    try {
      const userAddress = await signer.getAddress();
      const targetAddress = onBehalfOf || userAddress;
      
      const tx = await poolContract.borrow(
        asset,
        ethers.parseUnits(amount, 18),
        interestRateMode,
        0,
        targetAddress
      );
      const receipt = await tx.wait();
      
      return {
        content: [{
          type: "text",
          text: `借款成功!\n交易哈希: ${receipt.hash}\n借款金额: ${amount}\n利率模式: ${interestRateMode === 1 ? '稳定' : '浮动'}`
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
    asset: z.string(),
    amount: z.string(),
    rateMode: z.number().min(1).max(2),
    onBehalfOf: z.string().optional()
  },
  async ({ asset, amount, rateMode, onBehalfOf }) => {
    try {
      const tokenContract = new Contract(asset, ERC20_ABI, signer);
      const userAddress = await signer.getAddress();
      const targetAddress = onBehalfOf || userAddress;
      
      // 检查授权
      const allowance = await tokenContract.allowance(userAddress, POOL_ADDRESS);
      if (allowance < ethers.parseUnits(amount, 18)) {
        const approveTx = await tokenContract.approve(POOL_ADDRESS, ethers.MaxUint256);
        await approveTx.wait();
      }
      
      const tx = await poolContract.repay(
        asset,
        ethers.parseUnits(amount, 18),
        rateMode,
        targetAddress
      );
      const receipt = await tx.wait();
      
      return {
        content: [{
          type: "text",
          text: `还款成功!\n交易哈希: ${receipt.hash}\n还款金额: ${amount}`
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
    asset: z.string(),
    amount: z.string(),
    to: z.string().optional()
  },
  async ({ asset, amount, to }) => {
    try {
      const userAddress = await signer.getAddress();
      const targetAddress = to || userAddress;
      
      const tx = await poolContract.withdraw(
        asset,
        ethers.parseUnits(amount, 18),
        targetAddress
      );
      const receipt = await tx.wait();
      
      return {
        content: [{
          type: "text",
          text: `提款成功!\n交易哈希: ${receipt.hash}\n提取金额: ${amount}`
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
    collateralAsset: z.string(),
    debtAsset: z.string(),
    user: z.string(),
    debtToCover: z.string(),
    receiveAToken: z.boolean()
  },
  async ({ collateralAsset, debtAsset, user, debtToCover, receiveAToken }) => {
    try {
      const tokenContract = new Contract(debtAsset, ERC20_ABI, signer);
      const userAddress = await signer.getAddress();
      
      // 检查授权
      const allowance = await tokenContract.allowance(userAddress, POOL_ADDRESS);
      if (allowance < ethers.parseUnits(debtToCover, 18)) {
        const approveTx = await tokenContract.approve(POOL_ADDRESS, ethers.MaxUint256);
        await approveTx.wait();
      }
      
      const tx = await poolContract.liquidationCall(
        collateralAsset,
        debtAsset,
        user,
        ethers.parseUnits(debtToCover, 18),
        receiveAToken
      );
      const receipt = await tx.wait();
      
      return {
        content: [{
          type: "text",
          text: `清算成功!\n交易哈希: ${receipt.hash}\n清算金额: ${debtToCover}`
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