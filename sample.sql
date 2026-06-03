create database DB_124
use DB_124

-- 1. Bảng NHÓM HÀNG [cite: 7, 69]
CREATE TABLE NHOM_HANG (
    MANHOM VARCHAR(10) PRIMARY KEY,
    TENNHOM NVARCHAR(100) NOT NULL
);

-- 2. Bảng LOẠI NHÂN VIÊN [cite: 29, 79]
CREATE TABLE LOAI_NV (
    MALNV VARCHAR(10) PRIMARY KEY,
    TENLOAI NVARCHAR(50) NOT NULL
);

-- 3. Bảng HÌNH THỨC ĐÓNG GÓI [cite: 13, 89]
CREATE TABLE HINH_THUC_DONG_GOI (
    MAHTDG VARCHAR(20) PRIMARY KEY,
    THUNG INT NOT NULL CHECK(THUNG > 0),
    LOC INT CHECK(LOC >= 0)
);

-- 4. Bảng ĐẠI LÝ [cite: 32, 83]
CREATE TABLE DAI_LY (
    MADL VARCHAR(10) PRIMARY KEY,
    TENDL NVARCHAR(150) NOT NULL,
    MASOTHUE VARCHAR(20) NOT NULL,
    DIACHI NVARCHAR(200),
    DIENTHOAI VARCHAR(20),
    CONSTRAINT UQ_DAILY_MASOTHUE UNIQUE (MASOTHUE)
);

-- 5. Bảng ĐỘI [cite: 20, 81]
CREATE TABLE DOI (
    MADOI VARCHAR(10) PRIMARY KEY,
    MANHOM VARCHAR(10) NOT NULL,
    CONSTRAINT FK_DOI_NHOMHANG FOREIGN KEY (MANHOM) REFERENCES NHOM_HANG(MANHOM)
);

-- 6. Bảng HÀNG HÓA [cite: 10, 71]
CREATE TABLE HANG_HOA (
    MAHH VARCHAR(10) PRIMARY KEY,
    MAHTDG VARCHAR(20) NOT NULL,
    MANHOM VARCHAR(10) NOT NULL,
    TENHH NVARCHAR(150) NOT NULL,
    DVT NVARCHAR(20) NOT NULL,
    DONGIA DECIMAL(18, 2) NOT NULL CHECK(DONGIA > 0),
    SLTON INT NOT NULL CHECK(SLTON >= 0),
    CONSTRAINT FK_HANGHOA_HTDG FOREIGN KEY (MAHTDG) REFERENCES HINH_THUC_DONG_GOI(MAHTDG),
    CONSTRAINT FK_HANGHOA_NHOMHANG FOREIGN KEY (MANHOM) REFERENCES NHOM_HANG(MANHOM)
);

-- 7. Bảng NHÂN VIÊN [cite: 24, 50]
CREATE TABLE NHAN_VIEN (
    MANV VARCHAR(10) PRIMARY KEY,
    MALNV VARCHAR(10) NOT NULL,
    MADOI VARCHAR(10) NOT NULL,
    HOTEN NVARCHAR(100) NOT NULL,
    GIOITINH NVARCHAR(10) NOT NULL CHECK(GIOITINH IN (N'Nam', N'Nữ')),
    NAMSINH DATE,
    DIACHI NVARCHAR(200),
    DIENTHOAI VARCHAR(20),
    NGAYVAOLAM DATE NOT NULL,
    GHICHU NVARCHAR(MAX),
    CONSTRAINT FK_NHANVIEN_LOAINV FOREIGN KEY (MALNV) REFERENCES LOAI_NV(MALNV),
    CONSTRAINT FK_NHANVIEN_DOI FOREIGN KEY (MADOI) REFERENCES DOI(MADOI)
);

-- 8. Bảng PHIẾU XUẤT [cite: 35, 62]
CREATE TABLE PHIEU_XUAT (
    MAPX VARCHAR(20) PRIMARY KEY,
    MANV VARCHAR(10) NOT NULL,
    NGAYXUAT DATE NOT NULL,
    CONSTRAINT FK_PHIEUXUAT_NHANVIEN FOREIGN KEY (MANV) REFERENCES NHAN_VIEN(MANV)
);

