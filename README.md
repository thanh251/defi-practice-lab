# Bài thực hành 4 — Uniswap V2 + Aave V3

Project Node.js/Solidity cho sáu nội dung: kiến trúc AMM, deploy Uniswap V2, swap token trực tiếp/nhiều chặng, tìm route, deploy Aave V3 và flash loan kết hợp hai sàn.

## 1. Chạy ngay

Yêu cầu: Node.js 22 LTS trở lên, npm. Đã kiểm chứng trên macOS arm64 với Node 26.10.0 và Geth 1.17.10. Các dependency được khóa trong `package-lock.json`.

```bash
npm ci
npm run verify:vendor
npm test
npm run demo
```

- `npm test`: deploy thật các contract trên EVM Hardhat, kiểm tra các ca thành công và revert.
- `npm run demo`: chạy toàn bộ ví dụ trên blockchain Hardhat tạm thời, in kết quả và transaction hash. Node này kết thúc cùng script.
- Để có blockchain chạy lâu dài và tương tác bằng CLI, làm phần 2 hoặc 3.

## 2. Chạy trên Geth local

Cài Geth nếu chưa có, ví dụ macOS:

```bash
brew install ethereum
```

Terminal 1, tại thư mục project:

```bash
npm run geth
```

Script cũng nhận đường dẫn binary qua `GETH_BIN`; bản Geth 1.17.10 đã tải khi kiểm chứng project nằm trong `.tools/ethereum/1.17.10/bin/geth` và được tự phát hiện nếu còn tồn tại. `.tools` không nằm trong source control.

Geth chạy `--dev`, HTTP chỉ bind `127.0.0.1:8545`, lưu dữ liệu ở `geth-data/`. Tài khoản developer local được mở khóa và có ETH để trả gas.

Terminal 2:

```bash
cp .env.example .env
npm run compile
npm run deploy
npm run cli -- status
```

Giữ `PRIVATE_KEY` trống khi dùng tài khoản developer Geth. Khi dùng ví khác, điền private key của tài khoản **đã được cấp ETH** vào `.env`.

Deployment lưu ở `deployments/1337.json` (chain ID thực tế được đọc từ node). File chứa token, hai Factory/Router, WETH, Aave provider/Pool/configurator/oracle/aToken, các library và receiver.

Trên Geth/Hardhat local, mỗi lần chạy lệnh sau sẽ tự build và deploy một bộ mới, không cần `REDEPLOY=true`:

```bash
npm run deploy
```

Sau khi toàn bộ deployment thành công, script giữ đúng một bản địa chỉ trước đó ở `deployments/1337-backup.json` (hoặc `31337-backup.json`), thay các backup timestamp cũ của cùng chain, rồi cập nhật manifest đang dùng. Nếu deployment thất bại trước bước lưu, file địa chỉ đang dùng được giữ nguyên. Nếu deploy lại public testnet đã có manifest, vẫn cần `REDEPLOY=true` và `ALLOW_TESTNET=true`.

Các địa chỉ cũ vẫn tồn tại trên chain; file manifest sẽ trỏ sang bộ mới. Sau khi restart/reset node, chạy `status` để kiểm tra. Nếu chain đã bị reset, deploy lại. CLI kiểm tra genesis và sự tồn tại bytecode tại các địa chỉ chính trước khi tương tác.

## 3. Chạy trên Hardhat node thay Geth

Terminal 1:

```bash
npm run node -- --hostname 127.0.0.1
```

Terminal 2:

```bash
npm run deploy
npm run cli -- status
```

Hardhat dùng chain ID 31337, manifest là `deployments/31337.json`. Node mới không tự phục hồi state cũ; cần deploy lại khi khởi động một chain mới. Hai phương án Geth/Hardhat mặc định cùng port 8545, chỉ chạy một node tại port đó.

## 4. Swap bằng backend/CLI

```bash
# Báo giá, không gửi transaction
npm run cli -- quote 10 A,B

# Swap trực tiếp
npm run cli -- swap 10 A,B

# Swap A -> B -> C -> D trong MỘT transaction
npm run cli -- swap 10 A,B,C,D

# Liệt kê và xếp hạng route cho 100 A sang D, tối đa 3 chặng
npm run cli -- route 100 A D 3
```

CLI tự đọc decimals, approve đầu vào nếu cần, lấy báo giá mới, đặt `amountOutMin`, gửi transaction và in số dư thực nhận, hash, gas. Các token A/B/C/D của lab đều có 18 decimals.

`SLIPPAGE_BPS=50` nghĩa là chấp nhận đầu ra thấp hơn báo giá tối đa 0,5%. Deadline bằng timestamp block hiện tại cộng 300 giây. Approve là transaction riêng trước swap; toàn bộ các chặng swap nằm trong một transaction.

### Thanh khoản được dựng sẵn

| Sàn | Pair | Thanh khoản ban đầu |
|---|---|---|
| DEX 1 | A/B | 10.000 A : 10.000 B |
| DEX 1 | B/C | 10.000 B : 10.000 C |
| DEX 1 | C/D | 10.000 C : 10.000 D |
| DEX 1 | A/C | 10.000 A : 7.000 C |
| DEX 2 | A/B | 15.000 A : 10.000 B |

