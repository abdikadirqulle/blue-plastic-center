const fieldAliases: Record<string, string[]> = {
  customer: ["customerId", "customerName"],
  customerName: ["displayName", "customerId", "customer"],
  vendor: ["vendorId", "vendorName"],
  vendorName: ["displayName", "vendorId", "vendor"],
  project: ["projectId"],
  employee: ["employeeId"],
  warehouse: ["warehouseId"],
  account: ["accountId"],
  item: ["itemId"],
  poNumber: ["customerPurchaseOrder", "reference"],
  customerPurchaseOrder: ["poNumber", "reference"],
  incomeAccountId: ["incomeAccount"],
  expenseAccountId: ["cogsAccount", "expenseAccount"],
  inventoryAccountId: ["assetAccount", "inventoryAccount"],
  preferredVendorId: ["preferredVendor"],
};

export function resourceFieldValue(
  fieldName: string,
  data: Record<string, unknown>,
) {
  const key = [fieldName, ...(fieldAliases[fieldName] ?? [])].find(
    (candidate) =>
      data[candidate] !== undefined &&
      data[candidate] !== null &&
      data[candidate] !== "",
  );
  return key ? data[key] : undefined;
}

export function hydrateResourceFormValues(
  fieldNames: string[],
  data: Record<string, unknown>,
  defaults: Record<string, string> = {},
) {
  return Object.fromEntries(
    fieldNames.map((fieldName) => {
      const value = resourceFieldValue(fieldName, data);
      if (value === undefined || value === null || value === "")
        return [fieldName, defaults[fieldName] ?? ""];
      return [
        fieldName,
        typeof value === "object" ? JSON.stringify(value) : String(value),
      ];
    }),
  );
}

export function normalizeResourceData(values: Record<string, unknown>) {
  const data = { ...values };
  const targets: Record<string, string[]> = {
    customerId: ["customerId", "customer", "customerName"],
    vendorId: ["vendorId", "vendor", "vendorName"],
    projectId: ["projectId", "project"],
    employeeId: ["employeeId", "employee"],
    warehouseId: ["warehouseId", "warehouse"],
    accountId: ["accountId", "account"],
    displayName: [
      "displayName",
      "customerName",
      "vendorName",
      "customer",
      "vendor",
      "name",
    ],
    customerPurchaseOrder: ["customerPurchaseOrder", "poNumber"],
  };
  for (const [target, sources] of Object.entries(targets)) {
    if (data[target] !== undefined && data[target] !== "") continue;
    const source = sources.find(
      (candidate) => data[candidate] !== undefined && data[candidate] !== "",
    );
    if (source) data[target] = data[source];
  }
  return data;
}