-- 9. Bảng CHI TIẾT PHIẾU XUẤT (CTPX) [cite: 38, 65]
CREATE TABLE CTPX (
    MAPX VARCHAR(20) NOT NULL,
    MAHH VARCHAR(10) NOT NULL,
    SOLUONG INT NOT NULL CHECK(SOLUONG > 0),
    PRIMARY KEY (MAPX, MAHH),
    CONSTRAINT FK_CTPX_PHIEUXUAT FOREIGN KEY (MAPX) REFERENCES PHIEU_XUAT(MAPX),
    CONSTRAINT FK_CTPX_HANGHOA FOREIGN KEY (MAHH) REFERENCES HANG_HOA(MAHH)
);

-- 10. Bảng HÓA ĐƠN [cite: 43, 91]
CREATE TABLE HOA_DON (
    MAHD VARCHAR(20) PRIMARY KEY,
    MANV VARCHAR(10) NOT NULL,
    MADL VARCHAR(10) NOT NULL,
    NGAYLAP DATE NOT NULL,
    TONGTIEN DECIMAL(18, 2) NOT NULL CHECK(TONGTIEN >= 0),
    CONSTRAINT FK_HOADON_NHANVIEN FOREIGN KEY (MANV) REFERENCES NHAN_VIEN(MANV),
    CONSTRAINT FK_HOADON_DAILY FOREIGN KEY (MADL) REFERENCES DAI_LY(MADL)
);

-- 11. Bảng CHI TIẾT HÓA ĐƠN (CTHD) [cite: 46, 94]
CREATE TABLE CTHD (
    MAHD VARCHAR(20) NOT NULL,
    MAHH VARCHAR(10) NOT NULL,
    SLBAN INT NOT NULL CHECK(SLBAN > 0),
    CKBAN FLOAT NOT NULL CHECK(CKBAN >= 0 AND CKBAN <= 1),
    THANHTIEN DECIMAL(18, 2) NOT NULL CHECK(THANHTIEN >= 0),
    PRIMARY KEY (MAHD, MAHH),
    CONSTRAINT FK_CTHD_HOADON FOREIGN KEY (MAHD) REFERENCES HOA_DON(MAHD),
    CONSTRAINT FK_CTHD_HANGHOA FOREIGN KEY (MAHH) REFERENCES HANG_HOA(MAHH)
);

-- ====================================================================
-- 1. CHÈN DỮ LIỆU BẢNG NHÓM HÀNG
-- ====================================================================
INSERT INTO NHOM_HANG (MANHOM, TENNHOM) VALUES
('BOT', N'Bột'),
('CSSD', N'Chăm sóc sắc đẹp'),
('CSTT', N'Chăm sóc thân thể'),
('TP', N'Thực phẩm');

-- ====================================================================
-- 2. CHÈN DỮ LIỆU BẢNG LOẠI NHÂN VIÊN
-- ====================================================================
INSERT INTO LOAI_NV (MALNV, TENLOAI) VALUES
('GH', N'Giao hàng'),
('TD', N'Trưởng đội'),
('TT', N'Tiếp thị'); 

-- ====================================================================
-- 3. CHÈN DỮ LIỆU BẢNG HÌNH THỨC ĐÓNG GÓI
-- ====================================================================
INSERT INTO HINH_THUC_DONG_GOI (MAHTDG, THUNG, LOC) VALUES
('600', 6, NULL),
('1200', 12, NULL),
('1500', 15, NULL),
('2400', 24, NULL),
('3000', 30, NULL),
('3600', 36, NULL),
('3603', 36, 3),
('3606', 36, 6),
('3612', 36, 12),
('4800', 48, NULL),
('6000', 60, NULL),
('6006', 60, 6),
('7200', 72, NULL),
('7204', 72, 4),
('7206', 72, 6),
('7212', 72, 12),
('10000', 100, NULL),
('10010', 100, 10),
('12012', 120, 12),
('14412', 144, 12);

