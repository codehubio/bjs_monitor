import { config } from "../../config";

const queries =[{
  "name": "All EAPI calls",
  "query": "NOT eapi_direction:Started",
  "view": config.graylogNumberView
}, {
  "name": "Total EAPI cronjob", 
  "query":"eapi_ip:undefined AND NOT eapi_direction:Started",
  "view": config.graylogNumberView
}, {
  "name": "EAPI calls by duration > 10 seconds",
  "query":"eapi_duration:>10000",
  "view": config.graylogNumberView
}, {
  "name": "Total successful orders",
  "query": "eapi_method: SubmitOrder AND (NOT eapi_direction: Started)",
  "view": config.graylogNumberView,
  "groupBy": ["eapi_err_desc"]
}, {
  "name": "Total failed orders",
  "query": "eapi_method:SubmitOrder AND (NOT \"Order is submitted successfully.\") AND (NOT eapi_direction:Started)",
  "view": config.graylogNumberView,
}, {
  "name": "Total successful mobile payments",
  "query": `eapi_method:(PayPalVerifyCloseCheckP4 OR ProcessPaymentP3 OR ProcessPayPalFuturePaymentP4 OR ApplePayCloseCheckP3) AND ("payPalVerifyCloseCheckMobilePay" OR "applePayCloseCheckMobilePay" OR "processPaymentP3MobilePay" OR "payPalFuturePaymentMobilePay") AND NOT eapi_direction:Started AND ("Payment processed successfully" OR "Thank you for your payment")`,
  "view": config.graylogNumberView
}, {
  "name": "Total failed mobile payments",
  "query": `eapi_method:(PayPalVerifyCloseCheckP4 OR ProcessPaymentP3 OR ProcessPayPalFuturePaymentP4 OR ApplePayCloseCheckP3) AND ("payPalVerifyCloseCheckMobilePay" OR "applePayCloseCheckMobilePay" OR "processPaymentP3MobilePay" OR "payPalFuturePaymentMobilePay") AND NOT eapi_direction:Started AND NOT ("Payment processed successfully" OR "Thank you for your payment")`,
  "view": config.graylogNumberView
}, {
  "name": "Total success desktop payments",
  "query": 'eapi_method:(PayPalVerifyCloseCheckP4 OR ProcessPaymentP3 OR ProcessPayPalFuturePaymentP4 OR ApplePayCloseCheckP3) AND (NOT ("payPalVerifyCloseCheckMobilePay" OR "applePayCloseCheckMobilePay" OR "processPaymentP3MobilePay" OR "payPalFuturePaymentMobilePay")) AND NOT eapi_direction:Started AND ("Payment processed successfully" OR "Thank you for your payment")',
  "view": config.graylogNumberView,
}, , {
  "name": "Total failed desktop payments",
  "query": 'eapi_method:(PayPalVerifyCloseCheckP4 OR ProcessPaymentP3 OR ProcessPayPalFuturePaymentP4 OR ApplePayCloseCheckP3) AND (NOT ("payPalVerifyCloseCheckMobilePay" OR "applePayCloseCheckMobilePay" OR "processPaymentP3MobilePay" OR "payPalFuturePaymentMobilePay")) AND NOT eapi_direction:Started AND NOT ("Payment processed successfully" OR "Thank you for your payment")',
  "view": config.graylogNumberView,
}]

export default queries;
