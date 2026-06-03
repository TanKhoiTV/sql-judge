-- ============================================================================
-- SQLite Version: Unilever Product Management Database
-- Matches:       sample.sql (reference file) with SQLite-compatible types
-- All integrity constraints per specification (section 1.1-1.11)
-- ============================================================================

-- 1.1 NHOM_HANG
-- Spec: mỗi nhóm có một mã nhóm để phân biệt
CREATE TABLE IF NOT EXISTS NHOM_HANG (
    MANHOM  TEXT PRIMARY KEY,
    TENNHOM TEXT NOT NULL
);

-- 1.6 LOAI_NV
-- Spec: các vai trò khác nhau được phân biệt bởi mã loại nhân viên
CREATE TABLE IF NOT EXISTS LOAI_NV (
    MALNV   TEXT PRIMARY KEY,
    TENLOAI TEXT NOT NULL
);

-- 1.3 HINH_THUC_DONG_GOI
-- Spec: tối đa 4 cấp tính cho một loại hàng hóa, mỗi hàng hóa có một mã đóng gói
CREATE TABLE IF NOT EXISTS HINH_THUC_DONG_GOI (
    MAHTDG TEXT PRIMARY KEY,
    THUNG  INTEGER NOT NULL CHECK(THUNG > 0),
    LOC    INTEGER CHECK(LOC >= 0)
);

-- 1.7 DAI_LY
-- Spec: mỗi đại lý có một mã duy nhất, một mã số thuế
CREATE TABLE IF NOT EXISTS DAI_LY (
    MADL      TEXT PRIMARY KEY,
    TENDL     TEXT NOT NULL,
    MASOTHUE  TEXT NOT NULL UNIQUE,
    DIACHI    TEXT,
    DIENTHOAI TEXT
);

-- 1.4 DOI
-- Spec: công ty có 10 đội, mỗi đội phụ trách một nhóm hàng
CREATE TABLE IF NOT EXISTS DOI (
    MADOI  TEXT PRIMARY KEY,
    MANHOM TEXT NOT NULL,
    FOREIGN KEY (MANHOM) REFERENCES NHOM_HANG(MANHOM)
);

-- 1.2 HANG_HOA
-- Spec: mỗi hàng hóa được đánh mã, có tên, đơn vị tính, đơn giá, số lượng tồn,
--        được xếp vào một nhóm hàng, và có một mã đóng gói
CREATE TABLE IF NOT EXISTS HANG_HOA (
    MAHH   TEXT PRIMARY KEY,
    MAHTDG TEXT NOT NULL,
    MANHOM TEXT NOT NULL,
    TENHH  TEXT NOT NULL,
    DVT    TEXT NOT NULL,
    DONGIA REAL    NOT NULL CHECK(DONGIA > 0),
    SLTON  INTEGER NOT NULL CHECK(SLTON >= 0),
    FOREIGN KEY (MAHTDG) REFERENCES HINH_THUC_DONG_GOI(MAHTDG),
    FOREIGN KEY (MANHOM) REFERENCES NHOM_HANG(MANHOM)
);

-- 1.5 NHAN_VIEN
-- Spec: mỗi nhân viên có mã, thuộc một loại NV, thuộc một đội, có họ tên, giới tính,
--        năm sinh, địa chỉ, điện thoại, ngày vào làm
CREATE TABLE IF NOT EXISTS NHAN_VIEN (
    MANV       TEXT PRIMARY KEY,
    MALNV      TEXT NOT NULL,
    MADOI      TEXT NOT NULL,
    HOTEN      TEXT NOT NULL,
    GIOITINH   TEXT NOT NULL CHECK(GIOITINH IN ('Nam', 'Nữ')),
    NAMSINH    TEXT,
    DIACHI     TEXT,
    DIENTHOAI  TEXT,
    NGAYVAOLAM TEXT NOT NULL,
    GHICHU     TEXT,
    FOREIGN KEY (MALNV) REFERENCES LOAI_NV(MALNV),
    FOREIGN KEY (MADOI) REFERENCES DOI(MADOI)
);

