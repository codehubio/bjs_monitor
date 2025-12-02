import { config } from "../../config";

const queries =[{
  "name": "Paypal Error",
  "query": "userflow_action:(ERR_PAYPAL_PAYMENT_EAPI_MP OR ERR_PAYPAL_PAYMENT_PAGE_LOAD OR ERR_PAYPAL_PAYMENT_VALIDATION OR ERR_PAYPAL_PAYMENT_EAPI OR ERR_PAYPAL_PAYMENT_PAGE_LOAD_MP OR ERR_PAYPAL_PAYMENT_VALIDATION_MP OR ERR_PAYPAL_PAYMENT_EAPI_MP)",
  "view": config.graylogPaypalSearchView
}]
export const GROUP_BY_COLUMN = 'userflow_action';
export default queries;