**Không tạo Pair A/D.** Route DEX 1 có hai lựa chọn `A-B-C-D` và `A-C-D`.

### Thuật toán route

`lib/routes.js` đọc các Pair và reserves tại cùng một block, xây đồ thị hai chiều rồi DFS các đường không lặp token. Mỗi chặng tính bằng số nguyên:

```text
out = floor(in * 900 * reserveOut / (reserveIn * 1000 + in * 900))
```

Kết quả xếp giảm dần theo output; nếu bằng nhau thì ưu tiên ít chặng hơn. Giới hạn cho phép 1–6 chặng. Đây là đường tốt nhất trong các đường đơn của **một Factory**, không chia lệnh qua nhiều route và chưa trừ gas. Đường tốt nhất có thể thay đổi theo số tiền và reserve.

Để thực hiện route vừa chọn, truyền dãy token đó vào lệnh `swap`. Báo giá sẽ được lấy lại trước khi gửi.

## 5. Aave được deploy như thế nào?

Dùng artifact chính thức Aave core-v3 1.19.3 được lưu tại `vendor/artifacts/aave-v3/`, không dùng MockPool. Source Solidity tương ứng ở `vendor/solidity/aave-v3/`. Script thực hiện:

1. Deploy `PoolAddressesProvider` và `ACLManager`, cấp quyền pool admin.
2. Deploy và link các thư viện logic cần thiết.
3. Deploy Pool implementation và tạo Pool proxy qua provider.
4. Deploy PoolConfigurator implementation/proxy, data provider.
5. Deploy AaveOracle; sử dụng fallback PriceOracle của bộ mock Aave để đặt giá A = 1 đơn vị tham chiếu cho lab.
6. Deploy interest rate strategy, AToken, StableDebtToken và VariableDebtToken implementations.
7. Khởi tạo reserve A, bật borrowing/flash loan và đặt phí flash loan **5 bps**.
8. Approve và `supply` **50.000 A** qua Pool. Token underlying nằm tại aToken theo cơ chế của Aave.

Đây là thị trường tối giản cho bài thực hành: một reserve, oracle giá cố định phục vụ local, chưa cấu hình collateral/risk cho một thị trường lending production. Mock được dùng ở **nguồn giá**, còn Pool, reserve, proxy, token hóa và flash loan dùng code Aave thật.

## 6. Flash loan + Uniswap

```bash
# Vay 100 A, yêu cầu lãi tối thiểu 1 A sau phí Aave, trước gas
npm run cli -- flash 100 1
```

Luồng trong một transaction:

```text
Backend -> Receiver.start
        -> Aave Pool.flashLoanSimple
        -> Receiver nhận A và callback executeOperation
        -> DEX 1: A -> B
        -> DEX 2: B -> A
        -> kiểm tra số dư ban đầu + gốc + phí + minProfit
        -> approve Pool
        -> Aave thu nợ
```

CLI lấy báo giá cho hai chặng, đặt minOut và mô phỏng `staticCall` trước khi gửi. Gas limit của flash loan được đặt bằng 150% kết quả RPC estimate để có dự phòng cho chuỗi lời gọi lồng nhau trên Geth; chỉ gas thực dùng mới bị tính phí. Receiver giữ lại lợi nhuận; chỉ owner có thể gọi `withdraw(token, amount)` bằng ABI của contract. Sau nhiều lần swap, chênh lệch giá giảm và chiến lược có thể không còn đủ lợi nhuận.

Chênh lệch giá được tạo có chủ đích để demo. Số profit in ra tính bằng A, **chưa trừ gas trả bằng ETH**; không phải cam kết lợi nhuận thực tế.

### Điều kiện trong receiver

- Chỉ owner được bắt đầu chiến lược và rút token.
- Callback phải đến từ đúng Pool, initiator phải là receiver và nội dung phải khớp yêu cầu đang chờ.
- Khóa reentrancy ở entry point; callback tiêu thụ yêu cầu trước khi gọi Router.
- Chỉ swap số token trung gian thực nhận của chiến lược; không dùng số dư B có sẵn.
- Bảo toàn số dư A có sẵn trước vay, nên không thể dùng vốn nạp trước để che lỗ.
- Xóa allowance Router sau khi swap; approve Pool đúng khoản nợ.

## 7. Cấu trúc source

