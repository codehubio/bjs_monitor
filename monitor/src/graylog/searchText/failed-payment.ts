import { config } from "../../config";

const queries= [{
  "name": "Failure Mobile Payment",
  "query": 'eapi_method:(PayPalVerifyCloseCheckP4 OR ProcessPaymentP3 OR ProcessPayPalFuturePaymentP4 OR ApplePayCloseCheckP3) AND ("payPalVerifyCloseCheckMobilePay" OR "applePayCloseCheckMobilePay" OR "processPaymentP3MobilePay" OR "payPalFuturePaymentMobilePay") AND NOT eapi_direction:Started AND NOT ("Payment processed successfully" OR "Thank you for your payment")',
  "view": config.graylogPaymentSearchView,
  "groupBy": ["eapi_method", "eapi_err_desc", "eapi_result_msg", "eapi_check_number"]
}, {
  "name": "Failure Payment",
  "query": 'eapi_method:(PayPalVerifyCloseCheckP4 OR ProcessPaymentP3 OR ProcessPayPalFuturePaymentP4 OR ApplePayCloseCheckP3) AND (NOT ("payPalVerifyCloseCheckMobilePay" OR "applePayCloseCheckMobilePay" OR "processPaymentP3MobilePay" OR "payPalFuturePaymentMobilePay")) AND NOT eapi_direction:Started AND NOT ("Payment processed successfully" OR "Thank you for your payment")',
  "view": config.graylogPaymentSearchView,
  "groupBy": ["eapi_method", "eapi_err_desc", "eapi_result_msg", "eapi_check_number"]
}];

export default queries;

// , {
//   "name": "Failure ProcessPaymentP4",
//   "query": 'eapi_direction:Started AND (eapi_method:(ProcessPaymentP3 OR ApplePayCloseCheckP3 OR PayPalVerifyCloseCheckP4 OR ProcessPayPalFuturePaymentP4))'
// }