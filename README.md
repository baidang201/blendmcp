#### deploy blend-contract testnet
cd blend-contract
vim .env
```
PRIVATE_KEY=0x01xxx
MARKET_NAME=Commons
```
yarn
npx hardhat node

#### run mcp serve

yarn

yarn build && npx @modelcontextprotocol/inspector node dist/index.js

##### addLiquidity
![alt text](image-2.png)
##### tokenToEthSwap
![alt text](image-1.png)
##### resource pool
![alt text](image.png)