-- ====================================================================
-- 4. CHÈN DỮ LIỆU BẢNG ĐẠI LÝ
-- ====================================================================
INSERT INTO DAI_LY (MADL, TENDL, MASOTHUE, DIACHI, DIENTHOAI) VALUES
('DL001', N'Cửa hàng bách hóa tổng hợp IC', '020220118412', N'202 Trần Hưng Đạo, P5, Q5, TPHCM', '08990771'),
('DL002', N'Công ty bách hóa Long An', '013444432943', N'99 Hoàng Hoa Thám, Long An', '0658515044'),
('DL003', N'Cửa hàng tổng hợp DDC', '085784344522', N'50 Phạm Ngọc Thạch, Long Xuyên', '075611299'),
('DL004', N'Chi nhánh 2 công ty bách hoa FH', '093328330377', N'11 Lý Tự Trọng, Vũng Tàu', '0568900122'),
('DL005', N'Cửa hàng tổng hợp ABX', '011445367745', N'2 Nguyễn Chí Thanh, Cần Thơ', '071811111'),
('DL006', N'Công ty ASB', '045567845454', N'1 Nguyễn Huệ, Đà Lạt', '045990722'),
('DL007', N'Công ty bách hóa Đà Nẵng', '011546234533', N'98 Hòang Văn Thu, Đà Nẵng', '022877133'),
('DL008', N'Cửa hàng bách hóa BBF', '011443354534', N'56 Đề Thám, Nha Trang', '060871155'),
('DL009', N'Cửa hàng bách hóa GTT', '085089664433', N'112 Lê Lợi, Hà Nội', '0129890731'),
('DL010', N'Công ty ACD', '058023458397', N'45 Quốc Lộ 1A, Bến Tre', '062811077'),
('DL011', N'Cửa hàng thực phẩm ABC', '034093362343', N'355 Nguyễn Chí Thanh, Q1, TPHCM', '089890211'),
-- Đại lý phát sinh bổ sung do xuất hiện ở bảng hóa đơn mẫu nhưng không có ở danh mục đại lý gốc
('DL012', N'Cửa hàng bách hóa tổng hợp phát sinh DL012', '034099999999', N'Địa chỉ đại lý DL012', '089899999'); 

-- ====================================================================
-- 5. CHÈN DỮ LIỆU BẢNG ĐỘI
-- ====================================================================
INSERT INTO DOI (MADOI, MANHOM) VALUES
('1', 'BOT'),
('2', 'BOT'),
('3', 'CSTT'),
('4', 'CSTT'),
('5', 'CSTT'),
('6', 'CSSD'),
('7', 'CSSD'),
('8', 'CSSD'),
('9', 'TP'),
-- Đội số 10 được bổ sung vì có nhân viên NV019 thuộc đội này (đội phụ trách nhóm Thực phẩm)
('10', 'TP');