-- 1.8 PHIEU_XUAT
-- Spec: thủ kho lập phiếu xuất kho, lập cho một nhân viên vào một ngày xuất
CREATE TABLE IF NOT EXISTS PHIEU_XUAT (
    MAPX     TEXT PRIMARY KEY,
    MANV     TEXT NOT NULL,
    NGAYXUAT TEXT NOT NULL,
    FOREIGN KEY (MANV) REFERENCES NHAN_VIEN(MANV)
);

-- 1.9 CTPX
-- Spec: ứng với mỗi phiếu có thể có nhiều mặt hàng với số lượng cụ thể
CREATE TABLE IF NOT EXISTS CTPX (
    MAPX    TEXT    NOT NULL,
    MAHH    TEXT    NOT NULL,
    SOLUONG INTEGER NOT NULL CHECK(SOLUONG > 0),
    PRIMARY KEY (MAPX, MAHH),
    FOREIGN KEY (MAPX) REFERENCES PHIEU_XUAT(MAPX),
    FOREIGN KEY (MAHH) REFERENCES HANG_HOA(MAHH)
);

-- 1.10 HOA_DON
-- Spec: nhân viên cấp hóa đơn cho khách hàng vào một ngày lập, ghi tổng tiền
CREATE TABLE IF NOT EXISTS HOA_DON (
    MAHD     TEXT PRIMARY KEY,
    MANV     TEXT  NOT NULL,
    MADL     TEXT  NOT NULL,
    NGAYLAP  TEXT  NOT NULL,
    TONGTIEN REAL  NOT NULL CHECK(TONGTIEN >= 0),
    FOREIGN KEY (MANV) REFERENCES NHAN_VIEN(MANV),
    FOREIGN KEY (MADL) REFERENCES DAI_LY(MADL)
);

-- 1.11 CTHD
-- Spec: mỗi hóa đơn có thể có nhiều hàng, ghi số lượng bán, chiết khấu và thành tiền
CREATE TABLE IF NOT EXISTS CTHD (
    MAHD      TEXT   NOT NULL,
    MAHH      TEXT   NOT NULL,
    SLBAN     INTEGER NOT NULL CHECK(SLBAN > 0),
    CKBAN     REAL   NOT NULL CHECK(CKBAN >= 0 AND CKBAN <= 1),
    THANHTIEN REAL   NOT NULL CHECK(THANHTIEN >= 0),
    PRIMARY KEY (MAHD, MAHH),
    FOREIGN KEY (MAHD) REFERENCES HOA_DON(MAHD),
    FOREIGN KEY (MAHH) REFERENCES HANG_HOA(MAHH)
);

-- Indexes
CREATE INDEX IF NOT EXISTS IX_HANGHOA_MAHTDG ON HANG_HOA(MAHTDG);
CREATE INDEX IF NOT EXISTS IX_HANGHOA_MANHOM ON HANG_HOA(MANHOM);
CREATE INDEX IF NOT EXISTS IX_NHANVIEN_MADOI ON NHAN_VIEN(MADOI);
CREATE INDEX IF NOT EXISTS IX_NHANVIEN_MALNV ON NHAN_VIEN(MALNV);
CREATE INDEX IF NOT EXISTS IX_PHIEUXUAT_MANV ON PHIEU_XUAT(MANV);
CREATE INDEX IF NOT EXISTS IX_CTPX_MAHH      ON CTPX(MAHH);
CREATE INDEX IF NOT EXISTS IX_HOADON_MANV    ON HOA_DON(MANV);
CREATE INDEX IF NOT EXISTS IX_HOADON_MADL    ON HOA_DON(MADL);
CREATE INDEX IF NOT EXISTS IX_CTHD_MAHH      ON CTHD(MAHH);

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- NHOM_HANG: 4 groups per spec
INSERT OR IGNORE INTO NHOM_HANG (MANHOM, TENNHOM) VALUES
('BOT',  'Bột'),
('CSSD', 'Chăm sóc sắc đẹp'),
('CSTT', 'Chăm sóc thân thể'),
('TP',   'Thực phẩm');

