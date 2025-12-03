import { config } from "../../config";

const queries =[{
  "name": "All EAPI calls",
  "query": "NOT eapi_direction:Started",
  "view": config.graylogDailyEapiSearchView
}, {
  "name": "Total EAPI cronjob", 
  "query":"eapi_ip:undefined",
  "view": config.graylogDailyEapiSearchView
}, {
  "name": "Failed EAPI calls by http",
  "query":`eapi_http_status:>500 OR ((NOT eapi_direction:Ended) AND (NOT eapi_direction:Started) AND (NOT "expectedAction") AND (NOT "maps.googleapis.com") AND (NOT "apple-pay-gateway.apple.com") AND (NOT "aem.prod.bjsrestaurants.com"))`,
  "view": config.graylogDailyEapiSearchView
}, {
  "name": "EAPI calls by duration > 10 seconds",
  "query":"eapi_duration:>10000",
  "view": config.graylogDailyEapiSearchView
}, {
  "name": "Mobile Payment Success",
  "query": `eapi_method:(PayPalVerifyCloseCheckP4 OR ProcessPaymentP3 OR ProcessPayPalFuturePaymentP4 OR ApplePayCloseCheckP3) AND ("payPalVerifyCloseCheckMobilePay" OR "applePayCloseCheckMobilePay" OR "processPaymentP3MobilePay" OR "payPalFuturePaymentMobilePay") AND NOT eapi_direction:Started AND ("Payment processed successfully" OR "Thank you for your payment")`,
  "view": config.graylogPaymentSearchView
}, {
  "name": "Mobile Payment Failure",
  "query": `eapi_method:(PayPalVerifyCloseCheckP4 OR ProcessPaymentP3 OR ProcessPayPalFuturePaymentP4 OR ApplePayCloseCheckP3) AND ("payPalVerifyCloseCheckMobilePay" OR "applePayCloseCheckMobilePay" OR "processPaymentP3MobilePay" OR "payPalFuturePaymentMobilePay") AND NOT eapi_direction:Started AND NOT ("Payment processed successfully" OR "Thank you for your payment")`,
  "view": config.graylogPaymentSearchView
}, {
  "name": "Total SubmitOrder calls",
  "query": "eapi_method: SubmitOrder AND (NOT eapi_direction: Started)",
  "view": config.graylogSubmitOrderSearchView,
  "groupBy": ["eapi_err_desc"]
}, {
  "name": "Failed Order",
  "query": "eapi_method:SubmitOrder AND (NOT \"Order is submitted successfully.\") AND (NOT eapi_direction:Started)",
  "view": config.graylogFailedOrderSearchView,
  "groupBy": ["eapi_err_desc", "eapi_cor_id", "eapi_customer_id", "eapi_loyalty_id"]
}]

export default queries;