-- ====================================================================
-- 6. CHÈN DỮ LIỆU BẢNG HÀNG HÓA
-- ====================================================================
INSERT INTO HANG_HOA (MAHH, MAHTDG, MANHOM, TENHH, DVT, DONGIA, SLTON) VALUES
('BCCL1', '10010', 'CSTT', N'Bàn chải Close-up năng động (72)', N'cây', 7000, 1200),
('BCCL2', '10010', 'CSTT', N'Bàn chải Close-up Fresh(720)', N'cây', 4000, 700),
('BCCL3', '10010', 'CSTT', N'Bàn chải Close-up Flesx', N'cây', 6700, 400),
('BG001', '2400', 'BOT', N'Bột giặt Omo 30g', N'dây', 4500, 240),
('BG002', '3600', 'BOT', N'Bột giặt Omo 200g', N'gói', 2900, 108),
('BGOM1', '1200', 'BOT', N'Bột giặt Omo Matic 1000g', N'hộp', 17400, 48),
('BGOM2', '600', 'BOT', N'Bột giặt Omo Matic 4000g', N'hộp', 69000, 36),
('BGVJ1', '1200', 'BOT', N'Bột giặt Viso Javel 700ml', N'chai', 3150, 60),
('BN001', '6000', 'TP', N'Bột nêm', N'gói', 1350, 390),
('CAL01', '3000', 'TP', N'Cháo ăn liền', N'gói', 720, 450),
('CLG01', '14412', 'CSTT', N'Close-up Green 40g', N'cây', 2000, 1440),
('CLM01', '14412', 'CSTT', N'Close-up muoi 40g', N'cây', 3500, 1152),
('CMLB2', '3606', 'CSTT', N'Lifebouy chống muỗi 100ml', N'chai', 15000, 108),
('DDCCP', '6000', 'CSSD', N'Kem dưỡng da cao cấp Ponds 50g', N'chai', 3500, 420),
('DGCB1', '7200', 'CSTT', N'Dầu gội Clear bạc hà 7ml', N'dây', 9600, 144),
('DGCB2', '3612', 'CSTT', N'Dầu gội Clear bạc hà 100ml', N'chai', 13500, 108),
('DGD01', '3612', 'CSTT', N'Dầu gội Dove 100ml', N'chai', 15000, 360),
('DGLB1', '7200', 'CSTT', N'Dầu gội Lifebouy 6ml', N'dây', 4800, 216),
('ITD01', '7200', 'TP', N'Icetea day 10g', N'dây', 8700, 216),
('KCNP1', '6006', 'CSSD', N'Kem chống nắng Ponds 20g', N'chai', 20000, 360),
-- Mã hàng hóa KDDH1 xuất hiện ở chi tiết hóa đơn/phiếu xuất nhưng không có ở danh mục gốc
('KDDH1', '3612', 'CSTT', N'Kem đánh răng Close-up bạc hà phát sinh', N'cây', 10000, 300);