-- LOAI_NV: 3 roles per spec (trưởng đội, giao hàng, tiếp thị)
INSERT OR IGNORE INTO LOAI_NV (MALNV, TENLOAI) VALUES
('GH', 'Giao hàng'),
('TD', 'Trưởng đội'),
('TT', 'Tiếp thị');

-- HINH_THUC_DONG_GOI: 20 packaging formats
INSERT OR IGNORE INTO HINH_THUC_DONG_GOI (MAHTDG, THUNG, LOC) VALUES
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

-- DAI_LY: 12 agents
INSERT OR IGNORE INTO DAI_LY (MADL, TENDL, MASOTHUE, DIACHI, DIENTHOAI) VALUES
('DL001', 'Cửa hàng bách hóa tổng hợp IC',                     '020220118412', '202 Trần Hưng Đạo, P5, Q5, TPHCM',  '08990771'),
('DL002', 'Công ty bách hóa Long An',                          '013444432943', '99 Hoàng Hoa Thám, Long An',        '0658515044'),
('DL003', 'Cửa hàng tổng hợp DDC',                             '085784344522', '50 Phạm Ngọc Thạch, Long Xuyên',     '075611299'),
('DL004', 'Chi nhánh 2 công ty bách hoa FH',                   '093328330377', '11 Lý Tự Trọng, Vũng Tàu',           '0568900122'),
('DL005', 'Cửa hàng tổng hợp ABX',                             '011445367745', '2 Nguyễn Chí Thanh, Cần Thơ',         '071811111'),
('DL006', 'Công ty ASB',                                       '045567845454', '1 Nguyễn Huệ, Đà Lạt',                '045990722'),
('DL007', 'Công ty bách hóa Đà Nẵng',                          '011546234533', '98 Hoàng Văn Thu, Đà Nẵng',           '022877133'),
('DL008', 'Cửa hàng bách hóa BBF',                             '011443354534', '56 Đề Thám, Nha Trang',               '060871155'),
('DL009', 'Cửa hàng bách hóa GTT',                             '085089664433', '112 Lê Lợi, Hà Nội',                  '0129890731'),
('DL010', 'Công ty ACD',                                       '058023458397', '45 Quốc Lộ 1A, Bến Tre',              '062811077'),
('DL011', 'Cửa hàng thực phẩm ABC',                            '034093362343', '355 Nguyễn Chí Thanh, Q1, TPHCM',     '089890211'),
('DL012', 'Cửa hàng bách hóa tổng hợp phát sinh DL012',        '034099999999', 'Địa chỉ đại lý DL012',                '089899999');

-- DOI: 10 teams per spec, mapped to 4 product groups
INSERT OR IGNORE INTO DOI (MADOI, MANHOM) VALUES
('1',  'BOT'),
('2',  'BOT'),
('3',  'CSTT'),
('4',  'CSTT'),
('5',  'CSTT'),
('6',  'CSSD'),
('7',  'CSSD'),
('8',  'CSSD'),
('9',  'TP'),
('10', 'TP');

