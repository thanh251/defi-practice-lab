# Solidity và artifact được lưu trong project

Thư mục này thay thế các package smart contract từng được đọc từ `node_modules/`. Có thể đọc source ngay sau khi clone repository; `npm ci` chỉ còn cài công cụ JavaScript.

```text
vendor/
├── solidity/
│   ├── aave-v3/               Aave core-v3 1.19.3
│   ├── uniswap-v2-core/       Uniswap V2 core 1.0.1
│   ├── uniswap-v2-periphery/  Uniswap V2 periphery 1.1.0-beta.0
│   ├── uniswap-lib/           Thư viện hỗ trợ Uniswap
│   └── openzeppelin/          OpenZeppelin Contracts 4.9.6
├── artifacts/
│   ├── aave-v3/              Artifact Aave chính thức cần để deploy thị trường
│   └── uniswap-v2/           Factory, Pair, Router02 và WETH9 build từ source local
├── licenses/                 License của các nguồn bên thứ ba
└── manifest.json             Phiên bản, đường dẫn gốc và SHA-256
```

## Các file thường cần đọc

- `solidity/uniswap-v2-core/UniswapV2Factory.sol`
- `solidity/uniswap-v2-core/UniswapV2Pair.sol`
- `solidity/uniswap-v2-periphery/UniswapV2Router02.sol`
- `solidity/uniswap-v2-periphery/libraries/UniswapV2Library.sol`
- `solidity/aave-v3/protocol/pool/Pool.sol`
- `solidity/aave-v3/protocol/pool/PoolConfigurator.sol`
- `solidity/aave-v3/protocol/libraries/logic/FlashLoanLogic.sol`
- `solidity/aave-v3/protocol/tokenization/AToken.sol`
- `solidity/aave-v3/flashloan/base/FlashLoanSimpleReceiverBase.sol`

Toàn bộ 350 file Solidity từ các bộ source được lưu lại, gồm cả interface, mock và contract không được dùng trong lab. Danh sách 111 file thuộc chuỗi import của lab nằm ở `../docs/SOLIDITY-FILES.md`.

## Biên dịch và triển khai

`contracts/LabToken.sol` và `contracts/FlashSwapReceiver.sol` import các dependency bằng đường dẫn tương đối vào `vendor/solidity/`. Hardhat biên dịch hai contract này cùng các dependency thực sự được import bằng solc 0.8.24. Không đưa cả folder vendor thành source root vì Uniswap V2 gốc cần compiler 0.5.16/0.6.6.

`lib/artifacts.js` đọc ABI và bytecode từ `vendor/artifacts/`, không có fallback sang npm. Aave giữ artifact chính thức. Uniswap được build từ source local bằng `npm run compile:uniswap` với core solc 0.5.16, periphery solc 0.6.6, optimizer 200 runs và EVM Istanbul.

Script build core trước, lấy keccak256 của creation bytecode Pair và điền vào `UniswapV2Library.pairFor()`, rồi build Router/WETH. Kết quả ghi vào `vendor/artifacts/uniswap-v2/`; metadata compiler, source hash, fee và Pair hash nằm trong `manifest.json.uniswapBuild`. Artifact thay thế giữ `upstreamSha256` để phân biệt với snapshot npm ban đầu.

Phí swap trong source/build hiện **10%**: hai hệ số trừ của Pair là 100, Library dùng 900, mẫu số 1000. Backend `lib/routes.js` tự đọc hệ số từ `manifest.json.uniswapBuild`, không hardcode mức phí. Pipeline kiểm tra đồng bộ phí trước khi build. `npm run deploy`, `npm test`, `npm run demo` tự build Uniswap qua npm lifecycle hooks. Contract đã deploy cũ không đổi; phải redeploy để dùng bytecode mới.

**Pipeline này chưa rebuild toàn bộ Aave.** Nếu sửa source Aave, phải biên dịch lại với compiler/cấu hình phù hợp và cập nhật artifact tương ứng trước khi deploy. Contract ứng dụng vẫn biên dịch bằng Hardhat/solc 0.8.24.

Import xuyên package đã đổi sang đường dẫn tương đối local. Source Uniswap còn có thay đổi phí do người dùng yêu cầu và Pair hash do script build cập nhật. `manifest.json` giữ hash source upstream, hash bản local và thông tin build. Script chỉ cập nhật hash các input Uniswap vừa biên dịch; không tự chấp nhận thay đổi source Aave/OpenZeppelin không liên quan.

Kiểm tra tính toàn vẹn và tất cả đường dẫn import:

```bash
npm run verify:vendor
```

Nếu chủ đích sửa source hoặc artifact, cần review thay đổi và cập nhật hash tương ứng trong manifest. Không tự cập nhật manifest chỉ để bỏ qua lỗi kiểm tra.

## Nguồn và giấy phép

- https://github.com/aave/aave-v3-core/tree/v1.19.3
- https://github.com/Uniswap/v2-core
- https://github.com/Uniswap/v2-periphery
- https://github.com/Uniswap/solidity-lib
- https://github.com/OpenZeppelin/openzeppelin-contracts/tree/v4.9.6

License tổng thể được giữ trong `licenses/`. Giữ nguyên header SPDX và các thông báo bản quyền theo từng file. Bản MIT license OpenZeppelin được lấy từ tag v4.9.6 của repository gốc.
