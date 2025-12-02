import { config } from "../../config";

const queries = [{
  "name": "Failed Order",
  "query": "eapi_method:SubmitOrder AND (NOT \"Order is submitted successfully.\") AND (NOT eapi_direction:Started)",
  "view": config.graylogFailedOrderSearchView
}];

export const GROUP_BY_COLUMN_1 = 'eapi_err_desc';
export const GROUP_BY_COLUMN_2 = 'eapi_cor_id';
export const GROUP_BY_COLUMN_3 = 'eapi_customer_id';
export const GROUP_BY_COLUMN_4 = 'eapi_loyalty_id';
export default queries;