-- ====================================================================
-- 7. CHÈN DỮ LIỆU BẢNG NHÂN VIÊN
-- ====================================================================
INSERT INTO NHAN_VIEN (MANV, MALNV, MADOI, HOTEN, GIOITINH, NAMSINH, DIACHI, DIENTHOAI, NGAYVAOLAM, GHICHU) VALUES
('NV001', 'TD', '1', N'Huỳnh Trí Lâm', N'Nam', '1960-12-12', N'12 Minh Phung Q11', '9634165', '1984-05-03', N'Tốt nghiệp Đại học Kinh Tế năm 1982, chứng chỉ C Anh Văn'),
('NV002', 'TT', '1', N'Trần Văn Minh', N'Nam', '1965-01-21', N'7 Lễ Lại Q1', '8202933', '1980-09-13', N'Tốt nghiệp Đại học Kinh Tế năm 1987'),
('NV003', 'TD', '2', N'Trần Hoàng Ngân', N'Nữ', '1962-01-07', N'551/1A Lạc Long Quân Q1', '9112135', '1985-12-26', N'Tốt nghiệp Đại học Kinh Tế năm 1984'),
('NV004', 'GH', '2', N'Lý Hoài An', N'Nam', '1977-02-24', N'1024/1 Hùng Vương Q5', '9425354', '1999-12-14', N'Tot nghiep Phe Thong Trung Học'),
('NV005', 'TD', '3', N'Lâm Trọng Tín', N'Nam', '1965-03-13', N'2 Trần Bình Trọng, Q5', '9987165', '1987-07-19', N'Tốt nghiệp Đại học Kinh Tế năm 1987, chứng chỉ C Anh Văn'),
('NV006', 'TT', '3', N'Nguyễn Văn Phương', N'Nam', '1967-09-04', N'56 Nguyễn Huệ QI', '8233911', '1995-12-01', N'Tốt nghiệp Đại học Kinh Tế năm 1989'),
('NV007', 'TD', '4', N'Trần Minh Tâm', N'Nữ', '1961-02-03', N'78 Hàn Hải Nguyên Q11', '9345235', '1984-06-05', N'Tốt nghiệp Đại học Kinh Tế năm 1983, chứng chỉ B Anh Vân'),
('NV008', 'TT', '4', N'Trần Minh', N'Nam', '1969-12-17', N'455/432 Ba Hat Q10', '8435523', '1992-03-17', N'Tốt nghiệp Đại học Kinh Tế năm 1991'),
('NV009', 'TD', '5', N'Hoàng Ly Ly', N'Nữ', '1968-02-13', N'178/3 Minh Phụng QI', '9129833', '1991-12-25', N'Tốt nghiệp Đại học Kinh Tế năm 1983'),
('NV010', 'TT', '5', N'Nguyễn Hoài Nam', N'Nam', '1970-12-07', N'321 Ba Huyen Thanh Quan Q3', '8523122', '1993-07-21', N'Tốt nghiệp Đại học Kinh Tế năm 1992'),
('NV011', 'TD', '6', N'Trần Văn Lâm', N'Nam', '1962-11-09', N'122/3 Minh Phung Q11', '9165002', '1986-12-13', N'Tốt nghiệp Đại học Kinh Tế năm 1985, chứng chỉ C Anh Vẫn'),
('NV012', 'TT', '6', N'Nguyễn Văn Hải', N'Nam', '1967-11-04', N'94/76 Trần Hưng Đạo Q1', '8332454', '1991-04-11', N'Tốt nghiệp Đại học Kinh Tế năm 1990'),
('NV013', 'TD', '7', N'Nguyễn Hoàng Minh', N'Nam', '1963-01-17', N'5511A/4 Bình Thời Q11', '9135521', '1987-02-16', N'Tốt nghiệp Đại học Kinh Tế năm 1985'),
('NV014', 'TT', '7', N'Phùng Văn Tín', N'Nam', '1975-11-19', N'14/44 Trần Bình Trọng Q5', '9884343', '1999-10-16', N'Tốt nghiệp Đại học Kinh Tế năm 1998, vị tinh văn phòng'),
('NV015', 'TD', '8', N'Hà Văn Tùng', N'Nam', '1966-03-10', N'2/45 Trần Bình Trọng Q5', '9987165', '1988-12-19', N'Tốt nghiệp Đại học Kinh Tế năm 1988, chứng chỉ C Anh Văn'),
('NV016', 'TT', '8', N'Nguyễn Văn Phú', N'Nam', '1962-08-14', N'454 Bùi Hữu Nghĩa QS', '8554911', '1987-12-02', N'Tốt nghiệp Đại học Kinh Tế năm 1986'),
('NV017', 'TD', '9', N'La Trí Trung', N'Nam', '1965-11-12', N'12 Minh Phụng Q11', '9631533', '1986-05-13', N'Tốt nghiệp Đại học Kinh Tế năm 1985, chứng chỉ C Anh Văn'),
('NV018', 'TT', '9', N'Trần Hồng Long', N'Nam', '1963-01-27', N'7 Lễ Lại Q1', '8897633', '1985-09-03', N'Tốt nghiệp Đại học Kinh Tế năm 1982'),
('NV019', 'TD', '10', N'Lưu Tuyết Nhi', N'Nữ', '1966-01-05', N'54/35 Bình Thới 011', '9634135', '1989-03-08', N'Tốt nghiệp Đại học Kinh Tế năm 1988, chứng chỉ C Anh Văn'),
-- Nhân viên NV020 phát sinh trong phiếu xuất/hóa đơn nhưng không nằm trong danh sách gốc (Thủ kho hoặc nhân viên đại diện bán)
('NV020', 'TT', '1', N'Nguyễn Văn Kho', N'Nam', '1975-01-01', N'Kho Tổng Unilever', '090909090', '2000-01-01', N'Nhân viên quản lý kho / chứng từ');

