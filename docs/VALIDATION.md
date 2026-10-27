# Kết quả kiểm chứng ngày 25/10/2026

> Cập nhật 27/10/2026: đã build Uniswap từ source local với phí swap **5%**, tự cập nhật Pair init code hash, redeploy lên Geth và kiểm tra swap/flash loan thành công. Xem `fee-5-validation.json` cho địa chỉ Pair, hash runtime bytecode, báo giá theo công thức 5% và receipt giao dịch mới. Phần kết quả 25/10 dưới đây là bản ghi lịch sử của deployment phí 0,3%, không phải deployment hiện tại. Phí flash loan Aave vẫn là 0,05%.

## Môi trường

- macOS arm64; Node.js 26.10.0.
- Geth 1.17.10, developer mode, chain ID 1337, JSON-RPC `http://127.0.0.1:8545`.
- Contract Uniswap V2 và Aave V3 được tự deploy lên Geth, không fork mạng có sẵn.
- Thị trường Aave dùng Pool/proxy/libraries chính thức từ `@aave/core-v3@1.19.3`. Fallback oracle giá cố định là mock dùng cho lab.

## Kết quả trên Geth

Thực hiện theo thứ tự: deploy -> swap 10 A/B -> swap 10 A/B/C/D -> tìm route 100 A/D -> flash loan 100 A.

| Thao tác | Kết quả |
|---|---|
| Factory.getPair(A,D) | Địa chỉ zero: không có pool A/D trực tiếp |
| Supply Aave | 50.000 A, nhận aToken |
| Swap 10 A -> B | Nhận 9,960069810399032164 B |
| Swap 10 A -> B -> C -> D | Nhận 9,861151070444537575 D trong một transaction |
| Route A-B-C-D cho 100 A, block 66 | 95,483753644868542369 D |
| Route A-C-D cho 100 A, block 66 | 68,287753159641502248 D |
| Flash loan | Vay 100 A, phí 0,05 A, lợi nhuận 45,567032183921072425 A trước gas |

Giá và lợi nhuận này đến từ thanh khoản/chênh lệch giá được dựng riêng cho lab. Chạy giao dịch tiếp sẽ thay đổi reserves và kết quả.

### Transaction đã kiểm tra receipt status = 1

- Swap trực tiếp: `0x6117e51424cea0af10402803a361085a9262e5518ce9e0c18d9cccc78f9e6467`.
- Swap ba chặng: `0x0b7bb1c11a5a006059e852db65d9a54eac6d0e63c8d8017b4e375e406461c4e1`.
- Flash loan: `0x2020e3fb731bb3e6add47891771212b418b9af7f67473cc0929a1f8f83f4678e`.

Địa chỉ triển khai, block number và gas used được lưu trong `geth-validation.json` bên cạnh file này. Các hash thuộc chain local, không có Etherscan công khai.

Một lần gửi flash loan với gas limit mặc định từ RPC estimate đã revert, dù `eth_call` thành công. CLI hiện thêm 50% dự phòng vào gas limit cho flash loan; lần chạy sau thành công. Chưa xác định đầy đủ nguyên nhân sai khác estimate/thực thi của lần gửi trước, nên không coi thêm gas là bảo đảm thành công cho mọi node hay mọi giao dịch.

## Kiểm thử tự động

`npm test`: **13 passing** trên EVM Hardhat, bao gồm:

- Factory/Router tương thích và số dư underlying/aToken sau supply.
- Swap trực tiếp và ba chặng; lượng nhận đúng quote và số sự kiện Swap đúng số chặng.
- Revert khi không đạt minOut và bảo toàn số dư.
- Hai route được tìm đúng, báo giá khớp Router cùng block.
- Flash loan Aave thật, kiểm tra premium, lợi nhuận và tiền trả tại aToken.
- Revert và rollback reserve/DEX khi thiếu lợi nhuận.
- Không dùng tiền nạp sẵn vào receiver để che lỗ.
- Chặn người không có quyền, callback giả, người thứ ba yêu cầu khoản vay đến receiver.
- Chặn chiến lược quá deadline và khoản vay vượt thanh khoản.
- Công thức nguyên, thanh khoản zero và giới hạn route.

CLI cũng đã chạy độc lập qua RPC trên node Hardhat chain ID 31337.

`npm audit --omit=dev` sau cập nhật ethers 6.17.0: **0 vulnerabilities** tại thời điểm kiểm tra. Audit toàn bộ vẫn báo advisory trong dependency của toolchain Hardhat 2; chưa xử lý bằng nâng major vì project đang dùng hệ plugin tương thích Hardhat 2.

Chưa deploy lên public testnet. Không có đánh giá production cho thị trường lending hoặc chiến lược này.