-- HANG_HOA: 21 products
INSERT OR IGNORE INTO HANG_HOA (MAHH, MAHTDG, MANHOM, TENHH, DVT, DONGIA, SLTON) VALUES
('BCCL1', '10010', 'CSTT', 'Bàn chải Close-up năng động (72)',  'cây',  7000,   1200),
('BCCL2', '10010', 'CSTT', 'Bàn chải Close-up Fresh(720)',     'cây',  4000,   700),
('BCCL3', '10010', 'CSTT', 'Bàn chải Close-up Flesx',          'cây',  6700,   400),
('BG001', '2400',  'BOT',  'Bột giặt Omo 30g',                 'dây',  4500,   240),
('BG002', '3600',  'BOT',  'Bột giặt Omo 200g',                 'gói',  2900,   108),
('BGOM1', '1200',  'BOT',  'Bột giặt Omo Matic 1000g',         'hộp',  17400,  48),
('BGOM2', '600',   'BOT',  'Bột giặt Omo Matic 4000g',         'hộp',  69000,  36),
('BGVJ1', '1200',  'BOT',  'Bột giặt Viso Javel 700ml',        'chai', 3150,   60),
('BN001', '6000',  'TP',   'Bột nêm',                           'gói',  1350,   390),
('CAL01', '3000',  'TP',   'Cháo ăn liền',                     'gói',  720,    450),
('CLG01', '14412', 'CSTT', 'Close-up Green 40g',               'cây',  2000,   1440),
('CLM01', '14412', 'CSTT', 'Close-up muoi 40g',                'cây',  3500,   1152),
('CMLB2', '3606',  'CSTT', 'Lifebouy chống muỗi 100ml',        'chai', 15000,  108),
('DDCCP', '6000',  'CSSD', 'Kem dưỡng da cao cấp Ponds 50g',   'chai', 3500,   420),
('DGCB1', '7200',  'CSTT', 'Dầu gội Clear bạc hà 7ml',         'dây',  9600,   144),
('DGCB2', '3612',  'CSTT', 'Dầu gội Clear bạc hà 100ml',       'chai', 13500,  108),
('DGD01', '3612',  'CSTT', 'Dầu gội Dove 100ml',               'chai', 15000,  360),
('DGLB1', '7200',  'CSTT', 'Dầu gội Lifebouy 6ml',             'dây',  4800,   216),
('ITD01', '7200',  'TP',   'Icetea day 10g',                   'dây',  8700,   216),
('KCNP1', '6006',  'CSSD', 'Kem chống nắng Ponds 20g',         'chai', 20000,  360),
('KDDH1', '3612',  'CSTT', 'Kem đánh răng Close-up bạc hà phát sinh', 'cây', 10000, 300);

