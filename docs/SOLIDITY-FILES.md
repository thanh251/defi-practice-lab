# Các file Solidity liên quan đến project

Danh sách được đối chiếu với `lib/deploy.js`, artifact Aave đã khóa phiên bản và các `import` đệ quy.

**Phân biệt:** nằm trong danh sách phụ thuộc source không có nghĩa được deploy riêng hoặc mọi hàm đều được thực thi. Project deploy Uniswap từ artifact build lại từ source local (phí 10%); Aave dùng snapshot artifact chính thức.

## Contract, library được triển khai và Pair được Factory tạo

- `contracts/FlashSwapReceiver.sol`
- `contracts/LabToken.sol`
- `vendor/solidity/aave-v3/misc/AaveOracle.sol`
- `vendor/solidity/aave-v3/misc/AaveProtocolDataProvider.sol`
- `vendor/solidity/aave-v3/mocks/oracle/PriceOracle.sol`
- `vendor/solidity/aave-v3/protocol/configuration/ACLManager.sol`
- `vendor/solidity/aave-v3/protocol/configuration/PoolAddressesProvider.sol`
- `vendor/solidity/aave-v3/protocol/libraries/logic/BorrowLogic.sol`
- `vendor/solidity/aave-v3/protocol/libraries/logic/BridgeLogic.sol`
- `vendor/solidity/aave-v3/protocol/libraries/logic/ConfiguratorLogic.sol`
- `vendor/solidity/aave-v3/protocol/libraries/logic/EModeLogic.sol`
- `vendor/solidity/aave-v3/protocol/libraries/logic/FlashLoanLogic.sol`
- `vendor/solidity/aave-v3/protocol/libraries/logic/LiquidationLogic.sol`
- `vendor/solidity/aave-v3/protocol/libraries/logic/PoolLogic.sol`
- `vendor/solidity/aave-v3/protocol/libraries/logic/SupplyLogic.sol`
- `vendor/solidity/aave-v3/protocol/pool/DefaultReserveInterestRateStrategy.sol`
- `vendor/solidity/aave-v3/protocol/pool/Pool.sol`
- `vendor/solidity/aave-v3/protocol/pool/PoolConfigurator.sol`
- `vendor/solidity/aave-v3/protocol/tokenization/AToken.sol`
- `vendor/solidity/aave-v3/protocol/tokenization/StableDebtToken.sol`
- `vendor/solidity/aave-v3/protocol/tokenization/VariableDebtToken.sol`
- `vendor/solidity/uniswap-v2-core/UniswapV2Factory.sol`
- `vendor/solidity/uniswap-v2-core/UniswapV2Pair.sol`
- `vendor/solidity/uniswap-v2-periphery/UniswapV2Router02.sol`
- `vendor/solidity/uniswap-v2-periphery/test/WETH9.sol`

`UniswapV2Pair` do Factory tạo; các proxy do provider/configurator tạo trong quá trình thiết lập, không được deploy trực tiếp bởi JavaScript.

## Toàn bộ file source trong chuỗi import

Tổng: **111 file**. Bao gồm các contract ở trên, interface, contract cơ sở, proxy, kiểu dữ liệu và thư viện hỗ trợ.

Các file Solidity được lưu trực tiếp trong `vendor/solidity/` và có trong source project. Folder vendor có 350 file của các bộ nguồn đầy đủ; dưới đây là 111 file thuộc chuỗi import liên quan đến lab, không có nghĩa tất cả được deploy riêng hoặc thực thi trong mỗi giao dịch.