-- ====================================================================
-- 8. CHÈN DỮ LIỆU BẢNG PHIẾU XUẤT
-- ====================================================================
INSERT INTO PHIEU_XUAT (MAPX, MANV, NGAYXUAT) VALUES
('010202X0001', 'NV020', '2009-02-01'),
('010202X0002', 'NV020', '2009-02-01'),
('010202X0003', 'NV001', '2009-02-01'),
('010302X0001', 'NV001', '2009-03-01'),
('010302X0002', 'NV010', '2009-03-01'),
('010302X0003', 'NV010', '2009-03-01'),
('010402X0001', 'NV005', '2009-04-01'),
('010402X0002', 'NV006', '2009-04-01'),
('010402X0003', 'NV007', '2009-04-01'),
('010502X0001', 'NV002', '2009-05-01'),
('010502X0002', 'NV010', '2009-05-01'),
('010602X0001', 'NV019', '2009-06-01'),
('010602X0002', 'NV015', '2009-06-01'),
('010702X0001', 'NV008', '2009-07-01'),
('010702X0002', 'NV011', '2009-07-01'),
-- Mã phiếu xuất này phát sinh ở chi tiết phiếu xuất nhưng không có ở bảng phiếu xuất gốc
('010702X0003', 'NV007', '2009-07-01'); 

-- ====================================================================
-- 9. CHÈN DỮ LIỆU BẢNG CHI TIẾT PHIẾU XUẤT (CTPX)
-- ====================================================================
INSERT INTO CTPX (MAPX, MAHH, SOLUONG) VALUES
('010202X0001', 'BCCL1', 100),
('010202X0002', 'DDCCP', 60),
('010202X0003', 'BGVJ1', 200), -- Đã sửa mã phiếu đúng chuẩn cấu trúc sang X0003 từ lỗi đánh máy '01020200003' trong đề
('010302X0001', 'CLG01', 100),
('010302X0002', 'BG001', 50),
('010302X0003', 'CAL01', 150),
('010402X0001', 'CLG01', 100),
('010402X0002', 'DDCCP', 60),
('010402X0003', 'CLM01', 240),
('010502X0001', 'BG001', 24),
('010502X0002', 'CLG01', 144),
('010502X0002', 'CLM01', 144),
('010602X0001', 'CLG01', 100),
('010602X0001', 'ITD01', 100),
('010602X0002', 'CLG01', 100),
('010702X0001', 'BCCL1', 100),
('010702X0001', 'ITD01', 100),
('010702X0002', 'KDDH1', 60),
('010702X0003', 'CLG01', 120),
('010702X0003', 'KCNP1', 60);

-- ====================================================================
-- 10. CHÈN DỮ LIỆU BẢNG HÓA ĐƠN
-- ====================================================================
INSERT INTO HOA_DON (MAHD, MANV, MADL, NGAYLAP, TONGTIEN) VALUES
('010202HD001', 'NV006', 'DL011', '2008-02-01', 700000),
('010202HD002', 'NV008', 'DL003', '2008-02-01', 871500),
('010202HD003', 'NV014', 'DL004', '2008-02-01', 747000),
('010302HD001', 'NV016', 'DL011', '2008-03-01', 700000),
('010302HD002', 'NV005', 'DL003', '2008-03-01', 1767900),
('010302HD003', 'NV002', 'DL004', '2008-03-01', 747000),
('010402HD001', 'NV007', 'DL012', '2008-04-01', 766000),
('010402HD002', 'NV003', 'DL003', '2008-04-01', 1767900),
('010402HD003', 'NV012', 'DL005', '2008-04-01', 2191200),
('010502HD001', 'NV020', 'DL001', '2008-05-01', 151044),
('010502HD002', 'NV010', 'DL002', '2008-05-01', 336600),
('010602HD001', 'NV017', 'DL012', '2008-06-01', 1396000),
('010602HD002', 'NV013', 'DL004', '2008-06-01', 1767900),
('010702HD001', 'NV004', 'DL011', '2008-07-01', 700000),
('010702HD002', 'NV015', 'DL003', '2008-07-01', 896400);

