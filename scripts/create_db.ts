import { DatabaseSync } from "node:sqlite";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(
  __dirname,
  "..",
  "public",
  "db",
  "Unilever_Product_Management.db",
);
const sqlPath = path.join(__dirname, "Unilever_Product_Management.sqlite.sql");

// Remove old database
try {
  fs.unlinkSync(dbPath);
} catch {
  /* ok */
}

const db = new DatabaseSync(dbPath);

db.exec("PRAGMA foreign_keys = ON");

const sql = fs.readFileSync(sqlPath, "utf8");
db.exec(sql);

// Verify
const tables = [
  "NHOM_HANG",
  "LOAI_NV",
  "HINH_THUC_DONG_GOI",
  "DAI_LY",
  "DOI",
  "HANG_HOA",
  "NHAN_VIEN",
  "PHIEU_XUAT",
  "CTPX",
  "HOA_DON",
  "CTHD",
];

console.log("=== Table Row Counts ===");
for (const t of tables) {
  const row = db.prepare(`SELECT COUNT(*) AS cnt FROM ${t}`).get() as Record<string, unknown>;
  console.log(`  ${t.padEnd(25)} ${row.cnt} rows`);
}

console.log("\n=== Product Catalog ===");
const products = db
  .prepare(
    `SELECT h.MAHH, h.TENHH, h.DVT, h.DONGIA, h.SLTON, n.TENNHOM
     FROM HANG_HOA h
     JOIN NHOM_HANG n ON h.MANHOM = n.MANHOM
     ORDER BY n.MANHOM, h.MAHH`,
  )
  .all() as Record<string, unknown>[];
console.log(`  Total: ${products.length} products`);
for (const p of products) {
  console.log(
    `  ${p.MAHH} | ${String(p.TENHH ?? "").padEnd(38)} | ${String(p.DONGIA).padStart(8)} | ${p.SLTON} tồn | ${p.TENNHOM}`,
  );
}

console.log("\n=== Team-to-Group Mapping ===");
const teams = db
  .prepare("SELECT MADOI, MANHOM FROM DOI ORDER BY CAST(MADOI AS INTEGER)")
  .all() as Record<string, unknown>[];
for (const t of teams) {
  console.log(`  Đội ${String(t.MADOI).padStart(2)} → ${t.MANHOM}`);
}

console.log("\n=== Employee Types ===");
const types = db.prepare("SELECT * FROM LOAI_NV").all() as Record<string, unknown>[];
for (const t of types) {
  console.log(`  ${t.MALNV} = ${t.TENLOAI}`);
}

console.log("\n=== Invoices with Agent Names ===");
const invoices = db
  .prepare(
    `SELECT hd.MAHD, hd.NGAYLAP, hd.TONGTIEN, dl.TENDL
     FROM HOA_DON hd
     JOIN DAI_LY dl ON hd.MADL = dl.MADL
     ORDER BY hd.NGAYLAP`,
  )
  .all() as Record<string, unknown>[];
for (const inv of invoices) {
  console.log(
    `  ${inv.MAHD} | ${inv.NGAYLAP} | ${String(inv.TONGTIEN).padStart(10)} | ${inv.TENDL}`,
  );
}

db.close();
console.log("\n✓ Database saved to public/db/Unilever_Product_Management.db");