-- NHAN_VIEN: 20 employees across 10 teams
INSERT OR IGNORE INTO NHAN_VIEN (MANV, MALNV, MADOI, HOTEN, GIOITINH, NAMSINH, DIACHI, DIENTHOAI, NGAYVAOLAM, GHICHU) VALUES
('NV001', 'TD',  '1',  'Huỳnh Trí Lâm',     'Nam', '1960-12-12', '12 Minh Phung Q11',               '9634165', '1984-05-03', 'Tốt nghiệp Đại học Kinh Tế năm 1982, chứng chỉ C Anh Văn'),
('NV002', 'TT',  '1',  'Trần Văn Minh',     'Nam', '1965-01-21', '7 Lễ Lại Q1',                      '8202933', '1980-09-13', 'Tốt nghiệp Đại học Kinh Tế năm 1987'),
('NV003', 'TD',  '2',  'Trần Hoàng Ngân',   'Nữ',  '1962-01-07', '551/1A Lạc Long Quân Q1',           '9112135', '1985-12-26', 'Tốt nghiệp Đại học Kinh Tế năm 1984'),
('NV004', 'GH',  '2',  'Lý Hoài An',        'Nam', '1977-02-24', '1024/1 Hùng Vương Q5',              '9425354', '1999-12-14', 'Tot nghiep Phe Thong Trung Hoc'),
('NV005', 'TD',  '3',  'Lâm Trọng Tín',     'Nam', '1965-03-13', '2 Trần Bình Trọng, Q5',             '9987165', '1987-07-19', 'Tốt nghiệp Đại học Kinh Tế năm 1987, chứng chỉ C Anh Văn'),
('NV006', 'TT',  '3',  'Nguyễn Văn Phương', 'Nam', '1967-09-04', '56 Nguyễn Huệ QI',                  '8233911', '1995-12-01', 'Tốt nghiệp Đại học Kinh Tế năm 1989'),
('NV007', 'TD',  '4',  'Trần Minh Tâm',     'Nữ',  '1961-02-03', '78 Hàn Hải Nguyên Q11',             '9345235', '1984-06-05', 'Tốt nghiệp Đại học Kinh Tế năm 1983, chứng chỉ B Anh Vân'),
('NV008', 'TT',  '4',  'Trần Minh',         'Nam', '1969-12-17', '455/432 Ba Hat Q10',               '8435523', '1992-03-17', 'Tốt nghiệp Đại học Kinh Tế năm 1991'),
('NV009', 'TD',  '5',  'Hoàng Ly Ly',       'Nữ',  '1968-02-13', '178/3 Minh Phụng QI',               '9129833', '1991-12-25', 'Tốt nghiệp Đại học Kinh Tế năm 1983'),
('NV010', 'TT',  '5',  'Nguyễn Hoài Nam',   'Nam', '1970-12-07', '321 Ba Huyen Thanh Quan Q3',        '8523122', '1993-07-21', 'Tốt nghiệp Đại học Kinh Tế năm 1992'),
('NV011', 'TD',  '6',  'Trần Văn Lâm',      'Nam', '1962-11-09', '122/3 Minh Phung Q11',              '9165002', '1986-12-13', 'Tốt nghiệp Đại học Kinh Tế năm 1985, chứng chỉ C Anh Vẫn'),
('NV012', 'TT',  '6',  'Nguyễn Văn Hải',    'Nam', '1967-11-04', '94/76 Trần Hưng Đạo Q1',            '8332454', '1991-04-11', 'Tốt nghiệp Đại học Kinh Tế năm 1990'),
('NV013', 'TD',  '7',  'Nguyễn Hoàng Minh', 'Nam', '1963-01-17', '5511A/4 Bình Thời Q11',             '9135521', '1987-02-16', 'Tốt nghiệp Đại học Kinh Tế năm 1985'),
('NV014', 'TT',  '7',  'Phùng Văn Tín',     'Nam', '1975-11-19', '14/44 Trần Bình Trọng Q5',           '9884343', '1999-10-16', 'Tốt nghiệp Đại học Kinh Tế năm 1998, vị tinh văn phòng'),
('NV015', 'TD',  '8',  'Hà Văn Tùng',       'Nam', '1966-03-10', '2/45 Trần Bình Trọng Q5',            '9987165', '1988-12-19', 'Tốt nghiệp Đại học Kinh Tế năm 1988, chứng chỉ C Anh Văn'),
('NV016', 'TT',  '8',  'Nguyễn Văn Phú',    'Nam', '1962-08-14', '454 Bùi Hữu Nghĩa QS',              '8554911', '1987-12-02', 'Tốt nghiệp Đại học Kinh Tế năm 1986'),
('NV017', 'TD',  '9',  'La Trí Trung',      'Nam', '1965-11-12', '12 Minh Phụng Q11',                  '9631533', '1986-05-13', 'Tốt nghiệp Đại học Kinh Tế năm 1985, chứng chỉ C Anh Văn'),
('NV018', 'TT',  '9',  'Trần Hồng Long',    'Nam', '1963-01-27', '7 Lễ Lại Q1',                       '8897633', '1985-09-03', 'Tốt nghiệp Đại học Kinh Tế năm 1982'),
('NV019', 'TD',  '10', 'Lưu Tuyết Nhi',     'Nữ',  '1966-01-05', '54/35 Bình Thới 011',               '9634135', '1989-03-08', 'Tốt nghiệp Đại học Kinh Tế năm 1988, chứng chỉ C Anh Văn'),
('NV020', 'TT',  '1',  'Nguyễn Văn Kho',    'Nam', '1975-01-01', 'Kho Tổng Unilever',                  '090909090', '2000-01-01', 'Nhân viên quản lý kho / chứng từ');

-- PHIEU_XUAT: 16 warehouse export notes
INSERT OR IGNORE INTO PHIEU_XUAT (MAPX, MANV, NGAYXUAT) VALUES
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
('010702X0003', 'NV007', '2009-07-01');

-- CTPX: export note line items
INSERT OR IGNORE INTO CTPX (MAPX, MAHH, SOLUONG) VALUES
('010202X0001', 'BCCL1', 100),
('010202X0002', 'DDCCP', 60),
('010202X0003', 'BGVJ1', 200),
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

-- HOA_DON: 15 invoices with TONGTIEN = SUM(THANHTIEN) per spec section 1.10
INSERT OR IGNORE INTO HOA_DON (MAHD, MANV, MADL, NGAYLAP, TONGTIEN) VALUES
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

