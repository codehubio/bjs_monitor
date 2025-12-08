import { config } from "../../config";

const queries =[{
  "name": "Failed Order",
  "query": "eapi_method:SubmitOrder AND (NOT \"Order is submitted successfully.\") AND (NOT eapi_direction:Started)",
  "view": config.graylogFailedOrderSearchView,
  "groupBy": ["eapi_err_desc", "eapi_cor_id", "eapi_customer_id", "eapi_loyalty_id"]
}]

export default queries;
