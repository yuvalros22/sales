const map = {};
const rows = [
  { itemCode: "1", modelCode: "A", quality: "Good", bloomPct: "50", quantity: 10, itemName: "Item", modelName: "Model" },
  { itemCode: "1", modelCode: "A", quality: "Good", bloomPct: "50", quantity: 20, itemName: "Item", modelName: "Model" }
];

for (const row of rows) {
  const { itemCode, modelCode, quality, bloomPct, quantity, itemName, modelName } = row;
  const key = `${itemCode}|${modelCode}|${quality}|${bloomPct}`;
  if (map[key]) {
    map[key].quantity += quantity;
  } else {
    map[key] = { itemCode, itemName, modelCode, modelName, quality, bloomPct, quantity };
  }
}

console.log(Object.values(map));