-- CTHD: invoice line items
INSERT OR IGNORE INTO CTHD (MAHD, MAHH, SLBAN, CKBAN, THANHTIEN) VALUES
('010202HD001', 'BG001',  50,  0.20, 700000),
('010202HD002', 'DDCCP',  30,  0.17, 871500),
('010202HD003', 'KCNP1',  60,  0.17, 747000),
('010302HD001', 'CLG01',  50,  0.20, 700000),
('010302HD002', 'ITD01',  30,  0.17, 871500),
('010302HD002', 'KDDH1',  60,  0.17, 896400),
('010302HD003', 'CAL01',  60,  0.17, 747000),
('010402HD001', 'BN001',  100, 0.20, 696000),
('010402HD001', 'CLG01',  50,  0.20, 70000),
('010402HD002', 'CMLB2',  60,  0.17, 896400),
('010402HD002', 'DDCCP',  30,  0.17, 871500),
('010402HD003', 'BGOM1',  60,  0.17, 747000),
('010402HD003', 'BGOM2',  60,  0.17, 1444200),
('010502HD001', 'BG001',  24,  0.18, 88560),
('010502HD001', 'BG002',  3,   0.18, 62484),
('010502HD002', 'CLG01',  72,  0.15, 122400),
('010502HD002', 'CLM01',  72,  0.15, 214200),
('010602HD001', 'CLG01',  50,  0.20, 700000),
('010602HD001', 'ITD01',  100, 0.20, 696000),
('010602HD002', 'DGLB1',  30,  0.17, 871500),
('010602HD002', 'KCNP1',  60,  0.17, 896400),
('010702HD001', 'CLG01',  50,  0.20, 700000),
('010702HD002', 'KDDH1',  60,  0.17, 896400);

-- ============================================================================
-- INTEGRITY TRIGGERS
-- ============================================================================

-- -------------------------------------------------------
-- 1. TONGTIEN consistency (spec section 1.10-1.11)
-- TONGTIEN = SUM(CTHD.THANHTIEN) per invoice
-- -------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_cthd_insert AFTER INSERT ON CTHD
BEGIN
    UPDATE HOA_DON SET TONGTIEN = (
        SELECT COALESCE(SUM(THANHTIEN), 0) FROM CTHD WHERE CTHD.MAHD = NEW.MAHD
    ) WHERE MAHD = NEW.MAHD;
END;

CREATE TRIGGER IF NOT EXISTS trg_cthd_update AFTER UPDATE ON CTHD
BEGIN
    UPDATE HOA_DON SET TONGTIEN = (
        SELECT COALESCE(SUM(THANHTIEN), 0) FROM CTHD WHERE CTHD.MAHD = NEW.MAHD
    ) WHERE MAHD = NEW.MAHD;
    UPDATE HOA_DON SET TONGTIEN = (
        SELECT COALESCE(SUM(THANHTIEN), 0) FROM CTHD WHERE CTHD.MAHD = OLD.MAHD
    ) WHERE MAHD = OLD.MAHD AND OLD.MAHD != NEW.MAHD;
END;

CREATE TRIGGER IF NOT EXISTS trg_cthd_delete AFTER DELETE ON CTHD
BEGIN
    UPDATE HOA_DON SET TONGTIEN = (
        SELECT COALESCE(SUM(THANHTIEN), 0) FROM CTHD WHERE CTHD.MAHD = OLD.MAHD
    ) WHERE MAHD = OLD.MAHD;
END;

