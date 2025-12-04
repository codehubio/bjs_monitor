import { config } from "../../config";

const queries =[{
  "name": "Paypal",
  "query": "userflow_action:(ERR_PAYPAL_PAYMENT_EAPI_MP OR ERR_PAYPAL_PAYMENT_PAGE_LOAD OR ERR_PAYPAL_PAYMENT_VALIDATION OR ERR_PAYPAL_PAYMENT_EAPI OR ERR_PAYPAL_PAYMENT_PAGE_LOAD_MP OR ERR_PAYPAL_PAYMENT_VALIDATION_MP OR ERR_PAYPAL_PAYMENT_EAPI_MP OR COMPLETE_PAYPAL_PAYMENT OR APPROVE_PAYPAL_PAYMENT)",
  "view": config.graylogPaypalSearchView,
  "groupBy": ["userflow_action"]
}]

export default queries;