```text
contracts/LabToken.sol            ERC-20 cho lab, mint chỉ owner
contracts/FlashSwapReceiver.sol   Vay Aave + swap hai DEX
vendor/solidity/                  Source Uniswap, Aave và OpenZeppelin trong project
vendor/artifacts/                 ABI/bytecode giao thức chính thức đã cố định
vendor/manifest.json              Nguồn gốc, phiên bản và SHA-256
lib/artifacts.js                  Đọc artifact local, deploy và link thư viện Aave
lib/deploy.js                     Dựng toàn bộ thị trường
lib/deployment-store.js           Lưu manifest và xoay một backup sau deployment thành công
lib/routes.js                     Snapshot đồ thị và tìm route
scripts/deploy.js                 Deploy qua RPC, lưu manifest
scripts/cli.js                    Status, quote, swap, route, flash
scripts/demo.js                   Demo trọn luồng trên EVM tạm thời
scripts/geth.sh                   Khởi động Geth local
scripts/verify-vendor.js          Kiểm tra hash và import Solidity local
scripts/compile-uniswap.js        Build core/periphery và cập nhật Pair hash
test/lab.test.js                 Kiểm thử tích hợp và routing
```

Uniswap V2 hiện dùng source local trong `vendor/solidity/`, đã đổi phí swap thành **10%** (Pair trừ 100/1000, Library dùng 900/1000; backend tự đọc hệ số từ manifest build). Artifact được build tại chỗ bằng solc 0.5.16 cho core và 0.6.6 cho periphery. Script tự tính Pair init code hash mới và cập nhật `UniswapV2Library.pairFor()` trước khi build Router. Aave vẫn dùng artifact chính thức đã khóa phiên bản; phí flash loan lab giữ **0,05%**.

```bash
# Build lại giao thức Uniswap local và cập nhật artifact/hash
npm run compile:uniswap

# Build Uniswap rồi compile contract ứng dụng
npm run compile

# Kiểm tra snapshot, source và import
npm run verify:vendor
```

`npm run deploy`, `npm test` và `npm run demo` tự chạy bước build Uniswap trước khi thực hiện. Khi sửa phí, phải đồng bộ hai phép trừ trong Pair và hai công thức quote của Library; script dừng nếu các hệ số không khớp. Backend tự đọc hệ số mới từ `vendor/manifest.json` sau build, không cần sửa số trong `lib/routes.js`. Các test có giá trị kỳ vọng theo phí 10% cũng cần được cập nhật nếu thay đổi mức phí lần nữa.

Sửa source **Aave** vẫn yêu cầu rebuild artifact Aave bằng compiler/cấu hình phù hợp; pipeline tự động mới chỉ dành cho Uniswap. Xem [vendor/README.md](vendor/README.md) để biết nguồn và license.

## 8. Testnet

Mặc định ưu tiên local. Muốn tự deploy trên testnet có đủ ngân sách gas, đặt `RPC_URL`, `PRIVATE_KEY` và `ALLOW_TESTNET=true` trong `.env`, rồi chạy `npm run deploy`. Đọc chain ID từ RPC; script từ chối chain ID 1. Bộ contract Aave cần nhiều transaction, nên phải có đủ ETH testnet. Project chưa được kiểm chứng trên public testnet.

## Kiểm tra contract đang dùng có khớp bản build không

Giữ Geth/node local đang chạy, sau đó:

```bash
npm run verify:deployment
```

Lệnh đọc cùng manifest mà CLI dùng, kiểm tra source Uniswap chưa đổi sau build, Factory/Pair trên chain khớp bytecode artifact hiện tại, Router trỏ đúng Factory/WETH và Receiver trỏ đúng hai Router. Nó in địa chỉ và `KHOP BYTECODE` khi khớp; thoát với mã lỗi khi không khớp hoặc không kết nối được node. Không gửi transaction, không tự compile/deploy lại. Phạm vi kiểm tra bytecode là Factory/Pair Uniswap; các quan hệ Router/Receiver được kiểm tra qua getter, không xác nhận toàn bộ bytecode Aave/Receiver. Hai deployment khác địa chỉ nhưng cùng bytecode đều có thể khớp: kết quả chứng minh khớp bản build, không chứng minh lần deploy nào có thời gian mới nhất.

## 9. Kiểm thử và giới hạn

`npm test` bao gồm: khớp Factory/Router, supply Aave, swap trực tiếp/ba chặng, số sự kiện swap, slippage revert, báo giá route khớp Router, flash loan trả phí, rollback cả Aave/DEX khi thiếu lãi, bảo toàn vốn có sẵn, quyền gọi, callback giả và vay vượt thanh khoản.

Kết quả kiểm chứng Geth nằm trong `docs/VALIDATION.md`. Source và lockfile dành cho thực hành. Các snapshot giao thức V2/V3 là phiên bản cũ có chủ đích; toolchain Hardhat 2 còn dependency có advisory trong `npm audit`. Không dùng project này làm cấu hình production.

## Tài liệu gốc

- [Uniswap V2 architecture](https://developers.uniswap.org/docs/protocols/v2/concepts/architecture)
- [Uniswap V2 core](https://github.com/Uniswap/v2-core)
- [Uniswap V2 periphery](https://github.com/Uniswap/v2-periphery)
- [Aave V3 core, phiên bản 1.19.3](https://github.com/aave/aave-v3-core/tree/v1.19.3)
- [Aave flash loans](https://www.aave.com/docs/aave-v3/guides/flash-loans)
- [Geth developer mode](https://geth.ethereum.org/docs/developers/dapp-developer/dev-mode)