-- -------------------------------------------------------
-- 2. LOAI_NV role constraints (spec section 1.5-1.6)
-- "Mỗi đội có một trưởng đội, một nhân viên giao hàng và các tiếp thị"
-- At most 1 team leader (TD) per team, at most 1 delivery (GH) per team
-- -------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_nhanvien_insert_update
AFTER INSERT ON NHAN_VIEN
BEGIN
    SELECT CASE
        WHEN NEW.MALNV = 'TD' AND (
            SELECT COUNT(*) FROM NHAN_VIEN
            WHERE MADOI = NEW.MADOI AND MALNV = 'TD' AND MANV != NEW.MANV
        ) >= 1 THEN RAISE(ABORT, 'Each team can have at most one team leader (TD)')
        WHEN NEW.MALNV = 'GH' AND (
            SELECT COUNT(*) FROM NHAN_VIEN
            WHERE MADOI = NEW.MADOI AND MALNV = 'GH' AND MANV != NEW.MANV
        ) >= 1 THEN RAISE(ABORT, 'Each team can have at most one delivery person (GH)')
    END;
END;

CREATE TRIGGER IF NOT EXISTS trg_nhanvien_update_role
AFTER UPDATE OF MALNV ON NHAN_VIEN
BEGIN
    SELECT CASE
        WHEN NEW.MALNV = 'TD' AND (
            SELECT COUNT(*) FROM NHAN_VIEN
            WHERE MADOI = NEW.MADOI AND MALNV = 'TD' AND MANV != NEW.MANV
        ) >= 1 THEN RAISE(ABORT, 'Each team can have at most one team leader (TD)')
        WHEN NEW.MALNV = 'GH' AND (
            SELECT COUNT(*) FROM NHAN_VIEN
            WHERE MADOI = NEW.MADOI AND MALNV = 'GH' AND MANV != NEW.MANV
        ) >= 1 THEN RAISE(ABORT, 'Each team can have at most one delivery person (GH)')
    END;
END;

-- -------------------------------------------------------
-- 3. HOA_DON validator: TONGTIEN must match SUM of line items
-- on initial INSERT (the CTHD triggers handle subsequent changes)
-- -------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_hoadon_insert_tongtien
AFTER INSERT ON HOA_DON
BEGIN
    UPDATE HOA_DON SET TONGTIEN = (
        SELECT COALESCE(SUM(THANHTIEN), 0) FROM CTHD WHERE CTHD.MAHD = NEW.MAHD
    ) WHERE MAHD = NEW.MAHD AND TONGTIEN IS NULL;
END;

-- ============================================================================
-- Add to server.js /api/schema endpoint: these triggers enforce all
-- business rules from the PDF specification.
--
-- Summary of integrity checks by table:
--   NHOM_HANG:      PK, TENNHOM NOT NULL
--   LOAI_NV:        PK, TENLOAI NOT NULL
--   HINH_THUC_DONG_GOI: PK, THUNG>0, LOC>=0
--   DAI_LY:         PK, TENDL NOT NULL, MASOTHUE NOT NULL UNIQUE
--   DOI:            PK, MANHOM NOT NULL, FK→NHOM_HANG
--   HANG_HOA:       PK, MAHTDG NOT NULL, MANHOM NOT NULL, DVT NOT NULL,
--                   DONGIA>0, SLTON>=0, FK→NHOM_HANG+HINH_THUC_DONG_GOI
--   NHAN_VIEN:      PK, MALNV NOT NULL, MADOI NOT NULL, HOTEN NOT NULL,
--                   GIOITINH IN('Nam','Nữ'), NGAYVAOLAM NOT NULL,
--                   max 1 TD+max 1 GH per team (trigger), FK→DOI+LOAI_NV
--   PHIEU_XUAT:     PK, MANV NOT NULL, NGAYXUAT NOT NULL, FK→NHAN_VIEN
--   CTPX:           PK(MAPX,MAHH), SOLUONG>0, FK→PHIEU_XUAT+HANG_HOA
--   HOA_DON:        PK, MANV NOT NULL, MADL NOT NULL, NGAYLAP NOT NULL,
--                   TONGTIEN>=0, TONGTIEN=SUM(THANHTIEN) (trigger),
--                   FK→NHAN_VIEN+DAI_LY
--   CTHD:           PK(MAHD,MAHH), SLBAN>0, CKBAN∈[0,1], THANHTIEN>=0,
--                   FK→HOA_DON+HANG_HOA, triggers update HOA_DON.TONGTIEN
-- ============================================================================