-- ====================================================================
-- 11. CHÈN DỮ LIỆU BẢNG CHI TIẾT HÓA ĐƠN (CTHD)
-- ====================================================================
INSERT INTO CTHD (MAHD, MAHH, SLBAN, CKBAN, THANHTIEN) VALUES
('010202HD001', 'BG001', 50, 0.2, 700000),
('010202HD002', 'DDCCP', 30, 0.17, 871500),
('010202HD003', 'KCNP1', 60, 0.17, 747000),
('010302HD001', 'CLG01', 50, 0.2, 700000),
('010302HD002', 'ITD01', 30, 0.17, 871500),
('010302HD002', 'KDDH1', 60, 0.17, 896400),
('010302HD003', 'CAL01', 60, 0.17, 747000),
('010402HD001', 'BN001', 100, 0.2, 696000),
('010402HD001', 'CLG01', 50, 0.2, 70000),
('010402HD002', 'CMLB2', 60, 0.17, 896400),
('010402HD002', 'DDCCP', 30, 0.17, 871500),
('010402HD003', 'BGOM1', 60, 0.17, 747000),
('010402HD003', 'BGOM2', 60, 0.17, 1444200),
('010502HD001', 'BG001', 24, 0.18, 88560),
('010502HD001', 'BG002', 3, 0.18, 62484),
('010502HD002', 'CLG01', 72, 0.15, 122400),
('010502HD002', 'CLM01', 72, 0.15, 214200),
('010602HD001', 'CLG01', 50, 0.2, 700000),
('010602HD001', 'ITD01', 100, 0.2, 696000),
('010602HD002', 'DGLB1', 30, 0.17, 871500),
('010602HD002', 'KCNP1', 60, 0.17, 896400),
('010702HD001', 'CLG01', 50, 0.2, 700000),
('010702HD002', 'KDDH1', 60, 0.17, 896400); 



-- ============================================================================
-- INTEGRITY TRIGGERS
-- ============================================================================

-- -------------------------------------------------------
-- 1. TONGTIEN consistency (spec section 1.10-1.11)
-- TONGTIEN = SUM(THANHTIEN) per invoice
-- -------------------------------------------------------
CREATE TRIGGER trg_cthd_MaintainTotal ON CTHD
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE HOA_DON
    SET TONGTIEN = (
        SELECT COALESCE(SUM(THANHTIEN), 0)
        FROM CTHD
        WHERE CTHD.MAHD = HOA_DON.MAHD
    )
    WHERE MAHD IN (
        SELECT MAHD FROM inserted
        UNION
        SELECT MAHD FROM deleted
    );
END;
GO

-- -------------------------------------------------------
-- 2. LOAI_NV role constraints (spec section 1.5-1.6)
-- "Mỗi đội có một trưởng đội, một nhân viên giao hàng và các tiếp thị"
-- At most 1 team leader (TD) per team, at most 1 delivery (GH) per team
-- -------------------------------------------------------
CREATE TRIGGER trg_nhanvien_MaintainRoles ON NHAN_VIEN
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1 FROM inserted i
        WHERE i.MALNV = 'TD'
        GROUP BY i.MADOI
        HAVING COUNT(*) > 1
           OR EXISTS (
               SELECT 1 FROM NHAN_VIEN nv
               WHERE nv.MADOI = i.MADOI
                 AND nv.MALNV = 'TD'
                 AND nv.MANV != i.MANV
           )
    )
    BEGIN
        RAISERROR('Each team can have at most one team leader (TD)', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END;

    IF EXISTS (
        SELECT 1 FROM inserted i
        WHERE i.MALNV = 'GH'
        GROUP BY i.MADOI
        HAVING COUNT(*) > 1
           OR EXISTS (
               SELECT 1 FROM NHAN_VIEN nv
               WHERE nv.MADOI = i.MADOI
                 AND nv.MALNV = 'GH'
                 AND nv.MANV != i.MANV
           )
    )
    BEGIN
        RAISERROR('Each team can have at most one delivery person (GH)', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END;
END;
GO