- `contracts/FlashSwapReceiver.sol`
- `contracts/LabToken.sol`
- `vendor/solidity/aave-v3/dependencies/chainlink/AggregatorInterface.sol`
- `vendor/solidity/aave-v3/dependencies/gnosis/contracts/GPv2SafeERC20.sol`
- `vendor/solidity/aave-v3/dependencies/openzeppelin/contracts/AccessControl.sol`
- `vendor/solidity/aave-v3/dependencies/openzeppelin/contracts/Address.sol`
- `vendor/solidity/aave-v3/dependencies/openzeppelin/contracts/Context.sol`
- `vendor/solidity/aave-v3/dependencies/openzeppelin/contracts/ERC165.sol`
- `vendor/solidity/aave-v3/dependencies/openzeppelin/contracts/IAccessControl.sol`
- `vendor/solidity/aave-v3/dependencies/openzeppelin/contracts/IERC165.sol`
- `vendor/solidity/aave-v3/dependencies/openzeppelin/contracts/IERC20.sol`
- `vendor/solidity/aave-v3/dependencies/openzeppelin/contracts/IERC20Detailed.sol`
- `vendor/solidity/aave-v3/dependencies/openzeppelin/contracts/Ownable.sol`
- `vendor/solidity/aave-v3/dependencies/openzeppelin/contracts/SafeCast.sol`
- `vendor/solidity/aave-v3/dependencies/openzeppelin/contracts/Strings.sol`
- `vendor/solidity/aave-v3/dependencies/openzeppelin/upgradeability/BaseUpgradeabilityProxy.sol`
- `vendor/solidity/aave-v3/dependencies/openzeppelin/upgradeability/InitializableUpgradeabilityProxy.sol`
- `vendor/solidity/aave-v3/dependencies/openzeppelin/upgradeability/Proxy.sol`
- `vendor/solidity/aave-v3/flashloan/base/FlashLoanSimpleReceiverBase.sol`
- `vendor/solidity/aave-v3/flashloan/interfaces/IFlashLoanReceiver.sol`
- `vendor/solidity/aave-v3/flashloan/interfaces/IFlashLoanSimpleReceiver.sol`
- `vendor/solidity/aave-v3/interfaces/IACLManager.sol`
- `vendor/solidity/aave-v3/interfaces/IAToken.sol`
- `vendor/solidity/aave-v3/interfaces/IAaveIncentivesController.sol`
- `vendor/solidity/aave-v3/interfaces/IAaveOracle.sol`
- `vendor/solidity/aave-v3/interfaces/ICreditDelegationToken.sol`
- `vendor/solidity/aave-v3/interfaces/IDefaultInterestRateStrategy.sol`
- `vendor/solidity/aave-v3/interfaces/IERC20WithPermit.sol`
- `vendor/solidity/aave-v3/interfaces/IInitializableAToken.sol`
- `vendor/solidity/aave-v3/interfaces/IInitializableDebtToken.sol`
- `vendor/solidity/aave-v3/interfaces/IPool.sol`
- `vendor/solidity/aave-v3/interfaces/IPoolAddressesProvider.sol`
- `vendor/solidity/aave-v3/interfaces/IPoolConfigurator.sol`
- `vendor/solidity/aave-v3/interfaces/IPoolDataProvider.sol`
- `vendor/solidity/aave-v3/interfaces/IPriceOracle.sol`
- `vendor/solidity/aave-v3/interfaces/IPriceOracleGetter.sol`
- `vendor/solidity/aave-v3/interfaces/IPriceOracleSentinel.sol`
- `vendor/solidity/aave-v3/interfaces/IReserveInterestRateStrategy.sol`
- `vendor/solidity/aave-v3/interfaces/IScaledBalanceToken.sol`
- `vendor/solidity/aave-v3/interfaces/IStableDebtToken.sol`
- `vendor/solidity/aave-v3/interfaces/IVariableDebtToken.sol`
- `vendor/solidity/aave-v3/misc/AaveOracle.sol`
- `vendor/solidity/aave-v3/misc/AaveProtocolDataProvider.sol`
- `vendor/solidity/aave-v3/mocks/oracle/PriceOracle.sol`
- `vendor/solidity/aave-v3/protocol/configuration/ACLManager.sol`
- `vendor/solidity/aave-v3/protocol/configuration/PoolAddressesProvider.sol`
- `vendor/solidity/aave-v3/protocol/libraries/aave-upgradeability/BaseImmutableAdminUpgradeabilityProxy.sol`
- `vendor/solidity/aave-v3/protocol/libraries/aave-upgradeability/InitializableImmutableAdminUpgradeabilityProxy.sol`
- `vendor/solidity/aave-v3/protocol/libraries/aave-upgradeability/VersionedInitializable.sol`
- `vendor/solidity/aave-v3/protocol/libraries/configuration/ReserveConfiguration.sol`
- `vendor/solidity/aave-v3/protocol/libraries/configuration/UserConfiguration.sol`
- `vendor/solidity/aave-v3/protocol/libraries/helpers/Errors.sol`
- `vendor/solidity/aave-v3/protocol/libraries/helpers/Helpers.sol`
- `vendor/solidity/aave-v3/protocol/libraries/logic/BorrowLogic.sol`
- `vendor/solidity/aave-v3/protocol/libraries/logic/BridgeLogic.sol`
- `vendor/solidity/aave-v3/protocol/libraries/logic/ConfiguratorLogic.sol`
- `vendor/solidity/aave-v3/protocol/libraries/logic/EModeLogic.sol`
- `vendor/solidity/aave-v3/protocol/libraries/logic/FlashLoanLogic.sol`
- `vendor/solidity/aave-v3/protocol/libraries/logic/GenericLogic.sol`
- `vendor/solidity/aave-v3/protocol/libraries/logic/IsolationModeLogic.sol`
- `vendor/solidity/aave-v3/protocol/libraries/logic/LiquidationLogic.sol`
- `vendor/solidity/aave-v3/protocol/libraries/logic/PoolLogic.sol`
- `vendor/solidity/aave-v3/protocol/libraries/logic/ReserveLogic.sol`
- `vendor/solidity/aave-v3/protocol/libraries/logic/SupplyLogic.sol`
- `vendor/solidity/aave-v3/protocol/libraries/logic/ValidationLogic.sol`
- `vendor/solidity/aave-v3/protocol/libraries/math/MathUtils.sol`
- `vendor/solidity/aave-v3/protocol/libraries/math/PercentageMath.sol`
- `vendor/solidity/aave-v3/protocol/libraries/math/WadRayMath.sol`
- `vendor/solidity/aave-v3/protocol/libraries/types/ConfiguratorInputTypes.sol`
- `vendor/solidity/aave-v3/protocol/libraries/types/DataTypes.sol`
- `vendor/solidity/aave-v3/protocol/pool/DefaultReserveInterestRateStrategy.sol`
- `vendor/solidity/aave-v3/protocol/pool/Pool.sol`
- `vendor/solidity/aave-v3/protocol/pool/PoolConfigurator.sol`
- `vendor/solidity/aave-v3/protocol/pool/PoolStorage.sol`
- `vendor/solidity/aave-v3/protocol/tokenization/AToken.sol`
- `vendor/solidity/aave-v3/protocol/tokenization/StableDebtToken.sol`
- `vendor/solidity/aave-v3/protocol/tokenization/VariableDebtToken.sol`
- `vendor/solidity/aave-v3/protocol/tokenization/base/DebtTokenBase.sol`
- `vendor/solidity/aave-v3/protocol/tokenization/base/EIP712Base.sol`
- `vendor/solidity/aave-v3/protocol/tokenization/base/IncentivizedERC20.sol`
- `vendor/solidity/aave-v3/protocol/tokenization/base/MintableIncentivizedERC20.sol`
- `vendor/solidity/aave-v3/protocol/tokenization/base/ScaledBalanceTokenBase.sol`
- `vendor/solidity/openzeppelin/access/Ownable.sol`
- `vendor/solidity/openzeppelin/security/ReentrancyGuard.sol`
- `vendor/solidity/openzeppelin/token/ERC20/ERC20.sol`
- `vendor/solidity/openzeppelin/token/ERC20/IERC20.sol`
- `vendor/solidity/openzeppelin/token/ERC20/extensions/IERC20Metadata.sol`
- `vendor/solidity/openzeppelin/token/ERC20/extensions/IERC20Permit.sol`
- `vendor/solidity/openzeppelin/token/ERC20/utils/SafeERC20.sol`
- `vendor/solidity/openzeppelin/utils/Address.sol`
- `vendor/solidity/openzeppelin/utils/Context.sol`
- `vendor/solidity/uniswap-lib/libraries/TransferHelper.sol`
- `vendor/solidity/uniswap-v2-core/UniswapV2ERC20.sol`
- `vendor/solidity/uniswap-v2-core/UniswapV2Factory.sol`
- `vendor/solidity/uniswap-v2-core/UniswapV2Pair.sol`
- `vendor/solidity/uniswap-v2-core/interfaces/IERC20.sol`
- `vendor/solidity/uniswap-v2-core/interfaces/IUniswapV2Callee.sol`
- `vendor/solidity/uniswap-v2-core/interfaces/IUniswapV2ERC20.sol`
- `vendor/solidity/uniswap-v2-core/interfaces/IUniswapV2Factory.sol`
- `vendor/solidity/uniswap-v2-core/interfaces/IUniswapV2Pair.sol`
- `vendor/solidity/uniswap-v2-core/libraries/Math.sol`
- `vendor/solidity/uniswap-v2-core/libraries/SafeMath.sol`
- `vendor/solidity/uniswap-v2-core/libraries/UQ112x112.sol`
- `vendor/solidity/uniswap-v2-periphery/UniswapV2Router02.sol`
- `vendor/solidity/uniswap-v2-periphery/interfaces/IERC20.sol`
- `vendor/solidity/uniswap-v2-periphery/interfaces/IUniswapV2Router01.sol`
- `vendor/solidity/uniswap-v2-periphery/interfaces/IUniswapV2Router02.sol`
- `vendor/solidity/uniswap-v2-periphery/interfaces/IWETH.sol`
- `vendor/solidity/uniswap-v2-periphery/libraries/SafeMath.sol`
- `vendor/solidity/uniswap-v2-periphery/libraries/UniswapV2Library.sol`
- `vendor/solidity/uniswap-v2-periphery/test/WETH9.sol`
