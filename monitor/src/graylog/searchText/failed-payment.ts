import { config } from "../../config";
const groupOfCorrectMessage = `("Credit Card is declined, please correct your payment information and try again." OR "Payment cannot be processed at this time. Please try again later." OR "We apologize, there is an error processing your payment. Please correct your payment information and try again." OR "We apologize, it looks like we are experiencing difficulties with your payment methods. Please contact restaurant for help.")`;
const queries= [{
  "name": "Failure Mobile Payment With Correct Message",
  "query": `${groupOfCorrectMessage} AND eapi_method:(PayPalVerifyCloseCheckP4 OR ProcessPaymentP3 OR ProcessPayPalFuturePaymentP4 OR ApplePayCloseCheckP3) AND ("payPalVerifyCloseCheckMobilePay" OR "applePayCloseCheckMobilePay" OR "processPaymentP3MobilePay" OR "payPalFuturePaymentMobilePay") AND NOT eapi_direction:Started AND NOT ("Payment processed successfully" OR "Thank you for your payment")'`,
  "view": config.graylogPaymentSearchView,
  "groupBy": ["eapi_method", "eapi_err_desc", "eapi_result_msg", "eapi_check_number"]
}, {
  "name": "Failure Mobile Payment With Incorrect Message",
  "query": `(NOT ${groupOfCorrectMessage}) AND eapi_method:(PayPalVerifyCloseCheckP4 OR ProcessPaymentP3 OR ProcessPayPalFuturePaymentP4 OR ApplePayCloseCheckP3) AND ("payPalVerifyCloseCheckMobilePay" OR "applePayCloseCheckMobilePay" OR "processPaymentP3MobilePay" OR "payPalFuturePaymentMobilePay") AND NOT eapi_direction:Started AND NOT ("Payment processed successfully" OR "Thank you for your payment")`,
  "view": config.graylogPaymentSearchView,
  "groupBy": ["eapi_method", "eapi_err_desc", "eapi_result_msg", "eapi_check_number"]
}, {
  "name": "Failure BJS Online Payment With Correct Message",
  "query": `${groupOfCorrectMessage} AND eapi_method:(PayPalVerifyCloseCheckP4 OR ProcessPaymentP3 OR ProcessPayPalFuturePaymentP4 OR ApplePayCloseCheckP3) AND (NOT ("payPalVerifyCloseCheckMobilePay" OR "applePayCloseCheckMobilePay" OR "processPaymentP3MobilePay" OR "payPalFuturePaymentMobilePay")) AND NOT eapi_direction:Started AND NOT ("Payment processed successfully" OR "Thank you for your payment")'`,
  "view": config.graylogPaymentSearchView,
  "groupBy": ["eapi_method", "eapi_err_desc", "eapi_result_msg", "eapi_check_number"]
}, {
  "name": "Failure BJS Online Payment With Incorrect Message",
  "query": `(NOT ${groupOfCorrectMessage}) AND eapi_method:(PayPalVerifyCloseCheckP4 OR ProcessPaymentP3 OR ProcessPayPalFuturePaymentP4 OR ApplePayCloseCheckP3) AND (NOT ("payPalVerifyCloseCheckMobilePay" OR "applePayCloseCheckMobilePay" OR "processPaymentP3MobilePay" OR "payPalFuturePaymentMobilePay")) AND NOT eapi_direction:Started AND NOT ("Payment processed successfully" OR "Thank you for your payment")`,
  "view": config.graylogPaymentSearchView,
  "groupBy": ["eapi_method", "eapi_err_desc", "eapi_result_msg", "eapi_check_number"]
}];

export default queries;

// , {
//   "name": "Failure ProcessPaymentP4",
//   "query": 'eapi_direction:Started AND (eapi_method:(ProcessPaymentP3 OR ApplePayCloseCheckP3 OR PayPalVerifyCloseCheckP4 OR ProcessPayPalFuturePaymentP4))'
// }