import { apiClient, type ApiRecord } from "@/lib/api-client";
import {
  firstValue,
  recordAmount,
  recordDate,
  recordIdentifier,
  recordTitle,
} from "../../resources/resource-api";
import type {
  SalesQuery,
  SalesRecord,
  SalesRecordInput,
  SalesRepository,
  SalesResource,
} from "../domain/sales-record";

function toDomain(
  resource: SalesResource,
  record: ApiRecord,
  customerNames: Map<string, string> = new Map(),
): SalesRecord {
  const customerId = String(record.data.customerId ?? "");
  return {
    id: record.id,
    displayId: recordIdentifier(record),
    resource,
    customer:
      resource === "customers"
        ? recordTitle(record)
        : (customerNames.get(customerId) ?? "Customer not assigned"),
    amount: recordAmount(record),
    date: recordDate(record),
    status: record.status,
    reference: firstValue(
      record,
      ["documentNumber", "reference", "poNumber"],
      "",
    ),
    paymentMethod: firstValue(record, ["paymentMethod"], ""),
    memo: firstValue(record, ["memo", "message"], ""),
    version: record.version,
    data: record.data,
  };
}

export class ApiSalesRepository implements SalesRepository {
  private async customerNames() {
    const response = await apiClient.list(
      "sales",
      "customers",
      "page=1&pageSize=200",
    );
    return new Map(
      response.data.map((customer) => [customer.id, recordTitle(customer)]),
    );
  }

  async list(resource: SalesResource, query: SalesQuery = {}) {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("pageSize", "200");
    if (query.search) params.set("search", query.search);
    if (query.status && query.status !== "All statuses")
      params.set("status", query.status);
    const [response, customerNames] = await Promise.all([
      apiClient.list("sales", resource, params.toString()),
      resource === "customers"
        ? Promise.resolve(new Map<string, string>())
        : this.customerNames(),
    ]);
    return response.data.map((record) =>
      toDomain(resource, record, customerNames),
    );
  }

  async get(resource: SalesResource, id: string) {
    const [response, customerNames] = await Promise.all([
      apiClient.get("sales", resource, id),
      resource === "customers"
        ? Promise.resolve(new Map<string, string>())
        : this.customerNames(),
    ]);
    return toDomain(resource, response.data, customerNames);
  }

  async create(resource: SalesResource, input: SalesRecordInput) {
    return toDomain(
      resource,
      (await apiClient.create("sales", resource, input, input.status)).data,
    );
  }

  async update(
    resource: SalesResource,
    id: string,
    input: Partial<SalesRecordInput>,
  ) {
    const current = (await apiClient.get("sales", resource, id)).data;
    return toDomain(
      resource,
      (
        await apiClient.update(
          "sales",
          resource,
          id,
          input,
          current.version,
          input.status,
        )
      ).data,
    );
  }

  async remove(resource: SalesResource, id: string) {
    await apiClient.remove("sales", resource, id);
  }
}
